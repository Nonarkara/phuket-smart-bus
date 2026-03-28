import { describe, expect, it } from "vitest";
import { haversineDistanceMeters } from "../../lib/geo.js";
import { getStopsForRoute } from "../routes.js";
import {
  buildScheduleMockFleet,
  getFallbackFleetRoster,
  getMockFleetSummary
} from "./mockFleetProvider.js";

describe("mockFleetProvider", () => {
  it("keeps the full fleet roster available for route assignment", () => {
    const roster = getFallbackFleetRoster();
    const routeCounts = roster.reduce<Record<string, number>>((counts, vehicle) => {
      counts[vehicle.routeId] = (counts[vehicle.routeId] ?? 0) + 1;
      return counts;
    }, {});

    expect(roster).toHaveLength(38);
    expect(routeCounts["rawai-airport"]).toBeGreaterThanOrEqual(8);
    expect(routeCounts["patong-old-bus-station"]).toBeGreaterThanOrEqual(3);
    expect(routeCounts["dragon-line"]).toBeGreaterThanOrEqual(2);
    expect(routeCounts["rassada-phi-phi"]).toBeGreaterThanOrEqual(5);
    expect(routeCounts["bang-rong-koh-yao"]).toBeGreaterThanOrEqual(4);
    expect(routeCounts["chalong-racha"]).toBeGreaterThanOrEqual(3);
  });

  it("builds an active daytime fleet from the timetable across the three routes", () => {
    const now = new Date("2026-03-09T15:10:00+07:00");
    const vehicles = buildScheduleMockFleet(now);
    const summary = getMockFleetSummary(now);

    expect(vehicles.length).toBeGreaterThanOrEqual(7);
    expect(new Set(vehicles.map((vehicle) => vehicle.vehicleId)).size).toBe(vehicles.length);
    expect(summary.activeByRoute["rawai-airport"]).toBeGreaterThanOrEqual(3);
    expect(summary.activeByRoute["patong-old-bus-station"]).toBeGreaterThanOrEqual(2);
    expect(summary.activeByRoute["dragon-line"]).toBeGreaterThanOrEqual(1);

    for (const vehicle of vehicles) {
      expect(vehicle.telemetrySource).toBe("schedule_mock");
      expect(vehicle.freshness).toBe("fresh");
      expect(vehicle.updatedAt).toBe(now.toISOString());
    }
  });

  it("positions an upcoming airport-line bus at the airport before departure", () => {
    const now = new Date("2026-03-09T08:50:00+07:00");
    const airportStop = getStopsForRoute("rawai-airport").find((stop) => stop.name.en === "Phuket Airport");
    const vehicles = buildScheduleMockFleet(now).filter((vehicle) => vehicle.routeId === "rawai-airport");
    const nearestDistance =
      airportStop && vehicles.length > 0
        ? Math.min(...vehicles.map((vehicle) => haversineDistanceMeters(vehicle.coordinates, airportStop.coordinates)))
        : Infinity;

    expect(airportStop).toBeTruthy();
    expect(nearestDistance).toBeLessThanOrEqual(50);
  });
});
