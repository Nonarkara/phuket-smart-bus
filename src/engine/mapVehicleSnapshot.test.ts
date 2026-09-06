import { describe, expect, it } from "vitest";
import { getMapVehicles } from "./mapVehicleSnapshot";

describe("map vehicle snapshot", () => {
  it("uses the full route-aware fleet shape for embedded and console maps", () => {
    const vehicles = getMapVehicles(12 * 60);

    expect(vehicles.length).toBeGreaterThan(0);
    expect(vehicles.some((vehicle) => vehicle.route === "rawai-airport")).toBe(true);
    expect(vehicles.some((vehicle) => vehicle.route === "patong-old-bus-station")).toBe(true);
    expect(vehicles.every((vehicle) => Number.isFinite(vehicle.lat) && Number.isFinite(vehicle.lng))).toBe(true);
    expect(vehicles.every((vehicle) => vehicle.pax >= 0)).toBe(true);
  });
});
