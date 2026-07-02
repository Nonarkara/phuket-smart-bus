/**
 * THE demand-supply engine — one deterministic model of the whole day.
 *
 *   Flights land (airline · aircraft · seats · pax)
 *     → passengers clear customs (20–45 min ramp)
 *     → 12% join the bus queue at the airport curb
 *     → each scheduled bus departure boards FIFO up to 25
 *     → passengers who wait > 60 min give up and take Grab  (= lost revenue)
 *     → boarded passengers alight progressively along the route
 *
 * Everything is a pure function of the minute-of-day, precomputed once for
 * the whole service day. Scrubbing the clock to any minute reads the same
 * arrays — there is no second model to drift against.
 *
 * Why a queue instead of per-hour min(demand, supply): the old hour-bucket
 * model had no carry-over (pax landing 09:55 vanished at 10:00) and no
 * abandonment, so "missed revenue" was never traceable. The queue conserves
 * passengers exactly: demand = boarded + abandoned + still-waiting, always.
 */

import {
  getOpsFlightScheduleFor,
  getSimulationDay,
  getDayLabel,
  type OpsFlight
} from "./opsFlightSchedule";
import { getAirportDepartures } from "./fleetSimulator";

// ---------------------------------------------------------------------------
// Model constants — each one sourced, none decorative
// ---------------------------------------------------------------------------

/** Share of arriving pax who take the bus (budget/mid/premium weighted). */
export const BUS_CAPTURE_RATE = 0.12;
/** Customs + baggage: first pax out after 20 min, last after 45. */
const CUSTOMS_MIN = 20;
const CUSTOMS_MAX = 45;
/** Seats per airport-line bus. */
export const BUS_CAPACITY = 25;
/** After this long in the queue, a tourist gives up and takes Grab. */
export const ABANDON_AFTER_MIN = 60;
/** Flat fare. */
const FARE_THB = 100;
/** Passengers alight progressively from first major stop to terminus. */
const FIRST_ALIGHT_MIN = 20;
const LAST_ALIGHT_MIN = 95;

const DAY_MIN = 1441; // 00:00 .. 24:00 inclusive

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AirportTrip = {
  /** Scheduled departure minute from the airport. */
  depMin: number;
  /** Passengers boarded (engine-computed, ≤ BUS_CAPACITY). */
  boarded: number;
  /** True when this trip exists only in a what-if scenario. */
  extra?: boolean;
};

export type DaySnapshot = {
  min: number;
  waiting: number;       // in queue right now
  demandCum: number;     // joined the queue so far
  boardedCum: number;
  abandonedCum: number;
  deliveredCum: number;
};

export type WhatIfResult = {
  extraBuses: number;
  boardedCum: number;
  gainedPax: number;
  gainedRevenueThb: number;
  /** Where the extra departures were inserted (minutes). */
  insertedAt: number[];
};

export type DayModel = {
  trips: AirportTrip[];
  /** Minute-indexed cumulative arrays, length 1441. */
  demandCum: number[];
  boardedCum: number[];
  abandonedCum: number[];
  deliveredCum: number[];
  waiting: number[];
  /** 5-minute snapshots for charting. */
  snapshots: DaySnapshot[];
  totals: {
    demand: number;
    boarded: number;
    abandoned: number;
    delivered: number;
    revenueThb: number;       // boarded × fare (fare collected at boarding)
    lostRevenueThb: number;   // abandoned × fare
  };
  whatIf: WhatIfResult[];
};

// ---------------------------------------------------------------------------
// Demand inflow: flights → per-minute queue arrivals (integer-conserving)
// ---------------------------------------------------------------------------

function buildInflow(arrivals: OpsFlight[]): number[] {
  const inflow = new Array<number>(DAY_MIN).fill(0);
  const ramp = CUSTOMS_MAX - CUSTOMS_MIN; // 25 minutes
  for (const f of arrivals) {
    const demand = Math.round(f.pax * BUS_CAPTURE_RATE);
    if (demand <= 0) continue;
    // Spread integer demand evenly across the customs ramp using
    // cumulative rounding so the per-flight total is conserved exactly.
    let emitted = 0;
    for (let i = 0; i < ramp; i++) {
      const target = Math.round((demand * (i + 1)) / ramp);
      const t = f.schedMin + CUSTOMS_MIN + i;
      if (t >= 0 && t < DAY_MIN) inflow[t] += target - emitted;
      emitted = target;
    }
  }
  return inflow;
}

