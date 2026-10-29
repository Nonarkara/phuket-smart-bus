/**
 * The service of today — what the trackers recorded — and the plan it ran
 * against.
 *
 * THE PROBLEM THIS SOLVES
 *   The operations wall in LIVE mode knew two things: where the buses are (the
 *   tracker relay, every 15 s) and what this browser had observed since it
 *   opened (a ledger in localStorage). Open the wall at 16:00 and it said
 *   "3 trips completed, observed since 09:14" — because that was all this tab
 *   had seen. The record knows better: the research archive holds every fix
 *   of the day, and the service endpoint projects it into the trips the
 *   buses actually ran. A wall screen is not a browser tab that happened to
 *   be left open; it is the operator's window onto the service.
 *
 * WHAT IS REAL AND WHAT IS NOT
 *   Every number in this module comes from one of two places, and the module
 *   never mixes them silently:
 *     recorded   — the trips the trackers saw, end to end. A trip whose
 *                  tracker went quiet mid-run leaves no trip, so this
 *                  UNDERCOUNTS the service. That is a property of the
 *                  record, not an estimate, and the panel says so.
 *     published  — the official PKSB timetable (src/data/timetables/*.json),
 *                  read through the engine's own accessor so the plan is one
 *                  source and not a number written down twice.
 *   Nothing here estimates riders, fares or demand: no counter has ever
 *   reported, so those stay modelled, and modelled where they are modelled.
 *
 * THE FRAME
 *   A service day runs 03:00 → 03:00 Bangkok, so a trip that arrives at 00:30
 *   belongs to the day that started the previous morning. Both sides of every
 *   comparison are therefore expressed in the same frame — minutes since the
 *   service day's midnight (03:00 → 180, 00:30 → 1470) — so a 23:30
 *   departure and a 00:30 arrival are 60 minutes apart, not −1380.
 */
import type { ServiceDay, ServiceDeparture, ServiceLine, ServiceTrip } from "@shared/research";
import { quantile } from "@shared/insights";
import {
  getLiveAirportSupply,
  getPublishedAirportTrips,
  setLiveAirportSupply,
  type AirportboundTrip,
  type LiveAirportSupply,
  type PublishedTrip,
} from "./fleetSimulator";
import { bangkokServiceDate, getBangkokNowMinutes } from "./time";
import { appPath } from "../lib/paths";

/** A service day starts at 03:00 Bangkok. */
export const SERVICE_START_MIN = 180;

/** Minutes since the service day's midnight → the same minute on the wall clock. */
export function toServiceFrame(minute: number): number {
  return ((minute - SERVICE_START_MIN + 1440) % 1440) + SERVICE_START_MIN;
}

/**
 * The collector's day ledger, in the numbers the wall shows: how far the
 * fleet drove today, how many runs it made, how much of the service window
 * was sampled. Null means the collector never wrote that day — unknown, not
 * zero.
 */
export type FleetTotals = {
  date: string;
  vehicles: number | null;
  moved: number | null;
  km: number | null;
  kmBasis: string | null;
  runs: number | null;
  hoursMoving: number | null;
  reachedAirport: number | null;
  noFix: number | null;
  countersReporting: number | null;
  coveragePct: number | null;
  updatedAt: number | null;
};

/** The service day as the wall reads it: the trips, and the fleet's day. */
export type LiveServiceDay = ServiceDay & { fleet: FleetTotals | null };

/** One direction of a line: the plan, and what the record holds. */
export type DirectionService = {
  /** Published departure minutes (the plan). */
  published: number[];
  /**
   * Departure minutes the record holds — known as the bus leaves the
   * terminal, so they are the service that has actually gone out.
   */
  departed: number[];
  /** Arrival minutes of the trips that ran end to end. */
  arrived: number[];
  /** Median end-to-end minutes of the published trips. */
  publishedTripMin: number | null;
  /** Median end-to-end minutes of the recorded trips. */
  recordedTripMin: number | null;
  /** Median gap between consecutive published departures. */
  publishedGapMin: number | null;
  /** Median gap between consecutive recorded departures. */
  recordedGapMin: number | null;
  /** Published departures still to come today. */
  stillDue: number;
  /** The last departure the record holds. */
  lastRecordedMin: number | null;
  /** The next departure the plan says. */
  nextPublishedMin: number | null;
};

/** The Airport line's day, plan against record. */
export type AirportService = {
  date: string;
  finished: boolean;
  computedAt: string;
  southbound: DirectionService;
  northbound: DirectionService;
  /** Buses the record saw today, on any line. */
  busesSeen: number;
  /** Trips the record holds today, on any line. */
  tripsRecorded: number;
  /** Fixes in the record today. */
  fixes: number;
  /** Per line: how many buses reported and how many trips ran. */
  lines: { routeId: string; name: string; buses: number; trips: number }[];
};

