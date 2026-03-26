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
import { getFlightSchedule, getDemandForecast, getHourlyDemandProjection } from "./services/providers/flightProvider.js";
import { readRecentHistory, readAllVehicles } from "./lib/db.js";
import { buildScheduleMockFleet } from "./services/providers/mockFleetProvider.js";
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

  // Easter egg: simulation endpoint — returns vehicles at a specific simulated time
  app.get("/api/simulate", (request, response) => {
    const simMinutes = Number(request.query.t); // minutes since midnight (0-1440)
    if (isNaN(simMinutes) || simMinutes < 0 || simMinutes > 1440) {
      response.status(400).json({ error: "t must be 0-1440 (minutes since midnight)" });
      return;
    }
    // Build a Date for today at the given Bangkok time
    const now = new Date();
    const bangkokOffset = 7 * 60; // UTC+7
    const utcMidnight = new Date(now.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }) + "T00:00:00Z");
    const simDate = new Date(utcMidnight.getTime() + (simMinutes - bangkokOffset) * 60_000);
    const vehicles = buildScheduleMockFleet(simDate);
    response.json({ vehicles, simMinutes, simTime: `${String(Math.floor(simMinutes / 60)).padStart(2, "0")}:${String(simMinutes % 60).padStart(2, "0")}` });
  });

  // --- Demand request system ---
  const demandRequests: Array<{ lat: number; lng: number; zone: string; ts: number }> = [];
  const DEMAND_ZONES = [
    { name: "Central Patong", lat: 7.8961, lng: 98.2969 },
    { name: "Kata Beach", lat: 7.8205, lng: 98.2976 },
    { name: "Karon Beach", lat: 7.8425, lng: 98.2948 },
    { name: "Phuket Town", lat: 7.8804, lng: 98.3923 },
    { name: "Rawai", lat: 7.7734, lng: 98.3258 },
    { name: "Airport", lat: 8.1132, lng: 98.3169 },
    { name: "Chalong", lat: 7.8379, lng: 98.3398 },
    { name: "Surin Beach", lat: 7.9765, lng: 98.2798 },
  ];

  function findZone(lat: number, lng: number): string {
    let best = DEMAND_ZONES[0]!.name;
    let bestDist = Infinity;
    for (const z of DEMAND_ZONES) {
      const d = Math.sqrt((z.lat - lat) ** 2 + (z.lng - lng) ** 2);
      if (d < bestDist) { bestDist = d; best = z.name; }
    }
    return best;
  }

  app.post("/api/demand-request", (request, response) => {
    const { lat, lng } = request.body ?? {};
    if (typeof lat !== "number" || typeof lng !== "number") {
      response.status(400).json({ error: "lat and lng required" });
      return;
    }
    const zone = findZone(lat, lng);
    demandRequests.push({ lat, lng, zone, ts: Date.now() });
    // Keep only last hour
    const cutoff = Date.now() - 3600_000;
    while (demandRequests.length > 0 && demandRequests[0]!.ts < cutoff) demandRequests.shift();
    const total = demandRequests.filter(r => r.zone === zone).length;
    response.json({ success: true, zone, totalRequests: total });
  });

  app.get("/api/ops/demand-requests", (_request, response) => {
    const cutoff = Date.now() - 3600_000;
    while (demandRequests.length > 0 && demandRequests[0]!.ts < cutoff) demandRequests.shift();
    const counts = new Map<string, number>();
    for (const r of demandRequests) counts.set(r.zone, (counts.get(r.zone) ?? 0) + 1);
    const hotspots = DEMAND_ZONES.map(z => ({
      location: z.name,
      lat: z.lat,
      lng: z.lng,
      requestCount: counts.get(z.name) ?? 0,
      covered: (counts.get(z.name) ?? 0) < 5
    })).filter(h => h.requestCount > 0).sort((a, b) => b.requestCount - a.requestCount);
    response.json({ hotspots, totalRequests: demandRequests.length });
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
        tempC: weather?.temperatureC ?? 31,
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

  // --- Operator: Hourly demand projection ---
  app.get("/api/ops/hourly-demand", async (_request, response) => {
    try {
      const snapshot = await getBusSnapshot();
      const busesOnline = snapshot.vehicles.filter(v => v.routeId === "rawai-airport").length;
      response.set("Cache-Control", "public, max-age=60");
      response.json({ points: getHourlyDemandProjection(40, Math.max(busesOnline, 6)) });
    } catch {
      response.json({ points: [] });
    }
  });

  // --- Operator: Weather intelligence ---
  app.get("/api/ops/weather", async (_request, response) => {
    try {
      const [weatherResult, aqiResult] = await Promise.allSettled([
        getWeatherSnapshot(),
        getAqiSnapshot()
      ]);
      const weather = weatherResult.status === "fulfilled" ? weatherResult.value.snapshot : null;
      const aqi = aqiResult.status === "fulfilled" ? aqiResult.value.snapshot : null;

      // Phuket monsoon: May-October (southwest monsoon), Nov-April (dry/northeast)
      const month = new Date().getMonth() + 1; // 1-12
      const monsoonSeason = month >= 5 && month <= 10;
      const driverAlerts: string[] = [];

      if ((weather?.precipitation ?? 0) > 2) driverAlerts.push("Heavy rain active — reduce speed, increase following distance");
      if ((weather?.windSpeed ?? 0) > 40) driverAlerts.push("Strong winds — caution on exposed coastal roads");
      if ((weather?.precipitationProbability ?? 0) > 70) driverAlerts.push("High rain probability next hours — prepare for wet roads");
      if ((aqi?.usAqi ?? 0) > 100) driverAlerts.push("Poor air quality — keep windows closed, run AC recirculation");
      if (monsoonSeason && (weather?.precipitationProbability ?? 0) > 50) driverAlerts.push("Monsoon season flash flood risk — avoid low-lying routes if water rises");

      // Generate 12-hour forecast (mock based on current + patterns)
      const currentHour = new Date().getHours();
      const forecast = Array.from({ length: 12 }, (_, i) => {
        const hour = (currentHour + i) % 24;
        const isAfternoon = hour >= 13 && hour <= 17;
        const baseRain = weather?.precipitationProbability ?? 20;
        const rainVariation = monsoonSeason ? (isAfternoon ? 30 : 10) : (isAfternoon ? 15 : 0);
        return {
          hour: `${String(hour).padStart(2, "0")}:00`,
          tempC: Math.round((weather?.temperatureC ?? 31) + (isAfternoon ? 2 : -1) + (Math.sin(hour / 3) * 1.5)),
          rainProb: Math.min(100, Math.max(0, baseRain + rainVariation + Math.round(Math.sin(hour / 4) * 10))),
          precipMm: Math.max(0, (weather?.precipitation ?? 0) * (isAfternoon ? 1.5 : 0.5)),
          windKph: Math.round((weather?.windSpeed ?? 8) + Math.sin(hour / 6) * 5),
          code: weather?.weatherCode ?? 0
        };
      });

      const monsoonNote = monsoonSeason
        ? "Southwest monsoon season (May-Oct). Expect afternoon storms, brief heavy showers, and higher seas. Ferry services may be disrupted."
        : "Dry season (Nov-Apr). Generally clear skies with occasional brief showers. Ideal operating conditions.";

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
        monsoonNote,
        driverAlerts
      });
    } catch {
      response.json({
        current: { tempC: 31, rainProb: 20, precipMm: 0, windKph: 8, aqi: 55, pm25: 18 },
        forecast: [],
        monsoonSeason: false,
        monsoonNote: "Weather data temporarily unavailable.",
        driverAlerts: []
      });
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
