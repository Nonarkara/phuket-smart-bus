/**
 * LIVE operations ledger — real PKSB buses, today's money.
 *
 * GPS observes SUPPLY, never riders. So the chain in LIVE mode is:
 *
 *   tracker fix → trip completed (destination flips, seen on two fixes)
 *               → km driven (fix-to-fix haversine, glitches dropped)
 *   completed trip × modelled riders for THAT run → estimated fares
 *
 * "Modelled riders for that run": an airport-line trip is matched to the
 * scheduled departure it most plausibly is (±30 min of when it started) and
 * takes that departure's boarded load from today's demand model — the same
 * number the SIMULATION shows for that bus. Local lines take the line P&L's
 * capacity × occupancy. Every trip records which basis priced it, so when
 * seat cameras or fare-box counts arrive, one function swaps and every ฿
 * figure downstream sharpens without a UI change.
 *
 * The ledger is kept per Bangkok calendar day in localStorage, so a wall
 * screen that reloads keeps its day. It only knows what it observed: trips
 * before the first fix of the day are not invented ("observed since").
 */
import type { LiveBus, LiveBusFeed, LiveBusRouteId } from "@shared/pksbFeed";
import { getDayModelFor, BUS_CAPACITY, FARE_THB } from "./demandSupplyEngine";
import { getLocalLineTripEstimate, type SimState } from "./simulation";
import { haversineDistanceMeters } from "./geo";
import { getBangkokNowFractionalMinutes, BANGKOK_TIME_ZONE } from "./time";
import { ROI_CONSTANTS } from "./roi";
import { appPath } from "../lib/paths";

// ── tuning knobs (each one line, each one reason) ──────────────────────────
export const POLL_INTERVAL_MS = 15_000;
/** A fix older than this is not "reporting" (matches server LIVE_STALE_AFTER_MS). */
export const FRESH_FIX_MS = 3 * 60_000;
/** Longer gap than this between fixes: don't draw a straight line across it. */
const MAX_KM_GAP_MS = 10 * 60_000;
/** Moves shorter than this are GPS jitter at a stop, not driving. */
const MIN_MOVE_M = 15;
/** Implied speed above this between two fixes is a GPS jump, not a bus. */
const MAX_PLAUSIBLE_KPH = 120;
/** An airport-line trip within this of a scheduled run IS that run. */
const RUN_MATCH_MIN = 30;
const AIRPORT_TRIP_MINUTES = 95;
const CO2_KG_PER_PAX_KM_SAVED = ROI_CONSTANTS.co2KgPerPaxKmCar - ROI_CONSTANTS.co2KgPerPaxKmBus;

export type PricingBasis = "scheduled-run" | "hour-average" | "line-occupancy" | "no-model";

export type LiveTrip = {
  plate: string;
  routeId: LiveBusRouteId;
  /** Destination the completed trip arrived at. */
  to: string;
  /** Bangkok minutes; null when the trip began before the first observed fix. */
  startMin: number | null;
  endMin: number;
  riders: number;
  fareThb: number;
  basis: PricingBasis;
};

type VehicleLedger = {
  plate: string;
  routeId: LiveBusRouteId;
  lat: number;
  lng: number;
  fixMs: number;
  dest: string;
  /** A new destination seen once; committed as a flip only when seen twice running. */
  pendingDest: string | null;
  lastFlipMin: number | null;
  km: number;
};

export type LiveLedger = {
  /** Bangkok calendar date, yyyy-mm-dd. */
  date: string;
  dow: number;
  firstFixMs: number | null;
  vehicles: Record<string, VehicleLedger>;
  trips: LiveTrip[];
};

// ── Bangkok calendar helpers ───────────────────────────────────────────────
export function bangkokDate(ms: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BANGKOK_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
}

export function bangkokDow(ms: number): number {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: BANGKOK_TIME_ZONE, weekday: "short" }).format(new Date(ms));
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd);
}

export function emptyLedger(nowMs: number): LiveLedger {
  return { date: bangkokDate(nowMs), dow: bangkokDow(nowMs), firstFixMs: null, vehicles: {}, trips: [] };
}

const norm = (s: string) => s.trim().toLowerCase();

