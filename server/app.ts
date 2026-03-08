import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getRoutes, getStopById, getStopsForRoute } from "./services/routes.js";
import { getBusSnapshot, getVehiclesForRoute } from "./services/providers/busProvider.js";
import { getTrafficAdvisories } from "./services/providers/trafficProvider.js";
import { getWeatherAdvisories, getWeatherSnapshot } from "./services/providers/weatherProvider.js";
import { buildDecisionSummary } from "./services/decisionEngine.js";
import type { HealthPayload, RouteId } from "../shared/types.js";

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
