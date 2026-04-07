import request from "supertest";
import { localizedText } from "../shared/localizedText.js";
import type {
  Advisory,
  DataSourceStatus,
  DecisionSummary,
  HealthPayload,
  InvestorSimulationPayload,
  OpsDashboardPayload,
  Route,
  SimulationSnapshot,
  Stop,
  VehiclePosition
} from "../shared/types.js";

const lt = localizedText;
const now = "2026-03-08T14:00:00Z";

function createSourceStatus(
  source: DataSourceStatus["source"],
  state: DataSourceStatus["state"]
): DataSourceStatus {
  return {
    source,
    state,
    updatedAt: now,
    detail: lt(`${source} ${state}`, `${source} ${state}`),
    freshnessSeconds: state === "live" ? 15 : null,
    fallbackReason: state === "live" ? null : "demo_mode"
  };
}

const mockRoute: Route = {
  id: "rawai-airport",
  name: lt("Airport Line", "สายสนามบิน"),
  shortName: lt("Airport", "สนามบิน"),
  overview: lt("Airport corridor", "คอร์ริดอร์สนามบิน"),
  axis: "north_south",
  axisLabel: lt("North-south", "เหนือใต้"),
  tier: "core",
  color: "#16b8b0",
  accentColor: "#16b8b0",
  bounds: [[7.7804, 98.3225], [8.109, 98.307]],
  pathSegments: [[[7.7804, 98.3225], [8.109, 98.307]]],
  stopCount: 1,
  defaultStopId: "airport-1",
  activeVehicles: 1,
  status: lt("Live", "สด"),
  sourceStatus: createSourceStatus("bus", "live")
};

const mockStop: Stop = {
  id: "airport-1",
  routeId: "rawai-airport",
  sequence: 1,
  name: lt("Airport Stop", "ป้ายสนามบิน"),
  direction: lt("To Rawai", "ไปราไวย์"),
  routeDirection: lt("Airport to Rawai", "สนามบินไปราไวย์"),
  coordinates: [8.10846, 98.30655],
  scheduleText: "06:00,07:00",
  nextBus: {
    label: "3:05 PM",
    minutesUntil: 9,
    basis: "live",
    notes: lt("Live", "สด")
  },
  timetable: {
    firstDepartureLabel: "06:00",
    lastDepartureLabel: "18:00",
    nextDepartures: ["15:05", "16:05"],
    serviceWindowLabel: "06:00-18:00",
    sourceLabel: lt("Official timetable", "ตารางเวลาอย่างเป็นทางการ"),
    sourceUrl: "https://example.com",
    sourceUpdatedAt: now,
    notes: lt("Published schedule", "ตารางเผยแพร่")
  },
  nearbyPlace: {
    name: "Terminal hall",
    mapUrl: "https://example.com",
    openingHours: "24 hours",
    distanceMeters: 120,
    walkMinutes: 2
  }
};

const mockVehicle: VehiclePosition = {
  id: "veh-1",
  routeId: "rawai-airport",
  licensePlate: "10-1151",
  vehicleId: "bus-airport-1",
  deviceId: "tracker-1",
  coordinates: [8.086376, 98.304563],
  heading: 24,
  speedKph: 35,
  destination: lt("To Rawai", "ไปราไวย์"),
  updatedAt: now,
  telemetrySource: "direct_gps",
  freshness: "fresh",
  status: "moving",
  distanceToDestinationMeters: null,
  stopsAway: null
};

const mockDecision: DecisionSummary = {
  routeId: "rawai-airport",
  stopId: "airport-1",
  level: "go_now",
  headline: lt("Ride now", "ขึ้นรถได้เลย"),
  summary: lt("Service is flowing normally.", "บริการยังไหลลื่นตามปกติ"),
  reasons: [lt("Vehicle feed is live.", "ข้อมูลรถสดทำงานปกติ")],
  nextBus: {
    label: "3:05 PM",
    minutesUntil: 9,
    basis: "live",
    notes: lt("Live feed", "ข้อมูลสด")
  },
  seatAvailability: null,
  timetable: mockStop.timetable,
  liveVehicles: 1,
  routeStatus: lt("Live", "สด"),
  environment: null,
  updatedAt: now,
  sourceStatuses: [
    createSourceStatus("bus", "live"),
    createSourceStatus("traffic", "fallback"),
    createSourceStatus("weather", "live")
  ]
};

