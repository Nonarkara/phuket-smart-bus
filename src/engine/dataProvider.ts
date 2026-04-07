/**
 * Client-side data provider that replaces all server API endpoints.
 * Every function returns Promise<T> to maintain the same interface as api.ts.
 * Under the hood, everything is computed synchronously from schedules + current time.
 */

import type {
  Advisory,
  AirportGuidePayload,
  CompetitorBenchmark,
  DataSourceStatus,
  DecisionSummary,
  DemandForecast,
  EnvironmentSnapshot,
  FlightInfo,
  HealthPayload,
  HourlyDemandPoint,
  InvestorSimulationPayload,
  OperationalRouteId,
  OperationsOverviewPayload,
  OpsDashboardPayload,
  PriceComparison,
  Route,
  RouteId,
  SimulationSnapshot,
  Stop,
  VehiclePosition,
  WeatherIntelligence
} from "@shared/types";
import {
  BUS_SEAT_CAPACITY,
  INVESTOR_FLAT_FARE_THB,
  ADDRESSABLE_DEMAND_SHARE,
  REPLAY_STEP_MINUTES,
  REPLAY_START_MINUTES,
  REPLAY_END_MINUTES
} from "@shared/productConfig";
import { buildScheduleMockFleet, getMockFleetSummary } from "./fleetSimulator";
import { getRoutes as getRoutesEngine, getStopsForRoute, getStopById } from "./routes";
import { buildDecisionSummary, estimateSeatAvailability } from "./decisionEngine";
import { getTransferHubs } from "./transferHubs";
import {
  getEnvironmentSnapshot,
  getWeatherIntelligence,
  getWeatherAdvisories,
  getTrafficAdvisories,
  getSeasonalMultiplier,
  isHighSeason
} from "./environmentSimulator";
import { getImpactMetrics } from "./impactSimulator";
import { APP_VERSION, PRICE_COMPARISONS, ROUTE_DEFINITIONS, COMPETITOR_BENCHMARKS, OPERATIONAL_ROUTE_IDS, FERRY_ROUTE_IDS } from "./config";
import { text } from "./i18n";
import { haversineDistanceMeters } from "./geo";
import { getBangkokNowMinutes } from "./time";

function makeBusSourceStatus(now = new Date()): DataSourceStatus {
  return {
    source: "bus",
    state: "live",
    updatedAt: now.toISOString(),
    detail: text("Schedule-based simulation active", "การจำลองจากตารางเวลาเปิดใช้งาน"),
    freshnessSeconds: 0,
    fallbackReason: null
  };
}

function makeSourceStatuses(now = new Date()): DataSourceStatus[] {
  return [
    makeBusSourceStatus(now),
    { source: "traffic", state: "live", updatedAt: now.toISOString(), detail: text("Traffic intelligence active", "ข่าวกรองจราจรเปิดใช้งาน"), freshnessSeconds: 0, fallbackReason: null },
    { source: "weather", state: "live", updatedAt: now.toISOString(), detail: text("Seasonal weather model", "โมเดลสภาพอากาศตามฤดูกาล"), freshnessSeconds: 0, fallbackReason: null },
    { source: "aqi", state: "live", updatedAt: now.toISOString(), detail: text("Air quality model active", "โมเดลคุณภาพอากาศเปิดใช้งาน"), freshnessSeconds: 0, fallbackReason: null }
  ];
}

// --- Public API (same signatures as api.ts) ---

export function getHealth(): Promise<HealthPayload> {
  return Promise.resolve({
    status: "ok",
    checkedAt: new Date().toISOString(),
    mode: "demo",
    appVersion: APP_VERSION,
    database: { available: false, writable: false, mode: "memory", path: null },
    worker: { status: "ok", updatedAt: new Date().toISOString(), maxAgeMs: 90000 },
    sources: makeSourceStatuses().map((s) => ({ ...s, critical: s.source === "bus", demoOnly: false }))
  });
}

export function getRoutes(): Promise<Route[]> {
  const now = new Date();
  const { activeByRoute } = getMockFleetSummary(now);
  return Promise.resolve(getRoutesEngine(makeBusSourceStatus(now), activeByRoute));
}

export function getStops(routeId: RouteId): Promise<Stop[]> {
  return Promise.resolve(getStopsForRoute(routeId as OperationalRouteId));
}

export function getVehicles(routeId: RouteId): Promise<{ vehicles: VehiclePosition[] }> {
  const vehicles = buildScheduleMockFleet().filter((v) => v.routeId === routeId);
  return Promise.resolve({ vehicles });
}

