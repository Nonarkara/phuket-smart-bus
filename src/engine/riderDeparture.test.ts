import { describe, expect, it } from "vitest";
import { getNextRiderDeparture } from "./riderDeparture";

describe("rider departure SSOT", () => {
  it("uses the next published airport departure", () => {
    const next = getNextRiderDeparture("rawai-airport", 8 * 60);
    expect(next).not.toBeNull();
    expect(next!.departureMin).toBeGreaterThan(8 * 60);
    expect(next!.waitMin).toBe(next!.departureMin - 8 * 60);
    expect(next!.destination).toBe("Patong & Rawai");
  });

  it("wraps the published airport timetable to tomorrow", () => {
    const next = getNextRiderDeparture("rawai-airport", 23 * 60 + 59);
    expect(next).not.toBeNull();
    expect(next!.departureMin).toBeGreaterThan(24 * 60);
    expect(next!.waitMin).toBeGreaterThan(0);
  });
});
