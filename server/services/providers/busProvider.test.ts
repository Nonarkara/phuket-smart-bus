import { beforeEach, describe, expect, it } from "vitest";
import { clearOperationsStore, recordVehicleTelemetry } from "../operationsStore.js";
import { inferRoute, mergeVehiclesWithTelemetry, normalizeRecord } from "./busProvider.js";

const rawRecord = {
  id: 1,
  licence: "10-1223",
  date: "2026-03-08T14:26:48.689912",
  buffer: "Patong",
  data: {
    azm: 294.7,
    pos: [98.356406, 7.906158] as [number, number],
    spd: 50,
    time: "2026-03-08T14:26:48.588467",
    buffer: "Patong",
    determineBusDirection: [
      "The bus is heading from Phuket Bus Terminal 1 to Patong",
      7483.75,
      "Patong",
      868.0,
      129
    ] as [string, number, string, number, number],
    vhc: {
      id: "007103AF3C",
      lc: "10-1223"
    }
  }
};

describe("busProvider", () => {
  beforeEach(() => {
    clearOperationsStore();
  });

  it("infers the Phuket route from buffer hints", () => {
    expect(inferRoute(rawRecord)).toBe("patong-old-bus-station");
  });

  it("normalizes raw live feed records for the frontend", () => {
    const vehicle = normalizeRecord(rawRecord);

    expect(vehicle).not.toBeNull();
    expect(vehicle?.routeId).toBe("patong-old-bus-station");
    expect(vehicle?.coordinates).toEqual([7.906158, 98.356406]);
    expect(vehicle?.destination.en).toContain("Patong");
    expect(vehicle?.deviceId).toBeNull();
    expect(vehicle?.telemetrySource).toBe("public_tracker");
  });

  it("prefers fresher direct GPS telemetry when device samples arrive", () => {
    const vehicle = normalizeRecord(rawRecord);
    const capturedAt = new Date(Date.now() + 60_000).toISOString();

    recordVehicleTelemetry([
      {
        deviceId: "gps-22",
        vehicleId: "007103AF3C",
        routeId: "patong-old-bus-station",
        licensePlate: "10-1223",
        coordinates: [7.91, 98.35],
        heading: 180,
        speedKph: 18,
        destinationHint: "Patong",
        capturedAt
      }
    ]);

    const merged = mergeVehiclesWithTelemetry(vehicle ? [vehicle] : []);

    expect(merged[0]?.coordinates).toEqual([7.91, 98.35]);
    expect(merged[0]?.telemetrySource).toBe("direct_gps");
    expect(merged[0]?.deviceId).toBe("gps-22");
  });
});
