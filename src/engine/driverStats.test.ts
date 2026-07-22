import { describe, expect, it } from "vitest";
import { setSimulatedMinutes, listLandTripAssignments, getLandBusRoster } from "./fleetSimulator";
import { getAllDriverDayRecords, getDriverDayRecord } from "./driverStats";
import { getDriverProfile, buildPixelFaceSvg } from "./driverRoster";
import { buildScheduleFlightBeads } from "./adsbFlights";

describe("driverRoster", () => {
  it("is stable for the same plate", () => {
    const a = getDriverProfile({ vehicleId: "pksb-1", plate: "กข 1001 ภูเก็ต", routeId: "rawai-airport" });
    const b = getDriverProfile({ vehicleId: "pksb-1", plate: "กข 1001 ภูเก็ต", routeId: "rawai-airport" });
    expect(a.nameTh).toBe(b.nameTh);
    expect(a.employeeNo).toBe(b.employeeNo);
    expect(a.faceDataUri).toContain("data:image/svg+xml");
  });

  it("builds crisp 8-bit SVG faces", () => {
    const svg = decodeURIComponent(buildPixelFaceSvg(42).replace("data:image/svg+xml;charset=utf-8,", ""));
    expect(svg).toContain('viewBox="0 0 16 16"');
    expect(svg).toContain("shape-rendering=\"crispEdges\"");
  });
});

describe("driverStats · sim-derived day records", () => {
  it("assigns every land departure to exactly one vehicle", () => {
    setSimulatedMinutes(12 * 60); // noon
    const legs = listLandTripAssignments(12 * 60);
    expect(legs.length).toBeGreaterThan(10);
    const keys = new Set(legs.map((l) => `${l.routeId}:${l.directionLabel}:${l.depMin}`));
    expect(keys.size).toBe(legs.length);
  });

  it("every land bus has a named driver record", () => {
    setSimulatedMinutes(18 * 60);
    const roster = getLandBusRoster();
    expect(roster.length).toBeGreaterThan(5);
    for (const bus of roster) {
      const rec = getDriverDayRecord(bus.vehicleId, 18 * 60);
      expect(rec).not.toBeNull();
      expect(rec!.profile.nameTh.length).toBeGreaterThan(3);
      expect(rec!.hoursOnDuty).toBeGreaterThanOrEqual(0);
      expect(rec!.co2ReducedKg).toBeCloseTo(rec!.paxServed * 28 * 0.15, 0);
      expect(rec!.revenueThb).toBe(rec!.paxServed * 100);
    }
  });

  it("fleet pax / hours climb as the day advances", () => {
    const morning = getAllDriverDayRecords(9 * 60);
    const evening = getAllDriverDayRecords(20 * 60);
    const sum = (rows: typeof morning, key: "paxServed" | "hoursOnDuty" | "tripsCompleted") =>
      rows.reduce((s, r) => s + r[key], 0);
    expect(sum(evening, "tripsCompleted")).toBeGreaterThanOrEqual(sum(morning, "tripsCompleted"));
    expect(sum(evening, "hoursOnDuty")).toBeGreaterThan(sum(morning, "hoursOnDuty"));
    expect(sum(evening, "paxServed")).toBeGreaterThanOrEqual(sum(morning, "paxServed"));
  });
});

describe("schedule flight beads", () => {
  it("places nearby arrivals/departures around HKT", () => {
    const beads = buildScheduleFlightBeads(
      [
        { flightNo: "TG201", type: "arr", city: "Bangkok", schedMin: 12 * 60 + 10 },
        { flightNo: "FD300", type: "dep", city: "Chiang Mai", schedMin: 12 * 60 + 5 },
        { flightNo: "XX999", type: "arr", city: "Far", schedMin: 18 * 60 },
      ],
      12 * 60
    );
    expect(beads.some((b) => b.callsign === "TG201")).toBe(true);
    expect(beads.some((b) => b.callsign === "FD300")).toBe(true);
    expect(beads.some((b) => b.callsign === "XX999")).toBe(false);
    for (const b of beads) {
      expect(b.lat).toBeGreaterThan(7.4);
      expect(b.lat).toBeLessThan(8.4);
      expect(b.lon).toBeGreaterThan(97.9);
      expect(b.lon).toBeLessThan(98.9);
    }
  });
});
