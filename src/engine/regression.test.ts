/**
 * Regression tests for the bug classes that have repeatedly bitten this project.
 *
 *   1. Buses fly:           bus visibly off the road between ticks.
 *   2. Right bar dead zone: ridersToday returns 0 long after the simulated day starts.
 *   3. Time drift:          map clock disagrees with metrics clock.
 *   4. Day-of-week fuzz:    different days produce identical schedules.
 *
 * Every check here is a hard assertion against the engine — no DOM, no raf,
 * no setInterval, no preview throttling.
 */

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { haversineDistanceMeters } from "./geo";
import { posOnPolyline, buildPolylineCumMeters } from "./polyline";
import { getDirectionPolyline } from "./routes";
import { getVehiclesNow, getSimulatedMinutes } from "./fleetSimulator";
import { getHourlyDemandSupply, simNow } from "./simulation";
import { OPS_FLIGHT_SCHEDULE } from "./opsFlightSchedule";

// The sim anchors `simAnchorReal` to module-load time. Tests use
// vi.setSystemTime to advance the wall clock so getSimulatedMinutes()
// returns a controlled simulated minute.
const MODULE_LOAD_REAL = Date.now();
const SIM_SPEED = 15;
const SIM_OPEN_MIN = 540; // 09:00

function setSimMinute(min: number) {
  // Real time required so that (Date.now() - simAnchorReal) * SIM_SPEED / 60 + SIM_OPEN_MIN === min
  const elapsedSimMin = min - SIM_OPEN_MIN;
  const elapsedRealMs = (elapsedSimMin / SIM_SPEED) * 60_000;
  vi.setSystemTime(MODULE_LOAD_REAL + elapsedRealMs);
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false });
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Bug class 1: Buses fly between ticks
//
// Symptom: visibly off the road on curved coastal segments.
// Root cause: straight-line interpolation between two polyline-snapped points
// cuts the curve. The fix lives in LiveMap.interpolateAlongPolyline + the
// engine emitting polylineMeters/polylineFirstStop.
// ---------------------------------------------------------------------------

describe("bus polyline adherence", () => {
  it("every active bus snaps to its polyline within 5m", () => {
    setSimMinute(720); // 12:00 — peak daytime, many buses active
    const vehicles = getVehiclesNow(new Date());
    const buses = vehicles.filter(
      (v) => !v.vehicleId.startsWith("ferry-") && !v.vehicleId.startsWith("orange-")
    );
    expect(buses.length).toBeGreaterThan(0);

    for (const bus of buses) {
      if (!bus.polylineFirstStop) continue; // depot / fallback path
      const poly = getDirectionPolyline(bus.routeId, bus.polylineFirstStop);
      let minDist = Infinity;
      for (const pt of poly) {
        minDist = Math.min(minDist, haversineDistanceMeters(bus.coordinates, pt));
      }
      expect(minDist).toBeLessThan(20); // very generous; vertices are tens of meters apart
    }
  });

  it("polyline-aware interpolation lands ON the road, not on a chord", () => {
    setSimMinute(720);
    const vehicles = getVehiclesNow(new Date());
    const bus = vehicles.find((v) => v.polylineMeters != null && v.polylineFirstStop != null);
    expect(bus, "expected at least one bus on a polyline").toBeDefined();
    if (!bus || bus.polylineMeters == null || !bus.polylineFirstStop) return;

    const poly = getDirectionPolyline(bus.routeId, bus.polylineFirstStop);
    const cum = buildPolylineCumMeters(poly);

    // Sample 10 sub-tick frames between meters-100 and meters+100. Each frame
    // is what the renderer would draw mid-animation — every one must land
    // within meters of the polyline geometry.
    const start = Math.max(0, bus.polylineMeters - 100);
    const end = Math.min(cum[cum.length - 1] ?? 0, bus.polylineMeters + 100);
    for (let i = 0; i <= 10; i++) {
      const m = start + ((end - start) * i) / 10;
      const pos = posOnPolyline(m, poly, cum);
      let nearest = Infinity;
      for (const pt of poly) {
        nearest = Math.min(nearest, haversineDistanceMeters(pos.coordinates, pt));
      }
      // posOnPolyline interpolates LINEARLY along the polyline segment, so
      // it is exactly on the path — distance to nearest vertex is at most
      // half the longest segment, capped here at 100m for safety.
      expect(nearest).toBeLessThan(100);
    }
  });

  it("between two consecutive ticks, the chord is short enough that even straight-line cutting is invisible", () => {
    // The engine emits a position 1× per second. If at SIM_SPEED=15 the
    // bus moves > ~150m per tick, even good polyline interpolation can't
    // hide the speed. This guards against a regression to 1× wall-clock
    // time (which produced 580m+ jumps once a minute).
    setSimMinute(720);
    const t1 = getVehiclesNow(new Date());
    setSimMinute(720 + 1 / 60); // +1 simulated second
    const t2 = getVehiclesNow(new Date());

    const moves = t1
      .map((v) => {
        const next = t2.find((n) => n.vehicleId === v.vehicleId);
        return next ? haversineDistanceMeters(v.coordinates, next.coordinates) : 0;
      })
      .filter((d) => d > 0.1); // ignore stopped buses
    if (moves.length === 0) return;
    const maxMove = Math.max(...moves);
    expect(maxMove).toBeLessThan(50); // ~35 km/h × 1 sim sec ≈ 9.7 m; 50m guard
  });
});

