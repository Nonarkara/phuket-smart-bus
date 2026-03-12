import type {
  Advisory,
  AirportGuidePayload,
  DecisionSummary,
  HealthPayload,
  Route,
  RouteId,
  Stop,
  VehiclePosition
} from "@shared/types";

export const mockAirportLocation: [number, number] = [8.10846, 98.30655];

function buildVehicle(
  id: string,
  routeId: RouteId,
  vehicleId: string,
  licensePlate: string,
  coordinates: [number, number],
  heading: number,
  speedKph: number,
  destinationEn: string,
  destinationTh: string,
  updatedAt: string
): VehiclePosition {
  return {
    id,
    routeId,
    licensePlate,
    vehicleId,
    deviceId: null,
    coordinates,
    heading,
    speedKph,
    destination: {
      en: destinationEn,
      th: destinationTh
    },
    updatedAt,
    telemetrySource: "schedule_mock",
    freshness: "fresh",
    status: speedKph > 4 ? "moving" : speedKph === 0 ? "dwelling" : "unknown",
    distanceToDestinationMeters: null,
    stopsAway: null
  };
}

export const mockRoutes: Route[] = [
  {
    id: "rawai-airport",
    name: { en: "Rawai - Phuket Airport", th: "ราไวย์ - สนามบินภูเก็ต" },
    shortName: { en: "Airport Line", th: "สายสนามบิน" },
    overview: {
      en: "Airport corridor",
      th: "คอร์ริดอร์สนามบิน"
    },
    axis: "north_south",
    axisLabel: {
      en: "North-south corridor",
      th: "แนวเส้นทางเหนือใต้"
    },
    tier: "core",
    color: "#16b8b0",
    accentColor: "#e8fff9",
    bounds: [
      [7.7, 98.2],
      [8.12, 98.4]
    ],
    pathSegments: [
      [
        [8.10846, 98.30655],
        [8.02, 98.334],
        [7.93, 98.324],
        [7.82, 98.296]
      ]
    ],
    stopCount: 2,
    defaultStopId: "rawai-airport-42",
    activeVehicles: 3,
    status: {
      en: "3 buses reporting live",
      th: "มีรถออนไลน์ 3 คัน"
    },
    sourceStatus: {
      source: "bus",
      state: "live",
      updatedAt: "2026-03-08T14:00:00Z",
      detail: { en: "Live vehicle feed healthy", th: "ระบบรถสดทำงานปกติ" }
    }
  },
  {
    id: "patong-old-bus-station",
    name: { en: "Patong - Terminal 1", th: "ป่าตอง - บขส.1" },
    shortName: { en: "Patong Line", th: "สายป่าตอง" },
    overview: {
      en: "City corridor",
      th: "คอร์ริดอร์ในเมือง"
    },
    axis: "east_west",
    axisLabel: {
      en: "East-west corridor",
      th: "แนวเส้นทางตะวันออกตะวันตก"
    },
    tier: "core",
    color: "#ffcc33",
    accentColor: "#fff8dc",
    bounds: [
      [7.84, 98.28],
      [7.94, 98.41]
    ],
    pathSegments: [
      [
        [7.895, 98.298],
        [7.901, 98.335],
        [7.91, 98.392]
      ]
    ],
    stopCount: 2,
    defaultStopId: "patong-old-bus-station-1",
    activeVehicles: 2,
    status: {
      en: "2 buses reporting live",
      th: "มีรถออนไลน์ 2 คัน"
    },
    sourceStatus: {
      source: "bus",
      state: "live",
      updatedAt: "2026-03-08T14:00:00Z",
      detail: { en: "Live vehicle feed healthy", th: "ระบบรถสดทำงานปกติ" }
    }
  }
];

export const mockAirportStops: Stop[] = [
  {
    id: "rawai-airport-42",
    routeId: "rawai-airport",
    sequence: 42,
    name: { en: "Phuket Airport", th: "สนามบินภูเก็ต" },
    direction: { en: "Bus to Rawai", th: "รถไปราไวย์" },
    routeDirection: {
      en: "Airport to Rawai",
      th: "สนามบินไปราไวย์"
    },
    coordinates: mockAirportLocation,
    scheduleText: "05:37AM,06:37AM",
    nextBus: {
      label: "3:05 PM",
      minutesUntil: 9,
      basis: "schedule",
      notes: { en: "Schedule based", th: "อิงตารางเวลา" }
    },
    timetable: {
      firstDepartureLabel: "5:37 AM",
      lastDepartureLabel: "6:37 AM",
      nextDepartures: ["3:05 PM", "4:05 PM", "5:05 PM"],
      serviceWindowLabel: "5:37 AM - 6:37 AM",
      sourceLabel: { en: "Official timetable", th: "ตารางเวลาอย่างเป็นทางการ" },
      sourceUrl: "https://example.com/timetable",
      sourceUpdatedAt: "2025-01-18",
      notes: { en: "Official schedule", th: "ตารางทางการ" }
    },
    nearbyPlace: {
      name: "Terminal hall",
      mapUrl: "https://example.com",
      openingHours: "24 hours",
      distanceMeters: 100,
      walkMinutes: 2
    }
  }
];

