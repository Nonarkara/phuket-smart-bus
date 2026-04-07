import compression from "compression";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  APP_VERSION,
  DATA_MODE,
  INGEST_BATCH_LIMIT,
  INGEST_RATE_LIMIT_MAX,
  INGEST_RATE_LIMIT_WINDOW_MS,
  isAllowedCorsOrigin,
  OPERATIONAL_ROUTE_IDS,
  PKSB_INGEST_API_KEY,
  PRICE_COMPARISONS,
  REQUEST_BODY_LIMIT,
  WORKER_HEARTBEAT_MAX_AGE_MS
} from "./config.js";
import { errorHandler, HttpError, requestContextMiddleware } from "./lib/http.js";
import {
  getDatabaseHealth,
  readAllVehicles,
  readRecentHistory,
  readWorkerHeartbeat
} from "./lib/db.js";
import {
  resolveOpsDataMode,
  sourceStatusesToFallbackReasons
} from "./lib/sourceStatus.js";
import { createRateLimit } from "./lib/rateLimit.js";
import { getAirportGuide } from "./services/airportGuide.js";
import {
  findDemandZone,
  getDemandHotspots,
  recordDemandRequest
} from "./services/demandRequestStore.js";
import {
  getInvestorSimulationPayload,
  getOpsDashboardPayload,
  getSimulationSnapshot
} from "./services/opsIntelligenceService.js";
import { getOperationsOverview } from "./services/operationsService.js";
import {
  recordDriverMonitorSamples,
  recordPassengerFlowSamples,
  recordSeatCameraSamples,
  recordVehicleTelemetry
} from "./services/operationsStore.js";
import { buildDecisionSummary } from "./services/decisionEngine.js";
import { getStopById, getStopsForRoute, getRoutes } from "./services/routes.js";
import { getTrafficAdvisories, getTrafficSnapshot } from "./services/providers/trafficProvider.js";
import { getAqiSnapshot } from "./services/providers/aqiProvider.js";
import { clearBusSnapshotCache, getBusSnapshot, getVehiclesForRoute } from "./services/providers/busProvider.js";
import {
  getDemandForecast,
  getFlightSchedule,
  getHourlyDemandProjection,
  getNationalityBreakdown
} from "./services/providers/flightProvider.js";
import { getWeatherAdvisories, getWeatherSnapshot } from "./services/providers/weatherProvider.js";
import { BUS_SEAT_CAPACITY } from "../shared/productConfig.js";
import type {
  DriverMonitorSample,
  HealthPayload,
  OperationalRouteId,
  PassengerFlowSample,
  PriceComparison,
  SeatCameraSample,
  VehicleTelemetrySample
} from "../shared/types.js";

const operationalRoutes = new Set<OperationalRouteId>(OPERATIONAL_ROUTE_IDS);
const routeIdSchema = z.enum(OPERATIONAL_ROUTE_IDS as [OperationalRouteId, ...OperationalRouteId[]]);
const ingestAuthorizationSchema = z.string().trim().regex(/^Bearer\s+\S+$/);
const demandRequestSchema = z.object({
  lat: z.number().finite().gte(-90).lte(90),
  lng: z.number().finite().gte(-180).lte(180)
});
const simulationQuerySchema = z.object({
  t: z.coerce.number().int().gte(0).lte(1440)
});
const decisionSummaryQuerySchema = z.object({
  routeId: routeIdSchema,
  stopId: z.string().trim().min(1)
});
const airportGuideQuerySchema = z.object({
  destination: z.string().default("")
});
const vehicleTelemetryBatchSchema = z.object({
  samples: z
    .array(
      z.object({
        deviceId: z.string().trim().min(1),
        vehicleId: z.string().trim().min(1),
        routeId: routeIdSchema,
        licensePlate: z.string().trim().min(1).nullable(),
        coordinates: z.tuple([
          z.number().finite().gte(-90).lte(90),
          z.number().finite().gte(-180).lte(180)
        ]),
        heading: z.number().finite(),
        speedKph: z.number().finite(),
        destinationHint: z.string().trim().min(1).nullable(),
        capturedAt: z.string().datetime({ offset: true })
      })
    )
    .min(1)
    .max(INGEST_BATCH_LIMIT)
});
const seatCameraBatchSchema = z.object({
  samples: z
    .array(
      z.object({
        cameraId: z.string().trim().min(1),
        vehicleId: z.string().trim().min(1),
        routeId: routeIdSchema,
        capacity: z.number().int().positive(),
        occupiedSeats: z.number().int().nonnegative(),
        seatsLeft: z.number().int().nonnegative(),
        capturedAt: z.string().datetime({ offset: true })
      })
    )
    .min(1)
    .max(INGEST_BATCH_LIMIT)
});
const driverMonitorBatchSchema = z.object({
  samples: z
    .array(
      z.object({
        cameraId: z.string().trim().min(1),
        vehicleId: z.string().trim().min(1),
        routeId: routeIdSchema,
        attentionState: z.enum(["alert", "watch", "drowsy_detected", "camera_offline"]),
        confidence: z.number().min(0).max(1).nullable(),
        capturedAt: z.string().datetime({ offset: true })
      })
    )
    .min(1)
    .max(INGEST_BATCH_LIMIT)
});
const passengerFlowBatchSchema = z.object({
  events: z
    .array(
      z.object({
        cameraId: z.string().trim().min(1),
        vehicleId: z.string().trim().min(1),
        routeId: routeIdSchema,
        stopId: z.string().trim().min(1).nullable(),
        coordinates: z.tuple([
          z.number().finite().gte(-90).lte(90),
          z.number().finite().gte(-180).lte(180)
        ]),
        eventType: z.enum(["boarding", "alighting"]),
        passengers: z.number().int().positive(),
        capturedAt: z.string().datetime({ offset: true })
      })
    )
    .min(1)
    .max(INGEST_BATCH_LIMIT)
});
const ingestRateLimit = createRateLimit({
  prefix: "ingest",
  max: INGEST_RATE_LIMIT_MAX,
  windowMs: INGEST_RATE_LIMIT_WINDOW_MS
});