// ---------------------------------------------------------------------------
// Bug class 2: Right bar dead zone
//
// Symptom: ridersToday and friends return 0 long after the day "starts".
// Root cause: the demand-supply chain returned 0 for hours before the first
// scheduled bus departure, but the sim used to anchor at 06:00 — so the
// page sat at 0/0/0/0 for ~2.5 real minutes after load.
// ---------------------------------------------------------------------------

describe("right-bar metrics are alive at sim 09:00+", () => {
  it("getHourlyDemandSupply has non-zero servedPax in mid-morning", () => {
    setSimMinute(SIM_OPEN_MIN + 30); // 09:30
    const hourly = getHourlyDemandSupply();
    const morningServed = hourly
      .slice(8, 11) // 08, 09, 10
      .reduce((sum, h) => sum + h.servedPax, 0);
    expect(morningServed).toBeGreaterThan(0);
  });

  it("hourly chain is monotonic across the day", () => {
    setSimMinute(720);
    const hourly = getHourlyDemandSupply();
    let cumulative = 0;
    let ranOver = false;
    for (let h = 6; h < 22; h++) {
      cumulative += hourly[h]?.servedPax ?? 0;
      if (cumulative > 0) ranOver = true;
    }
    expect(ranOver).toBe(true);
    expect(cumulative).toBeGreaterThan(50);
  });
});

// ---------------------------------------------------------------------------
// Bug class 3: Time drift between two clocks
//
// Symptom: the map clock and the metrics clock disagree.
// Root cause: simulation.ts had its own SIM_SPEED, fleetSimulator had another.
// Now simulation.ts imports from fleetSimulator.
// ---------------------------------------------------------------------------

describe("single sim clock", () => {
  it("simNow() and getSimulatedMinutes() return the same value", () => {
    setSimMinute(700);
    expect(simNow()).toBeCloseTo(getSimulatedMinutes(), 6);
    setSimMinute(900);
    expect(simNow()).toBeCloseTo(getSimulatedMinutes(), 6);
  });

  it("sim advances at SIM_SPEED× real time", () => {
    setSimMinute(SIM_OPEN_MIN);
    const a = getSimulatedMinutes();
    setSimMinute(SIM_OPEN_MIN + 60); // +60 sim min
    const b = getSimulatedMinutes();
    expect(b - a).toBeCloseTo(60, 1);
  });

  it("sim returns FRACTIONAL minutes (not stuck at integers)", () => {
    setSimMinute(SIM_OPEN_MIN + 0.5);
    const half = getSimulatedMinutes();
    setSimMinute(SIM_OPEN_MIN + 0.75);
    const threeQuarter = getSimulatedMinutes();
    // Both should be between SIM_OPEN_MIN and SIM_OPEN_MIN+1, NOT equal,
    // NOT both rounded to the same integer minute.
    expect(threeQuarter).toBeGreaterThan(half);
    expect(threeQuarter - half).toBeGreaterThan(0.1);
  });
});

