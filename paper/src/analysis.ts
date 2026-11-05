/**
 * The preprint's analysis. Every figure and table in the paper is a field of
 * the Results object this module returns, computed from the raw record with
 * the same rules the live research pages use (shared/research.ts), set
 * against the official PKSB timetable (src/data/timetables). Nothing here is
 * modelled: the scenario arithmetic lives in scenario.ts and is labelled so.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { analyzeDay, serviceDayWindow, serviceMinute, type ResearchFix, type ResearchDay } from "../../shared/research";
import type { RawFix, WeekRow } from "./record";
import { gaps, headwayCv, matchToSchedule, median, quantile, round, summarize, type Summary } from "./stats";

// ── the official timetable ─────────────────────────────────────────────────
type TimetableFile = { stops: { id: string; name: string; lat: number; lng: number }[]; departures: { trip: number; times: (string | null)[] }[] };
const timetablePath = (name: string) => fileURLToPath(new URL(`../../src/data/timetables/${name}.json`, import.meta.url));
const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h! * 60 + m!; };

export type PublishedTrip = { trip: number; originStop: string; departMin: number; endToEndMin: number; startsAtTerminal: boolean };
export type PublishedDirection = { trips: PublishedTrip[]; terminal: string };

function readPublished(name: string): PublishedDirection {
  const tt = JSON.parse(readFileSync(timetablePath(name), "utf8")) as TimetableFile;
  const terminal = tt.stops[0]!.name;
  const trips = tt.departures.map((dep) => {
    const idx = dep.times.map((t, i) => (t ? i : -1)).filter((i) => i >= 0);
    const first = dep.times[idx[0]!]!;
    const last = dep.times[idx[idx.length - 1]!]!;
    // Service minutes run past midnight (a 00:15 arrival is 1455), and the
    // forward difference keeps a trip that crosses midnight positive.
    const departMin = toMin(first) < 180 ? toMin(first) + 1440 : toMin(first);
    const endToEndMin = (((toMin(last) - toMin(first)) % 1440) + 1440) % 1440;
    return { trip: dep.trip, originStop: tt.stops[idx[0]!]!.name, departMin, endToEndMin, startsAtTerminal: idx[0] === 0 };
  });
  return { trips, terminal };
}

/** "fwd" = Airport → Rawai (line.from → line.to); "rev" = Rawai → Airport. */
export const PUBLISHED = { fwd: readPublished("airport-to-rawai"), rev: readPublished("rawai-to-airport") };

// ── per-day measurement ────────────────────────────────────────────────────
const HKT: [number, number] = [8.108, 98.3168];
const AIRPORT_RADIUS_KM = 1;
const MOVE_STEP_M = 50;
const MOVE_STEP_MAX_MS = 3 * 60_000;
const HALT_FOR_RUN_MS = 10 * 60_000;
const MAX_STEP_KPH = 120;
const COVERAGE_FROM_MIN = 5 * 60;
const COVERAGE_TO_MIN = 24 * 60;
/** TCQSM on-time window: up to 1 minute early, up to 5 minutes late. */
const ON_TIME: [number, number] = [-1, 5];
const MATCH_WINDOW_MIN = 30;

function km(a: [number, number], b: [number, number]): number {
  const kx = 111.32 * Math.cos((a[0] * Math.PI) / 180);
  return Math.hypot((b[1] - a[1]) * kx, (b[0] - a[0]) * 110.54);
}

export function dowOf(date: string): number {
  return new Date(`${date}T12:00:00+07:00`).getUTCDay();
}

export type TownBusDay = {
  date: string;
  plate: string;
  fixes: number;
  odometerKm: number | null;
  gpsKm: number;
  hoursMoving: number;
  runs: number;
  reachedAirport: boolean;
  firstMoveMin: number | null;
  lastMoveMin: number | null;
  /** 96 quarter-hours of the service clock (00:00–24:00): did this bus move in it? */
  movingBins: boolean[];
};

/** Grid cell for the town-fleet density map: 0.0025° ≈ 275 m at Phuket's latitude. */
export const DENSITY_CELL_DEG = 0.0025;
const cellKey = (lat: number, lng: number) => `${Math.round(lat / DENSITY_CELL_DEG)}:${Math.round(lng / DENSITY_CELL_DEG)}`;