// ---------------------------------------------------------------------------
// Queue simulation — FIFO with abandonment
// ---------------------------------------------------------------------------

type Cohort = { joined: number; count: number };

function simulateDay(inflow: number[], departures: number[]): {
  trips: AirportTrip[];
  demandCum: number[];
  boardedCum: number[];
  abandonedCum: number[];
  waiting: number[];
} {
  const depSet = new Map<number, number>(); // minute → bus count departing
  for (const d of departures) {
    const m = Math.round(d);
    if (m >= 0 && m < DAY_MIN) depSet.set(m, (depSet.get(m) ?? 0) + 1);
  }

  const queue: Cohort[] = [];
  const trips: AirportTrip[] = [];
  const demandCum = new Array<number>(DAY_MIN).fill(0);
  const boardedCum = new Array<number>(DAY_MIN).fill(0);
  const abandonedCum = new Array<number>(DAY_MIN).fill(0);
  const waiting = new Array<number>(DAY_MIN).fill(0);

  let demand = 0, boarded = 0, abandoned = 0;

  for (let t = 0; t < DAY_MIN; t++) {
    // 1. New passengers join the queue
    if (inflow[t] > 0) {
      queue.push({ joined: t, count: inflow[t] });
      demand += inflow[t];
    }

    // 2. Patience runs out — oldest cohorts abandon
    while (queue.length > 0 && t - queue[0].joined >= ABANDON_AFTER_MIN) {
      abandoned += queue[0].count;
      queue.shift();
    }

    // 3. Buses depart — board FIFO
    const busCount = depSet.get(t) ?? 0;
    for (let b = 0; b < busCount; b++) {
      let seats = BUS_CAPACITY;
      let load = 0;
      while (seats > 0 && queue.length > 0) {
        const head = queue[0];
        const take = Math.min(seats, head.count);
        head.count -= take;
        seats -= take;
        load += take;
        if (head.count === 0) queue.shift();
      }
      boarded += load;
      trips.push({ depMin: t, boarded: load });
    }

    demandCum[t] = demand;
    boardedCum[t] = boarded;
    abandonedCum[t] = abandoned;
    waiting[t] = queue.reduce((s, c) => s + c.count, 0);
  }

  return { trips, demandCum, boardedCum, abandonedCum, waiting };
}

// ---------------------------------------------------------------------------
// Progressive delivery — boarded pax alight 20–95 min after departure
// ---------------------------------------------------------------------------

function buildDelivered(trips: AirportTrip[]): number[] {
  const deliveredCum = new Array<number>(DAY_MIN).fill(0);
  const span = LAST_ALIGHT_MIN - FIRST_ALIGHT_MIN;
  for (let t = 0; t < DAY_MIN; t++) {
    let sum = 0;
    for (const trip of trips) {
      const age = t - trip.depMin;
      if (age <= FIRST_ALIGHT_MIN) continue;
      const progress = Math.min(1, (age - FIRST_ALIGHT_MIN) / span);
      sum += Math.round(trip.boarded * progress);
    }
    deliveredCum[t] = sum;
  }
  return deliveredCum;
}

// ---------------------------------------------------------------------------
// What-if: insert N extra buses at the worst-queue minutes, re-run
// ---------------------------------------------------------------------------

/** One physical extra bus = a duty cycle, not a single departure.
 *  Airport → Rawai is 95 min; with layover and the return leg the same
 *  vehicle is back at the airport curb every ~210 min. */
const DUTY_CYCLE_MIN = 210;

function dutyCycleDepartures(startMin: number): number[] {
  const deps: number[] = [];
  for (let t = startMin; t < DAY_MIN; t += DUTY_CYCLE_MIN) deps.push(t);
  return deps;
}

/** Greedy: add one bus at a time. Each bus starts its duty at the worst
 *  remaining queue minute (±20 min exclusion around existing departures),
 *  then shuttles for the rest of the day. Re-run the sim after each bus so
 *  the next one targets what is STILL unserved. */