const medianGap = (minutes: number[]): number | null => {
  if (minutes.length < 2) return null;
  const gaps: number[] = [];
  for (let i = 1; i < minutes.length; i++) gaps.push(minutes[i]! - minutes[i - 1]!);
  return quantile(gaps, 0.5);
};

const round1 = (n: number | null): number | null => (n === null ? null : Math.round(n * 10) / 10);

/**
 * One direction, measured against the plan.
 *
 * `nowMin` is the wall clock in minutes; the published grid is read in the
 * service-day frame so "still due" is right on both sides of midnight.
 *
 * The two counts are different facts and are kept apart: `departed` is what
 * has left the terminal — known the moment the bus does, so the wall can
 * count the seats that have gone out while the bus is still running — and
 * `arrived` is what reached the other end, an hour or two later.
 */
export function directionService(
  published: PublishedTrip[],
  recorded: ServiceTrip[],
  departures: ServiceDeparture[],
  nowMin: number,
): DirectionService {
  const now = toServiceFrame(nowMin);
  const publishedDepartures = published.map((t) => t.departMin).sort((a, b) => a - b);
  // Every trip that arrived also left; the record holds its departure whether or
  // not the bus was seen clear of the zone first (an older body has no
  // departures at all). Keyed by bus and minute so one run is counted once.
  const left = new Map<string, number>();
  for (const d of departures) left.set(`${d.plate}@${d.departMin}`, d.departMin);
  for (const t of recorded) left.set(`${t.plate}@${t.departMin}`, t.departMin);
  const departed = [...left.values()].sort((a, b) => a - b);
  const arrived = recorded.map((t) => t.arriveMin).sort((a, b) => a - b);
  const publishedTripMinutes = published.map((t) => t.minutes);
  const recordedTripMinutes = recorded.map((t) => t.minutes);
  const stillDue = publishedDepartures.filter((d) => toServiceFrame(d) > now).length;
  const nextPublished = publishedDepartures.find((d) => toServiceFrame(d) > now) ?? null;
  return {
    published: publishedDepartures,
    departed,
    arrived,
    publishedTripMin: round1(quantile(publishedTripMinutes, 0.5)),
    recordedTripMin: round1(quantile(recordedTripMinutes, 0.5)),
    publishedGapMin: round1(medianGap(publishedDepartures)),
    recordedGapMin: round1(medianGap(departed)),
    stillDue,
    lastRecordedMin: departed.length ? departed[departed.length - 1]! : null,
    nextPublishedMin: nextPublished,
  };
}

/** Parse the service endpoint's body. Anything unexpected is null, never a guess. */
export function parseServiceDay(raw: unknown): LiveServiceDay | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as Partial<LiveServiceDay> & { ok?: boolean; fleet?: unknown };
  if (body.ok === false) return null;
  if (typeof body.date !== "string" || !Array.isArray(body.lines)) return null;
  const lines: ServiceLine[] = [];
  for (const line of body.lines) {
    if (!line || typeof line.routeId !== "string" || !Array.isArray(line.trips)) return null;
    const trips: ServiceTrip[] = [];
    for (const trip of line.trips) {
      if (
        !trip ||
        typeof trip.plate !== "string" ||
        typeof trip.departMin !== "number" ||
        typeof trip.arriveMin !== "number" ||
        !Number.isFinite(trip.departMin) ||
        !Number.isFinite(trip.arriveMin)
      ) {
        return null;
      }
      trips.push({
        plate: trip.plate,
        dir: trip.dir,
        departMin: trip.departMin,
        arriveMin: trip.arriveMin,
        minutes: typeof trip.minutes === "number" ? trip.minutes : 0,
      });
    }
    // `departures` is newer than the endpoint's first shape: a body without it
    // (an older cache, an older deploy) has no departures, which is "none
    // recorded" and not a reason to refuse the day.
    const departures: ServiceDeparture[] = [];
    if (Array.isArray(line.departures)) {
      for (const d of line.departures) {
        if (d && typeof d.plate === "string" && typeof d.departMin === "number" && Number.isFinite(d.departMin) && (d.dir === "fwd" || d.dir === "rev")) {
          departures.push({ plate: d.plate, dir: d.dir, departMin: d.departMin });
        }
      }
    }
    lines.push({
      routeId: line.routeId,
      name: typeof line.name === "string" ? line.name : line.routeId,
      from: typeof line.from === "string" ? line.from : "",
      to: typeof line.to === "string" ? line.to : "",
      loop: Boolean(line.loop),
      lengthM: typeof line.lengthM === "number" ? line.lengthM : 0,
      buses: typeof line.buses === "number" ? line.buses : 0,
      trips,
      departures,
    });
  }
  return {
    date: body.date,
    finished: Boolean(body.finished),
    computedAt: typeof body.computedAt === "string" ? body.computedAt : "",
    fixes: typeof body.fixes === "number" ? body.fixes : 0,
    lines,
    unassigned: typeof body.unassigned === "number" ? body.unassigned : 0,
    fleet: parseFleetTotals(body.fleet),
  };
}

