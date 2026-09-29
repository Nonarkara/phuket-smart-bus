/**
 * The real-bus study archive. One writer: GET /api/collect/tick.
 *
 * Each sample is kept whole under `gps:` (newest first) so every number
 * below can be recomputed if a rule here turns out wrong, and folded into
 * `day:YYYY-MM-DD` (Bangkok date of the fix, not of the fetch).
 *
 * What each figure is:
 *   km          device odometer (keyless `LiCheng`, metres) — the bus's
 *               own count. The GPS trace is kept beside it; 30 s fixes cut
 *               corners and read ~10% short (checked 2026-09-29).
 *   passengers  only when the counter has ever read above zero. A counter
 *               stuck at 0 all day is not "0 riders" — on 2026-09-29 every
 *               counter on all 24 buses read 0 while 8 drove. Those days
 *               carry null revenue, not ฿0.
 *   coverage    which Bangkok minutes got a sample. A gap is shown, never
 *               filled in.
 */
import { isOnPhuketIsland, plateKey } from "./pksbFeed.js";

/**
 * A month-long study plus time to analyse it. Each key's clock starts at
 * its last write, so a day written on the 30th is readable ~45 days on.
 * ponytail: KV is the store; move raw batches to R2 if a study runs past ~6 weeks.
 */
export const GPS_HISTORY_TTL_S = 45 * 24 * 60 * 60;
/** Service window used for coverage: 05:00–24:00 Bangkok. First bus leaves 05:30, last arrives ~01:00. */
export const SERVICE_START_MIN = 5 * 60;
export const SERVICE_END_MIN = 24 * 60;
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
  /** Omitted when this fix had no passenger counter. */
  paxCount?: number;
  /** Counter's raw boarded / alighted fields, kept for re-analysis. */
  paxUp?: number;
  paxDown?: number;
  /** Device odometer, metres. */
  odometerM?: number;
  /** Tracker's "device connected" flag. */
  online?: boolean;
};

export type GpsBatch = {
  fetchedAt: number;
  storedAt: number;
  source: string;
  buses: GpsBusPing[];
};

export type DayVehicle = {
  plate: string;
  /** GPS-trace km (fix to fix). */
  km: number;
  boardings: number;
  sawCounter: boolean;
  lastLat: number;
  lastLng: number;
  /** Fetch time of the last sample that carried a new fix. */
  lastMs: number;
  lastPax: number | null;
  lastSpeedKph: number;
  lastSeenAt: string;
  /** Device time of the last fix folded in. Absent on records written before 2026-09-29. */
  lastFixMs?: number;
  /** New fixes folded in today (a re-served fix is not new). */
  fixes?: number;
  /** Odometer km: sum of forward, physically possible steps. */
  odoKm?: number;
  lastOdoM?: number | null;
  /** Any counter field ever above zero today. False = the counter never spoke. */
  counterMoved?: boolean;
  online?: boolean | null;
};

export type DayCoverage = {
  samples: number;
  firstMs: number;
  lastMs: number;
  maxGapMs: number;
  /** 1440 chars, one per Bangkok minute: "1" = at least one sample landed. */
  minutes: string;
};