export const mockPatongStops: Stop[] = [
  {
    id: "patong-old-bus-station-1",
    routeId: "patong-old-bus-station",
    sequence: 1,
    name: { en: "Patong Beach", th: "หาดป่าตอง" },
    direction: { en: "Bus to Terminal 1", th: "รถไป บขส.1" },
    routeDirection: {
      en: "Patong to Terminal 1",
      th: "ป่าตองไป บขส.1"
    },
    coordinates: [7.895, 98.298],
    scheduleText: "05:37AM,06:37AM",
    nextBus: {
      label: "3:11 PM",
      minutesUntil: 15,
      basis: "schedule",
      notes: { en: "Schedule based", th: "อิงตารางเวลา" }
    },
    timetable: {
      firstDepartureLabel: "5:37 AM",
      lastDepartureLabel: "6:37 AM",
      nextDepartures: ["3:11 PM", "4:11 PM", "5:11 PM"],
      serviceWindowLabel: "5:37 AM - 6:37 AM",
      sourceLabel: { en: "Official timetable", th: "ตารางเวลาอย่างเป็นทางการ" },
      sourceUrl: "https://example.com/timetable",
      sourceUpdatedAt: "2025-01-18",
      notes: { en: "Official schedule", th: "ตารางทางการ" }
    },
    nearbyPlace: {
      name: "Patong Beachfront",
      mapUrl: "https://example.com/patong",
      openingHours: "Always open",
      distanceMeters: 120,
      walkMinutes: 2
    }
  }
];

export const mockAirportVehicles: VehiclePosition[] = [
  buildVehicle(
    "veh-airport-1",
    "rawai-airport",
    "bus-airport-1",
    "10-1151",
    [8.086376, 98.304563],
    24,
    35,
    "To Phuket Airport",
    "ไปสนามบินภูเก็ต",
    "2026-03-08T14:00:00Z"
  ),
  buildVehicle(
    "veh-airport-2",
    "rawai-airport",
    "bus-airport-2",
    "10-1155",
    [8.022465, 98.334835],
    332,
    33,
    "To Rawai",
    "ไปราไวย์",
    "2026-03-08T14:00:00Z"
  ),
  buildVehicle(
    "veh-airport-3",
    "rawai-airport",
    "bus-airport-3",
    "10-1205",
    [7.944326, 98.278071],
    186,
    30,
    "To Rawai",
    "ไปราไวย์",
    "2026-03-08T14:00:00Z"
  )
];

export const mockPatongVehicles: VehiclePosition[] = [
  buildVehicle(
    "veh-patong-1",
    "patong-old-bus-station",
    "bus-patong-1",
    "10-1218",
    [7.910695, 98.33354],
    71,
    0,
    "To Phuket Bus Terminal 1",
    "ไปสถานีขนส่งภูเก็ต 1",
    "2026-03-08T14:00:00Z"
  ),
  buildVehicle(
    "veh-patong-2",
    "patong-old-bus-station",
    "bus-patong-2",
    "10-1223",
    [7.908261, 98.349525],
    299,
    5,
    "To Patong",
    "ไปป่าตอง",
    "2026-03-08T14:00:00Z"
  )
];

export const mockAirportAdvisories: Advisory[] = [
  {
    id: "adv-1",
    routeId: "rawai-airport",
    source: "itic",
    severity: "caution",
    title: {
      en: "Airport approach is slower",
      th: "ทางเข้าสนามบินช้าลง"
    },
    message: {
      en: "Traffic is denser than baseline.",
      th: "การจราจรหนาแน่นกว่าปกติ"
    },
    recommendation: {
      en: "Leave 10 minutes earlier.",
      th: "เผื่อเวลาเพิ่ม 10 นาที"
    },
    updatedAt: "2026-03-08T14:00:00Z",
    active: true,
    tags: ["airport"]
  }
];

export const mockPatongAdvisories: Advisory[] = [];

