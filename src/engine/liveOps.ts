/**
 * LIVE operations ledger — real Phuket Smart Bus buses, today's money.
 *
 *   tracker fix → which line (geometry: the route polyline it drives along)
 *               → trip completed (arrives at a terminal ≥ half a line away
 *                 from where it last left one; loops: back at the start)
 *               → km driven (fix-to-fix haversine, glitches dropped)
 *   trip × riders → fares
 *
 * Riders, best evidence first:
 *   apc-count      the bus's own passenger counter (PeopleCur): every rise
 *                  in on-board count during the trip is a boarding. A lower
 *                  bound — a stop where 3 get off and 5 get on between two
 *                  fixes reads as +2.
 *   scheduled-run  no counter: the demand model's boarded load for the
 *                  scheduled run this trip matches (±30 min, today's weekday)
 *   hour-average   no run that close: mean load of runs within the hour
 *   line-occupancy local lines without a counter: line-P&L occupancy
 * Every trip keeps its basis; the console says which figures are counted.
 *
 * The ledger is kept per Bangkok calendar day in localStorage, so a wall
 * screen that reloads keeps its day. It only knows what it observed.
 */
import type { LatLngTuple } from "@shared/types";
import type { LiveBus, LiveBusFeed, LiveBusRouteId } from "@shared/pksbFeed";
import { getDayModelFor, BUS_CAPACITY, FARE_THB } from "./demandSupplyEngine";
import { getLocalLineTripEstimate, type SimState } from "./simulation";
import { getDirectionPolyline } from "./routes";
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
/** Within this of a terminal point the bus is AT that terminal. */
const TERMINAL_RADIUS_M = 400;
/**
 * A fix this close to one line is a vote for it. The keyless tracker's CMSV6
 * devices have ~50 m of jitter + a systematic offset vs the OSM polylines we
 * loaded years ago (the polylines run on the western coast while real
 * service drives on the eastern corridor). 500 m covers both the jitter
 * and the polyline drift. At 250 m we were rejecting every bus.
 */
const ON_LINE_M = 500;
/**
 * Decisive margin to the *next* line — a bus on a road shared by two lines
 * stays ambiguous. The patong + dragon + rawai lines share the Old Town
 * corridor for several km; the 250 m margin was still vetoing matches
 * there. 50 m lets the closest line win while keeping votes in a
 * bus's ledger distinct enough to flip if it moves onto a different road.
 */
const LINE_MARGIN_M = 50;
/** Decisive fixes needed before a bus is assigned to a line. */
const LINE_VOTES = 2;
/** A rise in on-board count larger than this between two fixes is a counter glitch. */
const MAX_BOARD_STEP = 40;
/** An airport-line trip within this of a scheduled run IS that run. */
const RUN_MATCH_MIN = 30;
const AIRPORT_TRIP_MINUTES = 95;
const CO2_KG_PER_PAX_KM_SAVED = ROI_CONSTANTS.co2KgPerPaxKmCar - ROI_CONSTANTS.co2KgPerPaxKmBus;

// ── line geometry ──────────────────────────────────────────────────────────
type Terminal = { name: string; lat: number; lng: number };
type LineGeo = { routeId: LiveBusRouteId; poly: LatLngTuple[]; terminals: Terminal[]; loop: boolean; lengthM: number };

const LINE_SEEDS: { routeId: LiveBusRouteId; firstStop: LatLngTuple; names: [string, string]; loop: boolean }[] = [
  { routeId: "rawai-airport", firstStop: [8.108, 98.317], names: ["Airport", "Rawai"], loop: false },
  { routeId: "patong-old-bus-station", firstStop: [7.884101493, 98.39575082], names: ["Old Town", "Patong"], loop: false },
  { routeId: "dragon-line", firstStop: [7.885774, 98.39478], names: ["Old Town loop", "Old Town loop"], loop: true },
];