export type GpsDay = {
  date: string;
  updatedAt: number;
  vehicles: Record<string, DayVehicle>;
  coverage?: DayCoverage;
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

/** Minute of the Bangkok day, 0–1439. */
export function bangkokMinute(ms: number): number {
  return Math.floor(((ms + 7 * 3_600_000) % 86_400_000) / 60_000);
}

function markCoverage(prev: DayCoverage | undefined, nowMs: number): DayCoverage {
  const minutes = prev?.minutes?.length === 1440 ? prev.minutes : "0".repeat(1440);
  const m = bangkokMinute(nowMs);
  return {
    samples: (prev?.samples ?? 0) + 1,
    firstMs: prev?.firstMs ?? nowMs,
    lastMs: nowMs,
    maxGapMs: prev ? Math.max(prev.maxGapMs, nowMs - prev.lastMs) : 0,
    minutes: minutes[m] === "1" ? minutes : minutes.slice(0, m) + "1" + minutes.slice(m + 1),
  };
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * Fold one tracker snapshot into the Bangkok-day ledger.
 * Only fixes the device took on this day count, and only once each — the
 * tracker re-serves a parked bus's last fix every call, sometimes for days.
 * Distance and speed use device time between fixes.
 */
export function applyBusesToDay(day: GpsDay, buses: GpsBusPing[], nowMs: number): GpsDay {
  const vehicles: Record<string, DayVehicle> = { ...day.vehicles };
  for (const bus of buses) {
    if (!bus?.coordinates || bus.coordinates.length !== 2) continue;
    const [lat, lng] = bus.coordinates;
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !isOnPhuketIsland(lat, lng)) continue;
    const plate = plateKey(bus.licensePlate || bus.vehicleId || "");
    if (!plate) continue;

    const parsed = Date.parse(bus.timestamp);
    const fixMs = Number.isFinite(parsed) ? Math.min(parsed, nowMs) : nowMs;
    if (bangkokDate(fixMs) !== day.date) continue; // yesterday's parked position isn't today's bus

    const prev = vehicles[plate];
    const prevFixMs = prev ? prev.lastFixMs ?? prev.lastMs : null;
    if (prev && prevFixMs !== null && fixMs <= prevFixMs) continue; // same fix served again

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
          fixes: 0,
          odoKm: 0,
          lastOdoM: null,
          counterMoved: false,
        };

    const hours = prev && prevFixMs !== null ? Math.max(1 / 3600, (fixMs - prevFixMs) / 3_600_000) : 0;
    if (prev) {
      const dKm = haversineKm([prev.lastLat, prev.lastLng], [lat, lng]);
      if (dKm >= MIN_MOVE_KM && dKm / hours <= MAX_KPH) next.km += dKm;
    }

    const odo = num(bus.odometerM);
    if (odo !== null) {
      const lastOdo = prev?.lastOdoM ?? null;
      if (lastOdo !== null) {
        const stepKm = (odo - lastOdo) / 1000;
        // Backwards = device reset; faster than a bus = glitch. 0.2 km = two odometer ticks of slack.
        if (stepKm >= 0 && stepKm <= MAX_KPH * hours + 0.2) next.odoKm = (next.odoKm ?? 0) + stepKm;
      }
      next.lastOdoM = odo;
    }

    const counts = [num(bus.paxCount), num(bus.paxUp), num(bus.paxDown)];
    if (counts.some((c) => c !== null)) next.sawCounter = true;
    if (counts.some((c) => c !== null && c > 0)) next.counterMoved = true;
    const cur = counts[0];
    if (cur !== null) {
      const onBoard = Math.max(0, Math.round(cur));
      if (prev?.lastPax != null && onBoard > prev.lastPax && onBoard - prev.lastPax <= MAX_BOARD_STEP) {
        next.boardings += onBoard - prev.lastPax;
      }
      next.lastPax = onBoard;
    }

    next.lastLat = lat;
    next.lastLng = lng;
    next.lastMs = nowMs;
    next.lastFixMs = fixMs;
    next.fixes = (next.fixes ?? 0) + 1;
    next.lastSpeedKph = Math.max(0, Number(bus.speedKph) || 0);
    next.lastSeenAt = bus.timestamp || new Date(nowMs).toISOString();
    if (typeof bus.online === "boolean") next.online = bus.online;
    vehicles[plate] = next;
  }
  return { date: day.date, updatedAt: nowMs, vehicles, coverage: markCoverage(day.coverage, nowMs) };
}

