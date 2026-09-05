/**
 * Live GPS Telemetry Ingest & Receiver Engine
 *
 * Designed to make the system "ready to work right away" if real GPS signals
 * arrive from buses. Handles:
 * 1. Direct GPS ping ingestion (REST API, WebSocket, Webhook, window message)
 * 2. Deduplication and signal freshness tracking (<60s fresh, 60-120s stale, >120s fallback)
 * 3. Graceful fallback to timetable simulation per-vehicle if GPS is lost
 * 4. Browser global bridge (window.__PKSB_INGEST_GPS__) for field testing & mobile trackers
 * 5. Built-in telemetry health monitor & simulated GPS burst generator for operator demos
 */

import type { LatLngTuple, OperationalRouteId, TelemetrySource, VehiclePosition } from "@shared/types";
import { text } from "./i18n";

export interface LiveGpsPing {
  vehicleId: string;
  coordinates: LatLngTuple; // [lat, lng]
  speedKph: number;
  heading?: number;
  licensePlate?: string;
  routeId?: OperationalRouteId;
  timestamp?: string | number;
  accuracyMeters?: number;
  altitudeMeters?: number;
  satellites?: number;
  batteryPct?: number;
  paxCount?: number;
  driverName?: string;
  destinationHint?: string;
}

export interface TelemetryHealthStatus {
  mode: "auto" | "live_only" | "sim_only";
  active: boolean;
  liveCount: number;
  totalConfigured: number;
  lastPingTime: string | null;
  latencyMs: number | null;
  sources: Record<string, TelemetrySource>;
  feedUrl: string | null;
}

// In-memory telemetry cache
const liveTelemetryMap = new Map<string, { ping: LiveGpsPing; receivedAt: number }>();
let telemetryMode: "auto" | "live_only" | "sim_only" = "auto";
let activeFeedUrl: string | null = null;
let pollTimer: number | null = null;
let testStreamTimer: number | null = null;

// Telemetry freshness boundaries
const FRESH_WINDOW_MS = 60_000;  // < 60s is fresh
const STALE_WINDOW_MS = 120_000; // 60s–120s is stale but shown; >120s falls back to schedule

// Normalized vehicle matching helper (matches "1001", "กข 1001", "pksb-1001")
export function normalizeVehicleKey(idOrPlate: string): string {
  const digits = idOrPlate.replace(/\D/g, "");
  if (digits.length >= 4) {
    return digits.slice(-4);
  }
  return idOrPlate.trim().toLowerCase();
}

/**
 * Ingest a single raw GPS packet from a bus device or gateway.
 */
export function ingestGpsPing(ping: LiveGpsPing): void {
  if (!ping || !Array.isArray(ping.coordinates) || ping.coordinates.length !== 2) {
    return;
  }
  const [lat, lng] = ping.coordinates;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

  const key = normalizeVehicleKey(ping.vehicleId || ping.licensePlate || "");
  if (!key) return;

  const now = Date.now();
  const pingTimestampMs =
    typeof ping.timestamp === "number"
      ? ping.timestamp
      : typeof ping.timestamp === "string"
        ? (Date.parse(ping.timestamp) || now)
        : now;
  const receivedAt = pingTimestampMs;

  liveTelemetryMap.set(key, {
    ping: {
      ...ping,
      heading: ping.heading ?? 0,
      speedKph: Math.max(0, ping.speedKph ?? 0),
      timestamp: ping.timestamp ?? new Date(now).toISOString(),
    },
    receivedAt,
  });

  // Notify listeners via custom event in browser environments
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("pksb:telemetry-update", { detail: { key, ping } }));
  }
}

/**
 * Ingest an array of GPS packets (e.g. from an API response or gateway push).
 */
export function ingestBatchGps(records: LiveGpsPing[]): void {
  if (!Array.isArray(records)) return;
  for (const record of records) {
    ingestGpsPing(record);
  }
}

/**
 * Retrieve the current map of live vehicle positions.
 * Automatically computes status ("moving" | "dwelling"), freshness, and coordinates.
 */
