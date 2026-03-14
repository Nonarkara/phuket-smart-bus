import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearBusSnapshotCache } from "./providers/busProvider.js";
import { clearWeatherSnapshotCache } from "./providers/weatherProvider.js";
import { getStopsForRoute } from "./routes.js";
import { getAirportGuide, matchAirportDestination } from "./airportGuide.js";
import { clearOperationsStore, recordSeatCameraSamples, recordVehicleTelemetry } from "./operationsStore.js";

describe("matchAirportDestination", () => {
  it("matches airport-line destinations in the outbound direction", () => {
    const matches = matchAirportDestination("Patong");

    expect(matches[0]?.routeId).toBe("rawai-airport");
    expect(matches[0]?.kind).toBe("direct");
    expect(matches[0]?.travelMinutes).not.toBeNull();
  });

  it("matches transfer-only town destinations onto the Patong line", () => {
    const matches = matchAirportDestination("Old Town");

    expect(matches[0]?.routeId).toBe("patong-old-bus-station");
    expect(matches[0]?.kind).toBe("transfer");
  });
});

describe("getAirportGuide", () => {
  beforeEach(() => {
    clearOperationsStore();
    clearBusSnapshotCache();
    clearWeatherSnapshotCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearOperationsStore();
    clearBusSnapshotCache();
    clearWeatherSnapshotCache();
  });

  it("returns fare, boarding-walk, and weather summary fields", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));

    const guide = await getAirportGuide("Patong");

    expect(guide.fareComparison.busFareThb).toBe(100);
    expect(guide.fareComparison.taxiFareEstimateThb).toBe(1000);
    expect(guide.fareComparison.savingsThb).toBe(900);
    expect(guide.boardingWalk.focusStopId).toContain("rawai-airport");
    expect(guide.weatherSummary.maxRainProbability).toBe(82);
    expect(guide.weatherSummary.currentPrecipitation).toBe(1.8);
    expect(guide.weatherSummary.severity).toBe("caution");
    expect(guide.bestMatch?.routeId).toBe("rawai-airport");
  });

  it("keeps quick-destination travel times in a realistic range for the airport demo", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));

    const guide = await getAirportGuide();
    const laguna = guide.quickDestinations.find((item) => item.id === "laguna");
    const kata = guide.quickDestinations.find((item) => item.id === "kata");
    const rawai = guide.quickDestinations.find((item) => item.id === "rawai");

    expect(laguna?.travelMinutes).toBeGreaterThanOrEqual(30);
    expect(laguna?.travelMinutes).toBeLessThanOrEqual(45);
    expect(kata?.travelMinutes).toBeGreaterThanOrEqual(80);
    expect(kata?.travelMinutes).toBeLessThanOrEqual(100);
    expect(rawai?.travelMinutes).toBeGreaterThanOrEqual(90);
    expect(rawai?.travelMinutes).toBeLessThanOrEqual(110);
  });

  it("uses an airport-adjacent live vehicle and its seat feed for the next departure", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));

    const airportStop = getStopsForRoute("rawai-airport").find((stop) => stop.name.en === "Phuket Airport");
    const capturedAt = new Date(Date.now() + 60_000).toISOString();

    expect(airportStop).toBeTruthy();

    recordVehicleTelemetry([
      {
        deviceId: "gps-airport-1",
        vehicleId: "rawai-airport-live-1",
        routeId: "rawai-airport",
        licensePlate: "10-1208",
        coordinates: airportStop?.coordinates ?? [8.099, 98.299],
        heading: 90,
        speedKph: 0,
        destinationHint: "Rawai Beach",
        capturedAt
      }
    ]);

    recordSeatCameraSamples([
      {
        cameraId: "cam-airport-1",
        vehicleId: "rawai-airport-live-1",
        routeId: "rawai-airport",
        capacity: 23,
        occupiedSeats: 21,
        seatsLeft: 2,
        capturedAt
      }
    ]);

    const guide = await getAirportGuide();

    expect(guide.nextDeparture.state).toBe("boarding");
    expect(guide.nextDeparture.basis).toBe("live");
    expect(guide.nextDeparture.minutesUntil).toBe(0);
    expect(guide.nextDeparture.liveBusId).toBe("rawai-airport-live-1");
    expect(guide.nextDeparture.liveLicensePlate).toBe("10-1208");
    expect(guide.nextDeparture.seats?.basis).toBe("camera_live");
    expect(guide.nextDeparture.seats?.seatsLeft).toBe(2);
  });
});
