import { describe, expect, it } from "vitest";
import type { VehiclePosition } from "@shared/types";
import { localizedText } from "@shared/localizedText";
import { buildAnimatedVehicleFrame, shouldAnimateVehicleFrame } from "./vehicleAnimation";

const airportVehicle: VehiclePosition = {
  id: "veh-airport-1",
  routeId: "rawai-airport",
  licensePlate: "10-1208",
  vehicleId: "veh-airport-1",
  deviceId: null,
  coordinates: [8.099, 98.299],
  heading: 20,
  speedKph: 16,
  destination: localizedText("To Rawai Beach", "ไปราไวย์บีช"),
  updatedAt: "2026-03-08T14:00:00Z",
  telemetrySource: "schedule_mock",
  freshness: "fresh",
  status: "moving",
  distanceToDestinationMeters: 2400,
  stopsAway: 4,
  polylineMeters: null,
  polylineFirstStop: null
};

const patongVehicle: VehiclePosition = {
  ...airportVehicle,
  id: "veh-patong-1",
  routeId: "patong-old-bus-station",
  licensePlate: "10-1223",
  vehicleId: "veh-patong-1",
  coordinates: [7.906, 98.356],
  destination: localizedText("To Patong", "ไปป่าตอง")
};

describe("vehicleAnimation", () => {
  it("interpolates intermediate coordinates for shared vehicles", () => {
    const frame = buildAnimatedVehicleFrame(
      [airportVehicle],
      [
        {
          ...airportVehicle,
          coordinates: [8.103, 98.305],
          heading: 80
        }
      ],
      0.5
    );

    expect(frame[0]?.coordinates[0]).toBeCloseTo(8.101, 4);
    expect(frame[0]?.coordinates[1]).toBeCloseTo(98.302, 4);
    expect(frame[0]?.heading).toBeCloseTo(50, 4);
    expect(shouldAnimateVehicleFrame([airportVehicle], frame)).toBe(true);
  });

  it("keeps new vehicles at their target position and removes filtered-out ones", () => {
    const frame = buildAnimatedVehicleFrame([airportVehicle], [patongVehicle], 0.5);

    expect(frame).toHaveLength(1);
    expect(frame[0]?.vehicleId).toBe("veh-patong-1");
    expect(frame[0]?.coordinates).toEqual(patongVehicle.coordinates);
  });

  it("handles route-filter switches by returning only the currently visible vehicles", () => {
    const frame = buildAnimatedVehicleFrame([airportVehicle, patongVehicle], [patongVehicle], 0.25);

    expect(frame).toHaveLength(1);
    expect(frame[0]?.vehicleId).toBe("veh-patong-1");
    expect(frame[0]?.routeId).toBe("patong-old-bus-station");
  });
});
