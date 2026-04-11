import { describe, expect, it } from "vitest";
import { buildFlightHourBuckets, getOpsFlightSchedule } from "./opsFlightSchedule";

describe("opsFlightSchedule", () => {
  it("loads the full peak-day schedule for the demand rail", () => {
    const flights = getOpsFlightSchedule();
    const arrivals = flights.filter((flight) => flight.type === "arr");
    const departures = flights.filter((flight) => flight.type === "dep");

    expect(flights).toHaveLength(380);
    expect(arrivals).toHaveLength(190);
    expect(departures).toHaveLength(190);
    expect(flights[0]?.timeLabel).toBe("00:10");
    expect(flights.at(-1)?.timeLabel).toBe("23:50");
  });

  it("builds 24 hourly buckets with both arrival and departure demand", () => {
    const buckets = buildFlightHourBuckets();

    expect(buckets).toHaveLength(24);
    expect(buckets.some((bucket) => bucket.arrivals > 0)).toBe(true);
    expect(buckets.some((bucket) => bucket.departures > 0)).toBe(true);
    expect(buckets.reduce((sum, bucket) => sum + bucket.arrivals, 0)).toBe(190);
    expect(buckets.reduce((sum, bucket) => sum + bucket.departures, 0)).toBe(190);
  });
});