export function getAdvisories(routeId: RouteId): Promise<{ advisories: Advisory[] }> {
  const now = new Date();
  const weather = getWeatherAdvisories(now);
  const traffic = getTrafficAdvisories(routeId, now);
  return Promise.resolve({ advisories: [...weather.advisories, ...traffic.advisories] });
}

export function getDecisionSummary(routeId: RouteId, stopId: string): Promise<DecisionSummary> {
  const now = new Date();
  const stop = getStopById(routeId as OperationalRouteId, stopId);
  if (!stop) {
    return Promise.resolve({} as DecisionSummary);
  }
  const vehicles = buildScheduleMockFleet(now).filter((v) => v.routeId === routeId);
  const weather = getWeatherAdvisories(now);
  const traffic = getTrafficAdvisories(routeId, now);
  const advisories = [...weather.advisories, ...traffic.advisories];
  const env = getEnvironmentSnapshot(now);
  const sourceStatuses = makeSourceStatuses(now);

  return Promise.resolve(buildDecisionSummary(
    routeId as OperationalRouteId,
    stop,
    vehicles,
    advisories,
    sourceStatuses,
    { temperatureC: env.tempC, precipitationMm: env.precipMm, precipitationProbability: env.rainProb, windSpeedKmh: env.windKph, usAqi: env.aqi, pm25: env.pm25 }
  ));
}

export function getAirportGuide(destination = ""): Promise<AirportGuidePayload> {
  const now = new Date();
  const AIRPORT_ROUTE_ID: OperationalRouteId = "rawai-airport";
  const airportStop = getStopsForRoute(AIRPORT_ROUTE_ID).find((s) => s.name.en === "Phuket Airport") ?? getStopsForRoute(AIRPORT_ROUTE_ID)[0];
  const vehicles = buildScheduleMockFleet(now).filter((v) => v.routeId === AIRPORT_ROUTE_ID);
  const env = getEnvironmentSnapshot(now);

  const nearbyVehicle = vehicles.length
    ? [...vehicles].sort((a, b) => haversineDistanceMeters(a.coordinates, airportStop.coordinates) - haversineDistanceMeters(b.coordinates, airportStop.coordinates))[0]
    : null;
  const boardingVehicle = nearbyVehicle && haversineDistanceMeters(nearbyVehicle.coordinates, airportStop.coordinates) <= 260 ? nearbyVehicle : null;

  return Promise.resolve({
    destinationQuery: destination,
    recommendation: "ready",
    headline: text("A bus is running from the airport", "มีรถบัสวิ่งออกจากสนามบิน"),
    summary: text("Search a beach, hotel belt, or landmark.", "พิมพ์ชื่อหาด ย่านโรงแรม หรือจุดสังเกต"),
    fareComparison: { busFareThb: 100, taxiFareEstimateThb: 1000, savingsThb: 900, savingsCopy: text("Save about 900 THB versus a typical airport taxi ride.", "ประหยัดได้ประมาณ 900 บาทเมื่อเทียบกับแท็กซี่จากสนามบินทั่วไป") },
    boardingWalk: {
      primaryInstruction: text("Turn left after you come out and head to the Smart Bus stop by Cafe Amazon.", "เมื่อออกมาด้านนอกแล้วให้เลี้ยวซ้ายและเดินไปที่ป้าย Smart Bus ข้าง Cafe Amazon"),
      secondaryInstruction: text("Use exit 3, cross to the Cafe Amazon side.", "ใช้ทางออก 3 ข้ามไปฝั่ง Cafe Amazon"),
      focusStopId: airportStop.id
    },
    weatherSummary: {
      conditionLabel: text(env.conditionLabel, env.conditionLabel),
      currentPrecipitation: env.precipMm,
      maxRainProbability: env.rainProb,
      recommendation: env.rainProb > 60 ? text("Bring an umbrella.", "พกร่ม") : text("Clear conditions expected.", "คาดว่าอากาศจะดี"),
      severity: env.precipMm >= 3 ? "warning" : env.rainProb >= 70 ? "caution" : "info"
    },
    bestMatch: null,
    matches: [],
    nextDeparture: {
      routeId: AIRPORT_ROUTE_ID,
      routeName: ROUTE_DEFINITIONS[AIRPORT_ROUTE_ID].shortName,
      label: boardingVehicle ? "Boarding now" : airportStop.nextBus.label,
      minutesUntil: boardingVehicle ? 0 : airportStop.nextBus.minutesUntil,
      basis: boardingVehicle ? "live" : airportStop.nextBus.basis,
      state: boardingVehicle ? "boarding" : "scheduled",
      liveBusId: boardingVehicle?.vehicleId ?? null,
      liveLicensePlate: boardingVehicle?.licensePlate ?? null,
      seats: estimateSeatAvailability(boardingVehicle)
    },
    followingDepartures: airportStop.timetable.nextDepartures.slice(0, 3),
    airportBoardingLabel: text("Board opposite Cafe Amazon", "ขึ้นรถฝั่งตรงข้าม Cafe Amazon"),
    boardingNotes: [
      text("International arrivals: follow the signs to the domestic side before exiting.", "ผู้โดยสารขาเข้าระหว่างประเทศให้เดินตามป้ายไปยังฝั่งอาคารในประเทศก่อนออกมา"),
      text("Go to exit 3 and wait opposite Cafe Amazon.", "ไปที่ทางออก 3 แล้วรอที่ป้าย Smart Bus ฝั่งตรงข้าม Cafe Amazon"),
      text("Be ready 10 to 15 minutes early.", "ควรมารอก่อนเวลา 10 ถึง 15 นาที")
    ],
    quickDestinations: [],
    sourceStatuses: makeSourceStatuses(now),
    checkedAt: now.toISOString()
  });
}