export function foldBatches(batches: GpsBatch[]): GpsDay {
  const sorted = [...batches].sort((a, b) => a.fetchedAt - b.fetchedAt);
  const start = sorted[0]?.fetchedAt ?? Date.now();
  return sorted.reduce((day, batch) => applyBusesToDay(day, batch.buses, batch.fetchedAt), emptyGpsDay(start));
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * How much of the service window has a sample. For today the window ends
 * at `nowMs`, so an 11:00 read isn't marked down for the evening.
 */
export function summarizeCoverage(coverage: DayCoverage | undefined, date: string, nowMs: number) {
  const endMin = bangkokDate(nowMs) === date ? Math.min(SERVICE_END_MIN, bangkokMinute(nowMs) + 1) : SERVICE_END_MIN;
  const windowMinutes = Math.max(0, endMin - SERVICE_START_MIN);
  const bits = coverage?.minutes?.length === 1440 ? coverage.minutes : "";
  let sampled = 0;
  for (let m = SERVICE_START_MIN; m < endMin; m++) if (bits[m] === "1") sampled++;
  return {
    samples: coverage?.samples ?? null,
    firstSampleAt: coverage ? new Date(coverage.firstMs).toISOString() : null,
    lastSampleAt: coverage ? new Date(coverage.lastMs).toISOString() : null,
    longestGapMin: coverage ? r1(coverage.maxGapMs / 60_000) : null,
    serviceMinutesSampled: bits ? sampled : null,
    serviceMinutesSoFar: windowMinutes,
    coveragePct: bits && windowMinutes > 0 ? r1((sampled / windowMinutes) * 100) : null,
  };
}

export function summarizeGpsDay(day: GpsDay, nowMs = Date.now()) {
  const vehicles = Object.values(day.vehicles).map((v) => {
    const atDepot = haversineKm([v.lastLat, v.lastLng], DEPOT) <= DEPOT_KM;
    const lastState = atDepot ? "parked_depot" : v.lastSpeedKph > 4 ? "in_transit" : "dwelling";
    const hasOdometer = v.lastOdoM != null;
    const km = hasOdometer ? v.odoKm ?? 0 : v.km;
    const paxBasis = v.counterMoved ? "apc" as const : v.sawCounter ? "counter-silent" as const : "no-counter" as const;
    const paxServed = v.counterMoved ? v.boardings : null;
    const revenueThb = paxServed === null ? null : paxServed * FARE_THB;
    const operatingCostThb = Math.round(km * OPEX_PER_KM_THB);
    return {
      vehicleId: v.plate,
      licensePlate: v.plate,
      totalDistanceKm: r1(km),
      kmBasis: hasOdometer ? "odometer" as const : "gps-trace" as const,
      gpsTraceKm: r1(v.km),
      fixes: v.fixes ?? null,
      tripsCompleted: 0,
      paxServed,
      paxBasis,
      revenueThb,
      operatingCostThb,
      netMarginThb: revenueThb === null ? null : revenueThb - operatingCostThb,
      co2SavedKg: paxServed === null ? null : r1(paxServed * CO2_KG_PER_PAX),
      lastState,
      lastSpeedKph: v.lastSpeedKph,
      online: v.online ?? null,
      lastSeenAt: v.lastSeenAt,
      lastFixAt: v.lastFixMs ? new Date(v.lastFixMs).toISOString() : null,
    };
  }).sort((a, b) => (b.revenueThb ?? -1) - (a.revenueThb ?? -1) || b.totalDistanceKm - a.totalDistanceKm);

  const counted = vehicles.filter((v) => v.paxBasis === "apc");
  const totalKmTracked = r1(vehicles.reduce((s, v) => s + v.totalDistanceKm, 0));
  const totalPaxServed = counted.length ? counted.reduce((s, v) => s + (v.paxServed ?? 0), 0) : null;
  const totalRevenueThb = totalPaxServed === null ? null : totalPaxServed * FARE_THB;
  const totalOperatingCostThb = vehicles.reduce((s, v) => s + v.operatingCostThb, 0);
  const netMarginThb = totalRevenueThb === null ? null : totalRevenueThb - totalOperatingCostThb;

  return {
    date: day.date,
    totalTrackedVehicles: vehicles.length,
    activeVehiclesCount: vehicles.filter((v) => v.lastState !== "parked_depot").length,
    depotVehiclesCount: vehicles.filter((v) => v.lastState === "parked_depot").length,
    /** Buses whose counter read above zero at least once. The rest have no rider figure. */
    countersReporting: counted.length,
    unmeteredVehicles: vehicles.length - counted.length,
    kmBasis: vehicles.every((v) => v.kmBasis === "odometer") ? "odometer" : vehicles.some((v) => v.kmBasis === "odometer") ? "mixed" : "gps-trace",
    totalKmTracked,
    totalGpsTraceKm: r1(vehicles.reduce((s, v) => s + v.gpsTraceKm, 0)),
    /** Null = no counter reported, so riders are unknown — not zero. */
    totalPaxServed,
    totalRevenueThb,
    totalOperatingCostThb,
    netMarginThb,
    profitMarginPct: totalRevenueThb && netMarginThb !== null ? Math.round((netMarginThb / totalRevenueThb) * 100) : null,
    totalTripsCompleted: 0,
    totalCo2SavedKg: totalPaxServed === null ? null : r1(totalPaxServed * CO2_KG_PER_PAX),
    passengerSavingsThb: totalPaxServed === null ? null : totalPaxServed * (GRAB_EQUIV_FARE_THB - FARE_THB),
    revenuePerKm: totalRevenueThb !== null && totalKmTracked > 0 ? r1(totalRevenueThb / totalKmTracked) : null,
    coverage: summarizeCoverage(day.coverage, day.date, nowMs),
    vehicles,
  };
}