const mockDashboard: OpsDashboardPayload = {
  checkedAt: now,
  dataMode: "demo",
  fallbackReasons: ["Demo snapshot active"],
  fleet: {
    vehicles: [mockVehicle],
    totalVehicles: 1,
    busCount: 1,
    ferryCount: 0,
    movingCount: 1,
    dwellingCount: 0,
    routePressure: [
      {
        routeId: "rawai-airport",
        level: "balanced",
        demand: 20,
        seatSupply: 25,
        gap: 0,
        coverageRatio: 1,
        delayRiskMinutes: 0,
        provenance: "fallback"
      }
    ]
  },
  routes: [mockRoute],
  demandSupply: {
    rawAirportArrivalPaxNext2h: 100,
    rawAirportDeparturePaxNext2h: 80,
    addressableArrivalDemandNext2h: 15,
    addressableDepartureDemandNext2h: 12,
    arrivalSeatSupplyNext2h: 25,
    departureSeatSupplyNext2h: 25,
    carriedArrivalDemandNext2h: 15,
    carriedDepartureDemandNext2h: 12,
    unmetArrivalDemandNext2h: 0,
    unmetDepartureDemandNext2h: 0,
    arrivalCaptureOfAddressablePct: 100,
    departureCaptureOfAddressablePct: 100,
    additionalBusesNeededPeak: 0,
    provenance: "fallback"
  },
  weather: {
    severity: "info",
    intelligence: {
      current: { tempC: 31, rainProb: 25, precipMm: 0.2, windKph: 12, aqi: 44, pm25: 11 },
      forecast: [
        { hour: "15:00", tempC: 31, rainProb: 25, precipMm: 0.2, windKph: 12, code: 1000 }
      ],
      monsoonSeason: false,
      monsoonNote: "Dry season",
      driverAlerts: []
    },
    provenance: "fallback"
  },
  traffic: {
    severity: "info",
    advisories: [],
    provenance: "fallback"
  },
  hotspots: {
    hotspots: [],
    totalRequests: 0
  },
  transferHubs: [],
  history: {
    recentEvents: [],
    vehicleHistoryCount: 0
  },
  mapOverlays: {
    tileLayers: [],
    markers: []
  },
  competitorBenchmarks: [
    {
      routeId: "orange-line",
      routeName: lt("Orange Line (Govt)", "สายสีส้ม"),
      tier: "competitor",
      operatorLabel: "Phuket government pilot",
      fareThb: 100,
      headwayMinutes: 60,
      tripDurationMinutes: 90,
      estimatedDemand: 400,
      seatSupply: 960,
      carriedRiders: 350,
      revenueThb: 35_000,
      capturePct: 88,
      overlapRouteIds: ["rawai-airport"],
      provenance: "fallback",
      notes: lt("Government-operated competitor", "คู่แข่งที่รัฐดำเนินการ")
    }
  ],
  sources: [
    createSourceStatus("bus", "live"),
    createSourceStatus("traffic", "fallback"),
    createSourceStatus("weather", "live"),
    createSourceStatus("aqi", "live")
  ]
};

const mockInvestor: InvestorSimulationPayload = {
  generatedAt: now,
  dataMode: "demo",
  fallbackReasons: ["Demo snapshot active"],
  assumptions: {
    seatCapacityPerBus: 25,
    flatFareThb: 100,
    addressableDemandShare: 0.15,
    replayStepMinutes: 3,
    replayStartMinutes: 360,
    replayEndMinutes: 1440
  },
  hourly: [],
  services: [],
  competitorBenchmarks: mockDashboard.competitorBenchmarks,
  totals: {
    rawAirportArrivalPax: 100,
    rawAirportDeparturePax: 80,
    addressableArrivalDemand: 15,
    addressableDepartureDemand: 12,
    carriedArrivalDemand: 15,
    carriedDepartureDemand: 12,
    unmetArrivalDemand: 0,
    unmetDepartureDemand: 0,
    totalAirportCapturePct: 100,
    addressableAirportCapturePct: 100,
    dailyRevenueThb: 2_700,
    lostRevenueThb: 0,
    peakAdditionalBusesNeeded: 0
  },
  opportunities: {
    summary: "No unmet demand in demo mode.",
    peakArrivalGapHour: null,
    peakDepartureGapHour: null,
    strongestRevenueServiceRouteId: "rawai-airport"
  },
  touchpoints: []
};