export function getLiveTelemetryVehicles(now = Date.now()): Map<string, VehiclePosition> {
  const result = new Map<string, VehiclePosition>();
  if (telemetryMode === "sim_only") {
    return result;
  }

  for (const [key, { ping, receivedAt }] of liveTelemetryMap.entries()) {
    const ageMs = now - receivedAt;
    // Beyond stale window in auto mode -> fall back to simulation
    if (telemetryMode === "auto" && ageMs > STALE_WINDOW_MS) {
      continue;
    }

    const isFresh = ageMs < FRESH_WINDOW_MS;
    const routeId: OperationalRouteId = ping.routeId ?? "rawai-airport";
    const status = ping.speedKph > 4 ? "moving" : ping.speedKph === 0 ? "dwelling" : "unknown";

    const vPos: VehiclePosition = {
      id: `gps-${key}`,
      routeId,
      licensePlate: ping.licensePlate || `กข ${key}`,
      vehicleId: key,
      deviceId: `gps-device-${key}`,
      coordinates: ping.coordinates,
      heading: ping.heading ?? 0,
      speedKph: Math.round(ping.speedKph),
      destination: text(ping.destinationHint || "Rawai Beach", ping.destinationHint || "หาดราไวย์"),
      updatedAt: typeof ping.timestamp === "string" ? ping.timestamp : new Date(receivedAt).toISOString(),
      telemetrySource: "direct_gps",
      freshness: isFresh ? "fresh" : "stale",
      status,
      distanceToDestinationMeters: null,
      stopsAway: null,
      polylineMeters: null,
      polylineFirstStop: null,
    };

    result.set(key, vPos);
  }

  return result;
}

/**
 * Check if live GPS signals are actively streaming right now.
 */
export function isLiveGpsActive(now = Date.now()): boolean {
  if (telemetryMode === "sim_only") return false;
  let activeCount = 0;
  for (const { receivedAt } of liveTelemetryMap.values()) {
    if (now - receivedAt < STALE_WINDOW_MS) {
      activeCount++;
    }
  }
  return activeCount > 0;
}

/**
 * Comprehensive telemetry health summary for UI indicators and audits.
 */
export function getTelemetryHealth(now = Date.now()): TelemetryHealthStatus {
  let liveCount = 0;
  let latestPingMs: number | null = null;
  const sources: Record<string, TelemetrySource> = {};

  for (const [key, { receivedAt }] of liveTelemetryMap.entries()) {
    const age = now - receivedAt;
    if (age < STALE_WINDOW_MS) {
      liveCount++;
      sources[key] = "direct_gps";
      if (!latestPingMs || receivedAt > latestPingMs) {
        latestPingMs = receivedAt;
      }
    }
  }

  const latencyMs = latestPingMs ? Math.max(0, now - latestPingMs) : null;

  return {
    mode: telemetryMode,
    active: liveCount > 0 && telemetryMode !== "sim_only",
    liveCount,
    totalConfigured: 20, // Phuket fleet size
    lastPingTime: latestPingMs ? new Date(latestPingMs).toISOString() : null,
    latencyMs,
    sources,
    feedUrl: activeFeedUrl,
  };
}

/**
 * Configure telemetry mode.
 */
export function setTelemetryMode(mode: "auto" | "live_only" | "sim_only"): void {
  telemetryMode = mode;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("pksb:telemetry-mode-change", { detail: { mode } }));
  }
}

/**
 * Clear all current telemetry in memory.
 */
export function clearTelemetry(): void {
  liveTelemetryMap.clear();
}

/**
 * Start periodic polling of a REST API endpoint serving live vehicle positions.
 */
export function startTelemetryPolling(feedUrl = "/api/vehicles/all", intervalMs = 5000): () => void {
  if (pollTimer !== null && typeof window !== "undefined") {
    window.clearInterval(pollTimer);
    pollTimer = null;
  }
  activeFeedUrl = feedUrl;

  const poll = async () => {
    try {
      const res = await fetch(feedUrl, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) return;
      const data = (await res.json()) as { vehicles?: Array<{
        vehicleId: string;
        licensePlate?: string;
        coordinates: LatLngTuple;
        speedKph?: number;
        heading?: number;
        routeId?: OperationalRouteId;
        updatedAt?: string;
      }> };

      if (data?.vehicles && Array.isArray(data.vehicles)) {
        for (const v of data.vehicles) {
          ingestGpsPing({
            vehicleId: v.vehicleId,
            licensePlate: v.licensePlate,
            coordinates: v.coordinates,
            speedKph: v.speedKph ?? 0,
            heading: v.heading ?? 0,
            routeId: v.routeId,
            timestamp: v.updatedAt,
          });
        }
      }
    } catch {
      // Backend not running or offline -> timetable simulation will smoothly carry on
    }
  };

  void poll();
  if (typeof window !== "undefined") {
    pollTimer = window.setInterval(poll, intervalMs);
  }

  return () => {
    if (pollTimer !== null && typeof window !== "undefined") {
      window.clearInterval(pollTimer);
      pollTimer = null;
    }
  };
}

