import { beforeEach, describe, expect, it } from "vitest";
import type { VehiclePosition } from "../../../shared/types.js";
import { clearOperationsStore, recordSeatCameraSamples } from "../operationsStore.js";
import { estimateSeatAvailability } from "./seatProvider.js";

const vehicle: VehiclePosition = {
  id: "rawai-1",
  routeId: "rawai-airport",
  licensePlate: "10-1148",
  vehicleId: "008800B133",
  deviceId: null,
  coordinates: [8.099, 98.2995],
  heading: 50,
  speedKph: 0,
  destination: { en: "To Rawai Beach", th: "ไปราไวย์บีช" },
  updatedAt: "2026-03-08T14:00:00Z",
  telemetrySource: "public_tracker",
  freshness: "fresh",
  status: "dwelling",
  distanceToDestinationMeters: 120,
  stopsAway: 1
};

describe("seatProvider", () => {
  beforeEach(() => {
    clearOperationsStore();
  });

  it("switches from estimate mode to live camera mode when occupancy is available", () => {
    const capturedAt = new Date(Date.now() + 60_000).toISOString();

    recordSeatCameraSamples([
      {
        cameraId: "cam-01",
        vehicleId: "008800B133",
        routeId: "rawai-airport",
        capacity: 23,
        occupiedSeats: 15,
        seatsLeft: 8,
        capturedAt
      }
    ]);

    const seats = estimateSeatAvailability(vehicle);

    expect(seats?.basis).toBe("camera_live");
    expect(seats?.seatsLeft).toBe(8);
    expect(seats?.cameraId).toBe("cam-01");
  });
});
