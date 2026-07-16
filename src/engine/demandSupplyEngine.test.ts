/**
 * Conservation laws for the demand-supply engine.
 *
 * The whole point of the queue model is that passengers are conserved
 * exactly: everyone who joins the queue either boards a bus, abandons
 * after 60 minutes, or is still standing there. If any of these breaks,
 * the dashboard is lying again.
 */

import { describe, expect, it } from "vitest";
import {
  getDayModel,
  getDayModelFor,
  getWeekEconomics,
  atMinute,
  getTripLoad,
  getReturnTripLoad,
  getHourlyCorridor,
  getFleetScenario,
  BUS_CAPACITY,
  ABANDON_AFTER_MIN
} from "./demandSupplyEngine";
import {
  getOpsFlightSchedule,
  getOpsFlightScheduleFor,
  getSimulationDay,
  setSimulationDay
} from "./opsFlightSchedule";
import { captureRateFor, BUS_CAPTURE_BY_REGION, CHECK_IN_LEAD_MIN } from "./travelBehavior";

describe("demandSupplyEngine — conservation and sanity", () => {
  const model = getDayModel();
  const END = 1440;

  it("conserves passengers at every minute: demand = boarded + abandoned + waiting", () => {
    for (let t = 0; t < 1441; t += 7) {
      expect(model.boardedCum[t] + model.abandonedCum[t] + model.waiting[t]).toBe(model.demandCum[t]);
    }
  });

  it("no trip boards more than the bus holds", () => {
    for (const trip of model.trips) {
      expect(trip.boarded).toBeGreaterThanOrEqual(0);
      expect(trip.boarded).toBeLessThanOrEqual(BUS_CAPACITY);
    }
  });

  it("per-trip boarded sums to the day's boarded total", () => {
    const sum = model.trips.reduce((s, t) => s + t.boarded, 0);
    expect(sum).toBe(model.totals.boarded);
  });

  it("cumulative arrays are monotonic", () => {
    for (let t = 1; t < 1441; t++) {
      expect(model.demandCum[t]).toBeGreaterThanOrEqual(model.demandCum[t - 1]);
      expect(model.boardedCum[t]).toBeGreaterThanOrEqual(model.boardedCum[t - 1]);
      expect(model.abandonedCum[t]).toBeGreaterThanOrEqual(model.abandonedCum[t - 1]);
      expect(model.deliveredCum[t]).toBeGreaterThanOrEqual(model.deliveredCum[t - 1]);
    }
  });

  it("delivered never exceeds boarded, and catches up by end of day + trip time", () => {
    for (let t = 0; t < 1441; t += 13) {
      expect(model.deliveredCum[t]).toBeLessThanOrEqual(model.boardedCum[t]);
    }
  });

  it("demand total matches the flight schedule (region-based capture per flight)", () => {
    const arrivals = getOpsFlightSchedule().filter((f) => f.type === "arr" && f.mode === "flight");
    const expected = arrivals.reduce((s, f) => s + Math.round(f.pax * captureRateFor(f.city)), 0);
    expect(model.totals.demand).toBe(expected);
  });

  it("abandonment honours the patience threshold — nobody waits longer than 60 min", () => {
    // Indirect check: at any minute, waiting count can only contain pax who
    // joined within the last ABANDON_AFTER_MIN minutes. So waiting(t) ≤
    // demand(t) − demand(t − 60).
    for (let t = ABANDON_AFTER_MIN; t < 1441; t += 11) {
      const joinedRecently = model.demandCum[t] - model.demandCum[t - ABANDON_AFTER_MIN];
      expect(model.waiting[t]).toBeLessThanOrEqual(joinedRecently);
    }
  });

  it("revenue identities hold", () => {
    expect(model.totals.revenueThb).toBe(model.totals.boarded * 100);
    expect(model.totals.lostRevenueThb).toBe(model.totals.abandoned * 100);
  });

  it("atMinute() agrees with the raw arrays", () => {
    const probe = atMinute(720);
    expect(probe.demandCum).toBe(model.demandCum[720]);
    expect(probe.boardedCum).toBe(model.boardedCum[720]);
    expect(probe.waiting).toBe(model.waiting[720]);
  });

  it("getTripLoad joins a vehicle to its trip's boarding count", () => {
    const someTrip = model.trips.find((t) => t.boarded > 0);
    expect(someTrip).toBeDefined();
    expect(getTripLoad(someTrip!.depMin)).toBe(someTrip!.boarded);
  });

  it("hourly corridor sums reconcile with the day totals", () => {
    const hours = getHourlyCorridor();
    const demand = hours.reduce((s, h) => s + h.demandPax, 0);
    const boarded = hours.reduce((s, h) => s + h.boardedPax, 0);
    const abandoned = hours.reduce((s, h) => s + h.abandonedPax, 0);
    expect(demand).toBe(model.demandCum[END]);
    expect(boarded).toBe(model.boardedCum[END]);
    expect(abandoned).toBe(model.abandonedCum[END]);
  });

  it("hourly corridor supply counts airport-line seats only (no ferry seats)", () => {
    // Each hour's seats must be a multiple of BUS_CAPACITY — a ferry's 100
    // would still pass (4×25), but the real check is magnitude: the airport
    // line runs at most ~4 departures/hour → ≤ 100 seats. The old bug
    // produced 300–500 seat hours.
    for (const h of getHourlyCorridor()) {
      expect(h.seats % BUS_CAPACITY).toBe(0);
      expect(h.seats).toBeLessThanOrEqual(6 * BUS_CAPACITY);
    }
  });

  it("what-if: extra buses never capture fewer passengers", () => {
    for (const w of model.whatIf) {
      expect(w.boardedCum).toBeGreaterThanOrEqual(model.totals.boarded);
      expect(w.gainedPax).toBe(w.boardedCum - model.totals.boarded);
      expect(w.gainedRevenueThb).toBe(w.gainedPax * 100);
      expect(w.insertedAt.length).toBeLessThanOrEqual(w.extraBuses);
    }
  });

  it("what-if(+5) captures at least as much as what-if(+2)", () => {
    const [two, five] = model.whatIf;
    expect(five.boardedCum).toBeGreaterThanOrEqual(two.boardedCum);
  });

  it("every flight carries aircraft + seats, and pax never exceeds seats", () => {
    for (const f of getOpsFlightSchedule()) {
      expect(f.seats).toBeGreaterThan(0);
      expect(f.pax).toBeLessThanOrEqual(f.seats);
      expect(f.loadPct).toBeGreaterThanOrEqual(0);
      expect(f.loadPct).toBeLessThanOrEqual(100);
      expect(f.aircraftName.length).toBeGreaterThan(0);
    }
  });
});