export function getCompare(): Promise<PriceComparison[]> {
  const now = new Date();
  const month = now.getMonth() + 1;
  const seasonal = getSeasonalMultiplier(month);
  const impact = getImpactMetrics(buildScheduleMockFleet(now).length, now);

  return Promise.resolve(PRICE_COMPARISONS.map((p) => ({
    ...p,
    savingsMin: p.tukTuk.minThb - p.bus.fareThb,
    savingsMax: p.taxi.maxThb - p.bus.fareThb,
    ridersToday: Math.round((impact.ridersToday / 6) * (p.destinationId === "airport" ? 1.5 : 1) * seasonal / seasonal)
  })));
}

export function getEnvironment(): Promise<EnvironmentSnapshot> {
  return Promise.resolve(getEnvironmentSnapshot());
}

export function getOpsOverview(): Promise<OperationsOverviewPayload> {
  const now = new Date();
  const vehicles = buildScheduleMockFleet(now);
  const routes = OPERATIONAL_ROUTE_IDS.filter((id) => !FERRY_ROUTE_IDS.includes(id)).map((routeId) => {
    const rv = vehicles.filter((v) => v.routeId === routeId);
    return {
      routeId,
      routeName: ROUTE_DEFINITIONS[routeId].name,
      shortName: ROUTE_DEFINITIONS[routeId].shortName,
      axisLabel: ROUTE_DEFINITIONS[routeId].axisLabel,
      tier: ROUTE_DEFINITIONS[routeId].tier,
      vehiclesOnline: rv.length,
      gpsDevicesLive: rv.length,
      seatCamerasLive: 0,
      seatsLeftVisible: null,
      occupiedSeatsVisible: null,
      boardingsLastHour: Math.round(rv.length * 8),
      alightingsLastHour: Math.round(rv.length * 7),
      driverAttentionLive: rv.length,
      driverAttentionWarnings: 0,
      lastEventAt: now.toISOString()
    };
  });

  return Promise.resolve({ checkedAt: now.toISOString(), routes, recentEvents: [] });
}

export function getOpsFlights(): Promise<{ flights: FlightInfo[] }> {
  const now = new Date();
  const currentHour = Math.floor(getBangkokNowMinutes(now) / 60);
  const flights: FlightInfo[] = [];

  for (let h = Math.max(6, currentHour - 1); h <= Math.min(23, currentHour + 3); h++) {
    const pax = 150 + Math.round(Math.sin((h - 6) * Math.PI / 17) * 120);
    flights.push({
      flightNo: `TG${100 + h}`,
      airline: "Thai Airways",
      origin: h % 3 === 0 ? "Bangkok (BKK)" : h % 3 === 1 ? "Singapore (SIN)" : "Kuala Lumpur (KUL)",
      scheduledTime: `${String(h).padStart(2, "0")}:${h % 2 === 0 ? "30" : "00"}`,
      estimatedPax: pax,
      type: h % 2 === 0 ? "arrival" : "departure"
    });
  }

  return Promise.resolve({ flights });
}