/** The collector's day ledger, or null when the collector wrote nothing. */
export function parseFleetTotals(raw: unknown): FleetTotals | null {
  if (!raw || typeof raw !== "object") return null;
  const f = raw as Record<string, unknown>;
  if (typeof f.date !== "string") return null;
  const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
  return {
    date: f.date,
    vehicles: num(f.vehicles),
    moved: num(f.moved),
    km: num(f.km),
    kmBasis: typeof f.kmBasis === "string" ? f.kmBasis : null,
    runs: num(f.runs),
    hoursMoving: num(f.hoursMoving),
    reachedAirport: num(f.reachedAirport),
    noFix: num(f.noFix),
    countersReporting: num(f.countersReporting),
    coveragePct: num(f.coveragePct),
    updatedAt: num(f.updatedAt),
  };
}

/** The Airport line's day: the plan against the record, and the day in numbers. */
export function airportService(day: LiveServiceDay, nowMin: number): AirportService {
  const published = getPublishedAirportTrips();
  const airport = day.lines.find((l) => l.routeId === "rawai-airport");
  const southbound = airport?.trips.filter((t) => t.dir === "fwd") ?? [];
  const northbound = airport?.trips.filter((t) => t.dir === "rev") ?? [];
  const southDepartures = airport?.departures.filter((d) => d.dir === "fwd") ?? [];
  const northDepartures = airport?.departures.filter((d) => d.dir === "rev") ?? [];
  return {
    date: day.date,
    finished: day.finished,
    computedAt: day.computedAt,
    southbound: directionService(published.southbound, southbound, southDepartures, nowMin),
    northbound: directionService(published.northbound, northbound, northDepartures, nowMin),
    busesSeen: day.lines.reduce((sum, l) => sum + l.buses, 0) + day.unassigned,
    tripsRecorded: day.lines.reduce((sum, l) => sum + l.trips.length, 0),
    fixes: day.fixes,
    lines: day.lines.map((l) => ({ routeId: l.routeId, name: l.name, buses: l.buses, trips: l.trips.length })),
  };
}

/**
 * The supply in force today: the departures that ran, plus the ones still due.
 *
 * The recorded departures are in the past by definition — a trip is in the
 * record because it happened. The published departures still ahead are the
 * plan for the rest of the day. A published departure that has come and gone
 * without being recorded leaves the supply: the record does not say it ran,
 * and a supply that counts seats nobody offered is not a measurement.
 */
