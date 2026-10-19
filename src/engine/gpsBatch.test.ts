import { describe, expect, it } from "vitest";
import {
  applyBusesToDay,
  emptyGpsDay,
  foldBatches,
  gpsBatchKey,
  GPS_HISTORY_TTL_S,
  studyDates,
  summarizeGpsDay,
  type GpsBusPing,
} from "../../shared/gpsBatch";

function ping(over: Partial<GpsBusPing> & Pick<GpsBusPing, "coordinates">): GpsBusPing {
  return {
    vehicleId: "10-1230ภูเก็ต",
    licensePlate: "10-1230ภูเก็ต",
    speedKph: 30,
    timestamp: "2026-09-29T03:00:00.000Z",
    paxCount: 0,
    ...over,
  };
}

/** A fix the device took at `ms` — each call is a new fix, as on a moving bus. */
const fixAt = (ms: number, over: Partial<GpsBusPing> & Pick<GpsBusPing, "coordinates">) =>
  ping({ ...over, timestamp: new Date(ms).toISOString() });

describe("gps history", () => {
  it("lists newest batches first and keeps a month-long study past its last day", () => {
    expect(gpsBatchKey(2_000) < gpsBatchKey(1_000)).toBe(true);
    expect(GPS_HISTORY_TTL_S).toBe(45 * 24 * 60 * 60);
  });

  it("names the seven Bangkok dates of a study that starts 30 Sep", () => {
    expect(studyDates("2026-09-30", 7)).toEqual([
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
      "2026-10-05",
      "2026-10-06",
    ]);
    expect(studyDates("2026-09-31", 7)).toBeNull();
    expect(studyDates("2026-09-30", 100)).toHaveLength(31);
  });

  it("joins the Thai plate to the canonical plate and does not count riders already on board", () => {
    const t0 = Date.parse("2026-09-29T02:00:00.000Z");
    let day = applyBusesToDay(emptyGpsDay(t0), [fixAt(t0, { coordinates: [7.89, 98.39], paxCount: 8 })], t0);
    day = applyBusesToDay(day, [fixAt(t0 + 60_000, { coordinates: [7.90, 98.39], paxCount: 11 })], t0 + 60_000);
    const summary = summarizeGpsDay(day);
    expect(summary.vehicles).toHaveLength(1);
    expect(summary.vehicles[0]?.vehicleId).toBe("10-1230");
    expect(summary.totalPaxServed).toBe(3);
    expect(summary.totalRevenueThb).toBe(300);
  });

  it("a counter that never reads above zero means riders unknown — not zero, not invented", () => {
    // 2026-09-29 11:08: all 24 buses read 0 on every counter field while 8 drove at up to 53 km/h.
    const t0 = Date.parse("2026-09-29T04:00:00.000Z");
    const batches = [0, 1, 2].map((i) => ({
      fetchedAt: t0 + i * 60_000,
      storedAt: t0 + i * 60_000,
      source: "pksb-tracker",
      buses: [ping({
        coordinates: [7.89 + i * 0.01, 98.39], paxCount: 0, paxUp: 0, paxDown: 0, speedKph: 40,
        timestamp: new Date(t0 + i * 60_000).toISOString(),
      })],
    }));
    const summary = summarizeGpsDay(foldBatches(batches));
    expect(summary.totalKmTracked).toBeGreaterThan(0);
    expect(summary.vehicles[0]?.paxBasis).toBe("counter-silent");
    expect(summary.countersReporting).toBe(0);
    expect(summary.totalPaxServed).toBeNull();
    expect(summary.totalRevenueThb).toBeNull();
    expect(summary.netMarginThb).toBeNull();
  });

  it("kilometres come from the odometer; the 30-second trace cuts corners and is kept beside it", () => {
    const t0 = Date.parse("2026-09-29T04:00:00.000Z");
    let day = emptyGpsDay(t0);
    // Straight-line 1.1 km, odometer says the road took 1.4 km.
    day = applyBusesToDay(day, [ping({ coordinates: [7.89, 98.39], odometerM: 52_076_500, timestamp: new Date(t0).toISOString() })], t0);
    day = applyBusesToDay(day, [ping({ coordinates: [7.90, 98.39], odometerM: 52_077_900, timestamp: new Date(t0 + 120_000).toISOString() })], t0 + 120_000);
    const bus = summarizeGpsDay(day).vehicles[0]!;
    expect(bus.kmBasis).toBe("odometer");
    expect(bus.totalDistanceKm).toBe(1.4);
    expect(bus.gpsTraceKm).toBeCloseTo(1.1, 1);
  });

  it("an odometer that resets or leaps faster than a bus adds no distance", () => {
    const t0 = Date.parse("2026-09-29T04:00:00.000Z");
    const at = (i: number, odometerM: number) => ping({
      coordinates: [7.89, 98.39], odometerM, timestamp: new Date(t0 + i * 60_000).toISOString(),
    });
    let day = emptyGpsDay(t0);
    day = applyBusesToDay(day, [at(0, 50_000_000)], t0);
    day = applyBusesToDay(day, [at(1, 50_000_500)], t0 + 60_000); // +0.5 km in a minute: real
    day = applyBusesToDay(day, [at(2, 10_000)], t0 + 120_000); // device reset
    day = applyBusesToDay(day, [at(3, 510_000)], t0 + 180_000); // +500 km in a minute: glitch
    day = applyBusesToDay(day, [at(4, 510_800)], t0 + 240_000); // +0.8 km: real again
    expect(summarizeGpsDay(day).vehicles[0]!.totalDistanceKm).toBe(1.3);
  });

  it("a fix the tracker serves again counts once, and yesterday's parked fix isn't today's bus", () => {
    const t0 = Date.parse("2026-09-29T04:00:00.000Z");
    const sameFix = ping({ coordinates: [7.89, 98.39], paxCount: 3, timestamp: new Date(t0).toISOString() });
    const ghost = ping({ vehicleId: "10-1229", licensePlate: "10-1229", coordinates: [7.905, 98.367], timestamp: "2026-09-27T02:08:04.000Z" });
    let day = applyBusesToDay(emptyGpsDay(t0), [sameFix, ghost], t0);
    day = applyBusesToDay(day, [sameFix, ghost], t0 + 30_000);
    day = applyBusesToDay(day, [sameFix, ghost], t0 + 60_000);
    const summary = summarizeGpsDay(day);
    expect(summary.totalTrackedVehicles).toBe(1);
    expect(summary.vehicles[0]!.fixes).toBe(1);
  });

  it("coverage counts the service minutes that got a sample, and says how long the worst gap was", () => {
    const bkk = (hhmm: string) => Date.parse(`2026-09-30T${hhmm}:00+07:00`);
    let day = emptyGpsDay(bkk("05:00"));
    for (const t of ["05:00", "05:00", "05:01", "05:02", "05:30"]) {
      day = applyBusesToDay(day, [ping({ coordinates: [7.89, 98.39], timestamp: new Date(bkk(t)).toISOString() })], bkk(t));
    }
    const cov = summarizeGpsDay(day, bkk("05:30") + 1_000).coverage;
    expect(cov.samples).toBe(5);
    expect(cov.serviceMinutesSampled).toBe(4); // 05:00, 05:01, 05:02, 05:30
    expect(cov.serviceMinutesSoFar).toBe(31); // 05:00–05:30 inclusive
    expect(cov.longestGapMin).toBe(28);
    // Read the day after: the whole 05:00–24:00 window is the denominator.
    expect(summarizeGpsDay(day, bkk("05:30") + 86_400_000).coverage.serviceMinutesSoFar).toBe(19 * 60);
  });

  it("drops a GPS jump and an off-island fix", () => {
    const t0 = Date.parse("2026-09-29T05:00:00.000Z");
    let day = applyBusesToDay(emptyGpsDay(t0), [fixAt(t0, { coordinates: [7.89, 98.39], paxCount: 1 })], t0);
    day = applyBusesToDay(day, [fixAt(t0 + 5_000, { coordinates: [8.2, 98.39], paxCount: 1 })], t0 + 5_000);
    day = applyBusesToDay(day, [fixAt(t0 + 10_000, { coordinates: [0, 0], vehicleId: "ghost", paxCount: 20 })], t0 + 10_000);
    expect(summarizeGpsDay(day).totalKmTracked).toBe(0);
    expect(summarizeGpsDay(day).totalTrackedVehicles).toBe(1);
  });

  it("a counter glitch larger than 40 does not become boardings", () => {
    const t0 = Date.parse("2026-09-29T06:00:00.000Z");
    let day = applyBusesToDay(emptyGpsDay(t0), [fixAt(t0, { coordinates: [7.89, 98.39], paxCount: 2 })], t0);
    day = applyBusesToDay(day, [fixAt(t0 + 60_000, { coordinates: [7.891, 98.39], paxCount: 80 })], t0 + 60_000);
    expect(summarizeGpsDay(day).totalPaxServed).toBe(0);
  });

  it("a run is a departure from a 10-minute halt; time moving excludes the halt; a bus that goes silent mid-route is no_fix, not in transit", () => {
    const t0 = Date.parse("2026-09-30T06:00:00+07:00");
    const at = (min: number, lat: number, speedKph: number) => fixAt(t0 + min * 60_000, { coordinates: [lat, 98.39], speedKph });
    const steps = [
      at(0, 7.86, 0), at(12, 7.86, 0),            // parked 12 min
      at(13, 7.865, 30), at(14, 7.87, 30),        // run 1: two moving minutes
      at(15, 7.87, 0), at(16, 7.87, 0),           // 2-min stop — a bus stop, not a new run
      at(17, 7.875, 30),
      at(18, 7.875, 0), at(30, 7.875, 0),         // 13-min halt
      at(31, 7.88, 30),                           // run 2, then the tracker goes silent
    ];
    let day = emptyGpsDay(t0);
    for (const p of steps) day = applyBusesToDay(day, [p], Date.parse(p.timestamp));
    const v = summarizeGpsDay(day, t0 + 60 * 60_000).vehicles[0]!;
    expect(v.runs).toBe(2);
    expect(v.hoursMoving).toBeCloseTo(4 / 60, 1);
    expect(v.longestHaltMin).toBe(13);
    expect(v.lastState).toBe("no_fix");
    expect(v.lostWhileMoving).toBe(true);
    expect(v.reachedAirport).toBe(false);
  });

  it("a past day is read at its last sample, so a bus that was halted then is halted — not no_fix a day later", () => {
    const t0 = Date.parse("2026-09-30T20:00:00+07:00");
    let day = applyBusesToDay(emptyGpsDay(t0), [fixAt(t0, { coordinates: [7.86, 98.39], speedKph: 0 })], t0);
    day = applyBusesToDay(day, [fixAt(t0 + 60_000, { coordinates: [7.86, 98.39], speedKph: 0 })], t0 + 60_000);
    expect(summarizeGpsDay(day, t0 + 86_400_000).vehicles[0]!.lastState).toBe("halted");
  });

  it("a day folded before runs were recorded says unknown, not 0 runs", () => {
    const t0 = Date.parse("2026-09-29T12:00:00+07:00");
    const day = applyBusesToDay(emptyGpsDay(t0), [fixAt(t0, { coordinates: [7.86, 98.39] })], t0);
    expect(summarizeGpsDay(day, t0).totalRuns).toBe(0);
    expect(summarizeGpsDay({ ...day, rules: undefined }, t0).totalRuns).toBeNull();
  });
});