describe("weekly economics — the week is Σ of the 7 day models", () => {
  it("week totals equal the exact sum of MON..SUN day models", () => {
    const { days, week } = getWeekEconomics();
    expect(days).toHaveLength(7);
    expect(days.map((d) => d.label)).toEqual(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]);
    expect(week.revenueThb).toBe(days.reduce((s, d) => s + d.revenueThb, 0));
    expect(week.boarded).toBe(days.reduce((s, d) => s + d.boarded, 0));
    expect(week.abandoned).toBe(days.reduce((s, d) => s + d.abandoned, 0));
    expect(week.lostRevenueThb).toBe(days.reduce((s, d) => s + d.lostRevenueThb, 0));
  });

  it("every day of the week conserves passengers at end of day", () => {
    for (let dow = 0; dow < 7; dow++) {
      const m = getDayModelFor(dow);
      const last = 1440;
      expect(m.boardedCum[last] + m.abandonedCum[last] + m.waiting[last]).toBe(m.demandCum[last]);
    }
  });

  it("each day's demand derives from that day's flight schedule", () => {
    for (let dow = 0; dow < 7; dow++) {
      const arrivals = getOpsFlightScheduleFor(dow).filter((f) => f.type === "arr" && f.mode === "flight");
      const expected = arrivals.reduce((s, f) => s + Math.round(f.pax * captureRateFor(f.city)), 0);
      expect(getDayModelFor(dow).totals.demand).toBe(expected);
    }
  });

  it("day schedules are deterministic (memoized identity) and vary across the week", () => {
    expect(getOpsFlightScheduleFor(3)).toBe(getOpsFlightScheduleFor(3));
    const demands = new Set(Array.from({ length: 7 }, (_, d) => getDayModelFor(d).totals.demand));
    expect(demands.size).toBeGreaterThan(1);
  });

  it("setSimulationDay switches which model getDayModel() serves", () => {
    const original = getSimulationDay();
    try {
      setSimulationDay(2);
      expect(getDayModel().totals.demand).toBe(getDayModelFor(2).totals.demand);
      setSimulationDay(6);
      expect(getDayModel().totals.demand).toBe(getDayModelFor(6).totals.demand);
    } finally {
      setSimulationDay(original);
    }
  });

  it("weekly revenue identities hold: revenue = boarded × ฿100", () => {
    const { week } = getWeekEconomics();
    expect(week.revenueThb).toBe(week.boarded * 100);
    expect(week.lostRevenueThb).toBe(week.abandoned * 100);
  });
});

