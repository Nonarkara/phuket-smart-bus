import { describe, expect, it } from "vitest";
import {
  BASE_OPS_FLIGHTS,
  buildFlightHourBuckets,
  getOpsFlightSchedule,
  getDayLabel,
  getDayVolumeFactor
} from "./opsFlightSchedule";

describe("opsFlightSchedule", () => {
  it("loads the unfuzzed base schedule for the demand rail", () => {
    const arrivals = BASE_OPS_FLIGHTS.filter((flight) => flight.type === "arr");
    const departures = BASE_OPS_FLIGHTS.filter((flight) => flight.type === "dep");

    expect(BASE_OPS_FLIGHTS).toHaveLength(380);
    expect(arrivals).toHaveLength(190);
    expect(departures).toHaveLength(190);
    expect(BASE_OPS_FLIGHTS[0]?.timeLabel).toBe("00:10");
    expect(BASE_OPS_FLIGHTS.at(-1)?.timeLabel).toBe("23:50");
  });

  it("applies day-of-week fuzz: ~5% cancellations + 0–2 charters", () => {
    const fuzzed = getOpsFlightSchedule();
    // base 380 minus ~5% cancellations + 0-2 charters → expect 350-385
    expect(fuzzed.length).toBeGreaterThanOrEqual(350);
    expect(fuzzed.length).toBeLessThanOrEqual(385);
  });

  it("builds 24 hourly buckets with both arrival and departure demand", () => {
    const buckets = buildFlightHourBuckets();

    expect(buckets).toHaveLength(24);
    expect(buckets.some((bucket) => bucket.arrivals > 0)).toBe(true);
    expect(buckets.some((bucket) => bucket.departures > 0)).toBe(true);
    // After fuzz the totals are slightly off from base 190 — guard the range.
    const totalArrivals = buckets.reduce((sum, b) => sum + b.arrivals, 0);
    const totalDepartures = buckets.reduce((sum, b) => sum + b.departures, 0);
    expect(totalArrivals).toBeGreaterThanOrEqual(170);
    expect(totalArrivals).toBeLessThanOrEqual(195);
    expect(totalDepartures).toBeGreaterThanOrEqual(170);
    expect(totalDepartures).toBeLessThanOrEqual(195);
  });

  it("exposes day metadata", () => {
    const dow = getDayLabel();
    const factor = getDayVolumeFactor();
    expect(["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]).toContain(dow);
    expect(factor).toBeGreaterThan(0.5);
    expect(factor).toBeLessThan(1.5);
  });
});
