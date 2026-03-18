import cors from "cors";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getRoutes, getStopById, getStopsForRoute } from "./services/routes.js";
import { clearBusSnapshotCache, getBusSnapshot, getVehiclesForRoute } from "./services/providers/busProvider.js";
import { getTrafficAdvisories } from "./services/providers/trafficProvider.js";
import { getWeatherAdvisories, getWeatherSnapshot } from "./services/providers/weatherProvider.js";
import { buildDecisionSummary } from "./services/decisionEngine.js";
import { getAirportGuide } from "./services/airportGuide.js";
import { getOperationsOverview } from "./services/operationsService.js";
import {
  recordDriverMonitorSamples,
  recordPassengerFlowSamples,
  recordSeatCameraSamples,
  recordVehicleTelemetry
} from "./services/operationsStore.js";
import type {
  DriverMonitorSample,
  HealthPayload,
  PassengerFlowSample,
  RouteId,
  SeatCameraSample,
  VehicleTelemetrySample
} from "../shared/types.js";

const validRoutes = new Set<RouteId>([
  "rawai-airport",
  "patong-old-bus-station",
  "dragon-line"
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
  app.use(cors());
  app.use(express.json());

  app.get("/api/health", async (_request, response) => {
    const sources = await collectSourceStatuses();
    const payload: HealthPayload = {
      status: sources.every((source) => source.state === "live") ? "ok" : "degraded",
      checkedAt: new Date().toISOString(),
      sources
    };

    response.json(payload);
  });

  app.get("/api/routes", async (_request, response) => {
    const snapshot = await getBusSnapshot();
    const activeVehicles = Object.fromEntries(
      Array.from(validRoutes).map((routeId) => [
        routeId,
        snapshot.vehicles.filter((vehicle) => vehicle.routeId === routeId).length
      ])
    ) as Record<RouteId, number>;

    response.json(getRoutes(snapshot.status, activeVehicles));
  });

  app.get("/api/routes/:routeId/stops", (request, response) => {
    if (!isRouteId(request.params.routeId)) {
      response.status(404).json({ error: "Unknown route" });
      return;
    }

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

    const [vehiclePayload, traffic, weather] = await Promise.all([
      getVehiclesForRoute(routeId),
      getTrafficAdvisories(routeId),
      getWeatherAdvisories(routeId)
    ]);

    response.json(
      buildDecisionSummary(routeId, stop, vehiclePayload.vehicles, [...traffic.advisories, ...weather.advisories], [
        vehiclePayload.status,
        traffic.status,
        weather.status
      ])
    );
  });

  app.use(express.static(clientDir));
  app.get("*", (_request, response) => {
    response.sendFile(path.join(clientDir, "index.html"));
  });

  return app;
}