function isOperationalRouteId(value: string): value is OperationalRouteId {
  return operationalRoutes.has(value as OperationalRouteId);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isLatLngTuple(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    isFiniteNumber(value[0]) &&
    isFiniteNumber(value[1])
  );
}

function isVehicleTelemetrySample(value: unknown): value is VehicleTelemetrySample {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.deviceId === "string" &&
    typeof value.vehicleId === "string" &&
    typeof value.routeId === "string" &&
    isOperationalRouteId(value.routeId) &&
    isNullableString(value.licensePlate) &&
    isLatLngTuple(value.coordinates) &&
    isFiniteNumber(value.heading) &&
    isFiniteNumber(value.speedKph) &&
    isNullableString(value.destinationHint) &&
    isIsoDate(value.capturedAt)
  );
}

function isSeatCameraSample(value: unknown): value is SeatCameraSample {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.cameraId === "string" &&
    typeof value.vehicleId === "string" &&
    typeof value.routeId === "string" &&
    isOperationalRouteId(value.routeId) &&
    Number.isInteger(value.capacity) &&
    Number.isInteger(value.occupiedSeats) &&
    Number.isInteger(value.seatsLeft) &&
    isIsoDate(value.capturedAt)
  );
}

function isDriverMonitorSample(value: unknown): value is DriverMonitorSample {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.cameraId === "string" &&
    typeof value.vehicleId === "string" &&
    typeof value.routeId === "string" &&
    isOperationalRouteId(value.routeId) &&
    typeof value.attentionState === "string" &&
    ["alert", "watch", "drowsy_detected", "camera_offline"].includes(value.attentionState) &&
    (value.confidence === null || isFiniteNumber(value.confidence)) &&
    isIsoDate(value.capturedAt)
  );
}

function isPassengerFlowSample(value: unknown): value is PassengerFlowSample {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.cameraId === "string" &&
    typeof value.vehicleId === "string" &&
    typeof value.routeId === "string" &&
    isOperationalRouteId(value.routeId) &&
    (value.stopId === null || typeof value.stopId === "string") &&
    isLatLngTuple(value.coordinates) &&
    (value.eventType === "boarding" || value.eventType === "alighting") &&
    typeof value.passengers === "number" &&
    Number.isInteger(value.passengers) &&
    value.passengers >= 0 &&
    isIsoDate(value.capturedAt)
  );
}

function readValidatedBatch<T>(
  payload: unknown,
  field: string,
  validator: (value: unknown) => value is T
) {
  if (!isObject(payload)) {
    throw new HttpError(400, "invalid_body", "Request body must be a JSON object");
  }

  const batch = payload[field];

  if (!Array.isArray(batch)) {
    throw new HttpError(400, "invalid_body", `${field} array is required`);
  }

  if (batch.length > INGEST_BATCH_LIMIT) {
    throw new HttpError(
      413,
      "payload_too_large",
      `${field} exceeds the ${INGEST_BATCH_LIMIT} record batch limit`
    );
  }

  const invalidIndex = batch.findIndex((entry) => !validator(entry));

  if (invalidIndex !== -1) {
    throw new HttpError(400, "validation_error", `${field}[${invalidIndex}] is invalid`);
  }

  return batch;
}