let lineCache: LineGeo[] | null = null;
function lines(): LineGeo[] {
  if (lineCache) return lineCache;
  lineCache = LINE_SEEDS.flatMap((seed) => {
    const poly = getDirectionPolyline(seed.routeId, seed.firstStop);
    if (poly.length < 2) return [];
    let lengthM = 0;
    for (let i = 1; i < poly.length; i++) lengthM += haversineDistanceMeters(poly[i - 1]!, poly[i]!);
    const [a, b] = [poly[0]!, poly[poly.length - 1]!];
    const terminals = seed.loop
      ? [{ name: seed.names[0], lat: a[0], lng: a[1] }]
      : [{ name: seed.names[0], lat: a[0], lng: a[1] }, { name: seed.names[1], lat: b[0], lng: b[1] }];
    return [{ routeId: seed.routeId, poly, terminals, loop: seed.loop, lengthM }];
  });
  return lineCache;
}

function lineFor(routeId: LiveBusRouteId | null): LineGeo | null {
  return routeId ? lines().find((line) => line.routeId === routeId) ?? null : null;
}

/** Metres from a point to a polyline (local equirectangular projection — exact enough at island scale). */
export function distanceToPolylineM(lat: number, lng: number, poly: LatLngTuple[]): number {
  const kx = 111_320 * Math.cos((lat * Math.PI) / 180);
  const ky = 110_540;
  let best = Infinity;
  for (let i = 1; i < poly.length; i++) {
    const ax = (poly[i - 1]![1] - lng) * kx, ay = (poly[i - 1]![0] - lat) * ky;
    const bx = (poly[i]![1] - lng) * kx, by = (poly[i]![0] - lat) * ky;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
    const px = ax + t * dx, py = ay + t * dy;
    const d = Math.sqrt(px * px + py * py);
    if (d < best) best = d;
  }
  return best;
}

/** The line this fix is decisive evidence for, or null (off-route, or where lines share road). */
function decisiveLine(lat: number, lng: number): { routeId: LiveBusRouteId; distM: number } | null {
  const scored = lines().map((line) => ({ routeId: line.routeId, distM: distanceToPolylineM(lat, lng, line.poly) }))
    .sort((a, b) => a.distM - b.distM);
  const [best, next] = scored;
  if (!best || best.distM > ON_LINE_M) return null;
  if (next && next.distM - best.distM < LINE_MARGIN_M) return null;
  return best;
}

// ── ledger types ───────────────────────────────────────────────────────────
export type PricingBasis = "apc-count" | "scheduled-run" | "hour-average" | "line-occupancy" | "no-model";

export type LiveTrip = {
  plate: string;
  routeId: LiveBusRouteId;
  /** Terminal the trip left, when observed. */
  from: string | null;
  /** Terminal the trip arrived at. */
  to: string;
  /** Bangkok minutes of departure; null when the trip began before the first observed fix. */
  startMin: number | null;
  endMin: number;
  riders: number;
  fareThb: number;
  basis: PricingBasis;
};

