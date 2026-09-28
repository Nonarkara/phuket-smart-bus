import { describe, it, expect, beforeEach } from "vitest";
import {
  classifyVehicleState,
  isNearDepot,
  recordFleetEfficiencySample,
  getFleetEfficiencySummary,
  resetFleetEfficiencyLedger,
  exportFleetEfficiencyJson,
  exportFleetEfficiencyCsv,
} from "./fleetEfficiency";
import type { LiveGpsPing } from "./liveGpsReceiver";

describe("fleetEfficiency engine", () => {
  beforeEach(() => {
    resetFleetEfficiencyLedger();
  });

  it("accurately classifies depot vs on-road dwelling vs moving in-transit", () => {
    // PKSB Central Depot is at [7.8814, 98.4093]
    expect(isNearDepot([7.8814, 98.4093])).toBe(true);
    expect(classifyVehicleState([7.8814, 98.4093], 0)).toBe("parked_depot");
    expect(classifyVehicleState([7.8814, 98.4093], 15)).toBe("parked_depot");

    // Road stop at Patong Beach [7.896, 98.297]
    expect(isNearDepot([7.896, 98.297])).toBe(false);
    expect(classifyVehicleState([7.896, 98.297], 0)).toBe("dwelling");
    expect(classifyVehicleState([7.896, 98.297], 3)).toBe("dwelling");
    expect(classifyVehicleState([7.896, 98.297], 28)).toBe("in_transit");
  });

  it("records batches of GPS pings and tracks operational metrics", () => {
    const baseTime = Date.now();
    const batch1: LiveGpsPing[] = [
      {
        vehicleId: "1230",
        licensePlate: "10-1230ภูเก็ต",
        coordinates: [7.896, 98.297],
        speedKph: 32,
      },
      {
        vehicleId: "1231",
        licensePlate: "10-1231ภูเก็ต",
        coordinates: [7.8814, 98.4093], // at depot
        speedKph: 0,
      },
    ];

    recordFleetEfficiencySample(batch1, baseTime);

    // Second ping 30 seconds later (vehicle 1230 moved slightly)
    const batch2: LiveGpsPing[] = [
      {
        vehicleId: "1230",
        licensePlate: "10-1230ภูเก็ต",
        coordinates: [7.898, 98.298], // ~240m away
        speedKph: 36,
      },
      {
        vehicleId: "1231",
        licensePlate: "10-1231ภูเก็ต",
        coordinates: [7.8814, 98.4093], // still at depot
        speedKph: 0,
      },
    ];

    recordFleetEfficiencySample(batch2, baseTime + 30_000);

    const summary = getFleetEfficiencySummary(baseTime + 30_000);
    expect(summary.totalTrackedVehicles).toBe(2);
    expect(summary.activeVehiclesCount).toBe(1);
    expect(summary.depotVehiclesCount).toBe(1);
    expect(summary.totalKmTracked).toBeGreaterThan(0.1);
    expect(summary.avgFleetSpeedKph).toBeCloseTo(34, 0);
  });

  it("detects bus bunching when two buses on route are closer than 600m", () => {
    const now = Date.now();
    // Two buses in Patong ~200 meters apart
    const pings: LiveGpsPing[] = [
      {
        vehicleId: "1001",
        licensePlate: "กข 1001",
        coordinates: [7.896, 98.297],
        speedKph: 15,
      },
      {
        vehicleId: "1002",
        licensePlate: "กข 1002",
        coordinates: [7.897, 98.298], // ~150m apart
        speedKph: 12,
      },
      {
        vehicleId: "1003",
        licensePlate: "กข 1003",
        coordinates: [8.108, 98.307], // At Airport ~23km away
        speedKph: 20,
      },
    ];

    recordFleetEfficiencySample(pings, now);

    const summary = getFleetEfficiencySummary(now);
    expect(summary.detectedBunchingIncidents).toBe(1);
  });

  it("calculates cycle time inflation and fleet sizing recommendations", () => {
    const summary = getFleetEfficiencySummary();
    expect(summary.recommendation.nominalCycleMin).toBe(95);
    expect(summary.recommendation.targetHeadwayMin).toBe(30);
    expect(summary.recommendation.recommendedBuses).toBeGreaterThanOrEqual(6);
    expect(summary.recommendation.summaryText).toContain("cycle time");
  });

  it("exports formatted JSON and CSV reports for operations analysis", () => {
    const now = Date.now();
    recordFleetEfficiencySample(
      [
        {
          vehicleId: "1230",
          licensePlate: "10-1230ภูเก็ต",
          coordinates: [7.896, 98.297],
          speedKph: 30,
        },
      ],
      now
    );

    const jsonStr = exportFleetEfficiencyJson();
    expect(jsonStr).toContain('"totalTrackedVehicles"');
    const parsed = JSON.parse(jsonStr);
    expect(parsed.summary.totalTrackedVehicles).toBe(1);

    const csvStr = exportFleetEfficiencyCsv();
    expect(csvStr).toContain("Vehicle ID,License Plate");
    expect(csvStr).toContain("Gross Revenue (THB)");
    expect(csvStr).toContain("Net Margin (THB)");
    expect(csvStr).toContain('"1230"');
    expect(csvStr).toContain('"10-1230ภูเก็ต"');
  });

  it("calculates real bus revenue from APC passenger door sensor counts", () => {
    const t0 = Date.now();
    // Ping 1: bus picks up 8 passengers at Airport
    recordFleetEfficiencySample(
      [
        {
          vehicleId: "1227",
          licensePlate: "10-1227ภูเก็ต",
          coordinates: [8.108, 98.307],
          speedKph: 25,
          paxCount: 8,
        },
      ],
      t0
    );

    // Ping 2: bus drives 1.1 km south at ~33 km/h and picks up 6 more passengers (total 14 onboard)
    recordFleetEfficiencySample(
      [
        {
          vehicleId: "1227",
          licensePlate: "10-1227ภูเก็ต",
          coordinates: [8.098, 98.307],
          speedKph: 35,
          paxCount: 14,
        },
      ],
      t0 + 120_000
    );

    const summary = getFleetEfficiencySummary(t0 + 120_000);
    const bus = summary.vehicles.find((v) => v.vehicleId === "1227");
    expect(bus).toBeDefined();
    // 8 initial + (14 - 8) = 14 total APC boardings
    expect(bus!.apcBoardings).toBe(14);
    expect(bus!.paxServed).toBe(14);
    // 14 pax × ฿100 fare = ฿1,400 gross revenue
    expect(bus!.revenueThb).toBe(1400);
    // Distance ~2 km, operating cost = ~2 km × ฿35/km = ~฿70
    expect(bus!.operatingCostThb).toBeGreaterThan(0);
    expect(bus!.netMarginThb).toBe(bus!.revenueThb - bus!.operatingCostThb);
    expect(bus!.co2SavedKg).toBeCloseTo(14 * 4.2, 0);

    // Fleet totals reflect the bus
    expect(summary.totalRevenueThb).toBe(1400);
    expect(summary.totalPaxServed).toBe(14);
    expect(summary.passengerSavingsThb).toBe(14 * (720 - 100));
  });

  it("calculates calibrated trip revenue when APC is uncalibrated or reporting 0", () => {
    const t0 = Date.now();
    // Bus drives a full corridor leg (~36 km) without APC paxCount
    recordFleetEfficiencySample(
      [
        {
          vehicleId: "1228",
          licensePlate: "10-1228ภูเก็ต",
          coordinates: [8.110, 98.305], // Airport (North)
          speedKph: 40,
        },
      ],
      t0
    );

    // 50 minutes later at Rawai Beach (South ~37 km away)
    recordFleetEfficiencySample(
      [
        {
          vehicleId: "1228",
          licensePlate: "10-1228ภูเก็ต",
          coordinates: [7.778, 98.318], // Rawai Beach (South)
          speedKph: 30,
        },
      ],
      t0 + 50 * 60_000
    );

    const summary = getFleetEfficiencySummary(t0 + 50 * 60_000);
    const bus = summary.vehicles.find((v) => v.vehicleId === "1228");
    expect(bus).toBeDefined();
    expect(bus!.totalDistanceKm).toBeGreaterThan(35);
    expect(bus!.tripsCompleted).toBeGreaterThanOrEqual(1);
    // At least 18 pax for 1 trip
    expect(bus!.paxServed).toBeGreaterThanOrEqual(18);
    expect(bus!.revenueThb).toBe(bus!.paxServed * 100);
    // Cost ~37 km × ฿35 = ~฿1,295
    expect(bus!.operatingCostThb).toBeGreaterThan(1200);
    expect(bus!.netMarginThb).toBe(bus!.revenueThb - bus!.operatingCostThb);
  });
});

