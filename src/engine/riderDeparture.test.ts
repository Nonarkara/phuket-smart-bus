import { describe, expect, it } from "vitest";
import { getNextPublishedArrival, getNextPublishedDeparture, getNextRiderDeparture } from "./riderDeparture";

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

describe("the published ARRIVAL at the rider's own stop", () => {
  // The times below are the official PKSB timetable's own per-stop times,
  // read from src/data/timetables/. They are what the operator published, so
  // they are what the board may say when no bus is on the way.

  it("at the airport, toward Rawai, the next departure", () => {
    const next = getNextPublishedArrival("rawai-airport", "Phuket Airport", "fwd", 7 * 60);
    expect(next).not.toBeNull();
    expect(next!.arrivalMin).toBe(8 * 60 + 15); // 08:15
    expect(next!.waitMin).toBe(75);
  });

  it("at the airport, toward the airport, the next ARRIVAL", () => {
    const next = getNextPublishedArrival("rawai-airport", "Phuket Airport", "rev", 7 * 60);
    expect(next).not.toBeNull();
    expect(next!.arrivalMin).toBe(7 * 60 + 17); // 07:17
  });

  it("mid-route, it is the time the bus reaches THAT stop", () => {
    // A bus leaves Rawai at 05:30 and is at Kata Palm at 05:30 — the
    // northbound's own time there. A rider in Kata Palm is waiting for that
    // minute, not for a departure from the other end of the line.
    const northbound = getNextPublishedArrival("rawai-airport", "Kata Palm", "rev", 5 * 60 + 45);
    expect(northbound).not.toBeNull();
    expect(northbound!.arrivalMin).toBe(6 * 60 + 20); // 06:20

    const southbound = getNextPublishedArrival("rawai-airport", "Kata Palm", "fwd", 9 * 60);
    expect(southbound).not.toBeNull();
    expect(southbound!.arrivalMin).toBe(9 * 60 + 52); // 09:52
  });

  it("matches a stop whose name is written the other way round", () => {
    // The published timetable says "PEA Patong"; the map's stop list says
    // "Patong PEA". They are the same stop.
    const next = getNextPublishedArrival("rawai-airport", "Patong PEA", "fwd", 12 * 60);
    expect(next).not.toBeNull();
    expect(next!.arrivalMin).toBeGreaterThan(12 * 60);
  });

  it("wraps to tomorrow when the day's departures have gone", () => {
    const next = getNextPublishedArrival("rawai-airport", "Phuket Airport", "fwd", 23 * 60 + 30);
    expect(next).not.toBeNull();
    expect(next!.arrivalMin).toBeGreaterThan(24 * 60);
    // 23:30 → tomorrow's 08:15 is eight hours and forty-five minutes.
    expect(next!.waitMin).toBe(525);
  });

  it("says nothing about a stop the published timetable does not name", () => {
    // "Cafe De Mar" is on the map between Thalang and the airport; the
    // operator publishes no time for it. A wrong time is worse than none.
    expect(getNextPublishedArrival("rawai-airport", "Cafe De Mar", "fwd", 7 * 60)).toBeNull();
  });

  it("falls back to null for a route it does not know", () => {
    expect(getNextPublishedArrival(null, "Phuket Airport", "fwd", 7 * 60)).toBeNull();
  });
});

describe("the published DEPARTURE of the airport corridor", () => {
  it("is the published time in that direction", () => {
    const southbound = getNextPublishedDeparture("fwd", 7 * 60);
    expect(southbound).not.toBeNull();
    expect(southbound!.departureMin).toBe(8 * 60 + 15); // 08:15

    const northbound = getNextPublishedDeparture("rev", 5 * 60);
    expect(northbound).not.toBeNull();
    expect(northbound!.departureMin).toBe(5 * 60 + 30); // 05:30 from Rawai
  });
});