const mockSimulation: SimulationSnapshot = {
  simMinutes: 360,
  simTime: "06:00",
  dataMode: "demo",
  fallbackReasons: ["Demo snapshot active"],
  vehicles: [mockVehicle],
  routePressure: mockDashboard.fleet.routePressure,
  transferHubs: [],
  competitorBenchmarks: mockDashboard.competitorBenchmarks
};

type AppHarnessOptions = {
  busStatus?: DataSourceStatus;
  trafficStatus?: DataSourceStatus;
  weatherStatus?: DataSourceStatus;
  aqiStatus?: DataSourceStatus;
  dashboard?: OpsDashboardPayload;
  workerHeartbeat?: { updated_at: string } | null;
  database?: HealthPayload["database"];
  ingestKey?: string | null;
};

async function createTestApp(options: AppHarnessOptions = {}) {
  vi.resetModules();

  if (options.ingestKey === null) {
    delete process.env.PKSB_INGEST_API_KEY;
  } else {
    process.env.PKSB_INGEST_API_KEY = options.ingestKey ?? "test-ingest-key";
  }
  process.env.DATA_MODE = "demo";

  const busStatus = options.busStatus ?? createSourceStatus("bus", "live");
  const trafficStatus = options.trafficStatus ?? createSourceStatus("traffic", "fallback");
  const weatherStatus = options.weatherStatus ?? createSourceStatus("weather", "live");
  const aqiStatus = options.aqiStatus ?? createSourceStatus("aqi", "live");
  const database =
    options.database ?? { available: true, writable: true, mode: "sqlite" as const, path: ":memory:" };
  const freshHeartbeatAt = new Date().toISOString();
  const workerHeartbeat =
    options.workerHeartbeat === undefined ? { updated_at: freshHeartbeatAt } : options.workerHeartbeat;

  vi.doMock("./lib/db.js", () => ({
    getDatabaseHealth: vi.fn(() => database),
    readAllVehicles: vi.fn(() => [mockVehicle]),
    readRecentHistory: vi.fn(() => []),
    readWorkerHeartbeat: vi.fn(() => workerHeartbeat)
  }));

  vi.doMock("./services/providers/busProvider.js", () => ({
    clearBusSnapshotCache: vi.fn(),
    getBusSnapshot: vi.fn(async () => ({
      vehicles: [mockVehicle],
      status: busStatus
    })),
    getVehiclesForRoute: vi.fn(async () => ({
      vehicles: [mockVehicle],
      status: busStatus
    }))
  }));

  vi.doMock("./services/providers/trafficProvider.js", () => ({
    getTrafficSnapshot: vi.fn(async () => ({
      snapshot: { advisories: [] },
      status: trafficStatus
    })),
    getTrafficAdvisories: vi.fn(async (): Promise<{ advisories: Advisory[]; status: DataSourceStatus }> => ({
      advisories: [],
      status: trafficStatus
    }))
  }));

  vi.doMock("./services/providers/weatherProvider.js", () => ({
    getWeatherSnapshot: vi.fn(async () => ({
      snapshot: {
        temperatureC: 31,
        precipitation: 0.2,
        precipitationProbability: 25,
        windSpeed: 12,
        weatherCode: 1000
      },
      status: weatherStatus
    })),
    getWeatherAdvisories: vi.fn(async (): Promise<{ advisories: Advisory[]; status: DataSourceStatus }> => ({
      advisories: [],
      status: weatherStatus
    }))
  }));

  vi.doMock("./services/providers/aqiProvider.js", () => ({
    getAqiSnapshot: vi.fn(async () => ({
      snapshot: {
        usAqi: 44,
        pm25: 11
      },
      status: aqiStatus
    }))
  }));

  vi.doMock("./services/routes.js", () => ({
    getRoutes: vi.fn(() => [mockRoute]),
    getStopsForRoute: vi.fn(() => [mockStop]),
    getStopById: vi.fn((routeId: string, stopId: string) =>
      routeId === mockRoute.id && stopId === mockStop.id ? mockStop : null
    )
  }));

  vi.doMock("./services/decisionEngine.js", () => ({
    buildDecisionSummary: vi.fn(() => mockDecision)
  }));

  vi.doMock("./services/opsIntelligenceService.js", () => ({
    getOpsDashboardPayload: vi.fn(async () => options.dashboard ?? mockDashboard),
    getInvestorSimulationPayload: vi.fn(() => mockInvestor),
    getSimulationSnapshot: vi.fn(async () => mockSimulation)
  }));

  vi.doMock("./services/operationsService.js", () => ({
    getOperationsOverview: vi.fn(async () => ({
      checkedAt: now,
      routes: [],
      recentEvents: []
    }))
  }));

  vi.doMock("./services/demandRequestStore.js", () => ({
    findDemandZone: vi.fn(() => ({ zone: "Airport" })),
    getDemandHotspots: vi.fn(() => []),
    recordDemandRequest: vi.fn(() => ({ totalRequests: 1 }))
  }));

  vi.doMock("./services/operationsStore.js", () => ({
    recordDriverMonitorSamples: vi.fn(),
    recordPassengerFlowSamples: vi.fn(),
    recordSeatCameraSamples: vi.fn(),
    recordVehicleTelemetry: vi.fn()
  }));

  vi.doMock("./services/providers/flightProvider.js", () => ({
    getDemandForecast: vi.fn(() => ({
      currentHour: "15:00",
      arrivalsNext2h: 5,
      estimatedPaxNext2h: 200,
      busDemandEstimate: 30,
      currentFleetOnline: 1,
      recommendedFleet: 1,
      recommendation: "Steady",
      flights: []
    })),
    getFlightSchedule: vi.fn(() => []),
    getHourlyDemandProjection: vi.fn(() => []),
    getNationalityBreakdown: vi.fn(() => [])
  }));

  const { createApp } = await import("./app.js");
  return createApp();
}

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  delete process.env.PKSB_INGEST_API_KEY;
  delete process.env.DATA_MODE;
});