function planExtraBuses(
  inflow: number[],
  baseDepartures: number[],
  n: number
): { departures: number[]; startedAt: number[] } {
  let departures = [...baseDepartures];
  const startedAt: number[] = [];

  for (let k = 0; k < n; k++) {
    const run = simulateDay(inflow, departures);
    const blocked = new Array<boolean>(DAY_MIN).fill(false);
    for (const d of departures) {
      const m = Math.round(d);
      for (let i = Math.max(0, m - 20); i <= Math.min(DAY_MIN - 1, m + 20); i++) blocked[i] = true;
    }
    let bestMin = -1, bestVal = 0;
    for (let t = 0; t < DAY_MIN; t++) {
      if (!blocked[t] && run.waiting[t] > bestVal) { bestVal = run.waiting[t]; bestMin = t; }
    }
    if (bestMin < 0) break;
    startedAt.push(bestMin);
    departures = [...departures, ...dutyCycleDepartures(bestMin)];
  }

  return { departures, startedAt: startedAt.sort((a, b) => a - b) };
}

// ---------------------------------------------------------------------------
// Public API — memoized day model
// ---------------------------------------------------------------------------

const modelByDow = new Map<number, DayModel>();

function buildDayModel(dow: number): DayModel {
  const arrivals = getOpsFlightScheduleFor(dow).filter((f) => f.type === "arr" && f.mode === "flight");
  const departures = getAirportDepartures();
  const inflow = buildInflow(arrivals);

  const base = simulateDay(inflow, departures);
  const deliveredCum = buildDelivered(base.trips);

  const snapshots: DaySnapshot[] = [];
  for (let m = 0; m < DAY_MIN; m += 5) {
    snapshots.push({
      min: m,
      waiting: base.waiting[m],
      demandCum: base.demandCum[m],
      boardedCum: base.boardedCum[m],
      abandonedCum: base.abandonedCum[m],
      deliveredCum: deliveredCum[m]
    });
  }

  const last = DAY_MIN - 1;
  const totals = {
    demand: base.demandCum[last],
    boarded: base.boardedCum[last],
    abandoned: base.abandonedCum[last],
    delivered: deliveredCum[last],
    revenueThb: base.boardedCum[last] * FARE_THB,
    lostRevenueThb: base.abandonedCum[last] * FARE_THB
  };

  const whatIf: WhatIfResult[] = [2, 5].map((extraBuses) => {
    const plan = planExtraBuses(inflow, departures, extraBuses);
    const run = simulateDay(inflow, plan.departures);
    const boardedTotal = run.boardedCum[last];
    return {
      extraBuses,
      boardedCum: boardedTotal,
      gainedPax: boardedTotal - totals.boarded,
      gainedRevenueThb: (boardedTotal - totals.boarded) * FARE_THB,
      insertedAt: plan.startedAt
    };
  });

  return {
    trips: base.trips,
    demandCum: base.demandCum,
    boardedCum: base.boardedCum,
    abandonedCum: base.abandonedCum,
    deliveredCum,
    waiting: base.waiting,
    snapshots,
    totals,
    whatIf
  };
}

/** Day model for a specific day of week (0=SUN … 6=SAT). Memoized per dow. */
export function getDayModelFor(dow: number): DayModel {
  let m = modelByDow.get(dow);
  if (!m) {
    m = buildDayModel(dow);
    modelByDow.set(dow, m);
  }
  return m;
}

/** Day model for the ACTIVE simulation day (the /ops day picker). */
export function getDayModel(): DayModel {
  return getDayModelFor(getSimulationDay());
}

/** Test hook — drop the memos so a test can rebuild with fresh inputs. */
export function __resetDayModel(): void {
  modelByDow.clear();
}

// ---------------------------------------------------------------------------
// Weekly economics — the week is Σ of the 7 deterministic day models.
// Same timetable every day (published PKSB schedule); demand varies by day.
// ---------------------------------------------------------------------------

export type WeekDayEconomics = {
  dow: number;
  label: string;
  demand: number;
  boarded: number;
  abandoned: number;
  revenueThb: number;
  lostRevenueThb: number;
};

