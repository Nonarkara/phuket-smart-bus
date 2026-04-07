import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearOperationsStore,
  clearOperationsStoreCache,
  getDriverAttention,
  getLiveSeatAvailability,
  getTelemetryVehicles,
  getVehiclePassengerFlowSummary,
  recordDriverMonitorSamples,
  recordPassengerFlowSamples,
  recordSeatCameraSamples,
  recordVehicleTelemetry
} from "./operationsStore.js";
import {
  clearDemandRequestStore,
  getDemandHotspots,
  recordDemandRequest
} from "./demandRequestStore.js";

describe("SQLite-backed persistence", () => {
  beforeEach(() => {
    clearOperationsStore();
    clearDemandRequestStore();
  });

  afterEach(() => {
    clearOperationsStore();
    clearDemandRequestStore();
  });

  it("re-hydrates telemetry, seat, driver, and passenger-flow data after an in-memory reset", () => {
    const capturedAt = new Date().toISOString();

    recordVehicleTelemetry([
      {
        deviceId: "tracker-1",
        vehicleId: "bus-1",
        routeId: "rawai-airport",
        licensePlate: "10-1151",
        coordinates: [8.10846, 98.30655],
        heading: 24,
        speedKph: 35,
        destinationHint: "Airport",
        capturedAt
      }
    ]);
    recordSeatCameraSamples([
      {
        cameraId: "cabin-1",
        vehicleId: "bus-1",
        routeId: "rawai-airport",
        capacity: 25,
        occupiedSeats: 12,
        seatsLeft: 13,
        capturedAt
      }
    ]);
    recordDriverMonitorSamples([
      {
        cameraId: "driver-1",
        vehicleId: "bus-1",
        routeId: "rawai-airport",
        attentionState: "watch",
        confidence: 0.93,
        capturedAt
      }
    ]);
    recordPassengerFlowSamples([
      {
        cameraId: "door-1",
        vehicleId: "bus-1",
        routeId: "rawai-airport",
        stopId: "airport-1",
        coordinates: [8.10846, 98.30655],
        eventType: "boarding",
        passengers: 4,
        capturedAt
      }
    ]);

    clearOperationsStoreCache();

    const telemetryVehicles = getTelemetryVehicles();
    const seatAvailability = getLiveSeatAvailability("bus-1");
    const driverAttention = getDriverAttention("bus-1");
    const passengerFlow = getVehiclePassengerFlowSummary("bus-1");

    expect(telemetryVehicles).toEqual(
      expect.arrayContaining([expect.objectContaining({ vehicleId: "bus-1", routeId: "rawai-airport" })])
    );
    expect(seatAvailability?.seatsLeft).toBe(13);
    expect(seatAvailability?.passengerFlow?.boardingsRecent).toBe(4);
    expect(seatAvailability?.driverAttention?.state).toBe("watch");
    expect(driverAttention?.state).toBe("watch");
    expect(passengerFlow?.boardingsRecent).toBe(4);
  });

  it("keeps demand requests after the in-memory queue is cleared", () => {
    const now = Date.now();

    recordDemandRequest(8.10846, 98.30655, now);
    clearDemandRequestStore();

    const hotspots = getDemandHotspots(new Date(now));

    expect(hotspots.totalRequests).toBe(1);
    expect(
      hotspots.hotspots.some((hotspot) => hotspot.zone === "Airport" && hotspot.liveRequests === 1)
    ).toBe(true);
  });
});