// ── pricing: one completed trip → riders ───────────────────────────────────
export function estimateTripRiders(
  routeId: LiveBusRouteId,
  to: string,
  startMin: number,
  dow: number,
): { riders: number; fareThb: number; basis: PricingBasis } {
  const local = getLocalLineTripEstimate(routeId);
  if (local) return { riders: local.riders, fareThb: local.fareThb, basis: "line-occupancy" };

  const model = getDayModelFor(dow);
  const toAirport = norm(to).includes("airport");
  const runs = toAirport
    ? model.outbound.returnTrips.map((t) => ({ dep: t.originDepMin, boarded: t.boarded }))
    : model.trips.map((t) => ({ dep: t.depMin, boarded: t.boarded }));

  let nearest: { dep: number; boarded: number } | null = null;
  for (const run of runs) {
    if (!nearest || Math.abs(run.dep - startMin) < Math.abs(nearest.dep - startMin)) nearest = run;
  }
  if (nearest && Math.abs(nearest.dep - startMin) <= RUN_MATCH_MIN) {
    return { riders: Math.min(BUS_CAPACITY, nearest.boarded), fareThb: FARE_THB, basis: "scheduled-run" };
  }

  const nearby = runs.filter((run) => Math.abs(run.dep - startMin) <= 60);
  if (nearby.length > 0) {
    const mean = nearby.reduce((sum, run) => sum + run.boarded, 0) / nearby.length;
    return { riders: Math.min(BUS_CAPACITY, Math.round(mean)), fareThb: FARE_THB, basis: "hour-average" };
  }
  return { riders: 0, fareThb: FARE_THB, basis: "no-model" };
}

function typicalTripMinutes(routeId: LiveBusRouteId): number {
  return getLocalLineTripEstimate(routeId)?.tripMinutes ?? AIRPORT_TRIP_MINUTES;
}

// ── the ledger step: fold one tracker snapshot into the day ────────────────
export function applySnapshot(prev: LiveLedger, buses: LiveBus[], nowMs: number): LiveLedger {
  const ledger: LiveLedger = bangkokDate(nowMs) === prev.date
    ? { ...prev, vehicles: { ...prev.vehicles }, trips: [...prev.trips] }
    : emptyLedger(nowMs);

  for (const bus of buses) {
    const parsed = Date.parse(bus.updatedAt);
    const fixMs = Number.isFinite(parsed) ? Math.min(parsed, nowMs) : nowMs;
    if (nowMs - fixMs > FRESH_FIX_MS) continue; // a stale fix says nothing about today
    if (bangkokDate(fixMs) !== ledger.date) continue;

    const dest = norm(bus.destination);
    const existing = ledger.vehicles[bus.plate];
    if (ledger.firstFixMs === null || fixMs < ledger.firstFixMs) ledger.firstFixMs = fixMs;

    if (!existing) {
      ledger.vehicles[bus.plate] = {
        plate: bus.plate, routeId: bus.routeId, lat: bus.lat, lng: bus.lng, fixMs,
        dest, pendingDest: null, lastFlipMin: null, km: 0,
      };
      continue;
    }
    if (fixMs <= existing.fixMs) continue; // the tracker re-served the same fix

    const next: VehicleLedger = { ...existing, routeId: bus.routeId };

    const dtMs = fixMs - existing.fixMs;
    const meters = haversineDistanceMeters([existing.lat, existing.lng], [bus.lat, bus.lng]);
    const kph = (meters / dtMs) * 3600;
    if (dtMs <= MAX_KM_GAP_MS && meters >= MIN_MOVE_M && kph <= MAX_PLAUSIBLE_KPH) {
      next.km = existing.km + meters / 1000;
    }
    next.lat = bus.lat;
    next.lng = bus.lng;
    next.fixMs = fixMs;

    if (dest && existing.dest && dest !== existing.dest) {
      if (next.pendingDest === dest) {
        // Confirmed on two fixes: the bus reached `existing.dest` and turned.
        const endMin = getBangkokNowFractionalMinutes(new Date(fixMs));
        const startMin = existing.lastFlipMin;
        const priced = estimateTripRiders(
          bus.routeId,
          existing.dest,
          startMin ?? endMin - typicalTripMinutes(bus.routeId),
          ledger.dow,
        );
        ledger.trips.push({
          plate: bus.plate, routeId: bus.routeId, to: existing.dest,
          startMin, endMin: Math.round(endMin), ...priced,
        });
        next.dest = dest;
        next.pendingDest = null;
        next.lastFlipMin = Math.round(endMin);
      } else {
        next.pendingDest = dest;
      }
    } else {
      next.pendingDest = null; // a one-fix flicker, discarded
      if (!existing.dest && dest) next.dest = dest;
    }

    ledger.vehicles[bus.plate] = next;
  }
  return ledger;
}