// ---------------------------------------------------------------------------
// Simulated Live GPS burst generator (for field tests, operator QA & demos)
// ---------------------------------------------------------------------------

const PHUKET_WAYPOINTS: LatLngTuple[] = [
  [8.108, 98.307], // Airport
  [8.048, 98.304], // Thalang
  [7.989, 98.281], // Bang Tao
  [7.978, 98.280], // Surin Beach
  [7.954, 98.284], // Kamala
  [7.896, 98.297], // Patong Beach
  [7.834, 98.297], // Karon
  [7.821, 98.301], // Kata
  [7.778, 98.324], // Rawai Beach
];

/**
 * Simulates a burst of real GPS packets for the 10 Airport Line buses.
 * Allows anyone to immediately verify that the map switches to LIVE GPS mode.
 */
export function simulateLiveGpsBurst(): void {
  const plates = [
    "กข 1001", "กข 1002", "กข 1003", "กข 1004", "กข 1005",
    "กข 1006", "กข 1007", "กข 1008", "กข 1009", "กข 1010",
  ];

  plates.forEach((plate, i) => {
    const wpIdx = i % PHUKET_WAYPOINTS.length;
    const baseWp = PHUKET_WAYPOINTS[wpIdx]!;
    // Jitter by ~50 meters
    const lat = baseWp[0] + (Math.random() - 0.5) * 0.003;
    const lng = baseWp[1] + (Math.random() - 0.5) * 0.003;
    const speed = 25 + Math.floor(Math.random() * 20);
    const heading = (wpIdx * 40) % 360;

    ingestGpsPing({
      vehicleId: String(1001 + i),
      licensePlate: plate,
      coordinates: [lat, lng],
      speedKph: speed,
      heading,
      routeId: "rawai-airport",
      accuracyMeters: 3.5,
      satellites: 14,
      batteryPct: 98,
      driverName: `Driver ${i + 1}`,
      destinationHint: i % 2 === 0 ? "Rawai Beach" : "Phuket Airport",
    });
  });
}

/**
 * Toggle an ongoing simulated live GPS stream (pulses every 2 seconds).
 */
export function toggleSimulatedGpsStream(active?: boolean): boolean {
  const shouldEnable = active ?? testStreamTimer === null;
  if (testStreamTimer !== null && typeof window !== "undefined") {
    window.clearInterval(testStreamTimer);
    testStreamTimer = null;
  }

  if (shouldEnable) {
    simulateLiveGpsBurst();
    if (typeof window !== "undefined") {
      testStreamTimer = window.setInterval(simulateLiveGpsBurst, 2000);
    }
    return true;
  }
  return false;
}

// Attach browser bridge on module load
if (typeof window !== "undefined") {
  (window as unknown as { __PKSB_INGEST_GPS__: typeof ingestGpsPing }).__PKSB_INGEST_GPS__ = ingestGpsPing;
  (window as unknown as { __PKSB_INGEST_BATCH__: typeof ingestBatchGps }).__PKSB_INGEST_BATCH__ = ingestBatchGps;
  (window as unknown as { __PKSB_SIMULATE_GPS__: typeof simulateLiveGpsBurst }).__PKSB_SIMULATE_GPS__ = simulateLiveGpsBurst;

  window.addEventListener("message", (event: MessageEvent) => {
    if (event?.data?.type === "PKSB_GPS_PING" && event.data.ping) {
      ingestGpsPing(event.data.ping as LiveGpsPing);
    }
  });
}