export async function getOpsDemand(): Promise<DemandForecast> {
  const now = new Date();
  const currentHour = Math.floor(getBangkokNowMinutes(now) / 60);
  const vehicles = buildScheduleMockFleet(now);
  const seasonal = getSeasonalMultiplier(now.getMonth() + 1);

  return {
    currentHour: `${String(currentHour).padStart(2, "0")}:00`,
    arrivalsNext2h: Math.round(300 * seasonal),
    estimatedPaxNext2h: Math.round(450 * seasonal),
    busDemandEstimate: Math.round(68 * seasonal),
    currentFleetOnline: vehicles.length,
    recommendedFleet: Math.round(vehicles.length * 1.2),
    recommendation: vehicles.length >= Math.round(vehicles.length * 1.1) ? "Fleet coverage adequate" : "Consider deploying additional buses",
    flights: (await getOpsFlights()).flights
  };
}

export function getAllVehicles(): Promise<{ vehicles: VehiclePosition[]; updatedAt: string }> {
  const now = new Date();
  return Promise.resolve({ vehicles: buildScheduleMockFleet(now), updatedAt: now.toISOString() });
}

export function getOpsWeather(): Promise<WeatherIntelligence> {
  return Promise.resolve(getWeatherIntelligence());
}

export function getOpsHourlyDemand(): Promise<{ points: HourlyDemandPoint[] }> {
  const now = new Date();
  const seasonal = getSeasonalMultiplier(now.getMonth() + 1);
  const vehicles = buildScheduleMockFleet(now);
  const busesPerHour = vehicles.filter((v) => !FERRY_ROUTE_IDS.includes(v.routeId)).length;
  const hourlyDemand = [0, 0, 0, 0, 0, 0, 180, 320, 480, 520, 440, 380, 360, 400, 450, 480, 520, 560, 480, 360, 240, 120, 60, 0];

  const points: HourlyDemandPoint[] = hourlyDemand.map((demand, hour) => ({
    hour: `${String(hour).padStart(2, "0")}:00`,
    arrivals: Math.round(demand * seasonal * 0.4),
    estimatedPax: Math.round(demand * seasonal),
    busDemand: Math.round(demand * seasonal / BUS_SEAT_CAPACITY),
    seatsAvailable: busesPerHour * BUS_SEAT_CAPACITY
  }));

  return Promise.resolve({ points });
}

export function getOpsDashboard(): Promise<OpsDashboardPayload> {
  const now = new Date();
  const vehicles = buildScheduleMockFleet(now);
  const sourceStatuses = makeSourceStatuses(now);
  const { activeByRoute } = getMockFleetSummary(now);
  const routes = getRoutesEngine(makeBusSourceStatus(now), activeByRoute);
  const env = getEnvironmentSnapshot(now);
  const weatherInt = getWeatherIntelligence(now);
  const trafficData = getTrafficAdvisories(undefined, now);
  const transferHubs = getTransferHubs(now);

  const busVehicles = vehicles.filter((v) => !FERRY_ROUTE_IDS.includes(v.routeId));
  const ferryVehicles = vehicles.filter((v) => FERRY_ROUTE_IDS.includes(v.routeId));

  const competitorBenchmarks: CompetitorBenchmark[] = Object.values(COMPETITOR_BENCHMARKS).map((b) => ({
    ...b,
    estimatedDemand: 200,
    seatSupply: 180,
    carriedRiders: 160,
    revenueThb: 16000,
    capturePct: 0.15
  }));

  return Promise.resolve({
    checkedAt: now.toISOString(),
    dataMode: "demo",
    fallbackReasons: [],
    fleet: {
      vehicles,
      totalVehicles: vehicles.length,
      busCount: busVehicles.length,
      ferryCount: ferryVehicles.length,
      movingCount: vehicles.filter((v) => v.status === "moving").length,
      dwellingCount: vehicles.filter((v) => v.status === "dwelling").length,
      routePressure: OPERATIONAL_ROUTE_IDS.filter((id) => !FERRY_ROUTE_IDS.includes(id)).map((routeId) => ({
        routeId,
        level: "balanced" as const,
        demand: 100,
        seatSupply: 125,
        gap: 0,
        coverageRatio: 1.25,
        delayRiskMinutes: 0,
        provenance: "estimated" as const
      }))
    },
    routes,
    demandSupply: {
      rawAirportArrivalPaxNext2h: 300,
      rawAirportDeparturePaxNext2h: 200,
      addressableArrivalDemandNext2h: 45,
      addressableDepartureDemandNext2h: 30,
      arrivalSeatSupplyNext2h: 75,
      departureSeatSupplyNext2h: 50,
      carriedArrivalDemandNext2h: 40,
      carriedDepartureDemandNext2h: 25,
      unmetArrivalDemandNext2h: 5,
      unmetDepartureDemandNext2h: 5,
      arrivalCaptureOfAddressablePct: 0.89,
      departureCaptureOfAddressablePct: 0.83,
      additionalBusesNeededPeak: 1,
      provenance: "estimated"
    },
    weather: {
      severity: env.precipMm >= 3 ? "warning" : env.rainProb >= 70 ? "caution" : "info",
      intelligence: weatherInt,
      provenance: "estimated"
    },
    traffic: {
      severity: "info",
      advisories: trafficData.advisories,
      provenance: "estimated"
    },
    hotspots: { hotspots: [], totalRequests: 0 },
    transferHubs,
    history: { recentEvents: [], vehicleHistoryCount: 0 },
    mapOverlays: { tileLayers: [], markers: [] },
    competitorBenchmarks,
    sources: sourceStatuses
  });
}