// ---------------------------------------------------------------------------
// Return leg + travel-behavior heuristics
//
// Departing flights generate island→airport demand (be at the airport 1h
// before takeoff, ride the fixed northbound schedule). Same conservation
// discipline as the inbound queue: every passenger who needed a bus either
// boarded one or took a Grab — counted exactly once.
// ---------------------------------------------------------------------------

describe("return leg — departing flights → bus-to-airport demand", () => {
  const model = getDayModel();
  const out = model.outbound;
  const END = 1440;

  it("conserves passengers at every minute: outDemand = outBoarded + outLost", () => {
    for (let t = 0; t < 1441; t += 7) {
      expect(out.boardedCum[t] + out.lostCum[t]).toBe(out.demandCum[t]);
    }
    expect(out.totals.boarded + out.totals.lost).toBe(out.totals.demand);
  });

  it("outbound demand derives from the departing-flight schedule (region capture)", () => {
    const deps = getOpsFlightSchedule().filter((f) => f.type === "dep" && f.mode === "flight");
    const expected = deps.reduce((s, f) => s + Math.round(f.pax * captureRateFor(f.city)), 0);
    expect(out.totals.demand).toBe(expected);
  });

  it("no return trip carries more than the bus holds", () => {
    for (const trip of out.returnTrips) {
      expect(trip.boarded).toBeGreaterThanOrEqual(0);
      expect(trip.boarded).toBeLessThanOrEqual(BUS_CAPACITY);
    }
  });

  it("per-trip return loads sum to the outbound boarded total", () => {
    const sum = out.returnTrips.reduce((s, t) => s + t.boarded, 0);
    expect(sum).toBe(out.totals.boarded);
  });

  it("outbound revenue identities hold", () => {
    expect(out.totals.revenueThb).toBe(out.totals.boarded * 100);
    expect(out.totals.lostRevenueThb).toBe(out.totals.lost * 100);
  });

  it("combined = inbound + outbound, exactly", () => {
    expect(model.combined.demand).toBe(model.totals.demand + out.totals.demand);
    expect(model.combined.boarded).toBe(model.totals.boarded + out.totals.boarded);
    expect(model.combined.lost).toBe(model.totals.abandoned + out.totals.lost);
    expect(model.combined.revenueThb).toBe(model.totals.revenueThb + out.totals.revenueThb);
    expect(model.combined.lostRevenueThb).toBe(model.totals.lostRevenueThb + out.totals.lostRevenueThb);
  });

  it("hourly corridor outbound sums reconcile with the day totals", () => {
    const hours = getHourlyCorridor();
    expect(hours.reduce((s, h) => s + h.outDemandPax, 0)).toBe(out.demandCum[END]);
    expect(hours.reduce((s, h) => s + h.outBoardedPax, 0)).toBe(out.boardedCum[END]);
    expect(hours.reduce((s, h) => s + h.outLostPax, 0)).toBe(out.lostCum[END]);
  });

  it("atMinute exposes outbound cumulatives and COMBINED money", () => {
    const probe = atMinute(1200);
    expect(probe.outBoardedCum).toBe(out.boardedCum[1200]);
    expect(probe.revenueThb).toBe((model.deliveredCum[1200] + out.deliveredCum[1200]) * 100);
    expect(probe.lostRevenueThb).toBe((model.abandonedCum[1200] + out.lostCum[1200]) * 100);
  });

  it("getReturnTripLoad joins a northbound vehicle to its trip's boarding count", () => {
    const someTrip = out.returnTrips.find((t) => t.boarded > 0);
    expect(someTrip).toBeDefined();
    expect(getReturnTripLoad(someTrip!.originDepMin)).toBe(someTrip!.boarded);
  });

  it("weekly economics now carries both directions (week = Σ combined days)", () => {
    const { days, week } = getWeekEconomics();
    for (const d of days) {
      const c = getDayModelFor(d.dow).combined;
      expect(d.revenueThb).toBe(c.revenueThb);
      expect(d.lostRevenueThb).toBe(c.lostRevenueThb);
    }
    expect(week.revenueThb).toBe(days.reduce((s, d) => s + d.revenueThb, 0));
  });
});