function enforceDemandCoordinates(lat: unknown, lng: unknown) {
  if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) {
    throw new HttpError(400, "validation_error", "lat and lng must be finite numbers");
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new HttpError(400, "validation_error", "lat/lng are out of range");
  }
}

function getClientDir() {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const sourceClientDir = path.resolve(currentDir, "../client");
  const builtClientDir = path.resolve(currentDir, "../../client");
  return fs.existsSync(sourceClientDir) ? sourceClientDir : builtClientDir;
}

function allowCorsOrigin(origin: string | undefined) {
  return isAllowedCorsOrigin(origin);
}

function requireIngestKey(request: express.Request, _response: express.Response, next: express.NextFunction) {
  if (!PKSB_INGEST_API_KEY) {
    next(
      new HttpError(
        503,
        "ingest_not_configured",
        "Ingest API key is not configured on this server"
      )
    );
    return;
  }

  const authorizationHeader = request.header("authorization");
  const parsedAuthorization = ingestAuthorizationSchema.safeParse(authorizationHeader);

  if (!parsedAuthorization.success) {
    next(new HttpError(401, "unauthorized", "Missing Authorization bearer token"));
    return;
  }

  const token = parsedAuthorization.data.replace(/^Bearer\s+/i, "");

  if (token !== PKSB_INGEST_API_KEY) {
    next(new HttpError(401, "unauthorized", "Invalid ingest key"));
    return;
  }

  next();
}

const asyncRoute =
  (
    handler: (
      request: express.Request,
      response: express.Response,
      next: express.NextFunction
    ) => Promise<void>
  ): express.RequestHandler =>
  (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };

async function collectSourceStatuses() {
  const [busSnapshot, trafficSnapshot, weatherSnapshot, aqiSnapshot] = await Promise.all([
    getBusSnapshot(),
    getTrafficSnapshot(),
    getWeatherSnapshot(),
    getAqiSnapshot()
  ]);

  return [busSnapshot.status, trafficSnapshot.status, weatherSnapshot.status, aqiSnapshot.status];
}

function getWorkerHealth() {
  const heartbeat = readWorkerHeartbeat("background-worker");

  if (!heartbeat) {
    return {
      status: "missing" as const,
      updatedAt: null,
      maxAgeMs: WORKER_HEARTBEAT_MAX_AGE_MS
    };
  }

  const updatedAt = String(heartbeat.updated_at);
  const ageMs = Date.now() - Date.parse(updatedAt);

  return {
    status: ageMs <= WORKER_HEARTBEAT_MAX_AGE_MS ? ("ok" as const) : ("stale" as const),
    updatedAt,
    maxAgeMs: WORKER_HEARTBEAT_MAX_AGE_MS
  };
}

function buildHealthPayload(sources: Awaited<ReturnType<typeof collectSourceStatuses>>): HealthPayload {
  const worker = getWorkerHealth();
  const annotatedSources = sources.map((source) => ({
    ...source,
    critical: source.source === "bus" || source.source === "weather",
    demoOnly: source.source === "traffic"
  }));
  const criticalSources = annotatedSources.filter((source) => source.critical);

  return {
    status:
      criticalSources.every((source) => source.state === "live") && worker.status === "ok"
        ? "ok"
        : "degraded",
    checkedAt: new Date().toISOString(),
    mode: DATA_MODE,
    appVersion: APP_VERSION,
    database: getDatabaseHealth(),
    worker,
    sources: annotatedSources
  };
}