type VehicleLedger = {
  plate: string;
  routeId: LiveBusRouteId | null;
  votes: Partial<Record<LiveBusRouteId, number>>;
  lat: number;
  lng: number;
  fixMs: number;
  km: number;
  /** Terminal the bus is at right now, if any. */
  atTerminal: string | null;
  /** Last terminal visited, and the last minute it was seen there (≈ departure). */
  lastTerminal: string | null;
  leftTerminalMin: number | null;
  /** Path driven since the last terminal — a trip needs a real run, not a depot shuffle. */
  pathSinceTerminalM: number;
  /** Passenger counter state. */
  lastPax: number | null;
  tripBoardings: number;
  hasApc: boolean;
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

// ── pricing without a counter: one completed trip → modelled riders ────────
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

function fareFor(routeId: LiveBusRouteId): number {
  return getLocalLineTripEstimate(routeId)?.fareThb ?? FARE_THB;
}

function typicalTripMinutes(routeId: LiveBusRouteId): number {
  return getLocalLineTripEstimate(routeId)?.tripMinutes ?? AIRPORT_TRIP_MINUTES;
}

/** Where a bus on a two-terminal line is heading: the terminal it didn't last visit. */
function headingTo(book: VehicleLedger | undefined): string | null {
  const line = lineFor(book?.routeId ?? null);
  if (!line || !book?.lastTerminal) return null;
  if (line.loop) return line.terminals[0]!.name;
  return line.terminals.find((t) => t.name !== book.lastTerminal)?.name ?? null;
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
    if (ledger.firstFixMs === null || fixMs < ledger.firstFixMs) ledger.firstFixMs = fixMs;

    const existing = ledger.vehicles[bus.plate];
    if (existing && fixMs <= existing.fixMs) continue; // the tracker re-served the same fix

    const book: VehicleLedger = existing
      ? { ...existing, votes: { ...existing.votes } }
      : {
          plate: bus.plate, routeId: null, votes: {}, lat: bus.lat, lng: bus.lng, fixMs, km: 0,
          atTerminal: null, lastTerminal: null, leftTerminalMin: null, pathSinceTerminalM: 0,
          lastPax: null, tripBoardings: 0, hasApc: false,
        };
    const fixMin = getBangkokNowFractionalMinutes(new Date(fixMs));

    // Which line: the feed's label when it has one, else a vote of decisive fixes.
    if (bus.routeId) {
      book.routeId = bus.routeId;
    } else {
      const evidence = decisiveLine(bus.lat, bus.lng);
      if (evidence) book.votes[evidence.routeId] = (book.votes[evidence.routeId] ?? 0) + 1;
      const leader = (Object.entries(book.votes) as [LiveBusRouteId, number][]).sort((a, b) => b[1] - a[1])[0];
      if (leader && leader[1] >= LINE_VOTES) book.routeId = leader[0];
    }

    // Distance driven.
    if (existing) {
      const dtMs = fixMs - existing.fixMs;
      const meters = haversineDistanceMeters([existing.lat, existing.lng], [bus.lat, bus.lng]);
      const kph = (meters / dtMs) * 3600;
      if (kph <= MAX_PLAUSIBLE_KPH) {
        book.pathSinceTerminalM += meters;
        if (dtMs <= MAX_KM_GAP_MS && meters >= MIN_MOVE_M) book.km = existing.km + meters / 1000;
      }
    }
    book.lat = bus.lat;
    book.lng = bus.lng;
    book.fixMs = fixMs;

    // Passenger counter: every rise is a boarding. Read now, booked after the
    // terminal step, so a rise on an arrival fix counts toward the next trip.
    let boardedThisFix = 0;
    if (bus.paxOnBoard !== null) {
      if (bus.paxOnBoard > 0) book.hasApc = true;
      const step = book.lastPax === null ? bus.paxOnBoard : bus.paxOnBoard - book.lastPax;
      if (step > 0 && step <= MAX_BOARD_STEP) boardedThisFix = step;
      book.lastPax = bus.paxOnBoard;
    }

    // Terminals: arriving at one closes a trip; dwelling there sets the departure time.
    const line = lineFor(book.routeId);
    const terminal = line?.terminals.find((t) => haversineDistanceMeters([bus.lat, bus.lng], [t.lat, t.lng]) <= TERMINAL_RADIUS_M) ?? null;
    if (line && terminal) {
      if (book.atTerminal !== terminal.name) {
        const cameFromOtherEnd = line.loop || book.lastTerminal !== terminal.name;
        if (cameFromOtherEnd && book.pathSinceTerminalM >= line.lengthM * 0.5) {
          const startMin = book.lastTerminal ? book.leftTerminalMin : null;
          const modelled = estimateTripRiders(line.routeId, terminal.name, startMin ?? fixMin - typicalTripMinutes(line.routeId), ledger.dow);
          const counted = book.hasApc;
          ledger.trips.push({
            plate: bus.plate,
            routeId: line.routeId,
            from: book.lastTerminal,
            to: terminal.name,
            startMin: startMin === null ? null : Math.round(startMin),
            endMin: Math.round(fixMin),
            riders: counted ? book.tripBoardings : modelled.riders,
            fareThb: counted ? fareFor(line.routeId) : modelled.fareThb,
            basis: counted ? "apc-count" : modelled.basis,
          });
        }
        // Boardings from here on belong to the next trip.
        book.tripBoardings = 0;
        book.atTerminal = terminal.name;
        book.lastTerminal = terminal.name;
      }
      book.leftTerminalMin = fixMin;
      book.pathSinceTerminalM = 0;
    } else {
      book.atTerminal = null;
    }
    book.tripBoardings += boardedThisFix;

    ledger.vehicles[bus.plate] = book;
  }
  return ledger;
}