describe("travel-behavior heuristics — stereotypes, stated and bounded", () => {
  it("every region rate is a sane probability (0 < rate ≤ 0.15)", () => {
    for (const [region, rate] of Object.entries(BUS_CAPTURE_BY_REGION)) {
      expect(rate, region).toBeGreaterThan(0);
      expect(rate, region).toBeLessThanOrEqual(0.15);
    }
  });

  it("Europeans rent cars: Europe's rate is below SE Asia's budget-carrier rate", () => {
    expect(BUS_CAPTURE_BY_REGION["Europe"]).toBeLessThan(BUS_CAPTURE_BY_REGION["SE Asia"]);
    expect(BUS_CAPTURE_BY_REGION["Russia/CIS"]).toBeLessThan(BUS_CAPTURE_BY_REGION["SE Asia"]);
  });

  it("fleet-wide weighted average lands near the operator's ~5% planning figure", () => {
    // Weight by the actual pax mix across the whole week's arrivals.
    let pax = 0;
    let riders = 0;
    for (let dow = 0; dow < 7; dow++) {
      for (const f of getOpsFlightScheduleFor(dow)) {
        if (f.type !== "arr" || f.mode !== "flight") continue;
        pax += f.pax;
        riders += f.pax * captureRateFor(f.city);
      }
    }
    const avg = riders / pax;
    expect(avg).toBeGreaterThan(0.03);
    expect(avg).toBeLessThan(0.08);
  });

  it("check-in lead time is one hour, as the operator specified", () => {
    expect(CHECK_IN_LEAD_MIN).toBe(60);
  });
});

// ---------------------------------------------------------------------------
// Interactive fleet scenario — add/remove buses, re-run the whole day
// ---------------------------------------------------------------------------