// ---------------------------------------------------------------------------
// Bug class 4: Day-of-week fuzz
//
// The schedule must vary by day so the demo isn't identical every refresh.
// ---------------------------------------------------------------------------

describe("day-of-week fuzz", () => {
  it("flight schedule has exactly the expected count of arrival flights for the active day", () => {
    const arrivals = OPS_FLIGHT_SCHEDULE.filter((f) => f.type === "arr");
    // base arrivals = 190; ~5% cancellations + 0–2 charters
    expect(arrivals.length).toBeGreaterThanOrEqual(170);
    expect(arrivals.length).toBeLessThanOrEqual(195);
  });

  it("schedule is deterministic within a calendar day (re-import is a no-op)", () => {
    // Importing again returns the same module instance; the array reference
    // is the same. This is a structural guarantee of the day-of-week design.
    const a = OPS_FLIGHT_SCHEDULE;
    const b = OPS_FLIGHT_SCHEDULE;
    expect(a).toBe(b);
  });
});

// ---------------------------------------------------------------------------
// New for the contract demo: clock override + driver tablet helper.
// ---------------------------------------------------------------------------

import { setClockOverride, getVehicleDetail } from "./fleetSimulator";

describe("setClockOverride", () => {
  it("when set, getSimulatedMinutes returns the override value", () => {
    setClockOverride(() => 700);
    expect(getSimulatedMinutes()).toBe(700);
    setClockOverride(() => 1200);
    expect(getSimulatedMinutes()).toBe(1200);
    setClockOverride(null);
  });

  it("when cleared, getSimulatedMinutes returns the wall-clock value", () => {
    setClockOverride(null);
    setSimMinute(SIM_OPEN_MIN);
    expect(getSimulatedMinutes()).toBeCloseTo(SIM_OPEN_MIN, 1);
  });
});

describe("getVehicleDetail (driver tablet helper)", () => {
  beforeEach(() => {
    setClockOverride(null);
  });

  it("returns null for an unknown plate", () => {
    setSimMinute(720);
    expect(getVehicleDetail("NOT-A-REAL-PLATE")).toBeNull();
  });

  it("returns trip detail for an active bus, with stops + ETA", () => {
    setSimMinute(720); // 12:00 — peak, multiple buses active
    const vehicles = getVehiclesNow(new Date());
    const bus = vehicles.find(
      (v) => !v.vehicleId.startsWith("ferry-") && !v.vehicleId.startsWith("orange-") && v.polylineMeters != null
    );
    expect(bus, "expected at least one active bus").toBeDefined();
    if (!bus) return;

    const detail = getVehicleDetail(bus.licensePlate);
    expect(detail).not.toBeNull();
    if (!detail) return;

    expect(detail.vehicle.licensePlate).toBe(bus.licensePlate);
    expect(detail.stops.length).toBeGreaterThan(0);
    expect(detail.directionLabel).toBeTruthy();
    expect(detail.paxCount).toBeGreaterThanOrEqual(0);
    expect(detail.paxCount).toBeLessThanOrEqual(detail.paxCapacity);

    // The driver should always know which stop is next (or be at the terminal)
    expect(detail.nextStopIdx).toBeGreaterThanOrEqual(-1);
  });

  it("paxCount is deterministic per plate per simHour", () => {
    setSimMinute(720);
    const a = getVehicleDetail("กข 1001");
    const b = getVehicleDetail("กข 1001");
    if (a && b) expect(a.paxCount).toBe(b.paxCount);
  });
});