export type WeekEconomics = {
  days: WeekDayEconomics[]; // MON..SUN display order
  week: {
    demand: number;
    boarded: number;
    abandoned: number;
    revenueThb: number;
    lostRevenueThb: number;
  };
};

let cachedWeek: WeekEconomics | null = null;

export function getWeekEconomics(): WeekEconomics {
  if (cachedWeek) return cachedWeek;
  const order = [1, 2, 3, 4, 5, 6, 0]; // MON..SUN
  const days = order.map((dow) => {
    const t = getDayModelFor(dow).totals;
    return {
      dow,
      label: getDayLabel(dow),
      demand: t.demand,
      boarded: t.boarded,
      abandoned: t.abandoned,
      revenueThb: t.revenueThb,
      lostRevenueThb: t.lostRevenueThb
    };
  });
  const week = days.reduce(
    (s, d) => ({
      demand: s.demand + d.demand,
      boarded: s.boarded + d.boarded,
      abandoned: s.abandoned + d.abandoned,
      revenueThb: s.revenueThb + d.revenueThb,
      lostRevenueThb: s.lostRevenueThb + d.lostRevenueThb
    }),
    { demand: 0, boarded: 0, abandoned: 0, revenueThb: 0, lostRevenueThb: 0 }
  );
  cachedWeek = { days, week };
  return cachedWeek;
}

/** Engine state at one minute of the day. O(1) array reads. */
export function atMinute(min: number): {
  waiting: number;
  demandCum: number;
  boardedCum: number;
  abandonedCum: number;
  deliveredCum: number;
  lostRevenueThb: number;
  revenueThb: number;
} {
  const model = getDayModel();
  const m = Math.max(0, Math.min(DAY_MIN - 1, Math.floor(min)));
  return {
    waiting: model.waiting[m],
    demandCum: model.demandCum[m],
    boardedCum: model.boardedCum[m],
    abandonedCum: model.abandonedCum[m],
    deliveredCum: model.deliveredCum[m],
    lostRevenueThb: model.abandonedCum[m] * FARE_THB,
    revenueThb: model.deliveredCum[m] * FARE_THB
  };
}

/** Boarded pax for the trip that departed the airport at depMin (±2 min). */
export function getTripLoad(depMin: number): number | null {
  const model = getDayModel();
  let best: AirportTrip | null = null;
  for (const t of model.trips) {
    if (Math.abs(t.depMin - depMin) <= 2 && (!best || Math.abs(t.depMin - depMin) < Math.abs(best.depMin - depMin))) {
      best = t;
    }
  }
  return best ? best.boarded : null;
}

/** Hour-bucketed view for the capacity strip and the demand-supply chart.
 *  Airport corridor only — airport-line seats vs airport-arrival demand.
 *  (The old version counted ferry seats as bus supply. Boats don't pick
 *  up airport queues.) */
export type HourlyCorridor = {
  hour: number;
  demandPax: number;     // joined the queue this hour
  seats: number;         // airport-line bus seats departing this hour
  boardedPax: number;    // actually boarded this hour
  abandonedPax: number;  // gave up this hour (lost to capacity)
  revenueThb: number;
};

export function getHourlyCorridor(): HourlyCorridor[] {
  const model = getDayModel();
  const departures = getAirportDepartures();

  const out: HourlyCorridor[] = [];
  for (let h = 0; h < 24; h++) {
    const a = Math.min(DAY_MIN - 1, h * 60);
    // The last hour absorbs minute 1440 (the 24:00 boundary) so the
    // hourly sums reconcile exactly with the day totals.
    const b = h === 23 ? DAY_MIN - 1 : Math.min(DAY_MIN - 1, (h + 1) * 60 - 1);
    const demandPax = model.demandCum[b] - (a > 0 ? model.demandCum[a - 1] : 0);
    const boardedPax = model.boardedCum[b] - (a > 0 ? model.boardedCum[a - 1] : 0);
    const abandonedPax = model.abandonedCum[b] - (a > 0 ? model.abandonedCum[a - 1] : 0);
    const seats = departures.filter((d) => d >= h * 60 && d < (h + 1) * 60).length * BUS_CAPACITY;
    out.push({ hour: h, demandPax, seats, boardedPax, abandonedPax, revenueThb: boardedPax * FARE_THB });
  }
  return out;
}