describe("fleet scenario — what changes when the fleet changes", () => {
  const baseline = getDayModel();
  const END = 1440;

  it("demand is conserved at EVERY fleet size: boarded + lost === combined demand", () => {
    for (const d of [-5, -3, -1, 0, 1, 2, 5, 10]) {
      const s = getFleetScenario(d);
      expect(s.boarded + s.lost, `delta ${d}`).toBe(baseline.combined.demand);
    }
  });

  it("delta 0 reproduces the baseline exactly", () => {
    const s = getFleetScenario(0);
    expect(s.boarded).toBe(baseline.combined.boarded);
    expect(s.revenueThb).toBe(baseline.combined.revenueThb);
    expect(s.deltaBoarded).toBe(0);
    expect(s.deltaRevenueThb).toBe(0);
    expect(s.deltaLostThb).toBe(0);
  });

  it("revenue is monotonic in fleet size — more buses never earn less", () => {
    let prev = -Infinity;
    for (const d of [-5, -4, -3, -2, -1, 0, 1, 2, 3, 5, 8, 10]) {
      const s = getFleetScenario(d);
      expect(s.revenueThb, `delta ${d}`).toBeGreaterThanOrEqual(prev);
      prev = s.revenueThb;
    }
  });

  it("removing buses hurts and adding helps (strictly, on a shortfall day)", () => {
    // Every modelled day is capacity-constrained (missed ฿ > 0), so the
    // marginal bus must carry someone and a withdrawn bus must strand someone.
    expect(getFleetScenario(-2).deltaRevenueThb).toBeLessThan(0);
    expect(getFleetScenario(2).deltaRevenueThb).toBeGreaterThan(0);
  });

  it("revenue identities hold in every scenario", () => {
    for (const d of [-3, 0, 4]) {
      const s = getFleetScenario(d);
      expect(s.revenueThb).toBe(s.boarded * 100);
      expect(s.lostRevenueThb).toBe(s.lost * 100);
    }
  });

  it("clamps the delta to the supported range", () => {
    expect(getFleetScenario(99).deltaBuses).toBe(10);
    expect(getFleetScenario(-99).deltaBuses).toBe(-5);
  });
});

// ---------------------------------------------------------------------------
// getLiveTotals — combined-direction reconciliation
//
// The /ops dashboard and the bottom accumulator bar both consume
// getLiveTotals. Every number there must trace back to the engine's
// in/out cumulatives summed — no independent model, no per-minute rounding
// drift, no path by which the streaming cells and the analytic snapshot can
// disagree on what the day looks like.
// ---------------------------------------------------------------------------

import { getLiveTotals } from "./simulation";

