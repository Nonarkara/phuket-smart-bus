/**
 * One GPS history record, shared by the edge relay and the KV readers.
 *
 * The browser does not run a second parser. `/api/live-buses` already
 * normalises the tracker (shared/pksbFeed.ts). Each successful fetch
 * folds that snapshot into `day:YYYY-MM-DD` and keeps a newest-first
 * copy under `gps:`. Revenue is the day record — not "the first 100
 * keys KV list returned", which are the oldest.
 *
 * Passengers are counted only when the on-board counter rises. A bus
 * that reports 0 all day earned ฿0. Guessing 18 riders per 35 km was
 * a second model, and it disagreed with the ledger on screen.
 */
import { isOnPhuketIsland, plateKey } from "./pksbFeed";

/**
 * A 7-day study has to still be there the week after it ends.
 * Each key's clock starts at its last write, so day 1 of a
 * Mon–Sun collection is readable through the following Monday.
 */
export const GPS_HISTORY_TTL_S = 14 * 24 * 60 * 60;
/** Lexicographic inverse of a millisecond timestamp, so `kv.list` returns newest first. */
const KEY_SPAN = 9_999_999_999_999;
const MIN_MOVE_KM = 0.015;
const MAX_KPH = 120;
const MAX_BOARD_STEP = 40;
const DEPOT: [number, number] = [7.8814, 98.4093];
const DEPOT_KM = 0.45;
const FARE_THB = 100;
const OPEX_PER_KM_THB = 35;
const CO2_KG_PER_PAX = 4.2;
const GRAB_EQUIV_FARE_THB = 720;

export type GpsBusPing = {
  vehicleId: string;
  licensePlate?: string;
  /** [lat, lng] */
  coordinates: [number, number];
  speedKph: number;
  heading?: number;
  timestamp: string;
  routeId?: string;
  destinationHint?: string;
  /** Omitted when this fix had no passenger counter. 0 is a real reading. */
  paxCount?: number;
};

export type GpsBatch = {
  fetchedAt: number;
  storedAt: number;
  source: string;
  buses: GpsBusPing[];
};

export type DayVehicle = {
  plate: string;
  km: number;
  boardings: number;
  sawCounter: boolean;
  lastLat: number;
  lastLng: number;
  lastMs: number;
  lastPax: number | null;
  lastSpeedKph: number;
  lastSeenAt: string;
};

export type GpsDay = {
  date: string;
  updatedAt: number;
  vehicles: Record<string, DayVehicle>;
};

export function gpsBatchKey(fetchedAt: number, source = "pksb-tracker"): string {
  const inv = String(KEY_SPAN - Math.max(0, Math.floor(fetchedAt))).padStart(13, "0");
  const safe = source.replace(/[^a-z0-9_-]/gi, "").slice(0, 32) || "pksb";
  return `gps:${inv}:${safe}`;
}

export function bangkokDate(ms: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

export function gpsDayKey(ms: number): string {
  return `day:${bangkokDate(ms)}`;
}

const STUDY_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Noon in Bangkok for a calendar date, or null when it isn't a real date. */
export function parseStudyDate(iso: string): number | null {
  if (!STUDY_DATE.test(iso)) return null;
  const ms = Date.parse(`${iso}T12:00:00+07:00`);
  if (!Number.isFinite(ms) || bangkokDate(ms) !== iso) return null;
  return ms;
}

/** `days` Bangkok dates beginning at `from`, capped at 14. Null if `from` isn't a date. */
export function studyDates(from: string, days: number): string[] | null {
  const start = parseStudyDate(from);
  if (start === null) return null;
  const n = Math.max(1, Math.min(14, Math.floor(days)));
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(bangkokDate(start + i * 86_400_000));
  return out;
}

export function emptyGpsDay(ms: number): GpsDay {
  return { date: bangkokDate(ms), updatedAt: ms, vehicles: {} };
}

function haversineKm(a: [number, number], b: [number, number]): number {
  const [lat1, lon1] = a;
  const [lat2, lon2] = b;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}

/**
 * Fold one tracker snapshot into the Bangkok-day ledger.
 * `nowMs` is when we fetched, not the device clock — speed is
 * distance over time between our observations.
 */
export function applyBusesToDay(day: GpsDay, buses: GpsBusPing[], nowMs: number): GpsDay {
  const vehicles: Record<string, DayVehicle> = { ...day.vehicles };
  for (const bus of buses) {
    if (!bus?.coordinates || bus.coordinates.length !== 2) continue;
    const [lat, lng] = bus.coordinates;
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !isOnPhuketIsland(lat, lng)) continue;
    const plate = plateKey(bus.licensePlate || bus.vehicleId || "");
    if (!plate) continue;

    const prev = vehicles[plate];
    const next: DayVehicle = prev
      ? { ...prev }
      : {
          plate,
          km: 0,
          boardings: 0,
          sawCounter: false,
          lastLat: lat,
          lastLng: lng,
          lastMs: nowMs,
          lastPax: null,
          lastSpeedKph: 0,
          lastSeenAt: bus.timestamp,
        };

    if (prev) {
      const dKm = haversineKm([prev.lastLat, prev.lastLng], [lat, lng]);
      const hours = Math.max(1 / 3600, (nowMs - prev.lastMs) / 3_600_000);
      if (dKm >= MIN_MOVE_KM && dKm / hours <= MAX_KPH) next.km += dKm;
    }

    if (typeof bus.paxCount === "number" && Number.isFinite(bus.paxCount)) {
      const cur = Math.max(0, Math.round(bus.paxCount));
      next.sawCounter = true;
      if (prev?.lastPax != null && cur > prev.lastPax && cur - prev.lastPax <= MAX_BOARD_STEP) {
        next.boardings += cur - prev.lastPax;
      }
      next.lastPax = cur;
    }

    next.lastLat = lat;
    next.lastLng = lng;
    next.lastMs = nowMs;
    next.lastSpeedKph = Math.max(0, Number(bus.speedKph) || 0);
    next.lastSeenAt = bus.timestamp || new Date(nowMs).toISOString();
    vehicles[plate] = next;
  }
  return { date: day.date, updatedAt: nowMs, vehicles };
}

