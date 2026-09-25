/**
 * Phuket GPS Producer — polls the live upstream tracker and feeds
 * `ingestBatchGps` so the operator console sees real hardware state.
 *
 * Architecture
 * - Browser hits `/api/vehicles/last` (Cloudflare Pages Function in
 *   `functions/api/vehicles/last.ts`). The Function proxies the
 *   official Phuket Smart Bus tracker keylessly and resolves CORS.
 * - Upstream returns ~20 buses. Each row carries a license plate,
 *   a fresh lat/lon (or parked at the depot), and a `data` JSON
 *   string with the full GPS payload — speed, heading, satellites,
 *   GPS timestamp.
 * - We normalise each row into the engine's `LiveGpsPing` shape and
 *   call `ingestBatchGps` once per poll, which both seeds the
 *   `getLiveTelemetryVehicles` map AND records into the efficiency
 *   ledger.
 *
 * The producer has to be resilient: the upstream is flaky (the depot
 * returns 200 with stale data, mid-route returns vary), so every
 * poll is independent — a single failure never breaks the loop.
 */

import type { LiveGpsPing } from "./liveGpsReceiver";
import { ingestBatchGps } from "./liveGpsReceiver";

interface RawVehicleRow {
  /** License plate in Thai format — e.g. "10-1230ภูเก็ต". */
  licence?: string;
  /** Latitude as a string with up to 6 decimal places. */
  lat?: string;
  /** Longitude as a string with up to 6 decimal places. */
  lon?: string;
  /** Speed (km/h) as a string. "0" when parked at the depot. */
  speed?: string;
  /** Full GPS payload serialised as a JSON string. */
  data?: string;
}

interface RawGpsPayload {
  /** Heading / bearing in degrees (0–359). */
  HangXiang?: number;
  /** GPS fix timestamp, ISO 8601, BKK local. */
  GPSTime?: string;
  /** Number of satellites in view at the time of the fix. */
  Satellites?: number;
  /** Current passenger count from the APC sensor. */
  PeopleCur?: number;
}

/** Result of normalising one upstream row into our ingest shape. */
export interface NormalisedVehicle {
  ping: LiveGpsPing;
  /** True iff the row had a usable lat/lon AND a fresh-enough GPS time. */
  usable: boolean;
}

/**
 * Normalise a single upstream row into a LiveGpsPing.
 *
 * Pure function — no network, no module-level state. The producer
 * loop calls this once per row and discards the result if `usable`
 * is false (which only happens if lat/lon are missing or the GPS
 * timestamp is unparseable).
 */
export function normalisePhuketGpsRow(raw: RawVehicleRow, now = Date.now()): NormalisedVehicle {
  const plate = (raw.licence ?? "").trim();
  if (!plate) return { ping: { vehicleId: "", coordinates: [0, 0], speedKph: 0 }, usable: false };

  const lat = Number(raw.lat);
  const lon = Number(raw.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || (lat === 0 && lon === 0)) {
    return { ping: { vehicleId: plate, coordinates: [0, 0], speedKph: 0 }, usable: false };
  }

  let inner: RawGpsPayload = {};
  if (typeof raw.data === "string" && raw.data.length > 0) {
    try {
      inner = JSON.parse(raw.data) as RawGpsPayload;
    } catch {
      // Upstream sometimes sends an unterminated JSON string for
      // buses in the middle of a firmware update. Don't crash the
      // poll — just skip the inner payload.
    }
  }

  const speed = Math.max(0, Number(raw.speed ?? inner.PeopleCur != null ? raw.speed : "0") || 0);
  const heading = Number.isFinite(inner.HangXiang) ? Number(inner.HangXiang) : 0;
  const satellites = Number.isFinite(inner.Satellites) ? Number(inner.Satellites) : undefined;
  const paxCount = Number.isFinite(inner.PeopleCur) ? Number(inner.PeopleCur) : undefined;
  // GPS time from upstream is the device's reported timestamp. If
  // it's missing or unparseable, fall back to "now" so the freshness
  // window still works.
  let timestamp: string;
  if (inner.GPSTime) {
    const parsed = Date.parse(inner.GPSTime);
    timestamp = Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date(now).toISOString();
  } else {
    timestamp = new Date(now).toISOString();
  }

  const ping: LiveGpsPing = {
    vehicleId: plate,
    licensePlate: plate,
    coordinates: [lat, lon],
    speedKph: speed,
    heading,
    timestamp,
    routeId: "rawai-airport",
    destinationHint: speed > 4 ? "Rawai Beach" : "Phuket Airport",
    accuracyMeters: undefined,
    satellites,
    paxCount,
  };

  return { ping, usable: true };
}

