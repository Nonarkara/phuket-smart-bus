import { beforeEach } from "vitest";
import type { Stop, VehiclePosition } from "../../shared/types.js";
import { clearOperationsStore } from "./operationsStore.js";
import { buildDecisionSummary } from "./decisionEngine.js";

const stop: Stop = {
  id: "rawai-airport-42",
  routeId: "rawai-airport",
  sequence: 42,
  name: { en: "Phuket Airport", th: "สนามบินภูเก็ต", zh: "Phuket Airport", de: "Phuket Airport", fr: "Phuket Airport", es: "Phuket Airport" },
  direction: { en: "Bus to Rawai", th: "รถไปราไวย์", zh: "Bus to Rawai", de: "Bus to Rawai", fr: "Bus to Rawai", es: "Bus to Rawai" },
  routeDirection: { en: "Airport to Rawai", th: "สนามบินไปราไวย์", zh: "Airport to Rawai", de: "Airport to Rawai", fr: "Airport to Rawai", es: "Airport to Rawai" },
  coordinates: [8.1, 98.3] as [number, number],
  scheduleText: "05:37AM,06:37AM",
  nextBus: {
    label: "3:02 PM",
    minutesUntil: 4,
    basis: "schedule",
    notes: { en: "Schedule based", th: "อิงตารางเวลา", zh: "Schedule based", de: "Schedule based", fr: "Schedule based", es: "Schedule based" }
  },
  timetable: {
    firstDepartureLabel: "5:37 AM",
    lastDepartureLabel: "6:37 AM",
    nextDepartures: ["5:37 AM", "6:37 AM"],
    serviceWindowLabel: "5:37 AM - 6:37 AM",
    sourceLabel: { en: "Official timetable", th: "ตารางเวลาอย่างเป็นทางการ", zh: "Official timetable", de: "Official timetable", fr: "Official timetable", es: "Official timetable" },
    sourceUrl: "https://example.com/timetable",
    sourceUpdatedAt: "2025-01-18",
    notes: { en: "Official schedule", th: "ตารางทางการ", zh: "Official schedule", de: "Official schedule", fr: "Official schedule", es: "Official schedule" }
  },
  nearbyPlace: {
    name: "Terminal",
    mapUrl: "https://example.com",
    openingHours: "24 hours",
    distanceMeters: 80,
    walkMinutes: 1
  }
};

const vehicles: VehiclePosition[] = [
  {
    id: "1",
    routeId: "rawai-airport",
    licensePlate: "10-1148",
    vehicleId: "008800B133",
    deviceId: null,
    coordinates: [8.099, 98.2995] as [number, number],
    heading: 50,
    speedKph: 30,
    destination: { en: "To Phuket Airport", th: "ไปสนามบินภูเก็ต", zh: "To Phuket Airport", de: "To Phuket Airport", fr: "To Phuket Airport", es: "To Phuket Airport" },
    updatedAt: "2026-03-08T14:00:00Z",
    telemetrySource: "public_tracker",
    freshness: "fresh" as const,
    status: "moving" as const,
    distanceToDestinationMeters: 400,
    stopsAway: 2
  }
];

const statuses = [
  {
    source: "bus" as const,
    state: "live" as const,
    updatedAt: "2026-03-08T14:00:00Z",
    detail: { en: "Live vehicle feed healthy", th: "ระบบรถสดทำงานปกติ", zh: "Live vehicle feed healthy", de: "Live vehicle feed healthy", fr: "Live vehicle feed healthy", es: "Live vehicle feed healthy" }
  },
  {
    source: "traffic" as const,
    state: "fallback" as const,
    updatedAt: "2026-03-08T14:00:00Z",
    detail: { en: "Fixture", th: "ตัวอย่าง", zh: "Fixture", de: "Fixture", fr: "Fixture", es: "Fixture" }
  },
  {
    source: "weather" as const,
    state: "live" as const,
    updatedAt: "2026-03-08T14:00:00Z",
    detail: { en: "Live", th: "สด", zh: "Live", de: "Live", fr: "Live", es: "Live" }
  }
];

describe("decisionEngine", () => {
  beforeEach(() => {
    clearOperationsStore();
  });

  it("promotes the rider to go now when the bus is close", () => {
    const summary = buildDecisionSummary("rawai-airport", stop, vehicles, [], statuses);

    expect(summary.level).toBe("go_now");
    expect(summary.headline.en).toBe("Go now");
    expect(summary.seatAvailability?.basis).toBe("camera_ready_estimate");
  });

  it("drops to expect delay when warnings are active", () => {
    const summary = buildDecisionSummary(
      "rawai-airport",
      {
        ...stop,
        nextBus: { ...stop.nextBus, minutesUntil: 28 }
      },
      vehicles,
      [
        {
          id: "warning",
          routeId: "rawai-airport",
          source: "itic",
          severity: "warning",
          title: { en: "Delay", th: "ล่าช้า", zh: "Delay", de: "Delay", fr: "Delay", es: "Delay" },
          message: { en: "Delay", th: "ล่าช้า", zh: "Delay", de: "Delay", fr: "Delay", es: "Delay" },
          recommendation: { en: "Delay", th: "ล่าช้า", zh: "Delay", de: "Delay", fr: "Delay", es: "Delay" },
          updatedAt: "2026-03-08T14:00:00Z",
          active: true,
          tags: []
        }
      ],
      statuses
    );

    expect(summary.level).toBe("expect_delay");
  });
});