// ── read model for the console ─────────────────────────────────────────────
export type LiveVehicleRow = {
  plate: string;
  routeId: LiveBusRouteId;
  destination: string;
  speedKph: number;
  lastSeenSec: number;
  reporting: boolean;
  trips: number;
  km: number;
  riders: number;
  fareThb: number;
};

export type LiveOpsSummary = {
  busesReporting: number;
  busesMoving: number;
  tripsCompleted: number;
  kmDriven: number;
  riders: number;
  fareThb: number;
  /** Airport-line riders only: local-line ride length isn't modelled yet. */
  co2SavedKg: number;
  /** Bangkok minutes of the day's first fix, or null before any. */
  observedSinceMin: number | null;
  pricedByScheduledRun: number;
  rows: LiveVehicleRow[];
};

export function summarizeLedger(ledger: LiveLedger, buses: LiveBus[], nowMs: number): LiveOpsSummary {
  const latest = new Map(buses.map((bus) => [bus.plate, bus]));
  const plates = new Set([...Object.keys(ledger.vehicles), ...latest.keys()]);
  const rows: LiveVehicleRow[] = [];

  for (const plate of plates) {
    const bus = latest.get(plate);
    const book = ledger.vehicles[plate];
    const fixMs = bus ? Date.parse(bus.updatedAt) : book?.fixMs ?? 0;
    const lastSeenSec = Math.max(0, Math.round((nowMs - fixMs) / 1000));
    const trips = ledger.trips.filter((trip) => trip.plate === plate);
    rows.push({
      plate,
      routeId: (bus?.routeId ?? book?.routeId)!,
      destination: bus?.destination ?? book?.dest ?? "",
      speedKph: bus ? Math.round(bus.speedKph) : 0,
      lastSeenSec,
      reporting: lastSeenSec * 1000 <= FRESH_FIX_MS,
      trips: trips.length,
      km: Math.round((book?.km ?? 0) * 10) / 10,
      riders: trips.reduce((sum, trip) => sum + trip.riders, 0),
      fareThb: trips.reduce((sum, trip) => sum + trip.riders * trip.fareThb, 0),
    });
  }
  rows.sort((a, b) => Number(b.reporting) - Number(a.reporting) || b.fareThb - a.fareThb || a.plate.localeCompare(b.plate));

  const reporting = rows.filter((row) => row.reporting);
  const airportRiders = ledger.trips.filter((t) => t.routeId === "rawai-airport").reduce((s, t) => s + t.riders, 0);

  return {
    busesReporting: reporting.length,
    busesMoving: reporting.filter((row) => row.speedKph > 4).length,
    tripsCompleted: ledger.trips.length,
    kmDriven: Math.round(rows.reduce((sum, row) => sum + row.km, 0)),
    riders: ledger.trips.reduce((sum, trip) => sum + trip.riders, 0),
    fareThb: ledger.trips.reduce((sum, trip) => sum + trip.riders * trip.fareThb, 0),
    co2SavedKg: Math.round(airportRiders * ROI_CONSTANTS.avgTripKm * CO2_KG_PER_PAX_KM_SAVED),
    observedSinceMin: ledger.firstFixMs === null ? null : Math.floor(getBangkokNowFractionalMinutes(new Date(ledger.firstFixMs))),
    pricedByScheduledRun: ledger.trips.filter((trip) => trip.basis === "scheduled-run").length,
    rows,
  };
}

// ── runtime: poll, persist, tween, notify ──────────────────────────────────
export type LiveFeedStatus = "connecting" | "live" | "quiet" | "unconfigured" | "offline";

type Tween = { fromLat: number; fromLng: number; toLat: number; toLng: number; heading: number; startMs: number };

const STORAGE_KEY = "pksb.liveLedger.v1";
const listeners = new Set<() => void>();
const tweens = new Map<string, Tween>();
let ledger: LiveLedger = loadLedger();
let buses: LiveBus[] = [];
let status: LiveFeedStatus = "connecting";
let detail: string | null = null;
let lastOkMs: number | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let subscribers = 0;

function loadLedger(): LiveLedger {
  const now = Date.now();
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    const parsed = raw ? (JSON.parse(raw) as LiveLedger) : null;
    if (parsed && parsed.date === bangkokDate(now) && parsed.vehicles && Array.isArray(parsed.trips)) return parsed;
  } catch {
    // private window / blocked storage: start the day fresh
  }
  return emptyLedger(now);
}