export function getInvestorSimulation(): Promise<InvestorSimulationPayload> {
  const now = new Date();
  const transferHubs = getTransferHubs(now);

  return Promise.resolve({
    generatedAt: now.toISOString(),
    dataMode: "demo",
    fallbackReasons: [],
    assumptions: {
      seatCapacityPerBus: BUS_SEAT_CAPACITY,
      flatFareThb: INVESTOR_FLAT_FARE_THB,
      addressableDemandShare: ADDRESSABLE_DEMAND_SHARE,
      replayStepMinutes: REPLAY_STEP_MINUTES,
      replayStartMinutes: REPLAY_START_MINUTES,
      replayEndMinutes: REPLAY_END_MINUTES
    },
    hourly: [],
    services: [],
    competitorBenchmarks: Object.values(COMPETITOR_BENCHMARKS).map((b) => ({
      ...b,
      estimatedDemand: 200,
      seatSupply: 180,
      carriedRiders: 160,
      revenueThb: 16000,
      capturePct: 0.15
    })),
    totals: {
      rawAirportArrivalPax: 4200,
      rawAirportDeparturePax: 3800,
      addressableArrivalDemand: 630,
      addressableDepartureDemand: 570,
      carriedArrivalDemand: 520,
      carriedDepartureDemand: 460,
      unmetArrivalDemand: 110,
      unmetDepartureDemand: 110,
      totalAirportCapturePct: 0.12,
      addressableAirportCapturePct: 0.82,
      dailyRevenueThb: 98000,
      lostRevenueThb: 22000,
      peakAdditionalBusesNeeded: 2
    },
    opportunities: {
      summary: "Peak hour gap at 10:00-12:00 suggests adding 2 buses could capture 22,000 THB/day in lost revenue.",
      peakArrivalGapHour: "10:00",
      peakDepartureGapHour: "16:00",
      strongestRevenueServiceRouteId: "rawai-airport"
    },
    touchpoints: transferHubs
  });
}

export function getSimulationFrame(simMinutes: number): Promise<SimulationSnapshot> {
  const baseDate = new Date();
  baseDate.setHours(0, 0, 0, 0);
  const simDate = new Date(baseDate.getTime() + simMinutes * 60_000);
  const vehicles = buildScheduleMockFleet(simDate);
  const transferHubs = getTransferHubs(simDate);

  return Promise.resolve({
    simMinutes,
    simTime: `${String(Math.floor(simMinutes / 60)).padStart(2, "0")}:${String(simMinutes % 60).padStart(2, "0")}`,
    dataMode: "demo",
    fallbackReasons: [],
    vehicles,
    routePressure: OPERATIONAL_ROUTE_IDS.filter((id) => !FERRY_ROUTE_IDS.includes(id)).map((routeId) => ({
      routeId,
      level: "balanced" as const,
      demand: 100,
      seatSupply: 125,
      gap: 0,
      coverageRatio: 1.25,
      delayRiskMinutes: 0,
      provenance: "estimated" as const
    })),
    transferHubs,
    competitorBenchmarks: Object.values(COMPETITOR_BENCHMARKS).map((b) => ({
      ...b,
      estimatedDemand: 200,
      seatSupply: 180,
      carriedRiders: 160,
      revenueThb: 16000,
      capturePct: 0.15
    }))
  });
}
