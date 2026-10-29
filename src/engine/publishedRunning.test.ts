import { AIRPORT_PUBLISHED, publishedRunningByDir, publishedRunningMin } from "./publishedRunning";
import { getPublishedAirportTrips } from "./fleetSimulator";

const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length & 1 ? s[m]! : Math.round((s[m - 1]! + s[m]!) / 2);
};

describe("the published running time", () => {
  it("is what the official timetable says, not the 95 min comparison figure", () => {
    expect(AIRPORT_PUBLISHED.fwd).toBe(130);
    expect(AIRPORT_PUBLISHED.rev).toBe(147);
    expect(AIRPORT_PUBLISHED.line).toBeGreaterThan(125);
    expect(AIRPORT_PUBLISHED.line).toBeLessThan(150);
  });

  it("agrees with the trips the simulator reads from the same files (one source, checked)", () => {
    const published = getPublishedAirportTrips();
    expect(AIRPORT_PUBLISHED.fwd).toBe(median(published.southbound.map((t) => t.minutes)));
    expect(AIRPORT_PUBLISHED.rev).toBe(median(published.northbound.map((t) => t.minutes)));
  });

  it("publishes nothing for the lines that have no per-trip timetable", () => {
    expect(publishedRunningMin("patong-old-bus-station")).toBeNull();
    expect(publishedRunningMin("dragon-line")).toBeNull();
    expect(publishedRunningByDir("dragon-line")).toBeNull();
    expect(publishedRunningMin("rawai-airport")).toBe(AIRPORT_PUBLISHED.line);
  });
});
