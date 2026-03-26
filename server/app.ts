import compression from "compression";
import cors from "cors";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getRoutes, getStopById, getStopsForRoute } from "./services/routes.js";
import { clearBusSnapshotCache, getBusSnapshot, getVehiclesForRoute } from "./services/providers/busProvider.js";
import { getTrafficAdvisories } from "./services/providers/trafficProvider.js";
import { getWeatherAdvisories, getWeatherSnapshot } from "./services/providers/weatherProvider.js";
import { getAqiSnapshot } from "./services/providers/aqiProvider.js";
import { buildDecisionSummary } from "./services/decisionEngine.js";
import { getAirportGuide } from "./services/airportGuide.js";
import { getFlightSchedule, getDemandForecast } from "./services/providers/flightProvider.js";
import { readRecentHistory, readAllVehicles } from "./lib/db.js";
import { getOperationsOverview } from "./services/operationsService.js";
import {
  recordDriverMonitorSamples,
  recordPassengerFlowSamples,
  recordSeatCameraSamples,
  recordVehicleTelemetry
} from "./services/operationsStore.js";
import { PRICE_COMPARISONS } from "./config.js";
import type {
  DriverMonitorSample,
  HealthPayload,
  PriceComparison,
  PassengerFlowSample,
  RouteId,
  SeatCameraSample,
  VehicleTelemetrySample
} from "../shared/types.js";

const validRoutes = new Set<RouteId>([
  "rawai-airport",
  "patong-old-bus-station",
  "dragon-line",
  "rassada-phi-phi",
  "rassada-ao-nang",
  "bang-rong-koh-yao",
  "chalong-racha"
]);

function isRouteId(value: string): value is RouteId {
  return validRoutes.has(value as RouteId);
}

async function collectSourceStatuses() {
  const busSnapshot = await getBusSnapshot();
  const traffic = await getTrafficAdvisories("rawai-airport");
  const weather = await getWeatherSnapshot();

  return [busSnapshot.status, traffic.status, weather.status];
}