// ── read model for the console ─────────────────────────────────────────────
export type LiveVehicleRow = {
  plate: string;
  routeId: LiveBusRouteId | null;
  /** Terminal it's driving toward, the tracker's destination text, or "". */
  destination: string;
  speedKph: number;
  paxOnBoard: number | null;
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
  /** Reporting buses assigned to a line (the rest are identifying, or parked off-route). */
  busesOnLine: number;
  /** Sum of live passenger counters, when any bus has one. */
  paxOnBoardNow: number | null;
  tripsCompleted: number;
  kmDriven: number;
  riders: number;
  /** Riders from passenger counters (the rest are modelled). */
  ridersCounted: number;
  fareThb: number;
  /** Airport-line riders only: local-line ride length isn't modelled yet. */
  co2SavedKg: number;
  /** Bangkok minutes of the day's first fix, or null before any. */
  observedSinceMin: number | null;
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
      routeId: bus?.routeId ?? book?.routeId ?? null,
      destination: bus?.destination || headingTo(book) || "",
      speedKph: bus ? Math.round(bus.speedKph) : 0,
      paxOnBoard: bus?.paxOnBoard ?? null,
      lastSeenSec,
      reporting: lastSeenSec * 1000 <= FRESH_FIX_MS,
      trips: trips.length,
      km: Math.round((book?.km ?? 0) * 10) / 10,
      riders: trips.reduce((sum, trip) => sum + trip.riders, 0),
      fareThb: trips.reduce((sum, trip) => sum + trip.riders * trip.fareThb, 0),
    });
  }
  rows.sort((a, b) =>
    Number(b.reporting) - Number(a.reporting)
    || Number(b.routeId !== null) - Number(a.routeId !== null)
    || b.fareThb - a.fareThb
    || a.plate.localeCompare(b.plate));

  const reporting = rows.filter((row) => row.reporting);
  const counters = reporting.filter((row) => row.paxOnBoard !== null);
  const airportRiders = ledger.trips.filter((t) => t.routeId === "rawai-airport").reduce((s, t) => s + t.riders, 0);

  return {
    busesReporting: reporting.length,
    busesMoving: reporting.filter((row) => row.speedKph > 4).length,
    busesOnLine: reporting.filter((row) => row.routeId !== null).length,
    paxOnBoardNow: counters.length > 0 ? counters.reduce((sum, row) => sum + (row.paxOnBoard ?? 0), 0) : null,
    tripsCompleted: ledger.trips.length,
    kmDriven: Math.round(rows.reduce((sum, row) => sum + row.km, 0)),
    riders: ledger.trips.reduce((sum, trip) => sum + trip.riders, 0),
    ridersCounted: ledger.trips.filter((t) => t.basis === "apc-count").reduce((s, t) => s + t.riders, 0),
    fareThb: ledger.trips.reduce((sum, trip) => sum + trip.riders * trip.fareThb, 0),
    co2SavedKg: Math.round(airportRiders * ROI_CONSTANTS.avgTripKm * CO2_KG_PER_PAX_KM_SAVED),
    observedSinceMin: ledger.firstFixMs === null ? null : Math.floor(getBangkokNowFractionalMinutes(new Date(ledger.firstFixMs))),
    rows,
  };
}

// ── runtime: poll, persist, tween, notify ──────────────────────────────────
export type LiveFeedStatus = "connecting" | "live" | "quiet" | "offline";

type Tween = { fromLat: number; fromLng: number; toLat: number; toLng: number; startMs: number };

