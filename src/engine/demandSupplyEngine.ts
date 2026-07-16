/**
 * THE demand-supply engine — one deterministic model of the whole day.
 *
 *   Flights land (airline · aircraft · seats · pax)
 *     → passengers clear customs (20–45 min ramp)
 *     → 3–7% join by origin heuristic (~5% weighted fleet-wide)
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
import { getAirportDepartures, getAirportboundTrips, type AirportboundTrip } from "./fleetSimulator";
import { captureRateFor, CHECK_IN_LEAD_MIN, MAX_EARLY_ARRIVAL_MIN } from "./travelBehavior";

// ---------------------------------------------------------------------------
// Model constants — each one sourced, none decorative
// ---------------------------------------------------------------------------

// Bus capture is no longer one flat number — it varies by passenger origin
// (Europeans rent cars; Bangkok budget carriers ride the bus). See
// travelBehavior.ts for the heuristic table; fleet-wide it averages ~5%.
/** Customs + baggage: first pax out after 20 min, last after 45. */
export const CUSTOMS_MIN = 20;
export const CUSTOMS_MAX = 45;
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

/** One northbound (island → airport) trip with its engine-computed load. */
export type ReturnTrip = {
  originDepMin: number;     // departs Rawai
  airportArriveMin: number; // reaches the airport curb
  boarded: number;          // ≤ BUS_CAPACITY
};

/** The return leg: departing flights → pax who must reach the airport
 *  ≥ 1h before takeoff → they ride the northbound schedule. Buses run on
 *  intervals; flights don't — whoever's needed bus is full or nonexistent
 *  takes a Grab, and that fare is missed. */