/** One bus-day of the town fleet, by the study archive's rules. */
export function measureBusDay(date: string, fixes: RawFix[], dayStartMs: number): TownBusDay {
  const list = [...fixes].sort((a, b) => a.fixMs - b.fixMs);
  let gpsKm = 0, odoKm = 0, odoSeen = false, movingMs = 0, runs = 0;
  let lastMoveMs: number | null = null, firstMoveMs: number | null = null;
  let reachedAirport = false;
  const movingBins: boolean[] = new Array(96).fill(false);
  for (let i = 0; i < list.length; i++) {
    const f = list[i]!;
    if (km([f.lat, f.lng], HKT) <= AIRPORT_RADIUS_KM) reachedAirport = true;
    if (i === 0) continue;
    const p = list[i - 1]!;
    const dt = f.fixMs - p.fixMs;
    if (dt <= 0) continue;
    const stepKm = km([p.lat, p.lng], [f.lat, f.lng]);
    const plausible = stepKm / (dt / 3_600_000) <= MAX_STEP_KPH;
    if (plausible && stepKm * 1000 >= 15) gpsKm += stepKm;
    if (f.odometerM !== null && p.odometerM !== null) {
      odoSeen = true;
      const d = (f.odometerM - p.odometerM) / 1000;
      // An odometer only goes forward, and not faster than the bus can drive.
      if (d > 0 && d / (dt / 3_600_000) <= MAX_STEP_KPH) odoKm += d;
    }
    if (plausible && stepKm * 1000 >= MOVE_STEP_M && dt <= MOVE_STEP_MAX_MS) {
      movingMs += dt;
      if (lastMoveMs === null || f.fixMs - lastMoveMs >= HALT_FOR_RUN_MS + dt) runs += 1;
      if (firstMoveMs === null) firstMoveMs = p.fixMs;
      lastMoveMs = f.fixMs;
      const bin = Math.floor(serviceMinute(f.fixMs, dayStartMs) / 15);
      if (bin >= 0 && bin < 96) movingBins[bin] = true;
    }
  }
  return {
    date,
    plate: list[0]?.plate ?? "",
    fixes: list.length,
    odometerKm: odoSeen ? round(odoKm, 1) : null,
    gpsKm: round(gpsKm, 1)!,
    hoursMoving: round(movingMs / 3_600_000, 2)!,
    runs,
    reachedAirport,
    firstMoveMin: firstMoveMs === null ? null : serviceMinute(firstMoveMs, dayStartMs),
    lastMoveMin: lastMoveMs === null ? null : serviceMinute(lastMoveMs, dayStartMs),
    movingBins,
  };
}

export type LineTrip = { date: string; routeId: string; plate: string; dir: "fwd" | "rev" | "lap"; departMin: number; arriveMin: number; minutes: number; avgKph: number };
export type LineDeparture = { date: string; routeId: string; plate: string; dir: "fwd" | "rev"; departMin: number };

export type DayResult = {
  date: string;
  dow: number;
  fixes: number;
  fixesByFeed: Record<string, number>;
  platesByFeed: Record<string, string[]>;
  /** Median seconds between a bus's consecutive fixes, per feed (median over buses). */
  sampleSecByFeed: Record<string, number | null>;
  /** Share of 05:00–24:00 minutes with at least one fix from that feed. */
  coverageByFeed: Record<string, number>;
  counterFixes: number;
  counterPositive: number;
  busesByLine: Record<string, number>;
  unassigned: { plate: string; feed: string }[];
  trips: LineTrip[];
  departures: LineDeparture[];
  town: TownBusDay[];
  /** Moving town-fleet fixes per ~275 m cell. */
  townCells: Map<string, number>;
  /** Kept only for the Marey figure of the day the paper draws. */
  research: ResearchDay;
};