export const mockAirportDecision: DecisionSummary = {
  routeId: "rawai-airport",
  stopId: "rawai-airport-42",
  level: "leave_early",
  headline: {
    en: "Leave a bit early",
    th: "ออกเร็วขึ้นเล็กน้อย"
  },
  summary: {
    en: "Service is usable, but small delays matter.",
    th: "รถยังใช้ได้ แต่ความล่าช้าเล็กน้อยมีผล"
  },
  reasons: [
    { en: "3 live vehicles are visible on this route.", th: "มีรถสด 3 คันบนเส้นทางนี้" }
  ],
  nextBus: {
    label: "3:05 PM",
    minutesUntil: 9,
    basis: "schedule",
    notes: { en: "Schedule based", th: "อิงตารางเวลา" }
  },
  seatAvailability: {
    seatsLeft: 11,
    capacity: 23,
    occupiedSeats: 12,
    loadFactor: 12 / 23,
    basis: "camera_ready_estimate",
    cameraId: null,
    confidenceLabel: {
      en: "Estimated until the seat camera feed is connected.",
      th: "เป็นค่าประมาณจนกว่าจะเชื่อมต่อกล้องนับที่นั่ง"
    },
    passengerFlow: {
      boardingsRecent: 4,
      alightingsRecent: 1,
      updatedAt: "2026-03-08T14:00:00Z"
    },
    driverAttention: {
      state: "alert",
      cameraId: "driver-01",
      confidence: 0.94,
      label: {
        en: "Driver alert",
        th: "คนขับพร้อม"
      },
      updatedAt: "2026-03-08T14:00:00Z"
    },
    updatedAt: "2026-03-08T14:00:00Z"
  },
  timetable: mockAirportStops[0].timetable,
  liveVehicles: 3,
  routeStatus: {
    en: "Live service with rider caution",
    th: "มีรถสดแต่ควรเผื่อเวลา"
  },
  updatedAt: "2026-03-08T14:00:00Z",
  sourceStatuses: [
    {
      source: "bus",
      state: "live",
      updatedAt: "2026-03-08T14:00:00Z",
      detail: { en: "Live vehicle feed healthy", th: "ระบบรถสดทำงานปกติ" }
    }
  ]
};

export const mockPatongDecision: DecisionSummary = {
  routeId: "patong-old-bus-station",
  stopId: "patong-old-bus-station-1",
  level: "go_now",
  headline: {
    en: "Good time to ride",
    th: "เป็นช่วงที่เหมาะจะขึ้นรถ"
  },
  summary: {
    en: "Service is flowing normally on the Patong line.",
    th: "บริการบนสายป่าตองยังไหลลื่นตามปกติ"
  },
  reasons: [
    { en: "2 live vehicles are visible on this route.", th: "มีรถสด 2 คันบนเส้นทางนี้" }
  ],
  nextBus: {
    label: "3:11 PM",
    minutesUntil: 15,
    basis: "schedule",
    notes: { en: "Schedule based", th: "อิงตารางเวลา" }
  },
  seatAvailability: null,
  timetable: mockPatongStops[0].timetable,
  liveVehicles: 2,
  routeStatus: {
    en: "Patong line is running normally",
    th: "สายป่าตองยังวิ่งตามปกติ"
  },
  updatedAt: "2026-03-08T14:00:00Z",
  sourceStatuses: mockAirportDecision.sourceStatuses
};

export const mockHealthPayload: HealthPayload = {
  status: "ok",
  checkedAt: "2026-03-08T14:00:00Z",
  sources: mockAirportDecision.sourceStatuses
};