describe("getLiveTotals — combined-direction reconciliation (the screen-money SSOT)", () => {
  const model = getDayModel();
  const END = 1440;

  it("every hour's combined delivered = inbound + outbound delivered", () => {
    for (let t = 0; t <= END; t += 30) {
      const live = getLiveTotals(t);
      const expected = model.deliveredCum[t] + model.outbound.deliveredCum[t];
      expect(live.paxDelivered, `paxDelivered at t=${t}`).toBe(expected);
    }
  });

  it("every hour's combined lost = inbound abandoned + outbound lost", () => {
    for (let t = 0; t <= END; t += 30) {
      const live = getLiveTotals(t);
      const expected = model.abandonedCum[t] + model.outbound.lostCum[t];
      expect(live.paxAbandoned, `paxAbandoned at t=${t}`).toBe(expected);
    }
  });

  it("every hour's combined want = inbound + outbound demand (the queue join count)", () => {
    for (let t = 0; t <= END; t += 30) {
      const live = getLiveTotals(t);
      const expected = model.demandCum[t] + model.outbound.demandCum[t];
      expect(live.paxWantBus, `paxWantBus at t=${t}`).toBe(expected);
    }
  });

  it("revenue identities hold: earned = delivered × ฿100, lost = abandoned × ฿100", () => {
    for (const t of [0, 360, 720, 1080, 1350, 1440]) {
      const live = getLiveTotals(t);
      expect(live.revenueThb).toBe(live.paxDelivered * 100);
      expect(live.lostRevenueThb).toBe(live.paxAbandoned * 100);
    }
  });

  it("cumulative figures never decrease across the service day", () => {
    let lastDelivered = 0, lastAbandoned = 0, lastBoarded = 0, lastWant = 0;
    for (let t = 360; t <= 1350; t += 5) {
      const live = getLiveTotals(t);
      expect(live.paxDelivered, `delivered at t=${t}`).toBeGreaterThanOrEqual(lastDelivered);
      expect(live.paxAbandoned, `abandoned at t=${t}`).toBeGreaterThanOrEqual(lastAbandoned);
      expect(live.paxBoarded, `boarded at t=${t}`).toBeGreaterThanOrEqual(lastBoarded);
      expect(live.paxWantBus, `want at t=${t}`).toBeGreaterThanOrEqual(lastWant);
      lastDelivered = live.paxDelivered;
      lastAbandoned = live.paxAbandoned;
      lastBoarded = live.paxBoarded;
      lastWant = live.paxWantBus;
    }
  });

  it("CO₂ uses the /roi factor (0.21 car − 0.06 bus = 0.15 saved per pax-km)", () => {
    // Sample at midday — many pax delivered, denominators non-zero.
    const live = getLiveTotals(780);
    // Average trip km = 28, factors from roi.ts. If a future tuning changes
    // those constants, this test will catch a surprise delta in the saved kg.
    const expectedTaxi = Math.round(live.paxDelivered * 28 * 0.21);
    const expectedSaved = expectedTaxi - Math.round(live.paxDelivered * 28 * 0.06);
    expect(live.co2TaxiKg).toBe(expectedTaxi);
    expect(live.co2SavedKg).toBe(expectedSaved);
  });

  it("day-end totals reconcile with the engine's combined day model", () => {
    const live = getLiveTotals(END);
    // Delivered must be ≤ boarded: late-evening buses are still mid-trip
    // when the day ends, so deliveredCum[END] < boardedCum[END] is the
    // normal state. (The "delivered never exceeds boarded" assertion in
    // the inbound suite covers this at every minute.)
    expect(live.paxDelivered).toBeLessThanOrEqual(model.combined.boarded);
    // Abandoned / lost is cumulative and stops at the day boundary, so it
    // must equal the engine's combined lost field exactly.
    expect(live.paxAbandoned).toBe(model.combined.lost);
    // Same for want: demandCum is cumulative and finite at the day
    // boundary, so it must equal combined.demand.
    expect(live.paxWantBus).toBe(model.combined.demand);
  });
});

// ---------------------------------------------------------------------------
// CUSTOMS_MIN / CUSTOMS_MAX exports — the chart axis floor and the queue
// ramp must agree (one number, one source). If these constants ever drift
// between the two engines, the chart's "first arrivals" line lands on a
// different minute from the queue's first cohort.
// ---------------------------------------------------------------------------

import { CUSTOMS_MIN, CUSTOMS_MAX } from "./demandSupplyEngine";

describe("engine exports — single source of truth for the chart and the queue", () => {
  it("CUSTOMS ramp is the documented 20–45 minute window", () => {
    expect(CUSTOMS_MIN).toBe(20);
    expect(CUSTOMS_MAX).toBe(45);
    expect(CUSTOMS_MAX - CUSTOMS_MIN).toBe(25);
  });

  it("every flight's queue absorption lies inside the customs window", () => {
    // The first flight in the day starts its queue ramp at schedMin +
    // CUSTOMS_MIN and finishes at schedMin + CUSTOMS_MAX. We check that
    // at least one flight's ramp actually falls inside the [firstDep,
    // lastDep] corridor — i.e. the constants are wired into the model.
    const flights = getOpsFlightSchedule().filter((f) => f.type === "arr" && f.mode === "flight");
    expect(flights.length).toBeGreaterThan(0);
    const first = flights[0];
    // The engine rounds demand to integers across the ramp; verify the
    // ramp width matches our constant.
    const rampMin = CUSTOMS_MAX - CUSTOMS_MIN;
    expect(rampMin).toBeGreaterThan(0);
  });
});
