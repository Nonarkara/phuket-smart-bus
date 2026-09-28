import type { OperationalRouteId } from "./types.js";

/**
 * Phuket Smart Bus live trackers. One parser module, used by the Cloudflare
 * edge relay (functions/api/live-buses.ts) and the Express server.
 *
 * KEYLESS (primary): po-smartbus.phuket.cloud/vehicles/last — the public
 *   tracker's own backend. No token; wants a smartbus.phuket.cloud Referer.
 *   Rows carry plate, lat/lon, speed and a JSON-string payload with heading,
 *   GPS time, satellites and PeopleCur (on-board count from the APC sensor).
 *   No route, no destination: the ledger infers both from geometry.
 * TOKEN (optional enrichment): smartbus-pk-api.phuket.cloud/api/bus-news-2/
 *   — adds line + destination text when SMARTBUS_BEARER_TOKEN is set.
 */
export const PKSB_KEYLESS_URL = "https://po-smartbus.phuket.cloud/vehicles/last";
export const PKSB_KEYLESS_HEADERS: Record<string, string> = {
  accept: "application/json",
  referer: "https://smartbus.phuket.cloud/",
  origin: "https://smartbus.phuket.cloud",
  "user-agent": "Mozilla/5.0 (compatible; PhuketSmartBusOps/1.0; +https://bus.nonarkara.org/ops)",
};
export const PKSB_FEED_URL = "https://smartbus-pk-api.phuket.cloud/api/bus-news-2/";

export type PksbRawRecord = {
  id: number;
  licence: string;
  date: string;
  buffer: string;
  data: {
    azm: number;
    /** [lng, lat] — note the order. */
    pos: [number, number];
    spd: number;
    time: string;
    buffer: string;
    /** [sentence, metres, destination, metres-to-destination, stops-away] or a bare string. */
    determineBusDirection: string | [string, number | string, string, number | string, number | string];
    vhc: { id: string; lc: string };
  };
};

/** One row of the keyless tracker. Every field arrives as a string. */
export type KeylessRawRow = {
  licence?: string;
  lat?: string | number;
  lon?: string | number;
  speed?: string | number;
  /** JSON string: { HangXiang, GPSTime, Satellites, PeopleCur, … } */
  data?: string;
};

/** Line served by a real bus. Only land lines appear in the tracker. */
export type LiveBusRouteId = Extract<OperationalRouteId, "rawai-airport" | "patong-old-bus-station" | "dragon-line">;

export type LiveBus = {
  id: string;
  /** Canonical plate, e.g. "10-1230" (province suffix dropped). The join key. */
  plate: string;
  vehicleId: string;
  lat: number;
  lng: number;
  heading: number;
  speedKph: number;
  /** Null when the feed doesn't say — the ledger infers it from geometry. */
  routeId: LiveBusRouteId | null;
  /** Tracker's destination text when it has one ("Rawai", "Patong"…), else "". */
  destination: string;
  /** On-board count from the bus's passenger counter, when it reports one. */
  paxOnBoard: number | null;
  /** When the device took the fix (ISO, UTC). */
  updatedAt: string;
};

export type LiveBusFeedStatus = "live" | "upstream_error";

export type LiveBusFeed = {
  status: LiveBusFeedStatus;
  fetchedAt: string;
  source: "pksb-tracker";
  vehicles: LiveBus[];
  /** Which upstreams answered this time. */
  sources?: { keyless: boolean; token: boolean };
  detail?: string;
};

// Phuket island plus a margin. A [0,0] or off-island fix is a device glitch,
// never a bus — dropping it keeps a phantom marker out of the Gulf of Guinea.
const BBOX = { minLat: 7.4, maxLat: 8.4, minLng: 98.0, maxLng: 98.7 };
export function isOnPhuketIsland(lat: number, lng: number): boolean {
  return lat >= BBOX.minLat && lat <= BBOX.maxLat && lng >= BBOX.minLng && lng <= BBOX.maxLng;
}
const inPhuket = isOnPhuketIsland;

/** "10-1230ภูเก็ต", "10-1230 ภูเก็ต", "10-1230" → "10-1230". */
export function plateKey(raw: string): string {
  const match = raw.match(/\d{1,3}-\d{3,4}/);
  return match ? match[0] : raw.replace(/\s+/g, "").trim();
}

export function inferPksbRoute(record: PksbRawRecord): LiveBusRouteId | null {
  const direction = record.data?.determineBusDirection;
  const hint = [record.buffer, record.data?.buffer, Array.isArray(direction) ? direction[2] : ""]
    .join(" ")
    .toLowerCase();
  if (hint.includes("dragon")) return "dragon-line";
  if (hint.includes("rawai") || hint.includes("airport")) return "rawai-airport";
  if (hint.includes("patong") || hint.includes("terminal")) return "patong-old-bus-station";
  return null;
}

const ZONE_SUFFIX = /(Z|[+-]\d{2}:?\d{2})$/i;

/**
 * The trackers send naive timestamps ("2026-03-08T14:26:48.588467") with no
 * zone. A browser would read that as ITS OWN local time, so a viewer abroad
 * would see every bus hours stale. Resolve it here, once: a live GPS fix is
 * minutes old, so of the two plausible readings (UTC, Bangkok +07:00) the one
 * nearest `nowMs` is right — they sit 7 h apart, never ambiguous. Fractions
 * are trimmed to milliseconds (6-digit microseconds trip some parsers).
 */