export function analyzeServiceDay(date: string, rows: RawFix[]): DayResult {
  const window = serviceDayWindow(date)!;
  const dayStartMs = window[0];
  const fixesByFeed: Record<string, number> = {};
  const platesByFeedSet: Record<string, Set<string>> = {};
  const byPlate = new Map<string, RawFix[]>();
  let counterFixes = 0, counterPositive = 0;
  for (const r of rows) {
    fixesByFeed[r.feed] = (fixesByFeed[r.feed] ?? 0) + 1;
    (platesByFeedSet[r.feed] ??= new Set()).add(r.plate);
    const list = byPlate.get(r.plate) ?? [];
    list.push(r);
    byPlate.set(r.plate, list);
    if (r.paxOnBoard !== null) { counterFixes++; if (r.paxOnBoard > 0) counterPositive++; }
  }

  const sampleSecByFeed: Record<string, number | null> = {};
  const coverageByFeed: Record<string, number> = {};
  for (const feed of Object.keys(fixesByFeed)) {
    const medians: number[] = [];
    const minutes = new Set<number>();
    for (const [, list] of byPlate) {
      if (list[0]!.feed !== feed) continue;
      const times = list.map((f) => f.fixMs).sort((a, b) => a - b);
      const g = gaps(times).filter((d) => d > 0).map((d) => d / 1000);
      const m = median(g);
      if (m !== null) medians.push(m);
      for (const t of times) {
        const min = Math.floor(serviceMinute(t, dayStartMs));
        if (min >= COVERAGE_FROM_MIN && min < COVERAGE_TO_MIN) minutes.add(min);
      }
    }
    sampleSecByFeed[feed] = round(median(medians), 0);
    coverageByFeed[feed] = round(minutes.size / (COVERAGE_TO_MIN - COVERAGE_FROM_MIN), 3)!;
  }

  const fixes: ResearchFix[] = rows.map((r) => ({ plate: r.plate, fixMs: r.fixMs, lat: r.lat, lng: r.lng, speedKph: r.speedKph, routeId: r.routeId, feed: r.feed }));
  const research = analyzeDay(date, fixes);
  const busesByLine: Record<string, number> = {};
  const trips: LineTrip[] = [];
  const departures: LineDeparture[] = [];
  for (const line of research.lines) {
    busesByLine[line.routeId] = line.buses.length;
    for (const t of line.trips) {
      trips.push({ date, routeId: line.routeId, plate: t.plate, dir: t.dir, departMin: serviceMinute(t.departMs, dayStartMs), arriveMin: serviceMinute(t.arriveMs, dayStartMs), minutes: t.minutes, avgKph: t.avgKph });
    }
    for (const d of line.departures) {
      departures.push({ date, routeId: line.routeId, plate: d.plate, dir: d.dir, departMin: serviceMinute(d.departMs, dayStartMs) });
    }
  }

  const unassignedPlates = new Set(research.unassigned.map((u) => u.plate));
  const town = [...byPlate.entries()]
    .filter(([plate]) => unassignedPlates.has(plate))
    .map(([, list]) => measureBusDay(date, list, dayStartMs))
    .sort((a, b) => a.plate.localeCompare(b.plate));
  const townCells = new Map<string, number>();
  for (const r of rows) {
    if (!unassignedPlates.has(r.plate) || (r.speedKph ?? 0) <= 5) continue;
    const k = cellKey(r.lat, r.lng);
    townCells.set(k, (townCells.get(k) ?? 0) + 1);
  }

  return {
    date, dow: dowOf(date), fixes: rows.length, fixesByFeed,
    platesByFeed: Object.fromEntries(Object.entries(platesByFeedSet).map(([k, v]) => [k, [...v].sort()])),
    sampleSecByFeed, coverageByFeed, counterFixes, counterPositive, busesByLine,
    unassigned: research.unassigned.map((u) => ({ plate: u.plate, feed: u.feed })),
    trips, departures, town, townCells, research,
  };
}

// ── across days ────────────────────────────────────────────────────────────
export type DirectionDay = {
  date: string;
  dow: number;
  dir: "fwd" | "rev";
  busesOnLine: number;
  published: number;
  recordedDepartures: number;
  completeTrips: number;
  matched: number;
  onTime: number;
  firstDepartureMin: number | null;
  lastDepartureMin: number | null;
  medianHeadwayMin: number | null;
  headwayCv: number | null;
  longestGapMin: number | null;
};