export const mockAirportGuide: AirportGuidePayload = {
  destinationQuery: "",
  recommendation: "ready",
  headline: {
    en: "A bus is running from the airport",
    th: "มีรถบัสวิ่งออกจากสนามบิน"
  },
  summary: {
    en: "Search a beach, hotel belt, or landmark and we will tell you if Smart Bus is the right choice before you leave the terminal.",
    th: "พิมพ์ชื่อหาด ย่านโรงแรม หรือจุดสังเกต แล้วเราจะบอกว่าควรเลือก Smart Bus ก่อนออกจากอาคารหรือไม่"
  },
  fareComparison: {
    busFareThb: 100,
    taxiFareEstimateThb: 1000,
    savingsThb: 900,
    savingsCopy: {
      en: "Save about 900 THB versus a typical airport taxi ride.",
      th: "ประหยัดได้ประมาณ 900 บาทเมื่อเทียบกับแท็กซี่จากสนามบินทั่วไป"
    }
  },
  boardingWalk: {
    primaryInstruction: {
      en: "Turn left after you come out and head to the Smart Bus stop by Cafe Amazon.",
      th: "เมื่อออกมาด้านนอกแล้วให้เลี้ยวซ้ายและเดินไปที่ป้าย Smart Bus ข้าง Cafe Amazon"
    },
    secondaryInstruction: {
      en: "Use exit 3, cross to the Cafe Amazon side, and stay under cover if rain starts.",
      th: "ใช้ทางออก 3 ข้ามไปฝั่ง Cafe Amazon และหลบฝนใต้ที่กำบังหากฝนเริ่มตก"
    },
    focusStopId: "rawai-airport-42"
  },
  weatherSummary: {
    conditionLabel: {
      en: "Rain moving across the airport corridor",
      th: "มีกลุ่มฝนเคลื่อนผ่านแนวสนามบิน"
    },
    currentPrecipitation: 1.8,
    maxRainProbability: 82,
    recommendation: {
      en: "Keep a small buffer in case rain or wind slows boarding at the airport stop.",
      th: "ควรเผื่อเวลาเล็กน้อยในกรณีที่ฝนหรือลมทำให้การขึ้นรถที่ป้ายสนามบินช้าลง"
    },
    severity: "caution"
  },
  bestMatch: null,
  matches: [],
  nextDeparture: {
    routeId: "rawai-airport",
    routeName: { en: "Airport Line", th: "สายสนามบิน" },
    label: "3:05 PM",
    minutesUntil: 9,
    basis: "schedule",
    state: "scheduled",
    liveBusId: null,
    liveLicensePlate: null,
    seats: {
      seatsLeft: 11,
      capacity: 23,
      occupiedSeats: 12,
      loadFactor: 12 / 23,
      basis: "camera_live",
      cameraId: "cabin-01",
      confidenceLabel: {
        en: "Live seats from the bus camera feed.",
        th: "จำนวนที่นั่งสดจากกล้องบนรถ"
      },
      passengerFlow: {
        boardingsRecent: 4,
        alightingsRecent: 1,
        updatedAt: "2026-03-08T14:00:00Z"
      },
      driverAttention: {
        state: "alert",
        cameraId: "driver-01",
        confidence: 0.96,
        label: {
          en: "Driver alert",
          th: "คนขับพร้อม"
        },
        updatedAt: "2026-03-08T14:00:00Z"
      },
      updatedAt: "2026-03-08T14:00:00Z"
    }
  },
  followingDepartures: ["3:05 PM", "4:05 PM", "5:05 PM"],
  airportBoardingLabel: {
    en: "Board opposite Cafe Amazon",
    th: "ขึ้นรถฝั่งตรงข้าม Cafe Amazon"
  },
  boardingNotes: [
    {
      en: "Go to exit 3 and wait opposite Cafe Amazon for the Smart Bus stop.",
      th: "ไปที่ทางออก 3 แล้วรอที่ป้าย Smart Bus ฝั่งตรงข้าม Cafe Amazon"
    }
  ],
  quickDestinations: [
    {
      id: "patong",
      label: { en: "Patong", th: "ป่าตอง" },
      routeId: "rawai-airport",
      stopId: "rawai-airport-42",
      kind: "direct",
      travelMinutes: 46
    }
  ],
  sourceStatuses: mockHealthPayload.sources,
  checkedAt: "2026-03-08T14:00:00Z"
};

const payloadByPath = new Map<string, unknown>([
  ["/api/routes", mockRoutes],
  ["/api/health", mockHealthPayload],
  ["/api/routes/rawai-airport/stops", mockAirportStops],
  ["/api/routes/rawai-airport/vehicles", { vehicles: mockAirportVehicles }],
  ["/api/routes/rawai-airport/advisories", { advisories: mockAirportAdvisories }],
  ["/api/routes/patong-old-bus-station/stops", mockPatongStops],
  ["/api/routes/patong-old-bus-station/vehicles", { vehicles: mockPatongVehicles }],
  ["/api/routes/patong-old-bus-station/advisories", { advisories: mockPatongAdvisories }],
  ["/api/airport-guide", mockAirportGuide]
]);

export function getMockApiPayload(input: string | URL) {
  const url = new URL(String(input), "http://127.0.0.1");
  const directPayload = payloadByPath.get(url.pathname);

  if (directPayload !== undefined) {
    return directPayload;
  }

  if (url.pathname === "/api/decision-summary") {
    const routeId = url.searchParams.get("routeId");
    const stopId = url.searchParams.get("stopId");

    if (routeId === "patong-old-bus-station" && stopId === "patong-old-bus-station-1") {
      return mockPatongDecision;
    }

    if (routeId === "rawai-airport" && stopId === "rawai-airport-42") {
      return mockAirportDecision;
    }

    return null;
  }

  return null;
}