export function createApp() {
  const app = express();
  const clientDir = getClientDir();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(requestContextMiddleware);
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false
    })
  );
  app.use(compression());
  app.use(
    cors({
      origin(origin, callback) {
        if (allowCorsOrigin(origin)) {
          callback(null, true);
          return;
        }

        callback(new HttpError(403, "cors_forbidden", "Origin is not allowed"));
      }
    })
  );
  app.use(express.json({ limit: REQUEST_BODY_LIMIT }));
  app.use("/api/integrations", requireIngestKey, ingestRateLimit);

  app.get("/health/live", (_request, response) => {
    response.status(200).json({
      status: "ok",
      checkedAt: new Date().toISOString()
    });
  });

  app.get("/health/ready", (_request, response) => {
    const database = getDatabaseHealth();
    const worker = getWorkerHealth();
    const ready = database.available && worker.status === "ok";

    response.status(ready ? 200 : 503).json({
      status: ready ? "ok" : "degraded",
      checkedAt: new Date().toISOString(),
      database,
      worker
    });
  });

  app.get(
    "/api/health",
    asyncRoute(async (_request, response) => {
      const sources = await collectSourceStatuses();
      response.json(buildHealthPayload(sources));
    })
  );

  app.get(
    "/api/routes",
    asyncRoute(async (_request, response) => {
      const snapshot = await getBusSnapshot();
      const activeVehicles = Object.fromEntries(
        OPERATIONAL_ROUTE_IDS.map((routeId) => [
          routeId,
          snapshot.vehicles.filter((vehicle) => vehicle.routeId === routeId).length
        ])
      ) as Record<OperationalRouteId, number>;

      response.set("Cache-Control", "public, max-age=10");
      response.json(getRoutes(snapshot.status, activeVehicles));
    })
  );

  app.get("/api/routes/:routeId/stops", (request, response, next) => {
    const routeId = Array.isArray(request.params.routeId)
      ? request.params.routeId[0]
      : request.params.routeId;

    if (!routeId || !isOperationalRouteId(routeId)) {
      next(new HttpError(404, "not_found", "Unknown route"));
      return;
    }

    response.set("Cache-Control", "public, max-age=60");
    response.json(getStopsForRoute(routeId));
  });

  app.get(
    "/api/vehicles/all",
    asyncRoute(async (_request, response) => {
      const snapshot = await getBusSnapshot();
      response.json({
        vehicles: snapshot.vehicles,
        updatedAt: new Date().toISOString()
      });
    })
  );

  app.get(
    "/api/simulate",
    asyncRoute(async (request, response) => {
      const { t: simMinutes } = simulationQuerySchema.parse(request.query);

      response.json(await getSimulationSnapshot(simMinutes));
    })
  );

  app.post("/api/demand-request", (request, response, next) => {
    try {
      const { lat, lng } = demandRequestSchema.parse(request.body ?? {});
      const zone = findDemandZone(lat, lng);

      if (!zone) {
        throw new HttpError(404, "not_found", "Demand zone not found");
      }

      const result = recordDemandRequest(lat, lng);

      response.json({ success: true, zone: zone.zone, totalRequests: result?.totalRequests ?? 0 });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/ops/demand-requests", (_request, response) => {
    response.json(getDemandHotspots());
  });

  app.get(
    "/api/routes/:routeId/vehicles",
    asyncRoute(async (request, response) => {
      const routeId = Array.isArray(request.params.routeId)
        ? request.params.routeId[0]
        : request.params.routeId;

      if (!routeId || !isOperationalRouteId(routeId)) {
        throw new HttpError(404, "not_found", "Unknown route");
      }

      response.json(await getVehiclesForRoute(routeId));
    })
  );

  app.get(
    "/api/routes/:routeId/advisories",
    asyncRoute(async (request, response) => {
      const routeId = Array.isArray(request.params.routeId)
        ? request.params.routeId[0]
        : request.params.routeId;

      if (!routeId || !isOperationalRouteId(routeId)) {
        throw new HttpError(404, "not_found", "Unknown route");
      }

      const [traffic, weather] = await Promise.all([
        getTrafficAdvisories(routeId),
        getWeatherAdvisories(routeId)
      ]);

      response.json({
        advisories: [...traffic.advisories, ...weather.advisories],
        sourceStatuses: [traffic.status, weather.status]
      });
    })
  );

  app.get(
    "/api/operations/overview",
    asyncRoute(async (_request, response) => {
      response.json(await getOperationsOverview());
    })
  );

  app.get(
    "/api/ops/dashboard",
    asyncRoute(async (_request, response) => {
      response.set("Cache-Control", "public, max-age=10");
      response.json(await getOpsDashboardPayload());
    })
  );

  app.get("/api/ops/investor-sim", (_request, response) => {
    response.set("Cache-Control", "public, max-age=60");
    response.json(getInvestorSimulationPayload());
  });

  app.post("/api/integrations/vehicle-telemetry", (request, response, next) => {
    try {
      const { samples } = vehicleTelemetryBatchSchema.parse(request.body ?? {});
      recordVehicleTelemetry(samples);
      clearBusSnapshotCache();
      response.status(202).json({ accepted: samples.length });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/integrations/seat-camera", (request, response, next) => {
    try {
      const { samples } = seatCameraBatchSchema.parse(request.body ?? {});
      recordSeatCameraSamples(samples);
      response.status(202).json({ accepted: samples.length });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/integrations/driver-monitor", (request, response, next) => {
    try {
      const { samples } = driverMonitorBatchSchema.parse(request.body ?? {});
      recordDriverMonitorSamples(samples);
      response.status(202).json({ accepted: samples.length });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/integrations/passenger-flow", (request, response, next) => {
    try {
      const { events } = passengerFlowBatchSchema.parse(request.body ?? {});
      recordPassengerFlowSamples(events);
      response.status(202).json({ accepted: events.length });
    } catch (error) {
      next(error);
    }
  });

  app.get(
    "/api/airport-guide",
    asyncRoute(async (request, response) => {
      const { destination } = airportGuideQuerySchema.parse({
        destination:
          typeof request.query.destination === "string" ? request.query.destination : undefined
      });

      response.json(await getAirportGuide(destination));
    })
  );

  app.get(
    "/api/decision-summary",
    asyncRoute(async (request, response) => {
      const { routeId, stopId } = decisionSummaryQuerySchema.parse(request.query);

      const stop = getStopById(routeId, stopId);

      if (!stop) {
        throw new HttpError(404, "not_found", "Stop not found");
      }

      const [vehiclePayload, traffic, weather] = await Promise.all([
        getVehiclesForRoute(routeId),
        getTrafficAdvisories(routeId),
        getWeatherAdvisories(routeId)
      ]);

      const [weatherResult, aqiResult] = await Promise.allSettled([
        getWeatherSnapshot(),
        getAqiSnapshot()
      ]);

      const weatherSnapshot =
        weatherResult.status === "fulfilled" ? weatherResult.value.snapshot : null;
      const aqiSnapshot = aqiResult.status === "fulfilled" ? aqiResult.value.snapshot : null;

      response.json(
        buildDecisionSummary(
          routeId,
          stop,
          vehiclePayload.vehicles,
          [...traffic.advisories, ...weather.advisories],
          [vehiclePayload.status, traffic.status, weather.status],
          weatherSnapshot,
          aqiSnapshot
        )
      );
    })
  );

  app.get("/api/compare", (_request, response) => {
    const daySeed = Math.floor(Date.now() / 86_400_000);
    const comparisons: PriceComparison[] = PRICE_COMPARISONS.map((comparison, index) => {
      const riders = 20 + ((daySeed * 7 + index * 13) % 60);
      return {
        ...comparison,
        savingsMin: comparison.taxi.minThb - comparison.bus.fareThb,
        savingsMax: comparison.taxi.maxThb - comparison.bus.fareThb,
        ridersToday: riders
      };
    });

    response.set("Cache-Control", "public, max-age=300");
    response.json(comparisons);
  });

  app.get(
    "/api/environment",
    asyncRoute(async (_request, response) => {
      const [weatherResult, aqiResult] = await Promise.allSettled([
        getWeatherSnapshot(),
        getAqiSnapshot()
      ]);
      const weather = weatherResult.status === "fulfilled" ? weatherResult.value.snapshot : null;
      const aqi = aqiResult.status === "fulfilled" ? aqiResult.value.snapshot : null;

      response.set("Cache-Control", "public, max-age=300");
      response.json({
        tempC: weather?.temperatureC ?? 31,
        precipMm: weather?.precipitation ?? 0,
        rainProb: weather?.precipitationProbability ?? 0,
        windKph: weather?.windSpeed ?? 8,
        aqi: aqi?.usAqi ?? 55,
        pm25: aqi?.pm25 ?? 18,
        conditionLabel: (weather?.precipitation ?? 0) > 0.5 ? "Rain" : "Clear",
        updatedAt: new Date().toISOString()
      });
    })
  );

  app.get("/api/ops/flights", (_request, response) => {
    response.set("Cache-Control", "public, max-age=60");
    const flights = getFlightSchedule();
    const arrivals = flights.filter((flight) => flight.type === "arrival");
    const departures = flights.filter((flight) => flight.type === "departure");
    response.json({ flights, arrivals, departures, nationalities: getNationalityBreakdown() });
  });

  app.get(
    "/api/ops/demand",
    asyncRoute(async (_request, response) => {
      const snapshot = await getBusSnapshot();
      const airportVehicles = snapshot.vehicles.filter(
        (vehicle) => vehicle.routeId === "rawai-airport"
      ).length;
      response.json(getDemandForecast(airportVehicles));
    })
  );

  app.get(
    "/api/ops/hourly-demand",
    asyncRoute(async (_request, response) => {
      const snapshot = await getBusSnapshot();
      const busesOnline = snapshot.vehicles.filter(
        (vehicle) => vehicle.routeId === "rawai-airport"
      ).length;
      response.set("Cache-Control", "public, max-age=60");
      response.json({
        points: getHourlyDemandProjection(BUS_SEAT_CAPACITY, Math.max(busesOnline, 6))
      });
    })
  );

  app.get(
    "/api/ops/weather",
    asyncRoute(async (_request, response) => {
      const [weatherResult, aqiResult] = await Promise.allSettled([
        getWeatherSnapshot(),
        getAqiSnapshot()
      ]);
      const weather = weatherResult.status === "fulfilled" ? weatherResult.value.snapshot : null;
      const aqi = aqiResult.status === "fulfilled" ? aqiResult.value.snapshot : null;

      const month = new Date().getMonth() + 1;
      const monsoonSeason = month >= 5 && month <= 10;
      const driverAlerts: string[] = [];

      if ((weather?.precipitation ?? 0) > 2) {
        driverAlerts.push("Heavy rain active — reduce speed, increase following distance");
      }
      if ((weather?.windSpeed ?? 0) > 40) {
        driverAlerts.push("Strong winds — caution on exposed coastal roads");
      }
      if ((weather?.precipitationProbability ?? 0) > 70) {
        driverAlerts.push("High rain probability next hours — prepare for wet roads");
      }
      if ((aqi?.usAqi ?? 0) > 100) {
        driverAlerts.push("Poor air quality — keep windows closed, run AC recirculation");
      }
      if (monsoonSeason && (weather?.precipitationProbability ?? 0) > 50) {
        driverAlerts.push(
          "Monsoon season flash flood risk — avoid low-lying routes if water rises"
        );
      }

      const currentHour = new Date().getHours();
      const forecast = Array.from({ length: 12 }, (_, index) => {
        const hour = (currentHour + index) % 24;
        const isAfternoon = hour >= 13 && hour <= 17;
        const baseRain = weather?.precipitationProbability ?? 20;
        const rainVariation = monsoonSeason ? (isAfternoon ? 30 : 10) : isAfternoon ? 15 : 0;

        return {
          hour: `${String(hour).padStart(2, "0")}:00`,
          tempC: Math.round(
            (weather?.temperatureC ?? 31) + (isAfternoon ? 2 : -1) + Math.sin(hour / 3) * 1.5
          ),
          rainProb: Math.min(
            100,
            Math.max(0, baseRain + rainVariation + Math.round(Math.sin(hour / 4) * 10))
          ),
          precipMm: Math.max(0, (weather?.precipitation ?? 0) * (isAfternoon ? 1.5 : 0.5)),
          windKph: Math.round((weather?.windSpeed ?? 8) + Math.sin(hour / 6) * 5),
          code: weather?.weatherCode ?? 0
        };
      });

      response.set("Cache-Control", "public, max-age=300");
      response.json({
        current: {
          tempC: weather?.temperatureC ?? 31,
          rainProb: weather?.precipitationProbability ?? 20,
          precipMm: weather?.precipitation ?? 0,
          windKph: weather?.windSpeed ?? 8,
          aqi: aqi?.usAqi ?? 55,
          pm25: aqi?.pm25 ?? 18
        },
        forecast,
        monsoonSeason,
        monsoonNote: monsoonSeason
          ? "Southwest monsoon season (May-Oct). Expect afternoon storms, brief heavy showers, and higher seas. Ferry services may be disrupted."
          : "Dry season (Nov-Apr). Generally clear skies with occasional brief showers. Ideal operating conditions.",
        driverAlerts
      });
    })
  );

  app.get("/api/vehicle-history", (_request, response) => {
    const history = readRecentHistory();
    response.json({ history, count: history.length });
  });

  app.get("/api/db-snapshot", (_request, response) => {
    const vehicles = readAllVehicles();
    response.json({ vehicles, count: vehicles.length, source: "sqlite" });
  });

  app.use("/api", (_request, _response, next) => {
    next(new HttpError(404, "not_found", "API endpoint not found"));
  });

  app.use(express.static(clientDir));
  app.get("*", (_request, response) => {
    response.sendFile(path.join(clientDir, "index.html"));
  });

  app.use(errorHandler);

  return app;
}
