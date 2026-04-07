import type {
  Advisory,
  AirportGuidePayload,
  DataSourceStatus,
  DecisionSummary,
  HealthPayload,
  InvestorSimulationPayload,
  OpsDashboardPayload,
  Route,
  RouteId,
  SimulationSnapshot,
  Stop,
  TransferHub,
  VehiclePosition
} from "@shared/types";
import { localizedText } from "@shared/localizedText";

export const mockAirportLocation: [number, number] = [8.10846, 98.30655];
const lt = localizedText;
const mockBusSourceStatus: DataSourceStatus = {
  source: "bus",
  state: "live",
  updatedAt: "2026-03-08T14:00:00Z",
  detail: lt("Live vehicle feed healthy", "ระบบรถสดทำงานปกติ"),
  freshnessSeconds: 12,
  fallbackReason: null
};
const mockDecisionSourceStatuses: DataSourceStatus[] = [mockBusSourceStatus];
const mockHealthSources: HealthPayload["sources"] = [
  {
    ...mockBusSourceStatus,
    critical: true,
    demoOnly: false
  }
];

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
    destination: lt(destinationEn, destinationTh),
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
    name: lt("Rawai - Phuket Airport", "ราไวย์ - สนามบินภูเก็ต"),
    shortName: lt("Airport Line", "สายสนามบิน"),
    overview: lt("Airport corridor", "คอร์ริดอร์สนามบิน"),
    axis: "north_south",
    axisLabel: lt("North-south corridor", "แนวเส้นทางเหนือใต้"),
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
    status: lt("3 buses reporting live", "มีรถออนไลน์ 3 คัน"),
    sourceStatus: mockBusSourceStatus
  },
  {
    id: "patong-old-bus-station",
    name: lt("Patong - Terminal 1", "ป่าตอง - บขส.1"),
    shortName: lt("Patong Line", "สายป่าตอง"),
    overview: lt("City corridor", "คอร์ริดอร์ในเมือง"),
    axis: "east_west",
    axisLabel: lt("East-west corridor", "แนวเส้นทางตะวันออกตะวันตก"),
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
    status: lt("2 buses reporting live", "มีรถออนไลน์ 2 คัน"),
    sourceStatus: mockBusSourceStatus
  }
];