const STORAGE_KEY = "pksb.liveLedger.v2";
const listeners = new Set<() => void>();
const tweens = new Map<string, Tween>();
let ledger: LiveLedger = loadLedger();
let buses: LiveBus[] = [];
let status: LiveFeedStatus = "connecting";
let detail: string | null = null;
let lastOkMs: number | null = null;
let pollCount = 0;
let okCount = 0;
/** Bangkok-zone ISO timestamp the server stamped on the last successful upstream poll. */
let fetchedAtMs: number | null = null;
/** Which upstreams answered the last poll. `null` before the first successful fetch. */
let sources: { keyless: boolean; token: boolean } | null = null;
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
    status = "offline";
    detail = feed.detail ?? null;
    return;
  }
  okCount += 1;
  lastOkMs = nowMs;
  detail = null;
  buses = feed.vehicles;
  // Server stamps `fetchedAt` on every successful poll — the edge relay hits
  // both upstreams, then echoes whichever answered. The Fleet Detail screen
  // surfaces this so an operator can tell "the relay polled at 11:08:33"
  // apart from "the GPS device took this fix at 11:08:13".
  const parsedFetched = Date.parse(feed.fetchedAt);
  fetchedAtMs = Number.isFinite(parsedFetched) ? parsedFetched : nowMs;
  sources = feed.sources ?? { keyless: true, token: false };
  for (const bus of buses) {
    const tween = tweens.get(bus.plate);
    if (!tween) {
      tweens.set(bus.plate, { fromLat: bus.lat, fromLng: bus.lng, toLat: bus.lat, toLng: bus.lng, startMs: nowMs });
    } else if (tween.toLat !== bus.lat || tween.toLng !== bus.lng) {
      const shown = lerpPosition(tween, nowMs);
      tweens.set(bus.plate, { fromLat: shown.lat, fromLng: shown.lng, toLat: bus.lat, toLng: bus.lng, startMs: nowMs });
    }
  }
  ledger = applySnapshot(ledger, buses, nowMs);
  saveLedger();
  const reporting = buses.some((bus) => nowMs - Date.parse(bus.updatedAt) <= FRESH_FIX_MS);
  status = reporting ? "live" : "quiet";
}

async function pollOnce() {
  pollCount += 1;
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
  return {
    status,
    detail,
    lastOkMs,
    fetchedAtMs,
    sources,
    pollCount,
    okCount,
    feedAgeSec: lastOkMs === null ? null : Math.round((nowMs - lastOkMs) / 1000),
    /** Bangkok date the ledger is summing (rolls over at Bangkok midnight). */
    ledgerDate: ledger.date,
    summary: summarizeLedger(ledger, buses, nowMs),
  };
}

/**
 * The full set of live buses from the last successful upstream poll — every
 * field the tracker sent, no summarisation. The Fleet Detail screen reads
 * this directly so a curious operator can see lat / lng / heading / pax
 * counters / odometer / online flag per plate, none of which survive the
 * map-vehicle projection.
 */
export function getLiveBusesRaw(): readonly LiveBus[] {
  return buses;
}

/**
 * The day ledger (per-plate votes, trips, km, boardings, APC flag, terminal
 * dwell state). Plain object — the Fleet Detail screen joins it with
 * `getLiveBusesRaw()` on the client to draw one row per bus with every
 * ledger field and every raw tracker field visible.
 */
export function getLiveLedgerSnapshot(): LiveLedger {
  return ledger;
}

/** Map instrument shape, tweened between the last two real fixes so a 15 s
 *  feed glides instead of jumping (at most one poll behind the tracker). */
export function getLiveMapVehicles(nowMs = Date.now()): SimState["vehicles"] {
  const nowMin = getBangkokNowFractionalMinutes(new Date(nowMs));
  return buses
    .filter((bus) => nowMs - Date.parse(bus.updatedAt) <= FRESH_FIX_MS)
    .map((bus) => {
      const tween = tweens.get(bus.plate);
      const pos = tween ? lerpPosition(tween, nowMs) : { lat: bus.lat, lng: bus.lng };
      const book = ledger.vehicles[bus.plate];
      const routeId = bus.routeId ?? book?.routeId ?? null;
      let pax = bus.paxOnBoard ?? 0;
      if (bus.paxOnBoard === null && routeId) {
        const to = headingTo(book) ?? bus.destination;
        pax = estimateTripRiders(routeId, to, book?.leftTerminalMin ?? nowMin - typicalTripMinutes(routeId) / 2, ledger.dow).riders;
      }
      return {
        id: `live-${bus.plate}`,
        lat: pos.lat,
        lng: pos.lng,
        heading: bus.heading,
        status: bus.speedKph > 4 ? "moving" : "dwelling",
        route: routeId ?? "unassigned",
        pax,
        paxEstimated: bus.paxOnBoard === null,
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
  fetchedAtMs = null;
  sources = null;
  pollCount = 0;
  okCount = 0;
}