describe("server app API", () => {
  it("reports product health as degraded when any source is on fallback", async () => {
    const app = await createTestApp();
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("degraded");
    expect(response.body.mode).toBe("demo");
    expect(response.body.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: "traffic", state: "fallback", critical: false, demoOnly: true }),
        expect.objectContaining({ source: "bus", state: "live", critical: true, demoOnly: false })
      ])
    );
  });

  it("marks readiness degraded when worker heartbeat is missing", async () => {
    const app = await createTestApp({ workerHeartbeat: null });
    const response = await request(app).get("/health/ready");

    expect(response.status).toBe(503);
    expect(response.body.status).toBe("degraded");
    expect(response.body.worker.status).toBe("missing");
  });

  it("returns only operational routes from /api/routes", async () => {
    const app = await createTestApp();
    const response = await request(app).get("/api/routes");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.arrayContaining([expect.objectContaining({ id: "rawai-airport" })]));
    expect(response.body.map((route: { id: string }) => route.id)).not.toContain("orange-line");
  });

  it("rejects orange-line on rider-facing decision API queries", async () => {
    const app = await createTestApp();
    const response = await request(app)
      .get("/api/decision-summary")
      .query({ routeId: "orange-line", stopId: "airport-1" });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("validation_error");
  });

  it("serves decision summaries for operational routes", async () => {
    const app = await createTestApp();
    const response = await request(app)
      .get("/api/decision-summary")
      .query({ routeId: "rawai-airport", stopId: "airport-1" });

    expect(response.status).toBe(200);
    expect(response.body.routeId).toBe("rawai-airport");
    expect(response.body.sourceStatuses).toEqual(
      expect.arrayContaining([expect.objectContaining({ source: "bus", state: "live" })])
    );
  });

  it("keeps orange-line in ops competitor benchmarks, not public routes", async () => {
    const app = await createTestApp();
    const response = await request(app).get("/api/ops/dashboard");

    expect(response.status).toBe(200);
    expect(response.body.dataMode).toBe("demo");
    expect(response.body.routes.map((route: { id: string }) => route.id)).not.toContain("orange-line");
    expect(response.body.competitorBenchmarks).toEqual(
      expect.arrayContaining([expect.objectContaining({ routeId: "orange-line" })])
    );
  });

  it("serves ops weather with AQI data", async () => {
    const app = await createTestApp();
    const response = await request(app).get("/api/ops/weather");

    expect(response.status).toBe(200);
    expect(response.body.current.tempC).toBe(31);
    expect(response.body.current.aqi).toBe(44);
    expect(response.body.forecast).toHaveLength(12);
  });

  it.each([
    [
      "/api/integrations/vehicle-telemetry",
      {
        samples: [
          {
            deviceId: "tracker-1",
            vehicleId: "bus-1",
            routeId: "rawai-airport",
            licensePlate: "10-1151",
            coordinates: [8.10846, 98.30655],
            heading: 24,
            speedKph: 35,
            destinationHint: "Airport",
            capturedAt: now
          }
        ]
      }
    ],
    [
      "/api/integrations/seat-camera",
      {
        samples: [
          {
            cameraId: "cam-1",
            vehicleId: "bus-1",
            routeId: "rawai-airport",
            capacity: 25,
            occupiedSeats: 10,
            seatsLeft: 15,
            capturedAt: now
          }
        ]
      }
    ],
    [
      "/api/integrations/driver-monitor",
      {
        samples: [
          {
            cameraId: "driver-cam-1",
            vehicleId: "bus-1",
            routeId: "rawai-airport",
            attentionState: "alert",
            confidence: 0.98,
            capturedAt: now
          }
        ]
      }
    ],
    [
      "/api/integrations/passenger-flow",
      {
        events: [
          {
            cameraId: "door-cam-1",
            vehicleId: "bus-1",
            routeId: "rawai-airport",
            stopId: "airport-1",
            coordinates: [8.10846, 98.30655],
            eventType: "boarding",
            passengers: 3,
            capturedAt: now
          }
        ]
      }
    ]
  ])("accepts authorized ingest requests for %s", async (path, body) => {
    const app = await createTestApp({ ingestKey: "test-ingest-key" });
    const response = await request(app)
      .post(path)
      .set("x-ingest-key", "test-ingest-key")
      .send(body);

    expect(response.status).toBe(202);
    expect(response.body.accepted).toBe(1);
  });

  it("rejects ingest requests without x-ingest-key", async () => {
    const app = await createTestApp({ ingestKey: "test-ingest-key" });
    const response = await request(app)
      .post("/api/integrations/vehicle-telemetry")
      .send({ samples: [] });

    expect(response.status).toBe(401);
    expect(response.body.code).toBe("unauthorized");
  });

  it("returns structured validation errors for invalid ingest bodies", async () => {
    const app = await createTestApp({ ingestKey: "test-ingest-key" });
    const response = await request(app)
      .post("/api/integrations/vehicle-telemetry")
      .set("x-ingest-key", "test-ingest-key")
      .send({
        samples: [
          {
            deviceId: "",
            vehicleId: "bus-1",
            routeId: "rawai-airport",
            licensePlate: "10-1151",
            coordinates: [999, 999],
            heading: 24,
            speedKph: 35,
            destinationHint: "Airport",
            capturedAt: "not-a-date"
          }
        ]
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("validation_error");
    expect(Array.isArray(response.body.issues)).toBe(true);
  });

  it("returns 413 when an ingest batch exceeds the configured cap", async () => {
    const app = await createTestApp({ ingestKey: "test-ingest-key" });
    const samples = Array.from({ length: 251 }, (_, index) => ({
      deviceId: `tracker-${index}`,
      vehicleId: `bus-${index}`,
      routeId: "rawai-airport",
      licensePlate: `10-${1100 + index}`,
      coordinates: [8.10846, 98.30655] as [number, number],
      heading: 24,
      speedKph: 35,
      destinationHint: "Airport",
      capturedAt: now
    }));

    const response = await request(app)
      .post("/api/integrations/vehicle-telemetry")
      .set("x-ingest-key", "test-ingest-key")
      .send({ samples });

    expect(response.status).toBe(413);
    expect(response.body.code).toBe("payload_too_large");
  });

  it("returns 429 when ingest rate limits are exceeded", async () => {
    const app = await createTestApp({ ingestKey: "test-ingest-key" });
    const requestIp = "198.51.100.24";
    const body = {
      samples: [
        {
          deviceId: "tracker-1",
          vehicleId: "bus-1",
          routeId: "rawai-airport",
          licensePlate: "10-1151",
          coordinates: [8.10846, 98.30655],
          heading: 24,
          speedKph: 35,
          destinationHint: "Airport",
          capturedAt: now
        }
      ]
    };

    for (let index = 0; index < 60; index += 1) {
      const accepted = await request(app)
        .post("/api/integrations/vehicle-telemetry")
        .set("x-ingest-key", "test-ingest-key")
        .set("x-forwarded-for", requestIp)
        .send(body);

      expect(accepted.status).toBe(202);
    }

    const response = await request(app)
      .post("/api/integrations/vehicle-telemetry")
      .set("x-ingest-key", "test-ingest-key")
      .set("x-forwarded-for", requestIp)
      .send(body);

    expect(response.status).toBe(429);
    expect(response.body.code).toBe("rate_limited");
    expect(response.headers["retry-after"]).toBeDefined();
  });
});