export type Results = {
  generatedAt: string;
  record: {
    firstDay: string;
    lastDay: string;
    serviceDays: number;
    fixes: number;
    fixesByFeed: Record<string, number>;
    platesByFeed: Record<string, number>;
    sampleSecByFeed: Record<string, number | null>;
    coverageByFeed: Record<string, { median: number | null; daysBelow90: number }>;
    counterFixes: number;
    counterPositive: number;
    daysByDow: number[];
  };
  published: {
    fwd: { departures: number; fromTerminal: number; firstMin: number; lastMin: number; endToEnd: Summary; headway: Summary; headwayCv: number | null };
    rev: { departures: number; fromTerminal: number; firstMin: number; lastMin: number; endToEnd: Summary; headway: Summary; headwayCv: number | null };
  };
  airport: {
    lengthKm: number;
    busesOnLine: Summary;
    days: DirectionDay[];
    delivery: Record<"fwd" | "rev", { recordedPerDay: Summary; completePerDay: Summary; publishedPerDay: number; ratio: number | null }>;
    running: Record<"fwd" | "rev", { recorded: Summary; published: Summary; shareSlowerThanPublishedMedian: number | null }>;
    runningByHour: { dir: "fwd" | "rev"; hour: number; n: number; p50: number | null; p85: number | null }[];
    /** Every matched departure's recorded − published minutes, for the histogram. */
    deviations: Record<"fwd" | "rev", number[]>;
    adherence: Record<"fwd" | "rev", { scheduled: number; matched: number; deviation: Summary; onTimeShare: number | null; earlyShare: number | null; lateShare: number | null; unobservedShare: number | null }>;
    headway: Record<"fwd" | "rev", { recordedMedian: number | null; cvMedianDays: number | null; publishedCv: number | null; bunchedShare: number | null; longestGapMedian: number | null }>;
    speedKph: Summary;
  };
  otherLines: { routeId: string; buses: Summary; tripsPerDay: Summary; minutes: Summary }[];
  town: {
    /** Median (and max) number of town buses moving in each quarter-hour, across days. */
    activity: { bin: number; median: number; max: number }[];
    /** Moving fixes per ~275 m cell, all days: [lat, lng, fixes]. */
    density: [number, number, number][];
    busDays: number; plates: number; odometerKm: Summary; gpsKm: Summary; odoToGpsRatio: number | null; hoursMoving: Summary; runs: Summary; reachedAirportShare: number | null; busesPerDay: Summary; firstMove: Summary; lastMove: Summary };
  archive: { days: number; kmPerDay: Summary; hoursMovingPerDay: Summary; busesMovedPerDay: Summary; countersReportingMax: number | null };
  crossCheck: { days: number; agreeingDays: number; serverTrips: number; localTrips: number } | null;
  /** The day the paper draws as a Marey diagram: the median day by recorded departures. */
  mareyDay: string | null;
};

const DIRS = ["fwd", "rev"] as const;

function hourOf(min: number): number {
  return Math.floor(min / 60) % 24;
}