export function foldBatches(batches: GpsBatch[]): GpsDay {
  const sorted = [...batches].sort((a, b) => a.fetchedAt - b.fetchedAt);
  const start = sorted[0]?.fetchedAt ?? Date.now();
  return sorted.reduce((day, batch) => applyBusesToDay(day, batch.buses, batch.fetchedAt), emptyGpsDay(start));
}

export function summarizeGpsDay(day: GpsDay) {
  const vehicles = Object.values(day.vehicles).map((v) => {
    const atDepot = haversineKm([v.lastLat, v.lastLng], DEPOT) <= DEPOT_KM;
    const lastState = atDepot ? "parked_depot" : v.lastSpeedKph > 4 ? "in_transit" : "dwelling";
    const paxServed = v.sawCounter ? v.boardings : 0;
    const revenueThb = paxServed * FARE_THB;
    const operatingCostThb = Math.round(v.km * OPEX_PER_KM_THB);
    return {
      vehicleId: v.plate,
      licensePlate: v.plate,
      totalDistanceKm: Math.round(v.km * 10) / 10,
      tripsCompleted: 0,
      paxServed,
      paxBasis: v.sawCounter ? "apc" as const : "unmetered" as const,
      revenueThb,
      operatingCostThb,
      netMarginThb: revenueThb - operatingCostThb,
      co2SavedKg: Math.round(paxServed * CO2_KG_PER_PAX * 10) / 10,
      lastState,
      lastSpeedKph: v.lastSpeedKph,
      lastSeenAt: v.lastSeenAt,
    };
  }).sort((a, b) => b.revenueThb - a.revenueThb || b.totalDistanceKm - a.totalDistanceKm);

  const totalKmTracked = Math.round(vehicles.reduce((s, v) => s + v.totalDistanceKm, 0) * 10) / 10;
  const totalRevenueThb = vehicles.reduce((s, v) => s + v.revenueThb, 0);
  const totalOperatingCostThb = vehicles.reduce((s, v) => s + v.operatingCostThb, 0);
  const totalPaxServed = vehicles.reduce((s, v) => s + v.paxServed, 0);
  const netMarginThb = totalRevenueThb - totalOperatingCostThb;

  return {
    date: day.date,
    totalTrackedVehicles: vehicles.length,
    activeVehiclesCount: vehicles.filter((v) => v.lastState !== "parked_depot").length,
    depotVehiclesCount: vehicles.filter((v) => v.lastState === "parked_depot").length,
    unmeteredVehicles: vehicles.filter((v) => v.paxBasis === "unmetered").length,
    totalKmTracked,
    totalPaxServed,
    totalRevenueThb,
    totalOperatingCostThb,
    netMarginThb,
    profitMarginPct: totalRevenueThb > 0 ? Math.round((netMarginThb / totalRevenueThb) * 100) : 0,
    totalTripsCompleted: 0,
    totalCo2SavedKg: Math.round(totalPaxServed * CO2_KG_PER_PAX * 10) / 10,
    passengerSavingsThb: totalPaxServed * (GRAB_EQUIV_FARE_THB - FARE_THB),
    revenuePerKm: totalKmTracked > 0 ? Math.round((totalRevenueThb / totalKmTracked) * 10) / 10 : 0,
    vehicles,
  };
}
