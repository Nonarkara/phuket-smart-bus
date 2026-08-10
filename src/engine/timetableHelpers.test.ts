import { describe, it, expect } from "vitest";
import {
  getAirportDepartures,
  getAirportboundTrips,
  getNextPublishedStopArrival,
  getPublishedTravelMinutesFromAirport
} from "./fleetSimulator";

describe("published timetable helpers", () => {
  it("keeps all 20 northbound trips including mid-route joiners", () => {
    expect(getAirportDepartures().length).toBe(20);
    expect(getAirportboundTrips().length).toBe(20);
    expect(getAirportboundTrips()[0]!.originDepMin).toBe(5 * 60 + 30);
    expect(getAirportboundTrips()[0]!.airportArriveMin).toBe(7 * 60 + 17);
  });

  it("reads Patong from published stop times", () => {
    expect(getPublishedTravelMinutesFromAirport("Patong")).toBe(70);
    const next = getNextPublishedStopArrival("Patong", 8 * 60);
    expect(next?.arriveMin).toBe(9 * 60 + 25);
  });
});