export const mockAirportStops: Stop[] = [
  {
    id: "rawai-airport-42",
    routeId: "rawai-airport",
    sequence: 42,
    name: lt("Phuket Airport", "สนามบินภูเก็ต"),
    direction: lt("Bus to Rawai", "รถไปราไวย์"),
    routeDirection: lt("Airport to Rawai", "สนามบินไปราไวย์"),
    coordinates: mockAirportLocation,
    scheduleText: "05:37AM,06:37AM",
    nextBus: {
      label: "3:05 PM",
      minutesUntil: 9,
      basis: "schedule",
      notes: lt("Schedule based", "อิงตารางเวลา")
    },
    timetable: {
      firstDepartureLabel: "5:37 AM",
      lastDepartureLabel: "6:37 AM",
      nextDepartures: ["3:05 PM", "4:05 PM", "5:05 PM"],
      serviceWindowLabel: "5:37 AM - 6:37 AM",
      sourceLabel: lt("Official timetable", "ตารางเวลาอย่างเป็นทางการ"),
      sourceUrl: "https://example.com/timetable",
      sourceUpdatedAt: "2025-01-18",
      notes: lt("Official schedule", "ตารางทางการ")
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
    name: lt("Patong Beach", "หาดป่าตอง"),
    direction: lt("Bus to Terminal 1", "รถไป บขส.1"),
    routeDirection: lt("Patong to Terminal 1", "ป่าตองไป บขส.1"),
    coordinates: [7.895, 98.298],
    scheduleText: "05:37AM,06:37AM",
    nextBus: {
      label: "3:11 PM",
      minutesUntil: 15,
      basis: "schedule",
      notes: lt("Schedule based", "อิงตารางเวลา")
    },
    timetable: {
      firstDepartureLabel: "5:37 AM",
      lastDepartureLabel: "6:37 AM",
      nextDepartures: ["3:11 PM", "4:11 PM", "5:11 PM"],
      serviceWindowLabel: "5:37 AM - 6:37 AM",
      sourceLabel: lt("Official timetable", "ตารางเวลาอย่างเป็นทางการ"),
      sourceUrl: "https://example.com/timetable",
      sourceUpdatedAt: "2025-01-18",
      notes: lt("Official schedule", "ตารางทางการ")
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
    title: lt("Airport approach is slower", "ทางเข้าสนามบินช้าลง"),
    message: lt("Traffic is denser than baseline.", "การจราจรหนาแน่นกว่าปกติ"),
    recommendation: lt("Leave 10 minutes earlier.", "เผื่อเวลาเพิ่ม 10 นาที"),
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
  headline: lt("Leave a bit early", "ออกเร็วขึ้นเล็กน้อย"),
  summary: lt("Service is usable, but small delays matter.", "รถยังใช้ได้ แต่ความล่าช้าเล็กน้อยมีผล"),
  reasons: [
    lt("3 live vehicles are visible on this route.", "มีรถสด 3 คันบนเส้นทางนี้")
  ],
  nextBus: {
    label: "3:05 PM",
    minutesUntil: 9,
    basis: "schedule",
    notes: lt("Schedule based", "อิงตารางเวลา")
  },
  seatAvailability: {
    seatsLeft: 11,
    capacity: 25,
    occupiedSeats: 12,
    loadFactor: 12 / 25,
    basis: "camera_ready_estimate",
    cameraId: null,
    confidenceLabel: lt(
      "Estimated until the seat camera feed is connected.",
      "เป็นค่าประมาณจนกว่าจะเชื่อมต่อกล้องนับที่นั่ง"
    ),
    passengerFlow: {
      boardingsRecent: 4,
      alightingsRecent: 1,
      updatedAt: "2026-03-08T14:00:00Z"
    },
    driverAttention: {
      state: "alert",
      cameraId: "driver-01",
      confidence: 0.94,
      label: lt("Driver alert", "คนขับพร้อม"),
      updatedAt: "2026-03-08T14:00:00Z"
    },
    updatedAt: "2026-03-08T14:00:00Z"
  },
  timetable: mockAirportStops[0].timetable,
  liveVehicles: 3,
  routeStatus: lt("Live service with rider caution", "มีรถสดแต่ควรเผื่อเวลา"),
  environment: null,
  updatedAt: "2026-03-08T14:00:00Z",
  sourceStatuses: mockDecisionSourceStatuses
};

export const mockPatongDecision: DecisionSummary = {
  routeId: "patong-old-bus-station",
  stopId: "patong-old-bus-station-1",
  level: "go_now",
  headline: lt("Good time to ride", "เป็นช่วงที่เหมาะจะขึ้นรถ"),
  summary: lt("Service is flowing normally on the Patong line.", "บริการบนสายป่าตองยังไหลลื่นตามปกติ"),
  reasons: [
    lt("2 live vehicles are visible on this route.", "มีรถสด 2 คันบนเส้นทางนี้")
  ],
  nextBus: {
    label: "3:11 PM",
    minutesUntil: 15,
    basis: "schedule",
    notes: lt("Schedule based", "อิงตารางเวลา")
  },
  seatAvailability: null,
  timetable: mockPatongStops[0].timetable,
  liveVehicles: 2,
  routeStatus: lt("Patong line is running normally", "สายป่าตองยังวิ่งตามปกติ"),
  environment: null,
  updatedAt: "2026-03-08T14:00:00Z",
  sourceStatuses: mockAirportDecision.sourceStatuses
};

export const mockHealthPayload: HealthPayload = {
  status: "ok",
  checkedAt: "2026-03-08T14:00:00Z",
  mode: "live",
  appVersion: "0.1.0",
  database: {
    available: true,
    writable: true,
    mode: "sqlite",
    path: ":memory:"
  },
  worker: {
    status: "ok",
    updatedAt: "2026-03-08T14:00:00Z",
    maxAgeMs: 60_000
  },
  sources: mockHealthSources
};

const mockTrafficSourceStatus: DataSourceStatus = {
  source: "traffic",
  state: "fallback",
  updatedAt: "2026-03-08T14:00:00Z",
  detail: lt("Traffic advisories on fallback layer", "ข้อมูลจราจรใช้ชั้นข้อมูลสำรอง"),
  freshnessSeconds: null,
  fallbackReason: "traffic: fixture advisory layer"
};

const mockWeatherSourceStatus: DataSourceStatus = {
  source: "weather",
  state: "live",
  updatedAt: "2026-03-08T14:00:00Z",
  detail: lt("Weather feed healthy", "ระบบอากาศทำงานปกติ"),
  freshnessSeconds: 45,
  fallbackReason: null
};

const mockAqiSourceStatus: DataSourceStatus = {
  source: "aqi",
  state: "live",
  updatedAt: "2026-03-08T14:00:00Z",
  detail: lt("AQI feed healthy", "ระบบคุณภาพอากาศทำงานปกติ"),
  freshnessSeconds: 45,
  fallbackReason: null
};

const mockOpsTransferHubs: TransferHub[] = [
  {
    id: "rassada",
    name: lt("Rassada Hub", "ฮับรัษฎา"),
    coordinates: [7.8557, 98.4013],
    feederRouteIds: ["dragon-line", "patong-old-bus-station"],
    ferryRouteIds: ["rassada-phi-phi"],
    walkMinutes: 12,
    transferBufferMinutes: 20,
    provenance: "estimated",
    status: "watch",
    rationale: lt("Next ferry window opens soon.", "หน้าต่างเรือรอบถัดไปกำลังจะเปิด"),
    activeWindowLabel: null,
    nextWindowStartLabel: "16:30",
    activeConnections: []
  }
];

export const mockOpsDashboard: OpsDashboardPayload = {
  checkedAt: "2026-03-08T14:00:00Z",
  dataMode: "demo",
  fallbackReasons: ["simulation: scheduled replay model"],
  fleet: {
    vehicles: [...mockAirportVehicles, ...mockPatongVehicles],
    totalVehicles: mockAirportVehicles.length + mockPatongVehicles.length,
    busCount: mockAirportVehicles.length + mockPatongVehicles.length,
    ferryCount: 0,
    movingCount: 4,
    dwellingCount: 1,
    routePressure: [
      {
        routeId: "rawai-airport",
        level: "watch",
        demand: 42,
        seatSupply: 50,
        gap: 0,
        coverageRatio: 1,
        delayRiskMinutes: 4,
        provenance: "estimated"
      },
      {
        routeId: "patong-old-bus-station",
        level: "balanced",
        demand: 22,
        seatSupply: 25,
        gap: 0,
        coverageRatio: 1,
        delayRiskMinutes: 2,
        provenance: "estimated"
      }
    ]
  },
  routes: mockRoutes,
  demandSupply: {
    rawAirportArrivalPaxNext2h: 180,
    rawAirportDeparturePaxNext2h: 120,
    addressableArrivalDemandNext2h: 27,
    addressableDepartureDemandNext2h: 18,
    arrivalSeatSupplyNext2h: 50,
    departureSeatSupplyNext2h: 50,
    carriedArrivalDemandNext2h: 27,
    carriedDepartureDemandNext2h: 18,
    unmetArrivalDemandNext2h: 0,
    unmetDepartureDemandNext2h: 0,
    arrivalCaptureOfAddressablePct: 100,
    departureCaptureOfAddressablePct: 100,
    additionalBusesNeededPeak: 0,
    provenance: "estimated"
  },
  weather: {
    severity: "info",
    intelligence: {
      current: { tempC: 31, rainProb: 25, precipMm: 0.2, windKph: 12, aqi: 44, pm25: 11 },
      forecast: Array.from({ length: 12 }, (_, index) => ({
        hour: `${String(15 + index).padStart(2, "0")}:00`,
        tempC: 31,
        rainProb: 25,
        precipMm: 0.2,
        windKph: 12,
        code: 1000
      })),
      monsoonSeason: false,
      monsoonNote: "Dry season bias",
      driverAlerts: []
    },
    provenance: "live"
  },
  traffic: {
    severity: "caution",
    advisories: mockAirportAdvisories,
    provenance: "fallback"
  },
  hotspots: {
    hotspots: [
      {
        id: "airport",
        zone: "Airport",
        lat: 8.10846,
        lng: 98.30655,
        demand: 12,
        liveRequests: 3,
        modeledDemand: 9,
        coverageRatio: 0.8,
        gap: 2,
        provenance: "estimated"
      }
    ],
    totalRequests: 3
  },
  transferHubs: mockOpsTransferHubs,
  history: {
    recentEvents: [],
    vehicleHistoryCount: 6
  },
  mapOverlays: {
    tileLayers: [],
    markers: []
  },
  competitorBenchmarks: [
    {
      routeId: "orange-line",
      routeName: lt("Orange Line (Government)", "สายสีส้ม (ภาครัฐ)"),
      tier: "competitor",
      operatorLabel: "Government-operated",
      fareThb: 100,
      headwayMinutes: 60,
      tripDurationMinutes: 90,
      estimatedDemand: 120,
      seatSupply: 320,
      carriedRiders: 120,
      revenueThb: 12_000,
      capturePct: 100,
      overlapRouteIds: ["rawai-airport", "dragon-line"],
      provenance: "estimated",
      notes: lt("Benchmark competitor on the airport to town corridor.", "คู่เทียบเชิงกลยุทธ์บนคอร์ริดอร์สนามบินถึงเมือง")
    }
  ],
  sources: [mockBusSourceStatus, mockTrafficSourceStatus, mockWeatherSourceStatus, mockAqiSourceStatus]
};

export const mockInvestorSimulation: InvestorSimulationPayload = {
  generatedAt: "2026-03-08T14:00:00Z",
  dataMode: "demo",
  fallbackReasons: ["simulation: scheduled replay model"],
  assumptions: {
    seatCapacityPerBus: 25,
    flatFareThb: 100,
    addressableDemandShare: 0.15,
    replayStepMinutes: 3,
    replayStartMinutes: 360,
    replayEndMinutes: 1440
  },
  hourly: [
    {
      hour: "06:00",
      rawArrivalPax: 180,
      rawDeparturePax: 120,
      addressableArrivalDemand: 27,
      addressableDepartureDemand: 18,
      arrivalSeatSupply: 50,
      departureSeatSupply: 50,
      carriedArrivalDemand: 27,
      carriedDepartureDemand: 18,
      unmetArrivalDemand: 0,
      unmetDepartureDemand: 0,
      requiredArrivalDepartures: 2,
      requiredDepartureDepartures: 1,
      additionalArrivalBusesNeeded: 0,
      additionalDepartureBusesNeeded: 0,
      lostRevenueThb: 0
    }
  ],
  services: [],
  competitorBenchmarks: mockOpsDashboard.competitorBenchmarks,
  totals: {
    rawAirportArrivalPax: 180,
    rawAirportDeparturePax: 120,
    addressableArrivalDemand: 27,
    addressableDepartureDemand: 18,
    carriedArrivalDemand: 27,
    carriedDepartureDemand: 18,
    unmetArrivalDemand: 0,
    unmetDepartureDemand: 0,
    totalAirportCapturePct: 100,
    addressableAirportCapturePct: 100,
    dailyRevenueThb: 4_500,
    lostRevenueThb: 0,
    peakAdditionalBusesNeeded: 0
  },
  opportunities: {
    summary: "Modeled service covers the current replay window.",
    peakArrivalGapHour: null,
    peakDepartureGapHour: null,
    strongestRevenueServiceRouteId: "rawai-airport"
  },
  touchpoints: mockOpsTransferHubs
};

export const mockSimulationSnapshot: SimulationSnapshot = {
  simMinutes: 360,
  simTime: "06:00",
  dataMode: "demo",
  fallbackReasons: ["simulation: scheduled replay model"],
  vehicles: [...mockAirportVehicles, ...mockPatongVehicles],
  routePressure: mockOpsDashboard.fleet.routePressure,
  transferHubs: mockOpsTransferHubs,
  competitorBenchmarks: mockOpsDashboard.competitorBenchmarks
};

export const mockAirportGuide: AirportGuidePayload = {
  destinationQuery: "",
  recommendation: "ready",
  headline: lt("A bus is running from the airport", "มีรถบัสวิ่งออกจากสนามบิน"),
  summary: lt(
    "Search a beach, hotel belt, or landmark and we will tell you if Smart Bus is the right choice before you leave the terminal.",
    "พิมพ์ชื่อหาด ย่านโรงแรม หรือจุดสังเกต แล้วเราจะบอกว่าควรเลือก Smart Bus ก่อนออกจากอาคารหรือไม่"
  ),
  fareComparison: {
    busFareThb: 100,
    taxiFareEstimateThb: 1000,
    savingsThb: 900,
    savingsCopy: lt(
      "Save about 900 THB versus a typical airport taxi ride.",
      "ประหยัดได้ประมาณ 900 บาทเมื่อเทียบกับแท็กซี่จากสนามบินทั่วไป"
    )
  },
  boardingWalk: {
    primaryInstruction: lt(
      "Turn left after you come out and head to the Smart Bus stop by Cafe Amazon.",
      "เมื่อออกมาด้านนอกแล้วให้เลี้ยวซ้ายและเดินไปที่ป้าย Smart Bus ข้าง Cafe Amazon"
    ),
    secondaryInstruction: lt(
      "Use exit 3, cross to the Cafe Amazon side, and stay under cover if rain starts.",
      "ใช้ทางออก 3 ข้ามไปฝั่ง Cafe Amazon และหลบฝนใต้ที่กำบังหากฝนเริ่มตก"
    ),
    focusStopId: "rawai-airport-42"
  },
  weatherSummary: {
    conditionLabel: lt("Rain moving across the airport corridor", "มีกลุ่มฝนเคลื่อนผ่านแนวสนามบิน"),
    currentPrecipitation: 1.8,
    maxRainProbability: 82,
    recommendation: lt(
      "Keep a small buffer in case rain or wind slows boarding at the airport stop.",
      "ควรเผื่อเวลาเล็กน้อยในกรณีที่ฝนหรือลมทำให้การขึ้นรถที่ป้ายสนามบินช้าลง"
    ),
    severity: "caution"
  },
  bestMatch: null,
  matches: [],
  nextDeparture: {
    routeId: "rawai-airport",
    routeName: lt("Airport Line", "สายสนามบิน"),
    label: "3:05 PM",
    minutesUntil: 9,
    basis: "schedule",
    state: "scheduled",
    liveBusId: null,
    liveLicensePlate: null,
    seats: {
      seatsLeft: 11,
      capacity: 25,
      occupiedSeats: 12,
      loadFactor: 12 / 25,
      basis: "camera_live",
      cameraId: "cabin-01",
      confidenceLabel: lt("Live seats from the bus camera feed.", "จำนวนที่นั่งสดจากกล้องบนรถ"),
      passengerFlow: {
        boardingsRecent: 4,
        alightingsRecent: 1,
        updatedAt: "2026-03-08T14:00:00Z"
      },
      driverAttention: {
        state: "alert",
        cameraId: "driver-01",
        confidence: 0.96,
        label: lt("Driver alert", "คนขับพร้อม"),
        updatedAt: "2026-03-08T14:00:00Z"
      },
      updatedAt: "2026-03-08T14:00:00Z"
    }
  },
  followingDepartures: ["3:05 PM", "4:05 PM", "5:05 PM"],
  airportBoardingLabel: lt("Board opposite Cafe Amazon", "ขึ้นรถฝั่งตรงข้าม Cafe Amazon"),
  boardingNotes: [
    lt(
      "Go to exit 3 and wait opposite Cafe Amazon for the Smart Bus stop.",
      "ไปที่ทางออก 3 แล้วรอที่ป้าย Smart Bus ฝั่งตรงข้าม Cafe Amazon"
    )
  ],
  quickDestinations: [
    {
      id: "patong",
      label: lt("Patong", "ป่าตอง"),
      routeId: "rawai-airport",
      stopId: "rawai-airport-42",
      kind: "direct",
      travelMinutes: 46
    }
  ],
  sourceStatuses: mockDecisionSourceStatuses,
  checkedAt: "2026-03-08T14:00:00Z"
};

const payloadByPath = new Map<string, unknown>([
  ["/api/routes", mockRoutes],
  ["/api/health", mockHealthPayload],
  ["/api/ops/dashboard", mockOpsDashboard],
  ["/api/ops/investor-sim", mockInvestorSimulation],
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

  if (url.pathname === "/api/simulate") {
    return {
      ...mockSimulationSnapshot,
      simMinutes: Number(url.searchParams.get("t") ?? mockSimulationSnapshot.simMinutes),
      simTime: mockSimulationSnapshot.simTime
    };
  }

  return null;
}