export function aggregate(days: DayResult[], week: WeekRow[], period: { days?: { date: string; lines: { routeId: string; trips: unknown[] }[] }[] } | null): Results {
  if (days.length === 0) throw new Error("no service days in the record");
  const trips = days.flatMap((d) => d.trips);
  const deps = days.flatMap((d) => d.departures);
  const airportTrips = trips.filter((t) => t.routeId === "rawai-airport");
  const airportLine = days[0]!.research.lines.find((l) => l.routeId === "rawai-airport")!;

  // record
  const fixesByFeed: Record<string, number> = {};
  const platesByFeed: Record<string, Set<string>> = {};
  const sampleByFeed: Record<string, number[]> = {};
  const coverageByFeed: Record<string, number[]> = {};
  const daysByDow = [0, 0, 0, 0, 0, 0, 0];
  for (const d of days) {
    daysByDow[d.dow]! += 1;
    for (const [f, n] of Object.entries(d.fixesByFeed)) fixesByFeed[f] = (fixesByFeed[f] ?? 0) + n;
    for (const [f, ps] of Object.entries(d.platesByFeed)) for (const p of ps) (platesByFeed[f] ??= new Set()).add(p);
    for (const [f, s] of Object.entries(d.sampleSecByFeed)) if (s !== null) (sampleByFeed[f] ??= []).push(s);
    for (const [f, c] of Object.entries(d.coverageByFeed)) (coverageByFeed[f] ??= []).push(c);
  }

  // published
  const pub = (dir: "fwd" | "rev") => {
    const p = PUBLISHED[dir];
    const times = p.trips.map((t) => t.departMin);
    const fromTerminal = p.trips.filter((t) => t.startsAtTerminal);
    return {
      departures: p.trips.length,
      fromTerminal: fromTerminal.length,
      firstMin: Math.min(...times),
      lastMin: Math.max(...times),
      endToEnd: summarize(p.trips.map((t) => t.endToEndMin)),
      headway: summarize(gaps(times)),
      headwayCv: round(headwayCv(gaps(times)), 3),
    };
  };
  const published = { fwd: pub("fwd"), rev: pub("rev") };

  // airport line, day by direction
  const dirDays: DirectionDay[] = [];
  const deviations: Record<"fwd" | "rev", number[]> = { fwd: [], rev: [] };
  const adherenceCounts = { fwd: { scheduled: 0, matched: 0 }, rev: { scheduled: 0, matched: 0 } };
  for (const d of days) {
    for (const dir of DIRS) {
      const sched = PUBLISHED[dir].trips.filter((t) => t.startsAtTerminal).map((t) => t.departMin);
      const obs = d.departures.filter((x) => x.routeId === "rawai-airport" && x.dir === dir).map((x) => x.departMin).sort((a, b) => a - b);
      const complete = d.trips.filter((x) => x.routeId === "rawai-airport" && x.dir === dir).length;
      const m = matchToSchedule(obs, sched, MATCH_WINDOW_MIN);
      const busesOnLine = d.busesByLine["rawai-airport"] ?? 0;
      // A day with no bus on the line is a gap in the record, not a day of no service: it is kept
      // in the count of days but left out of every rate.
      if (busesOnLine > 0) {
        adherenceCounts[dir].scheduled += sched.length;
        adherenceCounts[dir].matched += m.pairs.length;
        deviations[dir].push(...m.pairs.map((p) => p.deviation));
      }
      const hw = gaps(obs);
      dirDays.push({
        date: d.date, dow: d.dow, dir, busesOnLine,
        published: PUBLISHED[dir].trips.length,
        recordedDepartures: obs.length,
        completeTrips: complete,
        matched: m.pairs.length,
        onTime: m.pairs.filter((p) => p.deviation >= ON_TIME[0] && p.deviation <= ON_TIME[1]).length,
        firstDepartureMin: obs[0] ?? null,
        lastDepartureMin: obs[obs.length - 1] ?? null,
        medianHeadwayMin: round(median(hw), 1),
        headwayCv: round(headwayCv(hw), 3),
        longestGapMin: hw.length ? round(Math.max(...hw), 1) : null,
      });
    }
  }
  const servedDays = dirDays.filter((x) => x.busesOnLine > 0);

  const delivery = Object.fromEntries(DIRS.map((dir) => {
    const rows = servedDays.filter((x) => x.dir === dir);
    const recorded = rows.map((x) => x.recordedDepartures);
    const pubN = PUBLISHED[dir].trips.length;
    return [dir, {
      recordedPerDay: summarize(recorded),
      completePerDay: summarize(rows.map((x) => x.completeTrips)),
      publishedPerDay: pubN,
      ratio: rows.length ? round(recorded.reduce((a, b) => a + b, 0) / (rows.length * pubN), 3) : null,
    }];
  })) as Results["airport"]["delivery"];

  const running = Object.fromEntries(DIRS.map((dir) => {
    const rec = airportTrips.filter((t) => t.dir === dir).map((t) => t.minutes);
    const pubMin = PUBLISHED[dir].trips.map((t) => t.endToEndMin);
    const pubMedian = median(pubMin);
    return [dir, {
      recorded: summarize(rec),
      published: summarize(pubMin),
      shareSlowerThanPublishedMedian: rec.length && pubMedian !== null ? round(rec.filter((m) => m > pubMedian).length / rec.length, 3) : null,
    }];
  })) as Results["airport"]["running"];

  const runningByHour: Results["airport"]["runningByHour"] = [];
  for (const dir of DIRS) {
    for (let h = 0; h < 24; h++) {
      const v = airportTrips.filter((t) => t.dir === dir && hourOf(t.departMin) === h).map((t) => t.minutes);
      if (v.length) runningByHour.push({ dir, hour: h, n: v.length, p50: round(quantile(v, 0.5), 1), p85: round(quantile(v, 0.85), 1) });
    }
  }

  const adherence = Object.fromEntries(DIRS.map((dir) => {
    const dev = deviations[dir];
    const c = adherenceCounts[dir];
    return [dir, {
      scheduled: c.scheduled,
      matched: c.matched,
      deviation: summarize(dev),
      onTimeShare: dev.length ? round(dev.filter((v) => v >= ON_TIME[0] && v <= ON_TIME[1]).length / dev.length, 3) : null,
      earlyShare: dev.length ? round(dev.filter((v) => v < ON_TIME[0]).length / dev.length, 3) : null,
      lateShare: dev.length ? round(dev.filter((v) => v > ON_TIME[1]).length / dev.length, 3) : null,
      unobservedShare: c.scheduled ? round(1 - c.matched / c.scheduled, 3) : null,
    }];
  })) as Results["airport"]["adherence"];

  const headway = Object.fromEntries(DIRS.map((dir) => {
    const rows = servedDays.filter((x) => x.dir === dir);
    const all = days.flatMap((d) => gaps(d.departures.filter((x) => x.routeId === "rawai-airport" && x.dir === dir).map((x) => x.departMin)));
    const schedMedian = median(gaps(PUBLISHED[dir].trips.map((t) => t.departMin)));
    return [dir, {
      recordedMedian: round(median(all), 1),
      cvMedianDays: round(median(rows.map((x) => x.headwayCv).filter((v): v is number => v !== null)), 3),
      publishedCv: published[dir].headwayCv,
      // Bunching: a departure less than half the scheduled headway behind the one before it.
      bunchedShare: all.length && schedMedian ? round(all.filter((h) => h < schedMedian / 2).length / all.length, 3) : null,
      longestGapMedian: round(median(rows.map((x) => x.longestGapMin).filter((v): v is number => v !== null)), 1),
    }];
  })) as Results["airport"]["headway"];

  // other lines
  const otherLines = ["patong-old-bus-station", "dragon-line"].map((routeId) => {
    const t = trips.filter((x) => x.routeId === routeId);
    const perDay = days.filter((d) => (d.busesByLine[routeId] ?? 0) > 0).map((d) => d.trips.filter((x) => x.routeId === routeId).length);
    return {
      routeId,
      buses: summarize(days.map((d) => d.busesByLine[routeId] ?? 0)),
      tripsPerDay: summarize(perDay),
      minutes: summarize(t.map((x) => x.minutes)),
    };
  });

  // town fleet
  const town = days.flatMap((d) => d.town).filter((b) => b.hoursMoving > 0);
  const odo = town.map((b) => b.odometerKm).filter((v): v is number => v !== null);
  const odoPaired = town.filter((b) => b.odometerKm !== null && b.gpsKm > 0);
  const townPlates = new Set(town.map((b) => b.plate));

  // study archive (KV ledger) as reported by /api/collect/week
  const ar = week.filter((w) => !w.missing);

  // server's own trip analysis, for agreement
  let crossCheck: Results["crossCheck"] = null;
  if (period?.days?.length) {
    let agreeing = 0, server = 0, local = 0, compared = 0;
    for (const sd of period.days) {
      const d = days.find((x) => x.date === sd.date);
      if (!d) continue;
      compared++;
      const s = sd.lines.reduce((a, l) => a + l.trips.length, 0);
      const l = d.trips.length;
      server += s;
      local += l;
      if (s === l) agreeing++;
    }
    crossCheck = { days: compared, agreeingDays: agreeing, serverTrips: server, localTrips: local };
  }

  // Marey day: the served day whose fwd+rev recorded departures is the median.
  const totals = days
    .filter((d) => (d.busesByLine["rawai-airport"] ?? 0) > 0)
    .map((d) => ({ date: d.date, n: d.departures.filter((x) => x.routeId === "rawai-airport").length }))
    .sort((a, b) => a.n - b.n || a.date.localeCompare(b.date));
  const mareyDay = totals.length ? totals[Math.floor((totals.length - 1) / 2)]!.date : null;

  return {
    generatedAt: new Date().toISOString(),
    record: {
      firstDay: days[0]!.date,
      lastDay: days[days.length - 1]!.date,
      serviceDays: days.length,
      fixes: days.reduce((a, d) => a + d.fixes, 0),
      fixesByFeed,
      platesByFeed: Object.fromEntries(Object.entries(platesByFeed).map(([k, v]) => [k, v.size])),
      sampleSecByFeed: Object.fromEntries(Object.entries(sampleByFeed).map(([k, v]) => [k, round(median(v), 0)])),
      coverageByFeed: Object.fromEntries(Object.entries(coverageByFeed).map(([k, v]) => [k, { median: round(median(v), 3), daysBelow90: v.filter((c) => c < 0.9).length }])),
      counterFixes: days.reduce((a, d) => a + d.counterFixes, 0),
      counterPositive: days.reduce((a, d) => a + d.counterPositive, 0),
      daysByDow,
    },
    published,
    airport: {
      lengthKm: round(airportLine.lengthM / 1000, 1)!,
      busesOnLine: summarize(days.map((d) => d.busesByLine["rawai-airport"] ?? 0)),
      days: dirDays,
      delivery,
      running,
      runningByHour,
      deviations: { fwd: deviations.fwd.map((v) => round(v, 1)!), rev: deviations.rev.map((v) => round(v, 1)!) },
      adherence,
      headway,
      speedKph: summarize(airportTrips.map((t) => t.avgKph)),
    },
    otherLines,
    town: {
      activity: Array.from({ length: 96 }, (_, bin) => {
        const counts = days.map((d) => d.town.filter((b) => b.movingBins[bin]).length);
        return { bin, median: round(median(counts), 1) ?? 0, max: Math.max(...counts) };
      }),
      density: (() => {
        const all = new Map<string, number>();
        for (const d of days) for (const [k, n] of d.townCells) all.set(k, (all.get(k) ?? 0) + n);
        return [...all.entries()].map(([k, n]) => {
          const [a, b] = k.split(":").map(Number);
          return [round(a! * DENSITY_CELL_DEG, 4)!, round(b! * DENSITY_CELL_DEG, 4)!, n] as [number, number, number];
        });
      })(),
      busDays: town.length,
      plates: townPlates.size,
      odometerKm: summarize(odo),
      gpsKm: summarize(town.map((b) => b.gpsKm)),
      odoToGpsRatio: odoPaired.length ? round(median(odoPaired.map((b) => b.odometerKm! / b.gpsKm)), 3) : null,
      hoursMoving: summarize(town.map((b) => b.hoursMoving)),
      runs: summarize(town.map((b) => b.runs)),
      reachedAirportShare: town.length ? round(town.filter((b) => b.reachedAirport).length / town.length, 3) : null,
      busesPerDay: summarize(days.map((d) => d.town.filter((b) => b.hoursMoving > 0).length)),
      firstMove: summarize(town.map((b) => b.firstMoveMin).filter((v): v is number => v !== null)),
      lastMove: summarize(town.map((b) => b.lastMoveMin).filter((v): v is number => v !== null)),
    },
    archive: {
      days: ar.length,
      kmPerDay: summarize(ar.map((w) => w.totalKmTracked).filter((v): v is number => v !== null)),
      hoursMovingPerDay: summarize(ar.map((w) => w.totalHoursMoving).filter((v): v is number => v !== null)),
      busesMovedPerDay: summarize(ar.map((w) => w.busesMoved).filter((v): v is number => v !== null)),
      countersReportingMax: ar.length ? Math.max(...ar.map((w) => w.countersReporting ?? 0)) : null,
    },
    crossCheck,
    mareyDay,
  };
}