export type OutboundModel = {
  returnTrips: ReturnTrip[];
  /** Minute-indexed cumulative event streams, length 1441.
   *  demandCum ≡ boardedCum + lostCum at every minute BY CONSTRUCTION:
   *  a passenger is counted at the moment their outcome happens (boarding
   *  a bus, or giving up and booking a Grab). */
  demandCum: number[];
  boardedCum: number[];
  lostCum: number[];
  /** Boarded pax counted as delivered when their bus reaches the airport. */
  deliveredCum: number[];
  totals: {
    demand: number;
    boarded: number;
    lost: number;
    revenueThb: number;      // boarded × fare
    lostRevenueThb: number;  // lost × fare
  };
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
  /** INBOUND totals (airport → island). Kept separate so each direction's
   *  conservation law stays independently checkable. */
  totals: {
    demand: number;
    boarded: number;
    abandoned: number;
    delivered: number;
    revenueThb: number;       // boarded × fare (fare collected at boarding)
    lostRevenueThb: number;   // abandoned × fare
  };
  /** RETURN leg (island → airport, driven by departing flights). */
  outbound: OutboundModel;
  /** Both directions summed — what the money surfaces show. */
  combined: {
    demand: number;
    boarded: number;
    lost: number;             // inbound abandoned + outbound lost
    revenueThb: number;
    lostRevenueThb: number;
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
    const demand = Math.round(f.pax * captureRateFor(f.city));
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
// Return leg — departing flights → island-to-airport bus demand
//
// A departing passenger works backward from takeoff: be at the airport by
// T − 60. Buses run on a fixed interval schedule; flights don't. Each cohort
// takes the LATEST northbound bus that still makes their deadline (least
// airport waiting); if it's full, they cascade to earlier buses — but nobody
// rides one that lands them more than 3h early. Whoever can't fit (or has no
// feasible bus at all — red-eye departures before the first bus) takes a
// Grab, and that ฿100 is missed revenue.
//
// Like the inbound model, the island is one origin pool (Patong/Karon/Rawai
// aggregated) — same simplification, same direction of error on both legs.
// ---------------------------------------------------------------------------

function buildOutbound(departures: OpsFlight[], schedule: AirportboundTrip[]): OutboundModel {
  const returnTrips: ReturnTrip[] = schedule.map((t) => ({ ...t, boarded: 0 }));
  const boardEvents = new Array<number>(DAY_MIN).fill(0);
  const lostEvents = new Array<number>(DAY_MIN).fill(0);
  const deliverEvents = new Array<number>(DAY_MIN).fill(0);

  const clampMin = (m: number) => Math.max(0, Math.min(DAY_MIN - 1, Math.round(m)));

  // Earliest deadlines claim seats first — same first-come-first-served
  // fairness as the inbound FIFO queue.
  const cohorts = departures
    .map((f) => ({
      count: Math.round(f.pax * captureRateFor(f.city)),
      deadline: f.schedMin - CHECK_IN_LEAD_MIN
    }))
    .filter((c) => c.count > 0)
    .sort((a, b) => a.deadline - b.deadline);

  for (const cohort of cohorts) {
    let remaining = cohort.count;
    // Latest feasible bus first — least time wasted at the airport.
    for (let i = returnTrips.length - 1; i >= 0 && remaining > 0; i--) {
      const trip = returnTrips[i];
      if (trip.airportArriveMin > cohort.deadline) continue;                       // arrives too late
      if (trip.airportArriveMin < cohort.deadline - MAX_EARLY_ARRIVAL_MIN) break;  // absurdly early
      const take = Math.min(BUS_CAPACITY - trip.boarded, remaining);
      if (take <= 0) continue;
      trip.boarded += take;
      remaining -= take;
      boardEvents[clampMin(trip.originDepMin)] += take;
      deliverEvents[clampMin(trip.airportArriveMin)] += take;
    }
    if (remaining > 0) {
      // They give up around when the Grab must leave (~1h airport run before
      // the check-in deadline) — that's when the missed ฿ shows on screen.
      lostEvents[clampMin(cohort.deadline - 60)] += remaining;
    }
  }

  const demandCum = new Array<number>(DAY_MIN).fill(0);
  const boardedCum = new Array<number>(DAY_MIN).fill(0);
  const lostCum = new Array<number>(DAY_MIN).fill(0);
  const deliveredCum = new Array<number>(DAY_MIN).fill(0);
  let b = 0, l = 0, d = 0;
  for (let t = 0; t < DAY_MIN; t++) {
    b += boardEvents[t];
    l += lostEvents[t];
    d += deliverEvents[t];
    boardedCum[t] = b;
    lostCum[t] = l;
    deliveredCum[t] = d;
    demandCum[t] = b + l; // conservation by construction
  }

  return {
    returnTrips,
    demandCum,
    boardedCum,
    lostCum,
    deliveredCum,
    totals: {
      demand: b + l,
      boarded: b,
      lost: l,
      revenueThb: b * FARE_THB,
      lostRevenueThb: l * FARE_THB
    }
  };
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
  const schedule = getOpsFlightScheduleFor(dow);
  const arrivals = schedule.filter((f) => f.type === "arr" && f.mode === "flight");
  const departingFlights = schedule.filter((f) => f.type === "dep" && f.mode === "flight");
  const departures = getAirportDepartures();
  const inflow = buildInflow(arrivals);

  const base = simulateDay(inflow, departures);
  const deliveredCum = buildDelivered(base.trips);
  const outbound = buildOutbound(departingFlights, getAirportboundTrips());

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

  const combined = {
    demand: totals.demand + outbound.totals.demand,
    boarded: totals.boarded + outbound.totals.boarded,
    lost: totals.abandoned + outbound.totals.lost,
    revenueThb: totals.revenueThb + outbound.totals.revenueThb,
    lostRevenueThb: totals.lostRevenueThb + outbound.totals.lostRevenueThb
  };

  return {
    trips: base.trips,
    demandCum: base.demandCum,
    boardedCum: base.boardedCum,
    abandonedCum: base.abandonedCum,
    deliveredCum,
    waiting: base.waiting,
    snapshots,
    totals,
    outbound,
    combined,
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
    // COMBINED both directions — the week's money story includes the
    // return leg (departing pax riding back to the airport).
    const c = getDayModelFor(dow).combined;
    return {
      dow,
      label: getDayLabel(dow),
      demand: c.demand,
      boarded: c.boarded,
      abandoned: c.lost,
      revenueThb: c.revenueThb,
      lostRevenueThb: c.lostRevenueThb
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

/** Engine state at one minute of the day. O(1) array reads. Inbound fields
 *  keep their historical names; `out*` fields are the return leg; revenue
 *  figures are COMBINED (both directions — what the money surfaces show). */
export function atMinute(min: number): {
  waiting: number;
  demandCum: number;
  boardedCum: number;
  abandonedCum: number;
  deliveredCum: number;
  outDemandCum: number;
  outBoardedCum: number;
  outLostCum: number;
  outDeliveredCum: number;
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
    outDemandCum: model.outbound.demandCum[m],
    outBoardedCum: model.outbound.boardedCum[m],
    outLostCum: model.outbound.lostCum[m],
    outDeliveredCum: model.outbound.deliveredCum[m],
    lostRevenueThb: (model.abandonedCum[m] + model.outbound.lostCum[m]) * FARE_THB,
    revenueThb: (model.deliveredCum[m] + model.outbound.deliveredCum[m]) * FARE_THB
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

/** Boarded pax for the northbound trip that left Rawai at originDepMin (±2 min).
 *  Joins map buses in the "Bus to Airport" direction to their REAL return loads. */
export function getReturnTripLoad(originDepMin: number): number | null {
  const model = getDayModel();
  let best: ReturnTrip | null = null;
  for (const t of model.outbound.returnTrips) {
    if (Math.abs(t.originDepMin - originDepMin) <= 2 && (!best || Math.abs(t.originDepMin - originDepMin) < Math.abs(best.originDepMin - originDepMin))) {
      best = t;
    }
  }
  return best ? best.boarded : null;
}

/** Hour-bucketed view for the capacity strip and the demand-supply chart.
 *  Airport corridor only, BOTH directions — airport-line seats vs the demand
 *  each direction's flights generate that hour. (Ferries never counted:
 *  boats don't pick up airport queues.) */
export type HourlyCorridor = {
  hour: number;
  // Inbound: airport → island (arriving flights)
  demandPax: number;     // joined the queue this hour
  seats: number;         // southbound bus seats departing this hour
  boardedPax: number;    // actually boarded this hour
  abandonedPax: number;  // gave up this hour (lost to capacity)
  // Return leg: island → airport (departing flights)
  outDemandPax: number;  // needed a bus-to-airport this hour
  outSeats: number;      // northbound bus seats departing origin this hour
  outBoardedPax: number;
  outLostPax: number;    // no feasible/available bus → took Grab
  // Money, both directions
  revenueThb: number;
  missedThb: number;
};

export function getHourlyCorridor(): HourlyCorridor[] {
  const model = getDayModel();
  const departures = getAirportDepartures();
  const northbound = getAirportboundTrips();

  const out: HourlyCorridor[] = [];
  for (let h = 0; h < 24; h++) {
    const a = Math.min(DAY_MIN - 1, h * 60);
    // The last hour absorbs minute 1440 (the 24:00 boundary) so the
    // hourly sums reconcile exactly with the day totals.
    const b = h === 23 ? DAY_MIN - 1 : Math.min(DAY_MIN - 1, (h + 1) * 60 - 1);
    const delta = (arr: number[]) => arr[b] - (a > 0 ? arr[a - 1] : 0);

    const demandPax = delta(model.demandCum);
    const boardedPax = delta(model.boardedCum);
    const abandonedPax = delta(model.abandonedCum);
    const outDemandPax = delta(model.outbound.demandCum);
    const outBoardedPax = delta(model.outbound.boardedCum);
    const outLostPax = delta(model.outbound.lostCum);

    const seats = departures.filter((d) => d >= h * 60 && d < (h + 1) * 60).length * BUS_CAPACITY;
    const outSeats = northbound.filter((t) => t.originDepMin >= h * 60 && t.originDepMin < (h + 1) * 60).length * BUS_CAPACITY;

    out.push({
      hour: h,
      demandPax, seats, boardedPax, abandonedPax,
      outDemandPax, outSeats, outBoardedPax, outLostPax,
      revenueThb: (boardedPax + outBoardedPax) * FARE_THB,
      missedThb: (abandonedPax + outLostPax) * FARE_THB
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Interactive fleet scenario — "if we add or remove a bus, what changes?"
//
// The toolkit's co-design workshop ranked "increase frequency" among the
// highest-impact interventions but couldn't price it — no demand data. This
// answers it: the WHOLE day re-runs with the changed fleet, both directions,
// against the same flights and the same conservation law.
//
//   +N buses: each new bus runs a full Airport↔Rawai duty cycle from the
//     worst-queue moment onward — southbound legs board the arrival queue
//     (planExtraBuses greedy) and the interleaved northbound legs (half a
//     cycle later) carry departing pax.
//   −N buses: the schedule is partitioned into per-bus duty chains (first-fit
//     at ≥210 min spacing — the same physics as computeMinimumFleet) and the
//     N lowest-yield chains in each direction are withdrawn. Removing a bus
//     removes its whole day of trips, not one departure.
//
// Demand never changes with the fleet — only who gets served. So for every
// delta: scenario.boarded + scenario.lost === baseline combined demand.
// ---------------------------------------------------------------------------

export type FleetScenario = {
  deltaBuses: number;
  boarded: number;
  lost: number;
  revenueThb: number;
  lostRevenueThb: number;
  deltaBoarded: number;
  deltaRevenueThb: number;
  deltaLostThb: number;
};

/** First-fit partition of departure times into per-bus duty chains: a bus
 *  can take the next trip if ≥ DUTY_CYCLE_MIN after its previous one. */
function partitionDutyChains(times: number[]): number[][] {
  const chains: number[][] = [];
  for (const t of [...times].sort((a, b) => a - b)) {
    const free = chains.find((ch) => t - ch[ch.length - 1] >= DUTY_CYCLE_MIN);
    if (free) free.push(t);
    else chains.push([t]);
  }
  return chains;
}

/** Drop the n chains with the lowest total baseline load. */
function withdrawChains(
  times: number[],
  n: number,
  loadOf: (t: number) => number
): number[] {
  const chains = partitionDutyChains(times)
    .map((ch) => ({ ch, yield: ch.reduce((s, t) => s + loadOf(t), 0) }))
    .sort((a, b) => a.yield - b.yield);
  const removed = new Set(chains.slice(0, Math.min(n, Math.max(0, chains.length - 1))).flatMap((c) => c.ch));
  return times.filter((t) => !removed.has(t));
}

const scenarioCache = new Map<string, FleetScenario>();

export function getFleetScenario(deltaBuses: number): FleetScenario {
  const dow = getSimulationDay();
  const delta = Math.max(-5, Math.min(10, Math.round(deltaBuses)));
  const key = `${dow}:${delta}`;
  const hit = scenarioCache.get(key);
  if (hit) return hit;

  const baseline = getDayModelFor(dow);
  const schedule = getOpsFlightScheduleFor(dow);
  const arrivals = schedule.filter((f) => f.type === "arr" && f.mode === "flight");
  const departingFlights = schedule.filter((f) => f.type === "dep" && f.mode === "flight");
  const inflow = buildInflow(arrivals);

  let southbound = getAirportDepartures();
  let northbound = getAirportboundTrips();

  if (delta > 0) {
    // Southbound legs target the worst arrival-queue moments…
    const plan = planExtraBuses(inflow, southbound, delta);
    southbound = plan.departures;
    // …and the same physical buses run northbound half a duty cycle later.
    const HALF_CYCLE = Math.round(DUTY_CYCLE_MIN / 2);
    const TRIP_MIN = 95;
    for (const start of plan.startedAt) {
      for (let t = start + HALF_CYCLE; t < DAY_MIN; t += DUTY_CYCLE_MIN) {
        northbound = [...northbound, { originDepMin: t, airportArriveMin: t + TRIP_MIN }];
      }
    }
    northbound = [...northbound].sort((a, b) => a.originDepMin - b.originDepMin);
  } else if (delta < 0) {
    const n = -delta;
    const sbLoad = (t: number) =>
      baseline.trips.find((x) => Math.abs(x.depMin - t) <= 1)?.boarded ?? 0;
    const nbLoad = (t: number) =>
      baseline.outbound.returnTrips.find((x) => Math.abs(x.originDepMin - t) <= 1)?.boarded ?? 0;
    southbound = withdrawChains(southbound, n, sbLoad);
    const keptNb = new Set(withdrawChains(northbound.map((x) => x.originDepMin), n, nbLoad));
    northbound = northbound.filter((x) => keptNb.has(x.originDepMin));
  }

  const inRun = simulateDay(inflow, southbound);
  const outRun = buildOutbound(departingFlights, northbound);
  const last = DAY_MIN - 1;

  const boarded = inRun.boardedCum[last] + outRun.totals.boarded;
  // Inbound "lost" for the scenario counts abandoned + still-waiting at close
  // of day so demand conservation holds exactly regardless of fleet size.
  const inUnserved = inRun.abandonedCum[last] + inRun.waiting[last];
  const lost = inUnserved + outRun.totals.lost;

  // Baseline "unserved" uses the same definition as the scenario (abandoned +
  // still-waiting + return-leg lost) so deltas compare like with like.
  const baselineUnserved =
    baseline.totals.abandoned + baseline.waiting[last] + baseline.outbound.totals.lost;

  const scenario: FleetScenario = {
    deltaBuses: delta,
    boarded,
    lost,
    revenueThb: boarded * FARE_THB,
    lostRevenueThb: lost * FARE_THB,
    deltaBoarded: boarded - baseline.combined.boarded,
    deltaRevenueThb: (boarded - baseline.combined.boarded) * FARE_THB,
    deltaLostThb: (lost - baselineUnserved) * FARE_THB
  };
  scenarioCache.set(key, scenario);
  return scenario;
}