/** Shape of one upstream row. */
export type PhuketUpstreamRow = RawVehicleRow;

/** Shape of the upstream JSON response. */
export interface PhuketUpstreamResponse {
  rows: RawVehicleRow[];
  fetchedAt: number;
  fetchDurationMs: number;
  error?: string;
}

export interface PhuketProducerState {
  /** True between start and stop calls. */
  running: boolean;
  /** Last successful poll's UTC ms timestamp. Null until the first hit. */
  lastSuccessAt: number | null;
  /** Total polls attempted since start. */
  pollCount: number;
  /** Successful polls since start. */
  successCount: number;
  /** Last error message (cleared on next success). */
  lastError: string | null;
}

const STATE: PhuketProducerState = {
  running: false,
  lastSuccessAt: null,
  pollCount: 0,
  successCount: 0,
  lastError: null,
};

/** Read-only snapshot of the producer's runtime state for the UI. */
export function getPhuketProducerState(): Readonly<PhuketProducerState> {
  return { ...STATE };
}

/**
 * Poll the live upstream once and ingest whatever comes back.
 * Pure side-effects on the telemetry map + efficiency ledger.
 */
export async function pollPhuketGpsOnce(signal?: AbortSignal): Promise<PhuketUpstreamResponse> {
  STATE.pollCount++;
  const startedAt = Date.now();
  try {
    const res = await fetch("/api/vehicles/last", {
      method: "GET",
      signal: signal ?? AbortSignal.timeout(8000),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      STATE.lastError = `Upstream HTTP ${res.status}`;
      return { rows: [], fetchedAt: Date.now(), fetchDurationMs: Date.now() - startedAt, error: STATE.lastError };
    }
    const json = (await res.json()) as unknown;
    const rawRows = Array.isArray(json) ? (json as RawVehicleRow[]) : extractRows(json);
    const now = Date.now();
    const normalised = rawRows
      .map((r) => normalisePhuketGpsRow(r, now))
      .filter((n): n is { ping: LiveGpsPing; usable: true } => n.usable);
    if (normalised.length > 0) {
      ingestBatchGps(normalised.map((n) => n.ping));
    }
    STATE.successCount++;
    STATE.lastSuccessAt = Date.now();
    STATE.lastError = null;
    return {
      rows: rawRows,
      fetchedAt: STATE.lastSuccessAt,
      fetchDurationMs: STATE.lastSuccessAt - startedAt,
    };
  } catch (err) {
    STATE.lastError = err instanceof Error ? err.message : String(err);
    return { rows: [], fetchedAt: Date.now(), fetchDurationMs: Date.now() - startedAt, error: STATE.lastError };
  }
}

/**
 * Some upstream responses nest the rows under a key like `{ data: [...] }`
 * or `{ vehicles: [...] }`. Try a couple of shapes before giving up.
 */
function extractRows(json: unknown): RawVehicleRow[] {
  if (!json || typeof json !== "object") return [];
  const obj = json as Record<string, unknown>;
  for (const key of ["data", "vehicles", "rows", "result"]) {
    const v = obj[key];
    if (Array.isArray(v)) return v as RawVehicleRow[];
  }
  return [];
}

let pollTimer: number | null = null;

/**
 * Start the polling producer. Idempotent — calling start twice is a
 * no-op. Polls every 30 s by default; pass a shorter interval for
 * debugging.
 *
 * On the operator wall screen this is the always-on telemetry feed
 * that the engine has been ready to receive since the original GPS
 * ingest path shipped.
 */
export function startPhuketGpsProducer(intervalMs = 30_000): () => void {
  if (typeof window === "undefined") return () => {};
  if (STATE.running) return stopPhuketGpsProducer;

  STATE.running = true;
  STATE.lastError = null;

  // First poll immediately so the operator sees pax within a second of
  // opening the console, then settle into the cadence.
  void pollPhuketGpsOnce();

  pollTimer = window.setInterval(() => {
    void pollPhuketGpsOnce();
  }, intervalMs);

  return stopPhuketGpsProducer;
}

/** Stop the producer. Safe to call multiple times. */
export function stopPhuketGpsProducer(): void {
  if (pollTimer !== null && typeof window !== "undefined") {
    window.clearInterval(pollTimer);
    pollTimer = null;
  }
  STATE.running = false;
}
