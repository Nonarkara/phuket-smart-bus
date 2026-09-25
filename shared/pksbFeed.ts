import type { OperationalRouteId } from "./types.js";

/**
 * The PKSB public tracker feed (smartbus-pk-api.phuket.cloud/api/bus-news-2/),
 * the same data behind phuketsmartbus.com/th/tracking. One parser, used by the
 * Cloudflare edge relay (functions/api/live-buses.ts) and the Express server.
 */
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

/** Line served by a real bus. Only land lines appear in the tracker. */
export type LiveBusRouteId = Extract<OperationalRouteId, "rawai-airport" | "patong-old-bus-station" | "dragon-line">;

export type LiveBus = {
  id: string;
  plate: string;
  vehicleId: string;
  lat: number;
  lng: number;
  heading: number;
  speedKph: number;
  routeId: LiveBusRouteId;
  /** Where the bus is heading, as the tracker names it ("Rawai", "Airport", "Patong"…). */
  destination: string;
  directionText: string | null;
  distanceToDestinationM: number | null;
  /** When the device took the fix (ISO). */
  updatedAt: string;
};

export type LiveBusFeedStatus = "live" | "unconfigured" | "upstream_error";

export type LiveBusFeed = {
  status: LiveBusFeedStatus;
  fetchedAt: string;
  source: "pksb-tracker";
  vehicles: LiveBus[];
  detail?: string;
};

// Phuket island plus a margin. A [0,0] or off-island fix is a device glitch,
// never a bus — dropping it keeps a phantom marker out of the Gulf of Guinea.
const BBOX = { minLat: 7.4, maxLat: 8.4, minLng: 98.0, maxLng: 98.7 };

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
 * The tracker sends naive timestamps ("2026-03-08T14:26:48.588467") with no
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
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function parsePksbRecord(record: PksbRawRecord, nowMs = Date.now()): LiveBus | null {
  if (!record?.data?.pos || !Array.isArray(record.data.pos)) return null;
  const routeId = inferPksbRoute(record);
  if (!routeId) return null;

  const lng = Number(record.data.pos[0]);
  const lat = Number(record.data.pos[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < BBOX.minLat || lat > BBOX.maxLat || lng < BBOX.minLng || lng > BBOX.maxLng) return null;

  const direction = record.data.determineBusDirection;
  const isArray = Array.isArray(direction);
  const destination = String((isArray ? direction[2] : "") || record.data.buffer || record.buffer || "").trim();
  const plate = record.data.vhc?.lc || record.licence || String(record.id);
  const updatedAt = normalizeTrackerTime(record.data.time, nowMs) ?? normalizeTrackerTime(record.date, nowMs);
  if (!updatedAt) return null; // a fix with no usable time can't be called live

  return {
    id: String(record.id),
    plate,
    vehicleId: record.data.vhc?.id || plate,
    lat,
    lng,
    heading: finiteOrNull(record.data.azm) ?? 0,
    speedKph: Math.max(0, finiteOrNull(record.data.spd) ?? 0),
    routeId,
    destination,
    directionText: isArray ? String(direction[0]) : typeof direction === "string" ? direction : null,
    distanceToDestinationM: isArray ? finiteOrNull(direction[3]) : null,
    updatedAt,
  };
}

/** Defensive: the upstream is a third party; anything unparseable is dropped, never thrown. */
export function parsePksbFeed(json: unknown, nowMs = Date.now()): LiveBus[] {
  const rows = Array.isArray(json)
    ? json
    : Array.isArray((json as { results?: unknown })?.results)
      ? (json as { results: unknown[] }).results
      : [];
  const out: LiveBus[] = [];
  for (const row of rows) {
    try {
      const bus = parsePksbRecord(row as PksbRawRecord, nowMs);
      if (bus) out.push(bus);
    } catch {
      // skip malformed row
    }
  }
  return out;
}