export function normalizeTrackerTime(raw: string | undefined | null, nowMs: number): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim().replace(" ", "T").replace(/(\.\d{3})\d+/, "$1");
  if (ZONE_SUFFIX.test(trimmed)) {
    const t = Date.parse(trimmed);
    return Number.isFinite(t) ? new Date(t).toISOString() : null;
  }
  const candidates = [Date.parse(`${trimmed}Z`), Date.parse(`${trimmed}+07:00`)].filter(Number.isFinite);
  if (candidates.length === 0) return null;
  const best = candidates.reduce((a, b) => (Math.abs(a - nowMs) <= Math.abs(b - nowMs) ? a : b));
  return new Date(best).toISOString();
}

function finiteOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// ── token feed (bus-news-2) ────────────────────────────────────────────────
export function parsePksbRecord(record: PksbRawRecord, nowMs = Date.now()): LiveBus | null {
  if (!record?.data?.pos || !Array.isArray(record.data.pos)) return null;
  const lng = Number(record.data.pos[0]);
  const lat = Number(record.data.pos[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !inPhuket(lat, lng)) return null;

  const direction = record.data.determineBusDirection;
  const destination = String((Array.isArray(direction) ? direction[2] : "") || record.data.buffer || record.buffer || "").trim();
  const rawPlate = record.data.vhc?.lc || record.licence || String(record.id);
  const updatedAt = normalizeTrackerTime(record.data.time, nowMs) ?? normalizeTrackerTime(record.date, nowMs);
  if (!updatedAt) return null; // a fix with no usable time can't be called live

  return {
    id: String(record.id),
    plate: plateKey(rawPlate),
    vehicleId: record.data.vhc?.id || rawPlate,
    lat,
    lng,
    heading: finiteOrNull(record.data.azm) ?? 0,
    speedKph: Math.max(0, finiteOrNull(record.data.spd) ?? 0),
    routeId: inferPksbRoute(record),
    destination,
    paxOnBoard: null,
    updatedAt,
  };
}

/** Defensive: the upstream is a third party; anything unparseable is dropped, never thrown. */
export function parsePksbFeed(json: unknown, nowMs = Date.now()): LiveBus[] {
  return parseRows(json, ["results"], (row) => parsePksbRecord(row as PksbRawRecord, nowMs));
}

// ── keyless feed (vehicles/last) ───────────────────────────────────────────
export function parseKeylessRow(row: KeylessRawRow, nowMs = Date.now()): LiveBus | null {
  const rawPlate = String(row?.licence ?? "").trim();
  if (!rawPlate) return null;
  const lat = Number(row.lat);
  const lng = Number(row.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !inPhuket(lat, lng)) return null;

  let inner: { HangXiang?: unknown; GPSTime?: unknown; PeopleCur?: unknown } = {};
  if (typeof row.data === "string" && row.data.length > 0) {
    try {
      inner = JSON.parse(row.data) as typeof inner;
    } catch {
      // Mid-firmware-update rows arrive with truncated JSON: keep the position.
    }
  }

  // Some real rows omit GPSTime (seen on the live feed): the relay's fetch time
  // stands in, so those buses stay visible rather than vanishing.
  const updatedAt = normalizeTrackerTime(typeof inner.GPSTime === "string" ? inner.GPSTime : null, nowMs)
    ?? new Date(nowMs).toISOString();
  const pax = finiteOrNull(inner.PeopleCur);

  return {
    id: plateKey(rawPlate),
    plate: plateKey(rawPlate),
    vehicleId: rawPlate,
    lat,
    lng,
    heading: finiteOrNull(inner.HangXiang) ?? 0,
    speedKph: Math.max(0, finiteOrNull(row.speed) ?? 0),
    routeId: null,
    destination: "",
    paxOnBoard: pax !== null && pax >= 0 && pax <= 120 ? Math.round(pax) : null,
    updatedAt,
  };
}

export function parseKeylessFeed(json: unknown, nowMs = Date.now()): LiveBus[] {
  return parseRows(json, ["data", "vehicles", "rows", "result"], (row) => parseKeylessRow(row as KeylessRawRow, nowMs));
}

function parseRows(json: unknown, wrapperKeys: string[], parse: (row: unknown) => LiveBus | null): LiveBus[] {
  let rows: unknown[] = [];
  if (Array.isArray(json)) rows = json;
  else if (json && typeof json === "object") {
    for (const key of wrapperKeys) {
      const value = (json as Record<string, unknown>)[key];
      if (Array.isArray(value)) { rows = value; break; }
    }
  }
  const out: LiveBus[] = [];
  for (const row of rows) {
    try {
      const bus = parse(row);
      if (bus) out.push(bus);
    } catch {
      // skip malformed row
    }
  }
  return out;
}

/**
 * Keyless rows are the position truth (and carry the passenger counter);
 * token rows add line + destination for the same plate. A bus only the token
 * feed knows is kept too.
 */
export function mergeLiveFeeds(keyless: LiveBus[], token: LiveBus[]): LiveBus[] {
  const labels = new Map(token.map((bus) => [bus.plate, bus]));
  const merged = keyless.map((bus) => {
    const label = labels.get(bus.plate);
    labels.delete(bus.plate);
    return label ? { ...bus, routeId: label.routeId ?? bus.routeId, destination: label.destination || bus.destination } : bus;
  });
  return [...merged, ...labels.values()];
}