export function liveSupplyFrom(day: LiveServiceDay, nowMin: number): LiveAirportSupply | null {
  const airport = day.lines.find((l) => l.routeId === "rawai-airport");
  if (!airport) return null;
  const now = toServiceFrame(nowMin);
  const published = getPublishedAirportTrips();

  // Southbound: only the minute a bus left is needed. A bus is a departure the
  // moment it is clear of the zone, so the record holds it for the hour or two
  // before its trip is published; a trip with no recorded departure (the first
  // fix past the zone was already the far end) is still a departure that ran.
  const south = new Map<string, number>();
  for (const d of airport.departures) if (d.dir === "fwd") south.set(`${d.plate}@${d.departMin}`, d.departMin);
  for (const t of airport.trips) if (t.dir === "fwd") south.set(`${t.plate}@${t.departMin}`, t.departMin);
  const recordedSouth = [...south.values()].sort((a, b) => a - b);
  const publishedSouthAhead = published.southbound.filter((t) => toServiceFrame(t.departMin) > now).map((t) => t.departMin);

  // Northbound: the engine also needs the minute the bus reaches the airport
  // curb. A completed trip has it. A bus that has left Rawai and is still on
  // the road does not, so its arrival is its departure plus the median this
  // line's recorded northbound trips took (the published median while none has
  // been recorded). That is a measured pace applied to a known departure — a
  // model, labelled as one by where it lives (the supply), never shown as a trip.
  const completedNorth: AirportboundTrip[] = airport.trips
    .filter((t) => t.dir === "rev")
    .map((t) => ({ originDepMin: t.departMin, airportArriveMin: t.arriveMin }));
  const completedKeys = new Set(airport.trips.filter((t) => t.dir === "rev").map((t) => `${t.plate}@${t.departMin}`));
  const northTrips = airport.trips.filter((t) => t.dir === "rev").map((t) => t.minutes);
  const pace = northTrips.length >= 3
    ? quantile(northTrips, 0.5)!
    : quantile(published.northbound.map((t) => t.minutes), 0.5) ?? 0;
  const onTheRoadNorth: AirportboundTrip[] = pace > 0
    ? airport.departures
        .filter((d) => d.dir === "rev" && !completedKeys.has(`${d.plate}@${d.departMin}`))
        .map((d) => ({ originDepMin: d.departMin, airportArriveMin: Math.round(d.departMin + pace) }))
    : [];
  const recordedNorth = [...completedNorth, ...onTheRoadNorth].sort((a, b) => a.originDepMin - b.originDepMin);
  const publishedNorthAhead = published.northbound
    .filter((t) => toServiceFrame(t.departMin) > now)
    .map((t) => ({ originDepMin: t.departMin, airportArriveMin: t.arriveMin }));

  const tripMinutes = airport.trips.map((t) => t.minutes);
  return {
    date: day.date,
    dow: new Date(`${day.date}T12:00:00Z`).getUTCDay(),
    southbound: [...recordedSouth, ...publishedSouthAhead].sort((a, b) => a - b),
    northbound: [...recordedNorth, ...publishedNorthAhead].sort((a, b) => a.originDepMin - b.originDepMin),
    medianTripMin: round1(quantile(tripMinutes, 0.5)),
  };
}

// ── runtime: poll the record, install the supply ──────────────────────────

/** The record does not change by the second; two minutes is a live wall's cadence. */
export const SERVICE_POLL_MS = 120_000;

export type LiveServiceState = {
  status: "idle" | "live" | "offline";
  day: LiveServiceDay | null;
  service: AirportService | null;
  /** When the record was last read. */
  fetchedAtMs: number | null;
  error: string | null;
};

let state: LiveServiceState = { status: "idle", day: null, service: null, fetchedAtMs: null, error: null };
let timer: ReturnType<typeof setInterval> | null = null;
let subscribers = 0;
const listeners = new Set<() => void>();

function publish(next: Partial<LiveServiceState>) {
  state = { ...state, ...next };
  listeners.forEach((fn) => fn());
}

/** Install the recorded service as the supply in force, if it changed. */
function installSupply(day: LiveServiceDay, nowMin: number) {
  const supply = liveSupplyFrom(day, nowMin);
  if (!supply) return;
  const current = getLiveAirportSupply();
  const same =
    current &&
    current.date === supply.date &&
    current.southbound.length === supply.southbound.length &&
    current.northbound.length === supply.northbound.length &&
    current.southbound.every((v, i) => v === supply.southbound[i]) &&
    current.northbound.every((v, i) => v.originDepMin === supply.northbound[i]?.originDepMin);
  if (same) return;
  setLiveAirportSupply(supply);
}

async function pollOnce() {
  const nowMs = Date.now();
  // The SERVICE date, not the calendar date: a service day runs 03:00 → 03:00,
  // so at 01:00 the day being served is the one that began yesterday morning.
  const date = bangkokServiceDate(nowMs);
  try {
    const res = await fetch(appPath(`/api/research/service?date=${date}`), {
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    if (!res.ok) {
      publish({ status: "offline", error: `the record answered ${res.status}` });
      return;
    }
    const day = parseServiceDay(await res.json());
    if (!day) {
      publish({ status: "offline", error: "the record's answer could not be read" });
      return;
    }
    const nowMin = getBangkokNowMinutes(new Date(nowMs));
    installSupply(day, nowMin);
    publish({ status: "live", day, service: airportService(day, nowMin), fetchedAtMs: nowMs, error: null });
  } catch (error) {
    publish({ status: "offline", error: (error as Error).message });
  }
}

/** Ref-counted: the first caller starts polling, the last stop ends it. */
export function startLiveService(): () => void {
  subscribers += 1;
  if (timer === null) {
    void pollOnce();
    timer = setInterval(() => void pollOnce(), SERVICE_POLL_MS);
  }
  return () => {
    subscribers -= 1;
    if (subscribers <= 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
      subscribers = 0;
    }
  };
}

export function subscribeLiveService(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function getLiveServiceState(): LiveServiceState {
  return state;
}

/** Test hook: forget the polled state. */
export function __resetLiveService(): void {
  state = { status: "idle", day: null, service: null, fetchedAtMs: null, error: null };
}
