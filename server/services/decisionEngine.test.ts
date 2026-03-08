import type { Stop, VehiclePosition } from "../../shared/types.js";
import { buildDecisionSummary } from "./decisionEngine.js";

const stop: Stop = {
  id: "rawai-airport-42",
  routeId: "rawai-airport",
  sequence: 42,
  name: { en: "Phuket Airport", th: "สนามบินภูเก็ต" },
  direction: { en: "Bus to Rawai", th: "รถไปราไวย์" },
  routeDirection: { en: "Airport to Rawai", th: "สนามบินไปราไวย์" },
  coordinates: [8.1, 98.3] as [number, number],
  scheduleText: "05:37AM,06:37AM",
  nextBus: {
    label: "3:02 PM",
    minutesUntil: 4,
    basis: "schedule",
    notes: { en: "Schedule based", th: "อิงตารางเวลา" }
  },
  timetable: {
    firstDepartureLabel: "5:37 AM",
    lastDepartureLabel: "6:37 AM",
    nextDepartures: ["5:37 AM", "6:37 AM"],
    serviceWindowLabel: "5:37 AM - 6:37 AM",
    sourceLabel: { en: "Official timetable", th: "ตารางเวลาอย่างเป็นทางการ" },
    sourceUrl: "https://example.com/timetable",
    sourceUpdatedAt: "2025-01-18",
    notes: { en: "Official schedule", th: "ตารางทางการ" }
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
    coordinates: [8.099, 98.2995] as [number, number],
    heading: 50,
    speedKph: 30,
    destination: { en: "To Phuket Airport", th: "ไปสนามบินภูเก็ต" },
    updatedAt: "2026-03-08T14:00:00Z",
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
    detail: { en: "Live vehicle feed healthy", th: "ระบบรถสดทำงานปกติ" }
  },
  {
    source: "traffic" as const,
    state: "fallback" as const,
    updatedAt: "2026-03-08T14:00:00Z",
    detail: { en: "Fixture", th: "ตัวอย่าง" }
  },
  {
    source: "weather" as const,
    state: "live" as const,
    updatedAt: "2026-03-08T14:00:00Z",
    detail: { en: "Live", th: "สด" }
  }
];

describe("decisionEngine", () => {
  it("promotes the rider to go now when the bus is close", () => {
    const summary = buildDecisionSummary("rawai-airport", stop, vehicles, [], statuses);

    expect(summary.level).toBe("go_now");
    expect(summary.headline.en).toBe("Go now");
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
          title: { en: "Delay", th: "ล่าช้า" },
          message: { en: "Delay", th: "ล่าช้า" },
          recommendation: { en: "Delay", th: "ล่าช้า" },
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