export function createApp() {
  const app = express();
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const sourceClientDir = path.resolve(currentDir, "../client");
  const builtClientDir = path.resolve(currentDir, "../../client");
  const clientDir = fs.existsSync(sourceClientDir) ? sourceClientDir : builtClientDir;

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(compression());
  app.use(cors());
  app.use(express.json());

  app.get("/api/health", async (_request, response) => {
    try {
      const sources = await collectSourceStatuses();
      const payload: HealthPayload = {
        status: sources.every((source) => source.state === "live") ? "ok" : "degraded",
        checkedAt: new Date().toISOString(),
        sources
      };

      response.json(payload);
    } catch {
      response.json({
        status: "degraded",
        checkedAt: new Date().toISOString(),
        sources: []
      } satisfies HealthPayload);
    }
  });

  app.get("/api/routes", async (_request, response) => {
    const snapshot = await getBusSnapshot();
    const activeVehicles = Object.fromEntries(
      Array.from(validRoutes).map((routeId) => [
        routeId,
        snapshot.vehicles.filter((vehicle) => vehicle.routeId === routeId).length
      ])
    ) as Record<RouteId, number>;

    response.set("Cache-Control", "public, max-age=10");
    response.json(getRoutes(snapshot.status, activeVehicles));
  });

  app.get("/api/routes/:routeId/stops", (request, response) => {
    if (!isRouteId(request.params.routeId)) {
      response.status(404).json({ error: "Unknown route" });
      return;
    }

    response.set("Cache-Control", "public, max-age=60");
    response.json(getStopsForRoute(request.params.routeId));
  });

  app.get("/api/vehicles/all", async (_request, response) => {
    const snapshot = await getBusSnapshot();
    response.json({
      vehicles: snapshot.vehicles,
      updatedAt: new Date().toISOString()
    });
  });

  app.get("/api/routes/:routeId/vehicles", async (request, response) => {
    if (!isRouteId(request.params.routeId)) {
      response.status(404).json({ error: "Unknown route" });
      return;
    }

    const payload = await getVehiclesForRoute(request.params.routeId);
    response.json(payload);
  });

  app.get("/api/routes/:routeId/advisories", async (request, response) => {
    if (!isRouteId(request.params.routeId)) {
      response.status(404).json({ error: "Unknown route" });
      return;
    }

    const [traffic, weather] = await Promise.all([
      getTrafficAdvisories(request.params.routeId),
      getWeatherAdvisories(request.params.routeId)
    ]);

    response.json({
      advisories: [...traffic.advisories, ...weather.advisories],
      sourceStatuses: [traffic.status, weather.status]
    });
  });

  app.get("/api/operations/overview", async (_request, response) => {
    response.json(await getOperationsOverview());
  });

  app.post("/api/integrations/vehicle-telemetry", (request, response) => {
    const samples = request.body?.samples;

    if (!Array.isArray(samples)) {
      response.status(400).json({ error: "samples array is required" });
      return;
    }

    recordVehicleTelemetry(samples as VehicleTelemetrySample[]);
    clearBusSnapshotCache();
    response.status(202).json({ accepted: samples.length });
  });

  app.post("/api/integrations/seat-camera", (request, response) => {
    const samples = request.body?.samples;

    if (!Array.isArray(samples)) {
      response.status(400).json({ error: "samples array is required" });
      return;
    }

    recordSeatCameraSamples(samples as SeatCameraSample[]);
    response.status(202).json({ accepted: samples.length });
  });

  app.post("/api/integrations/driver-monitor", (request, response) => {
    const samples = request.body?.samples;

    if (!Array.isArray(samples)) {
      response.status(400).json({ error: "samples array is required" });
      return;
    }

    recordDriverMonitorSamples(samples as DriverMonitorSample[]);
    response.status(202).json({ accepted: samples.length });
  });

  app.post("/api/integrations/passenger-flow", (request, response) => {
    const events = request.body?.events;

    if (!Array.isArray(events)) {
      response.status(400).json({ error: "events array is required" });
      return;
    }

    recordPassengerFlowSamples(events as PassengerFlowSample[]);
    response.status(202).json({ accepted: events.length });
  });

  app.get("/api/airport-guide", async (request, response) => {
    const destination =
      typeof request.query.destination === "string" ? request.query.destination : "";

    response.json(await getAirportGuide(destination));
  });

  app.get("/api/decision-summary", async (request, response) => {
    const routeId = request.query.routeId;
    const stopId = request.query.stopId;

    if (typeof routeId !== "string" || !isRouteId(routeId) || typeof stopId !== "string") {
      response.status(400).json({ error: "routeId and stopId are required" });
      return;
    }

    const stop = getStopById(routeId, stopId);

    if (!stop) {
      response.status(404).json({ error: "Stop not found" });
      return;
    }

    try {
      const [vehiclePayload, traffic, weather] = await Promise.all([
        getVehiclesForRoute(routeId),
        getTrafficAdvisories(routeId),
        getWeatherAdvisories(routeId)
      ]);

      const [weatherResult, aqiResult] = await Promise.allSettled([
        getWeatherSnapshot(),
        getAqiSnapshot()
      ]);

      const weatherSnapshot = weatherResult.status === "fulfilled" ? weatherResult.value.snapshot : null;
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
    } catch {
      response.status(500).json({ error: "Decision summary unavailable" });
    }
  });

  app.get("/api/compare", (_request, response) => {
    // Date-seeded simulated rider count for social proof
    const daySeed = Math.floor(Date.now() / 86_400_000);
    const comparisons: PriceComparison[] = PRICE_COMPARISONS.map((c, i) => {
      const riders = 20 + ((daySeed * 7 + i * 13) % 60);
      return {
        ...c,
        savingsMin: c.taxi.minThb - c.bus.fareThb,
        savingsMax: c.taxi.maxThb - c.bus.fareThb,
        ridersToday: riders,
      };
    });
    response.set("Cache-Control", "public, max-age=300");
    response.json(comparisons);
  });

  // --- Environment (weather + AQI combined) ---
  app.get("/api/environment", async (_request, response) => {
    try {
      const [weatherResult, aqiResult] = await Promise.allSettled([
        getWeatherSnapshot(),
        getAqiSnapshot()
      ]);
      const weather = weatherResult.status === "fulfilled" ? weatherResult.value.snapshot : null;
      const aqi = aqiResult.status === "fulfilled" ? aqiResult.value.snapshot : null;

      response.set("Cache-Control", "public, max-age=300");
      response.json({
        tempC: 31, // temperature not stored in snapshot; use Phuket average
        precipMm: weather?.precipitation ?? 0,
        rainProb: weather?.precipitationProbability ?? 0,
        windKph: weather?.windSpeed ?? 8,
        aqi: aqi?.usAqi ?? 55,
        pm25: aqi?.pm25 ?? 18,
        conditionLabel: (weather?.precipitation ?? 0) > 0.5 ? "Rain" : "Clear",
        updatedAt: new Date().toISOString()
      });
    } catch {
      response.json({
        tempC: 31, precipMm: 0, rainProb: 10, windKph: 8,
        aqi: 55, pm25: 18, conditionLabel: "Clear",
        updatedAt: new Date().toISOString()
      });
    }
  });

  // --- Operator: Flight schedule ---
  app.get("/api/ops/flights", (_request, response) => {
    response.set("Cache-Control", "public, max-age=60");
    response.json({ flights: getFlightSchedule() });
  });

  // --- Operator: Demand forecast ---
  app.get("/api/ops/demand", async (_request, response) => {
    try {
      const snapshot = await getBusSnapshot();
      const airportVehicles = snapshot.vehicles.filter(v => v.routeId === "rawai-airport").length;
      response.json(getDemandForecast(airportVehicles));
    } catch {
      response.json(getDemandForecast(0));
    }
  });

  app.get("/api/vehicle-history", (_request, response) => {
    try {
      const history = readRecentHistory();
      response.json({ history, count: history.length });
    } catch {
      response.json({ history: [], count: 0 });
    }
  });

  app.get("/api/db-snapshot", (_request, response) => {
    try {
      const vehicles = readAllVehicles();
      response.json({ vehicles, count: vehicles.length, source: "sqlite" });
    } catch {
      response.json({ vehicles: [], count: 0, source: "sqlite" });
    }
  });

  app.use(express.static(clientDir));
  app.get("*", (_request, response) => {
    response.sendFile(path.join(clientDir, "index.html"));
  });

  return app;
}