function saveLedger() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ledger));
  } catch {
    // storage unavailable: the ledger still lives for this page load
  }
}

function lerpPosition(tween: Tween, nowMs: number) {
  const k = Math.max(0, Math.min(1, (nowMs - tween.startMs) / POLL_INTERVAL_MS));
  return { lat: tween.fromLat + (tween.toLat - tween.fromLat) * k, lng: tween.fromLng + (tween.toLng - tween.fromLng) * k };
}

function ingest(feed: LiveBusFeed, nowMs: number) {
  if (feed.status !== "live") {
    status = feed.status === "unconfigured" ? "unconfigured" : "offline";
    detail = feed.detail ?? null;
    return;
  }
  lastOkMs = nowMs;
  detail = null;
  buses = feed.vehicles;
  for (const bus of buses) {
    const tween = tweens.get(bus.plate);
    if (!tween) {
      tweens.set(bus.plate, { fromLat: bus.lat, fromLng: bus.lng, toLat: bus.lat, toLng: bus.lng, heading: bus.heading, startMs: nowMs });
    } else if (tween.toLat !== bus.lat || tween.toLng !== bus.lng) {
      const shown = lerpPosition(tween, nowMs);
      tweens.set(bus.plate, { fromLat: shown.lat, fromLng: shown.lng, toLat: bus.lat, toLng: bus.lng, heading: bus.heading, startMs: nowMs });
    }
  }
  ledger = applySnapshot(ledger, buses, nowMs);
  saveLedger();
  const reporting = buses.some((bus) => nowMs - Date.parse(bus.updatedAt) <= FRESH_FIX_MS);
  status = reporting ? "live" : "quiet";
}

async function pollOnce() {
  try {
    const res = await fetch(appPath("/api/live-buses"), { signal: AbortSignal.timeout(8_000), cache: "no-store" });
    const isJson = (res.headers.get("content-type") ?? "").includes("json");
    if (!isJson) {
      // A static host with no edge function answers the SPA fallback page.
      status = "offline";
      detail = "No /api/live-buses relay on this host";
    } else {
      ingest((await res.json()) as LiveBusFeed, Date.now());
    }
  } catch (error) {
    status = "offline";
    detail = (error as Error).message;
  }
  listeners.forEach((fn) => fn());
}

/** Ref-counted: the first caller starts polling, the last stop ends it. */
export function startLiveFeed(): () => void {
  subscribers += 1;
  if (pollTimer === null) {
    void pollOnce();
    pollTimer = setInterval(() => void pollOnce(), POLL_INTERVAL_MS);
  }
  return () => {
    subscribers -= 1;
    if (subscribers <= 0 && pollTimer !== null) {
      clearInterval(pollTimer);
      pollTimer = null;
      subscribers = 0;
    }
  };
}

export function subscribeLiveFeed(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function getLiveFeedState(nowMs = Date.now()) {
  return { status, detail, lastOkMs, feedAgeSec: lastOkMs === null ? null : Math.round((nowMs - lastOkMs) / 1000), summary: summarizeLedger(ledger, buses, nowMs) };
}

/** Map instrument shape, tweened between the last two real fixes so a 15 s
 *  feed glides instead of jumping (at most one poll behind the tracker). */
export function getLiveMapVehicles(nowMs = Date.now()): SimState["vehicles"] {
  return buses
    .filter((bus) => nowMs - Date.parse(bus.updatedAt) <= FRESH_FIX_MS)
    .map((bus) => {
      const tween = tweens.get(bus.plate);
      const pos = tween ? lerpPosition(tween, nowMs) : { lat: bus.lat, lng: bus.lng };
      const book = ledger.vehicles[bus.plate];
      const nowMin = getBangkokNowFractionalMinutes(new Date(nowMs));
      const current = estimateTripRiders(bus.routeId, bus.destination, book?.lastFlipMin ?? nowMin - typicalTripMinutes(bus.routeId) / 2, ledger.dow);
      return {
        id: `live-${bus.plate}`,
        lat: pos.lat,
        lng: pos.lng,
        heading: bus.heading,
        status: bus.speedKph > 4 ? "moving" : "dwelling",
        route: bus.routeId,
        pax: current.riders,
        paxEstimated: true,
        plate: bus.plate,
      };
    });
}

/** Test seam. */
export function __resetLiveFeed(): void {
  ledger = emptyLedger(Date.now());
  buses = [];
  tweens.clear();
  status = "connecting";
  detail = null;
  lastOkMs = null;
}
