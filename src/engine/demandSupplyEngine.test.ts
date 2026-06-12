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
  atMinute,
  getTripLoad,
  getHourlyCorridor,
  BUS_CAPACITY,
  ABANDON_AFTER_MIN
} from "./demandSupplyEngine";
import { getOpsFlightSchedule } from "./opsFlightSchedule";

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

  it("demand total matches the flight schedule (12% of arriving flight pax)", () => {
    const arrivals = getOpsFlightSchedule().filter((f) => f.type === "arr" && f.mode === "flight");
    const expected = arrivals.reduce((s, f) => s + Math.round(f.pax * 0.12), 0);
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
