import { describe, it, expect, beforeEach } from "vitest";
import {
  ingestGpsPing,
  ingestBatchGps,
  getLiveTelemetryVehicles,
  isLiveGpsActive,
  getTelemetryHealth,
  setTelemetryMode,
  clearTelemetry,
  normalizeVehicleKey,
  simulateLiveGpsBurst,
} from "./liveGpsReceiver";

describe("liveGpsReceiver", () => {
  beforeEach(() => {
    clearTelemetry();
    setTelemetryMode("auto");
  });

  it("normalizes vehicle keys accurately", () => {
    expect(normalizeVehicleKey("1001")).toBe("1001");
    expect(normalizeVehicleKey("กข 1001")).toBe("1001");
    expect(normalizeVehicleKey("PKSB-1002")).toBe("1002");
    expect(normalizeVehicleKey("bus-alpha")).toBe("bus-alpha");
  });

  it("ingests single GPS pings and returns vehicle positions", () => {
    const t0 = 1700000000000;
    ingestGpsPing({
      vehicleId: "1001",
      licensePlate: "กข 1001",
      coordinates: [8.108, 98.307],
      speedKph: 35,
      heading: 180,
      timestamp: t0,
    });

    const vehicles = getLiveTelemetryVehicles(t0 + 5000);
    expect(vehicles.has("1001")).toBe(true);

    const v = vehicles.get("1001")!;
    expect(v.vehicleId).toBe("1001");
    expect(v.licensePlate).toBe("กข 1001");
    expect(v.coordinates).toEqual([8.108, 98.307]);
    expect(v.speedKph).toBe(35);
    expect(v.heading).toBe(180);
    expect(v.telemetrySource).toBe("direct_gps");
    expect(v.freshness).toBe("fresh");
    expect(v.status).toBe("moving");
  });

  it("ingests batches of GPS pings", () => {
    const t0 = Date.now();
    ingestBatchGps([
      { vehicleId: "1001", coordinates: [8.1, 98.3], speedKph: 30 },
      { vehicleId: "1002", coordinates: [7.9, 98.2], speedKph: 0 },
    ]);

    const vehicles = getLiveTelemetryVehicles(t0 + 1000);
    expect(vehicles.size).toBe(2);
    expect(vehicles.get("1001")?.status).toBe("moving");
    expect(vehicles.get("1002")?.status).toBe("dwelling");
  });

  it("marks telemetry as stale between 60s and 120s, and drops beyond 120s in auto mode", () => {
    const t0 = 1700000000000;
    ingestGpsPing({
      vehicleId: "1001",
      coordinates: [8.1, 98.3],
      speedKph: 20,
      timestamp: t0,
    });

    // 30s later -> fresh
    let vehicles = getLiveTelemetryVehicles(t0 + 30_000);
    expect(vehicles.get("1001")?.freshness).toBe("fresh");

    // 75s later -> stale
    vehicles = getLiveTelemetryVehicles(t0 + 75_000);
    expect(vehicles.get("1001")?.freshness).toBe("stale");

    // 130s later -> dropped in auto mode so system falls back to schedule
    vehicles = getLiveTelemetryVehicles(t0 + 130_000);
    expect(vehicles.has("1001")).toBe(false);
  });

  it("respects telemetryMode overrides", () => {
    const t0 = Date.now();
    ingestGpsPing({
      vehicleId: "1001",
      coordinates: [8.1, 98.3],
      speedKph: 20,
    });

    expect(isLiveGpsActive(t0)).toBe(true);

    // When sim_only is set, live telemetry is bypassed
    setTelemetryMode("sim_only");
    expect(isLiveGpsActive(t0)).toBe(false);
    expect(getLiveTelemetryVehicles(t0).size).toBe(0);

    // When set back to auto, live telemetry returns
    setTelemetryMode("auto");
    expect(isLiveGpsActive(t0)).toBe(true);
    expect(getLiveTelemetryVehicles(t0).size).toBe(1);
  });

  it("computes telemetry health metrics", () => {
    const t0 = 1700000000000;
    ingestGpsPing({
      vehicleId: "1001",
      coordinates: [8.1, 98.3],
      speedKph: 20,
      timestamp: t0,
    });

    const health = getTelemetryHealth(t0 + 2500);
    expect(health.active).toBe(true);
    expect(health.liveCount).toBe(1);
    expect(health.latencyMs).toBe(2500);
    expect(health.sources["1001"]).toBe("direct_gps");
  });

  it("generates a realistic simulated GPS burst", () => {
    simulateLiveGpsBurst();
    const vehicles = getLiveTelemetryVehicles();
    expect(vehicles.size).toBe(10);
    expect(isLiveGpsActive()).toBe(true);
    const first = vehicles.get("1001");
    expect(first).toBeDefined();
    expect(first?.telemetrySource).toBe("direct_gps");
  });
});
