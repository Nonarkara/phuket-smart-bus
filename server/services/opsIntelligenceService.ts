import type {
  Advisory,
  AdvisorySeverity,
  CompetitorBenchmark,
  CurrentDemandSupply,
  DataSourceStatus,
  DemandHotspot,
  FlightInfo,
  HourlyCapacityGap,
  InvestorSimulationPayload,
  MetricProvenance,
  OpsDashboardPayload,
  OpsMapOverlayMarker,
  OpsMapTileLayer,
  OperationalRouteId,
  RoutePressure,
  ServiceRevenueBreakdown,
  SimulationSnapshot,
  VehiclePosition,
  WeatherIntelligence
} from "../../shared/types.js";
import {
  ADDRESSABLE_DEMAND_SHARE,
  BUS_SEAT_CAPACITY,
  INVESTOR_FLAT_FARE_THB,
  REPLAY_END_MINUTES,
  REPLAY_START_MINUTES,
  REPLAY_STEP_MINUTES
} from "../../shared/productConfig.js";
import { COMPETITOR_BENCHMARKS, FERRY_ROUTE_IDS, ROUTE_DEFINITIONS } from "../config.js";
import { text } from "../lib/i18n.js";
import { resolveOpsDataMode, sourceStatusesToFallbackReasons } from "../lib/sourceStatus.js";
import { parseClockMinutes, formatClockLabel, getBangkokNowMinutes } from "../lib/time.js";
import { readRecentHistory, readVehicleHistoryRange } from "../lib/db.js";
import { getOperationsOverview } from "./operationsService.js";
import { getBusSnapshot } from "./providers/busProvider.js";
import { getTrafficSnapshot } from "./providers/trafficProvider.js";
import { getAqiSnapshot } from "./providers/aqiProvider.js";
import { getWeatherSnapshot } from "./providers/weatherProvider.js";
import { getRoutes, getStopsForRoute } from "./routes.js";
import { getDemandHotspots } from "./demandRequestStore.js";
import { getTransferHubs } from "./transferHubs.js";
import { getBusScheduledServices, getScheduledServices } from "./scheduleService.js";
import { buildScheduleMockFleet } from "./providers/mockFleetProvider.js";
import { getDailyFlightSchedule } from "./providers/flightProvider.js";

type FlightWithMinutes = FlightInfo & { minutes: number };
type AirportFlow = "arrival_to_city" | "city_to_airport";

const FERRY_ROUTE_SET = new Set<OperationalRouteId>(FERRY_ROUTE_IDS);
const CORE_BUS_ROUTE_IDS: OperationalRouteId[] = [
  "rawai-airport",
  "patong-old-bus-station",
  "dragon-line"
];
const ROUTE_MARKER_COORDINATES: Record<OperationalRouteId, [number, number]> = {
  "rawai-airport": [8.1132, 98.3169],
  "patong-old-bus-station": [7.8961, 98.2969],
  "dragon-line": [7.8842, 98.3923],
  "rassada-phi-phi": [7.8574, 98.3866],
  "rassada-ao-nang": [7.8574, 98.3866],
  "bang-rong-koh-yao": [8.0317, 98.4192],
  "chalong-racha": [7.8216, 98.3613]
};

function toMetricProvenance(status: Pick<DataSourceStatus, "state">): MetricProvenance {
  return status.state === "live" ? "live" : "fallback";
}

function severityRank(severity: AdvisorySeverity) {
  return severity === "warning" ? 3 : severity === "caution" ? 2 : 1;
}

function maxSeverity(severities: AdvisorySeverity[]) {
  return severities.sort((left, right) => severityRank(right) - severityRank(left))[0] ?? "info";
}

function roundPct(part: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return Math.round((part / total) * 1000) / 10;
}

function formatHourLabel(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getBangkokDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  const [year, month, day] = formatter.format(date).split("-").map((value) => Number(value));
  return { year, month, day };
}

function buildBangkokDateAtMinutes(simMinutes: number, referenceDate = new Date()) {
  const { year, month, day } = getBangkokDateParts(referenceDate);
  const hour = Math.floor(simMinutes / 60);
  const minute = simMinutes % 60;
  const utcMillis = Date.UTC(year, month - 1, day, hour - 7, minute);
  return new Date(utcMillis);
}

function toFlightsWithMinutes(date = new Date()) {
  return getDailyFlightSchedule(date)
    .map<FlightWithMinutes | null>((flight) => {
      const minutes = parseClockMinutes(flight.scheduledTime);
      if (minutes === null) {
        return null;
      }

      return {
        ...flight,
        minutes
      };
    })
    .filter((flight): flight is FlightWithMinutes => Boolean(flight));
}

function sumFlightPaxWithinWindow(
  flights: FlightWithMinutes[],
  type: FlightInfo["type"],
  startMinutes: number,
  endMinutes: number
) {
  const normalizedEnd = endMinutes >= startMinutes ? endMinutes : endMinutes + 24 * 60;

  return flights
    .filter((flight) => flight.type === type)
    .flatMap((flight) => [flight.minutes, flight.minutes + 24 * 60].map((minutes) => ({ flight, minutes })))
    .filter((entry) => entry.minutes >= startMinutes && entry.minutes < normalizedEnd)
    .reduce((sum, entry) => sum + entry.flight.estimatedPax, 0);
}

function countDeparturesWithinWindow(departures: number[], startMinutes: number, endMinutes: number) {
  const normalizedEnd = endMinutes >= startMinutes ? endMinutes : endMinutes + 24 * 60;

  return departures
    .flatMap((departure) => [departure, departure + 24 * 60])
    .filter((departure) => departure >= startMinutes && departure < normalizedEnd).length;
}

function classifyAirportServiceDirection(
  directionLabel: string,
  originStopName: string,
  terminalStopName: string
): AirportFlow {
  const hint = `${directionLabel} ${originStopName} ${terminalStopName}`.toLowerCase();
  return hint.includes("airport") && !originStopName.toLowerCase().includes("airport")
    ? "city_to_airport"
    : "arrival_to_city";
}

function buildAirportHourlyGaps(date = new Date(), overrideFleetSize?: number): HourlyCapacityGap[] {
  const flights = toFlightsWithMinutes(date);
  const airportServices = getBusScheduledServices().filter((service) => service.routeId === "rawai-airport");
  const arrivalService = airportServices.find(
    (service) =>
      classifyAirportServiceDirection(
        service.directionLabel,
        service.originStopName,
        service.terminalStopName
      ) === "arrival_to_city"
  );
  const departureService = airportServices.find(
    (service) =>
      classifyAirportServiceDirection(
        service.directionLabel,
        service.originStopName,
        service.terminalStopName
      ) === "city_to_airport"
  );

  return Array.from(
    { length: Math.max(0, REPLAY_END_MINUTES / 60 - REPLAY_START_MINUTES / 60) },
    (_, index) => {
      const hour = REPLAY_START_MINUTES / 60 + index;
      const rawArrivalPax = flights
        .filter((flight) => flight.type === "arrival" && Math.floor(flight.minutes / 60) === hour)
        .reduce((sum, flight) => sum + flight.estimatedPax, 0);
      const rawDeparturePax = flights
        .filter((flight) => flight.type === "departure" && Math.floor(flight.minutes / 60) === hour)
        .reduce((sum, flight) => sum + flight.estimatedPax, 0);
      const addressableArrivalDemand = Math.ceil(rawArrivalPax * ADDRESSABLE_DEMAND_SHARE);
      const addressableDepartureDemand = Math.ceil(rawDeparturePax * ADDRESSABLE_DEMAND_SHARE);
      const scheduledArrivalSupply =
        countDeparturesWithinWindow(arrivalService?.departures ?? [], hour * 60, hour * 60 + 60) *
        BUS_SEAT_CAPACITY;
      const scheduledDepartureSupply =
        countDeparturesWithinWindow(departureService?.departures ?? [], hour * 60, hour * 60 + 60) *
        BUS_SEAT_CAPACITY;
      const arrivalSeatSupply = overrideFleetSize != null
        ? Math.ceil(overrideFleetSize * 0.5) * BUS_SEAT_CAPACITY
        : scheduledArrivalSupply;
      const departureSeatSupply = overrideFleetSize != null
        ? Math.floor(overrideFleetSize * 0.5) * BUS_SEAT_CAPACITY
        : scheduledDepartureSupply;
      const carriedArrivalDemand = Math.min(addressableArrivalDemand, arrivalSeatSupply);
      const carriedDepartureDemand = Math.min(addressableDepartureDemand, departureSeatSupply);
      const unmetArrivalDemand = Math.max(0, addressableArrivalDemand - arrivalSeatSupply);
      const unmetDepartureDemand = Math.max(0, addressableDepartureDemand - departureSeatSupply);

      return {
        hour: formatHourLabel(hour),
        rawArrivalPax,
        rawDeparturePax,
        addressableArrivalDemand,
        addressableDepartureDemand,
        arrivalSeatSupply,
        departureSeatSupply,
        carriedArrivalDemand,
        carriedDepartureDemand,
        unmetArrivalDemand,
        unmetDepartureDemand,
        requiredArrivalDepartures: Math.ceil(addressableArrivalDemand / BUS_SEAT_CAPACITY),
        requiredDepartureDepartures: Math.ceil(addressableDepartureDemand / BUS_SEAT_CAPACITY),
        additionalArrivalBusesNeeded: Math.ceil(unmetArrivalDemand / BUS_SEAT_CAPACITY),
        additionalDepartureBusesNeeded: Math.ceil(unmetDepartureDemand / BUS_SEAT_CAPACITY),
        lostRevenueThb: (unmetArrivalDemand + unmetDepartureDemand) * INVESTOR_FLAT_FARE_THB
      };
    }
  );
}

function buildCurrentDemandSupply(
  date = new Date(),
  liveVehicles: VehiclePosition[] = []
): CurrentDemandSupply {
  const flights = toFlightsWithMinutes(date);
  const nowMinutes = getBangkokNowMinutes(date);
  const airportServices = getBusScheduledServices().filter((service) => service.routeId === "rawai-airport");
  const arrivalService = airportServices.find(
    (service) =>
      classifyAirportServiceDirection(
        service.directionLabel,
        service.originStopName,
        service.terminalStopName
      ) === "arrival_to_city"
  );
  const departureService = airportServices.find(
    (service) =>
      classifyAirportServiceDirection(
        service.directionLabel,
        service.originStopName,
        service.terminalStopName
      ) === "city_to_airport"
  );
  const rawAirportArrivalPaxNext2h = sumFlightPaxWithinWindow(flights, "arrival", nowMinutes, nowMinutes + 120);
  const rawAirportDeparturePaxNext2h = sumFlightPaxWithinWindow(
    flights,
    "departure",
    nowMinutes,
    nowMinutes + 120
  );
  const addressableArrivalDemandNext2h = Math.ceil(
    rawAirportArrivalPaxNext2h * ADDRESSABLE_DEMAND_SHARE
  );
  const addressableDepartureDemandNext2h = Math.ceil(
    rawAirportDeparturePaxNext2h * ADDRESSABLE_DEMAND_SHARE
  );

  // When live vehicles are available, use actual bus counts for airport supply.
  // Split by direction when destination hints are present; otherwise fall back
  // to scheduled departures.
  const liveAirportBuses = liveVehicles.filter((v) => v.routeId === "rawai-airport");
  const liveArrivalBuses = liveAirportBuses.filter((v) =>
    v.destination?.en?.includes("Rawai") || v.destination?.th?.includes("ราไวย์")
  ).length;
  const liveDepartureBuses = liveAirportBuses.filter((v) =>
    v.destination?.en?.includes("Airport") || v.destination?.th?.includes("สนามบิน")
  ).length;
  const hasLiveDirection = liveArrivalBuses > 0 || liveDepartureBuses > 0;

  const arrivalSeatSupplyNext2h = hasLiveDirection
    ? liveArrivalBuses * BUS_SEAT_CAPACITY
    : countDeparturesWithinWindow(arrivalService?.departures ?? [], nowMinutes, nowMinutes + 120) *
      BUS_SEAT_CAPACITY;
  const departureSeatSupplyNext2h = hasLiveDirection
    ? liveDepartureBuses * BUS_SEAT_CAPACITY
    : countDeparturesWithinWindow(departureService?.departures ?? [], nowMinutes, nowMinutes + 120) *
      BUS_SEAT_CAPACITY;
  const carriedArrivalDemandNext2h = Math.min(
    addressableArrivalDemandNext2h,
    arrivalSeatSupplyNext2h
  );
  const carriedDepartureDemandNext2h = Math.min(
    addressableDepartureDemandNext2h,
    departureSeatSupplyNext2h
  );
  const unmetArrivalDemandNext2h = Math.max(
    0,
    addressableArrivalDemandNext2h - arrivalSeatSupplyNext2h
  );
  const unmetDepartureDemandNext2h = Math.max(
    0,
    addressableDepartureDemandNext2h - departureSeatSupplyNext2h
  );
  const peakAdditionalBusesNeeded = buildAirportHourlyGaps(date).reduce(
    (max, gap) =>
      Math.max(max, gap.additionalArrivalBusesNeeded, gap.additionalDepartureBusesNeeded),
    0
  );

  return {
    rawAirportArrivalPaxNext2h,
    rawAirportDeparturePaxNext2h,
    addressableArrivalDemandNext2h,
    addressableDepartureDemandNext2h,
    arrivalSeatSupplyNext2h,
    departureSeatSupplyNext2h,
    carriedArrivalDemandNext2h,
    carriedDepartureDemandNext2h,
    unmetArrivalDemandNext2h,
    unmetDepartureDemandNext2h,
    arrivalCaptureOfAddressablePct: roundPct(
      carriedArrivalDemandNext2h,
      addressableArrivalDemandNext2h
    ),
    departureCaptureOfAddressablePct: roundPct(
      carriedDepartureDemandNext2h,
      addressableDepartureDemandNext2h
    ),
    additionalBusesNeededPeak: peakAdditionalBusesNeeded,
    provenance: "estimated"
  };
}

function buildLocalServiceDemand(
  routeId: OperationalRouteId,
  departures: number,
  seatSupply: number
) {
  if (routeId === "patong-old-bus-station") {
    return Math.round(Math.min(seatSupply, departures * 14));
  }

  if (routeId === "dragon-line") {
    return Math.round(Math.min(seatSupply, departures * 11));
  }

  return 0;
}

function buildServiceRevenueBreakdown(hourly: HourlyCapacityGap[]): ServiceRevenueBreakdown[] {
  const totalArrivalDemand = hourly.reduce((sum, item) => sum + item.addressableArrivalDemand, 0);
  const totalDepartureDemand = hourly.reduce((sum, item) => sum + item.addressableDepartureDemand, 0);

  return getBusScheduledServices().map((service) => {
    const departures = countDeparturesWithinWindow(
      service.departures,
      REPLAY_START_MINUTES,
      REPLAY_END_MINUTES
    );
    const seatSupply = departures * BUS_SEAT_CAPACITY;
    const airportFlow =
      service.routeId === "rawai-airport"
        ? classifyAirportServiceDirection(
            service.directionLabel,
            service.originStopName,
            service.terminalStopName
          )
        : null;
    const estimatedDemand =
      airportFlow === "arrival_to_city"
        ? totalArrivalDemand
        : airportFlow === "city_to_airport"
          ? totalDepartureDemand
          : buildLocalServiceDemand(service.routeId, departures, seatSupply);
    const carriedRiders = Math.min(estimatedDemand, seatSupply);
    const unmetRiders = Math.max(0, estimatedDemand - seatSupply);

    return {
      routeId: service.routeId,
      routeName: ROUTE_DEFINITIONS[service.routeId].name,
      directionLabel: service.directionLabel,
      tier: service.routeTier,
      departures,
      seatSupply,
      estimatedDemand,
      carriedRiders,
      unmetRiders,
      revenueThb: carriedRiders * INVESTOR_FLAT_FARE_THB,
      capturePct: roundPct(carriedRiders, estimatedDemand),
      provenance: "estimated",
      strategicValue:
        service.routeId === "rawai-airport"
          ? text(
              airportFlow === "arrival_to_city"
                ? "Direct airport-to-city trunk carrying arriving passengers into Phuket."
                : "Direct city-to-airport trunk supporting departure flights and hotel pickups.",
              airportFlow === "arrival_to_city"
                ? "เส้นหลักตรงจากสนามบินเข้าสู่เมืองสำหรับผู้โดยสารขาเข้า"
                : "เส้นหลักตรงจากเมืองไปสนามบินสำหรับผู้โดยสารขาออกและโรงแรม"
            )
          : service.routeId === "patong-old-bus-station"
            ? text(
                "Hotel belt distributor that expands city catchment around Patong and Old Town.",
                "เส้นกระจายผู้โดยสารแนวโรงแรมที่ขยายฐานผู้ใช้รอบป่าตองและเมืองเก่า"
              )
            : text(
                "Short urban distributor improving circulation and transfer spread inside Old Town.",
                "เส้นกระจายการเดินทางในเมืองเก่าที่ช่วยการหมุนเวียนและต่อเชื่อม"
              )
    };
  });
}

function buildCompetitorBenchmarks(totalAddressableDemand: number): CompetitorBenchmark[] {
  const benchmark = COMPETITOR_BENCHMARKS["orange-line"];
  const serviceWindowMinutes = REPLAY_END_MINUTES - REPLAY_START_MINUTES;
  const departures = Math.max(1, Math.floor(serviceWindowMinutes / benchmark.headwayMinutes));
  const seatSupply = departures * Math.round(BUS_SEAT_CAPACITY * 1.6);
  const estimatedDemand = Math.round(totalAddressableDemand * 0.42);
  const carriedRiders = Math.min(estimatedDemand, seatSupply);

  return [
    {
      ...benchmark,
      estimatedDemand,
      seatSupply,
      carriedRiders,
      revenueThb: carriedRiders * benchmark.fareThb,
      capturePct: roundPct(carriedRiders, estimatedDemand)
    }
  ];
}

async function buildWeatherIntelligence(now = new Date()) {
  const [weatherResult, aqiResult] = await Promise.all([getWeatherSnapshot(), getAqiSnapshot()]);
  const weather = weatherResult.snapshot;
  const aqi = aqiResult.snapshot;
  const month = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", month: "2-digit" }).format(now)
  );
  const monsoonSeason = month >= 5 && month <= 10;
  const driverAlerts: string[] = [];

  if (weather.precipitation > 2) {
    driverAlerts.push("Heavy rain active. Expect braking distance penalties and slower boarding.");
  }
  if (weather.windSpeed > 40) {
    driverAlerts.push("Strong wind over exposed coastal segments. Ferry coordination should stay on watch.");
  }
  if (weather.precipitationProbability > 70) {
    driverAlerts.push("Wet-road risk is elevated for the next few hours. Pad runtime on hillside segments.");
  }
  if (aqi.usAqi > 100) {
    driverAlerts.push("Poor air quality. Keep AC recirculation on and limit open-window dwell.");
  }

  const currentHour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Bangkok",
      hour: "2-digit",
      hour12: false
    }).format(now)
  );
  const forecast = Array.from({ length: 12 }, (_, index) => {
    const hour = (currentHour + index) % 24;
    const afternoonLift = hour >= 13 && hour <= 17 ? 1 : 0;
    const rainProb = clamp(
      weather.precipitationProbability + (monsoonSeason ? afternoonLift * 18 : afternoonLift * 8) + Math.round(Math.sin(hour / 3) * 10),
      5,
      98
    );

    return {
      hour: formatHourLabel(hour),
      tempC: Math.round(weather.temperatureC + (hour >= 11 && hour <= 16 ? 1 : -1)),
      rainProb,
      precipMm: Math.max(0, Math.round((weather.precipitation + afternoonLift * 0.8) * 10) / 10),
      windKph: Math.max(5, Math.round(weather.windSpeed + Math.cos(hour / 4) * 5)),
      code: weather.weatherCode
    };
  });
  const severity =
    weather.precipitation >= 3 || weather.precipitationProbability >= 85
      ? "warning"
      : weather.precipitation >= 1.5 || weather.precipitationProbability >= 70 || weather.windSpeed >= 28
        ? "caution"
        : "info";
  const intelligence: WeatherIntelligence = {
    current: {
      tempC: weather.temperatureC,
      rainProb: weather.precipitationProbability,
      precipMm: weather.precipitation,
      windKph: weather.windSpeed,
      aqi: aqi.usAqi,
      pm25: aqi.pm25
    },
    forecast,
    monsoonSeason,
    monsoonNote: monsoonSeason
      ? "Southwest monsoon pattern. Afternoon rain and ferry disruption risk should be assumed."
      : "Dry-season bias. Weather is mostly steady, but Phuket showers can still spike without much warning.",
    driverAlerts
  };

  return {
    severity,
    intelligence,
    provenance:
      weatherResult.status.state === "live" && aqiResult.status.state === "live" ? "live" : "fallback",
    sourceStatuses: [weatherResult.status, aqiResult.status]
  } as const;
}

async function buildTrafficPanel() {
  const trafficSnapshot = await getTrafficSnapshot();
  const severity = maxSeverity(trafficSnapshot.advisories.map((advisory) => advisory.severity));

  return {
    severity,
    advisories: trafficSnapshot.advisories,
    provenance: toMetricProvenance(trafficSnapshot.status),
    sourceStatuses: [trafficSnapshot.status]
  } as const;
}

function buildRoutePressure(
  vehicles: Awaited<ReturnType<typeof getBusSnapshot>>["vehicles"],
  hotspots: DemandHotspot[],
  currentDemandSupply: CurrentDemandSupply,
  weatherSeverity: AdvisorySeverity,
  trafficSeverity: AdvisorySeverity
) {
  const airportRouteDemand =
    currentDemandSupply.addressableArrivalDemandNext2h +
    currentDemandSupply.addressableDepartureDemandNext2h;
  const airportRouteSupply =
    currentDemandSupply.arrivalSeatSupplyNext2h + currentDemandSupply.departureSeatSupplyNext2h;
  const hasLiveAirportVehicles = vehicles.some(
    (v) =>
      v.routeId === "rawai-airport" &&
      (v.telemetrySource === "public_tracker" || v.telemetrySource === "direct_gps")
  );
  const hotspotDemandByRoute: Record<OperationalRouteId, number> = {
    "rawai-airport": airportRouteDemand,
    "patong-old-bus-station": hotspots
      .filter((hotspot) =>
        ["Central Patong", "Kata Beach", "Karon Beach", "Phuket Town"].includes(hotspot.zone)
      )
      .reduce((sum, hotspot) => sum + hotspot.demand, 0),
    "dragon-line": hotspots
      .filter((hotspot) => ["Phuket Town", "Chalong"].includes(hotspot.zone))
      .reduce((sum, hotspot) => sum + hotspot.demand, 0),
    "rassada-phi-phi": 18,
    "rassada-ao-nang": 8,
    "bang-rong-koh-yao": 10,
    "chalong-racha": 12
  };

  return (Object.keys(ROUTE_DEFINITIONS) as OperationalRouteId[]).map<RoutePressure>((routeId) => {
    const routeVehicleCount = vehicles.filter((vehicle) => vehicle.routeId === routeId).length;
    const seatSupply = routeId === "rawai-airport" ? airportRouteSupply : routeVehicleCount * BUS_SEAT_CAPACITY;
    const demand = hotspotDemandByRoute[routeId] ?? 0;
    const gap = Math.max(0, demand - seatSupply);
    const coverageRatio = seatSupply > 0 ? Math.round((seatSupply / Math.max(1, demand)) * 100) / 100 : 0;
    const severityPenalty =
      (weatherSeverity === "warning" ? 10 : weatherSeverity === "caution" ? 5 : 0) +
      (trafficSeverity === "warning" ? 8 : trafficSeverity === "caution" ? 4 : 0) +
      (FERRY_ROUTE_SET.has(routeId) && weatherSeverity !== "info" ? 6 : 0);

    return {
      routeId,
      level: coverageRatio >= 1 ? "balanced" : coverageRatio >= 0.7 ? "watch" : "strained",
      demand,
      seatSupply,
      gap,
      coverageRatio,
      delayRiskMinutes: severityPenalty,
      provenance:
        routeId === "rawai-airport"
          ? hasLiveAirportVehicles
            ? "live"
            : "estimated"
          : "fallback"
    };
  });
}

function buildOverlayMarkers(
  hotspots: DemandHotspot[],
  transferHubs: ReturnType<typeof getTransferHubs>,
  routePressure: RoutePressure[],
  trafficAdvisories: Advisory[],
  intelligence: WeatherIntelligence
) {
  const markers: OpsMapOverlayMarker[] = [];

  for (const hotspot of hotspots) {
    markers.push({
      id: `hotspot-${hotspot.id}`,
      layerId: "hotspots",
      lat: hotspot.lat,
      lng: hotspot.lng,
      color: hotspot.gap > 0 ? "#f85149" : "#58a6ff",
      radius: hotspot.gap > 0 ? 18 : 12,
      label: `${hotspot.zone}: ${hotspot.demand} demand, ${hotspot.liveRequests} live requests`,
      fillOpacity: 0.28
    });
  }

  for (const hub of transferHubs) {
    markers.push({
      id: `hub-${hub.id}`,
      layerId: "transfer_hubs",
      lat: hub.coordinates[0],
      lng: hub.coordinates[1],
      color: hub.status === "ready" ? "#3fb950" : hub.status === "watch" ? "#d29922" : "#6e7681",
      radius: hub.status === "ready" ? 16 : 12,
      label: `${hub.name.en}: ${hub.nextWindowStartLabel ?? "no ferry window"}`,
      fillOpacity: 0.25
    });
  }

  for (const pressure of routePressure) {
    const [lat, lng] = ROUTE_MARKER_COORDINATES[pressure.routeId];
    markers.push({
      id: `pressure-${pressure.routeId}`,
      layerId: "route_pressure",
      lat,
      lng,
      color:
        pressure.level === "strained"
          ? "#f85149"
          : pressure.level === "watch"
            ? "#d29922"
            : "#3fb950",
      radius: pressure.level === "strained" ? 16 : 11,
      label: `${ROUTE_DEFINITIONS[pressure.routeId].shortName.en}: ${pressure.demand} demand / ${pressure.seatSupply} seats`,
      fillOpacity: 0.24
    });
  }

  const advisoryAnchors = trafficAdvisories.slice(0, 4).map((advisory, index) => {
    const routeId = advisory.routeId === "all" ? CORE_BUS_ROUTE_IDS[index % CORE_BUS_ROUTE_IDS.length] : advisory.routeId;
    return {
      advisory,
      coordinates: ROUTE_MARKER_COORDINATES[routeId]
    };
  });

  for (const item of advisoryAnchors) {
    markers.push({
      id: `traffic-${item.advisory.id}`,
      layerId: "traffic",
      lat: item.coordinates[0],
      lng: item.coordinates[1],
      color: item.advisory.severity === "warning" ? "#f85149" : item.advisory.severity === "caution" ? "#d29922" : "#58a6ff",
      radius: 13,
      label: item.advisory.title.en,
      fillOpacity: 0.2
    });
  }

  markers.push({
    id: "weather-airport",
    layerId: "weather",
    lat: 8.1132,
    lng: 98.3169,
    color: intelligence.current.rainProb >= 70 ? "#58a6ff" : "#8b949e",
    radius: intelligence.current.rainProb >= 70 ? 18 : 12,
    label: `Airport corridor: ${intelligence.current.rainProb}% rain, AQI ${intelligence.current.aqi}`,
    fillOpacity: 0.18
  });

  markers.push({
    id: "weather-town",
    layerId: "aqi",
    lat: 7.8842,
    lng: 98.3923,
    color: intelligence.current.aqi > 100 ? "#f85149" : intelligence.current.aqi > 60 ? "#d29922" : "#3fb950",
    radius: 15,
    label: `Phuket Town AQI ${intelligence.current.aqi} / PM2.5 ${intelligence.current.pm25}`,
    fillOpacity: 0.18
  });

  return markers;
}

let rainViewerTimestamp: number | null = null;
let rainViewerTimestampAt = 0;

async function getRainViewerTimestamp(): Promise<number | null> {
  if (rainViewerTimestamp && Date.now() - rainViewerTimestampAt < 5 * 60_000) {
    return rainViewerTimestamp;
  }
  try {
    const response = await fetch("https://api.rainviewer.com/public/weather-maps.json");
    const data = (await response.json()) as { radar?: { past?: Array<{ time: number }> } };
    const latest = data.radar?.past?.at(-1);
    if (latest) {
      rainViewerTimestamp = latest.time;
      rainViewerTimestampAt = Date.now();
      return rainViewerTimestamp;
    }
  } catch {
    // RainViewer unavailable — precipitation layer won't render
  }
  return null;
}

function buildTileLayers(): OpsMapTileLayer[] {
  const layers: OpsMapTileLayer[] = [
    {
      id: "satellite",
      layerId: "satellite",
      label: "Satellite",
      description: "Esri World Imagery — verify bus stop locations and terrain",
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      attribution: "Esri",
      opacity: 1.0
    },
    {
      id: "terrain",
      layerId: "terrain",
      label: "Topography",
      description: "OpenTopoMap — steep hills and elevation for accident risk assessment",
      url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
      attribution: "OpenTopoMap",
      opacity: 0.75
    }
  ];

  const rainTs = rainViewerTimestamp;
  if (rainTs) {
    layers.push({
      id: "precipitation",
      layerId: "precipitation",
      label: "Precipitation",
      description: "RainViewer live radar — rain intensity over Phuket",
      url: `https://tilecache.rainviewer.com/v2/radar/${rainTs}/{z}/{x}/{y}/2/1_1.png`,
      attribution: "RainViewer",
      opacity: 0.6
    });
  }

  return layers;
}

export async function getSimulationSnapshot(
  simMinutes: number,
  referenceDate = new Date()
): Promise<SimulationSnapshot> {
  const simDate = buildBangkokDateAtMinutes(simMinutes, referenceDate);
  const vehicles = buildScheduleMockFleet(simDate);
  const hotspotState = getDemandHotspots(simDate);
  const currentDemandSupply = buildCurrentDemandSupply(simDate);
  const weatherPanel = await buildWeatherIntelligence(simDate);
  const trafficPanel = await buildTrafficPanel();
  const sourceStatuses = [
    {
      source: "bus" as const,
      state: "fallback" as const,
      updatedAt: simDate.toISOString(),
      detail: text(
        "Schedule replay is driving the simulation snapshot",
        "การจำลองนี้ขับด้วยตารางเวลาแทนข้อมูลสด"
      ),
      freshnessSeconds: 0,
      fallbackReason: "bus: schedule replay simulation"
    },
    ...weatherPanel.sourceStatuses,
    ...trafficPanel.sourceStatuses
  ];

  return {
    simMinutes,
    simTime: `${String(Math.floor(simMinutes / 60)).padStart(2, "0")}:${String(simMinutes % 60).padStart(2, "0")}`,
    dataMode: resolveOpsDataMode(sourceStatuses),
    fallbackReasons: sourceStatusesToFallbackReasons(sourceStatuses),
    vehicles,
    routePressure: buildRoutePressure(
      vehicles,
      hotspotState.hotspots,
      currentDemandSupply,
      weatherPanel.severity,
      trafficPanel.severity
    ),
    transferHubs: getTransferHubs(simDate, "estimated"),
    competitorBenchmarks: buildCompetitorBenchmarks(
      currentDemandSupply.addressableArrivalDemandNext2h +
        currentDemandSupply.addressableDepartureDemandNext2h
    )
  };
}

export async function getOpsDashboardPayload(now = new Date()): Promise<OpsDashboardPayload> {
  const [snapshot, overview, weatherPanel, trafficPanel] = await Promise.all([
    getBusSnapshot(),
    getOperationsOverview(),
    buildWeatherIntelligence(now),
    buildTrafficPanel()
  ]);
  // Warm RainViewer timestamp so precipitation layer is available
  await getRainViewerTimestamp();
  const hotspotState = getDemandHotspots(now);
  const currentDemandSupply = buildCurrentDemandSupply(now, snapshot.vehicles);
  const routePressure = buildRoutePressure(
    snapshot.vehicles,
    hotspotState.hotspots,
    currentDemandSupply,
    weatherPanel.severity,
    trafficPanel.severity
  );
  const activeVehicles = Object.fromEntries(
    (Object.keys(ROUTE_DEFINITIONS) as OperationalRouteId[]).map((routeId) => [
      routeId,
      snapshot.vehicles.filter((vehicle) => vehicle.routeId === routeId).length
    ])
  ) as Record<OperationalRouteId, number>;
  const transferHubs = getTransferHubs(now, snapshot.status.state === "live" ? "live" : "estimated");
  const history = readRecentHistory();
  const sourceStatuses = [snapshot.status, ...trafficPanel.sourceStatuses, ...weatherPanel.sourceStatuses];

  return {
    checkedAt: now.toISOString(),
    dataMode: resolveOpsDataMode(sourceStatuses),
    fallbackReasons: sourceStatusesToFallbackReasons(sourceStatuses),
    fleet: {
      vehicles: snapshot.vehicles,
      totalVehicles: snapshot.vehicles.length,
      busCount: snapshot.vehicles.filter((vehicle) => !FERRY_ROUTE_SET.has(vehicle.routeId)).length,
      ferryCount: snapshot.vehicles.filter((vehicle) => FERRY_ROUTE_SET.has(vehicle.routeId)).length,
      movingCount: snapshot.vehicles.filter((vehicle) => vehicle.status === "moving").length,
      dwellingCount: snapshot.vehicles.filter((vehicle) => vehicle.status === "dwelling").length,
      routePressure
    },
    routes: getRoutes(snapshot.status, activeVehicles),
    demandSupply: currentDemandSupply,
    weather: {
      severity: weatherPanel.severity,
      intelligence: weatherPanel.intelligence,
      provenance: weatherPanel.provenance
    },
    traffic: {
      severity: trafficPanel.severity,
      advisories: trafficPanel.advisories,
      provenance: trafficPanel.provenance
    },
    hotspots: {
      hotspots: hotspotState.hotspots,
      totalRequests: hotspotState.totalRequests
    },
    transferHubs,
    history: {
      recentEvents: overview.recentEvents,
      vehicleHistoryCount: history.length
    },
    mapOverlays: {
      tileLayers: buildTileLayers(),
      markers: buildOverlayMarkers(
        hotspotState.hotspots,
        transferHubs,
        routePressure,
        trafficPanel.advisories,
        weatherPanel.intelligence
      )
    },
    competitorBenchmarks: buildCompetitorBenchmarks(
      currentDemandSupply.addressableArrivalDemandNext2h +
        currentDemandSupply.addressableDepartureDemandNext2h
    ),
    sources: sourceStatuses
  };
}

export function getInvestorSimulationPayload(date = new Date(), overrideFleetSize?: number): InvestorSimulationPayload {
  const hourly = buildAirportHourlyGaps(date, overrideFleetSize);
  const services = buildServiceRevenueBreakdown(hourly);
  const competitorBenchmarks = buildCompetitorBenchmarks(
    hourly.reduce(
      (sum, item) => sum + item.addressableArrivalDemand + item.addressableDepartureDemand,
      0
    )
  );
  const totals = {
    rawAirportArrivalPax: hourly.reduce((sum, item) => sum + item.rawArrivalPax, 0),
    rawAirportDeparturePax: hourly.reduce((sum, item) => sum + item.rawDeparturePax, 0),
    addressableArrivalDemand: hourly.reduce((sum, item) => sum + item.addressableArrivalDemand, 0),
    addressableDepartureDemand: hourly.reduce((sum, item) => sum + item.addressableDepartureDemand, 0),
    carriedArrivalDemand: hourly.reduce((sum, item) => sum + item.carriedArrivalDemand, 0),
    carriedDepartureDemand: hourly.reduce((sum, item) => sum + item.carriedDepartureDemand, 0),
    unmetArrivalDemand: hourly.reduce((sum, item) => sum + item.unmetArrivalDemand, 0),
    unmetDepartureDemand: hourly.reduce((sum, item) => sum + item.unmetDepartureDemand, 0),
    totalAirportCapturePct: roundPct(
      hourly.reduce((sum, item) => sum + item.carriedArrivalDemand + item.carriedDepartureDemand, 0),
      hourly.reduce((sum, item) => sum + item.rawArrivalPax + item.rawDeparturePax, 0)
    ),
    addressableAirportCapturePct: roundPct(
      hourly.reduce((sum, item) => sum + item.carriedArrivalDemand + item.carriedDepartureDemand, 0),
      hourly.reduce(
        (sum, item) => sum + item.addressableArrivalDemand + item.addressableDepartureDemand,
        0
      )
    ),
    dailyRevenueThb: hourly.reduce(
      (sum, item) =>
        sum + (item.carriedArrivalDemand + item.carriedDepartureDemand) * INVESTOR_FLAT_FARE_THB,
      0
    ),
    lostRevenueThb: hourly.reduce((sum, item) => sum + item.lostRevenueThb, 0),
    peakAdditionalBusesNeeded: hourly.reduce(
      (max, item) =>
        Math.max(max, item.additionalArrivalBusesNeeded, item.additionalDepartureBusesNeeded),
      0
    )
  };
  const peakArrivalGap = hourly
    .slice()
    .sort((left, right) => right.unmetArrivalDemand - left.unmetArrivalDemand)[0];
  const peakDepartureGap = hourly
    .slice()
    .sort((left, right) => right.unmetDepartureDemand - left.unmetDepartureDemand)[0];
  const strongestService = services.slice().sort((left, right) => right.revenueThb - left.revenueThb)[0];

  return {
    generatedAt: date.toISOString(),
    dataMode: "demo",
    fallbackReasons: ["bus: investor replay uses modeled demand and schedule-derived supply"],
    assumptions: {
      seatCapacityPerBus: BUS_SEAT_CAPACITY,
      flatFareThb: INVESTOR_FLAT_FARE_THB,
      addressableDemandShare: ADDRESSABLE_DEMAND_SHARE,
      replayStepMinutes: REPLAY_STEP_MINUTES,
      replayStartMinutes: REPLAY_START_MINUTES,
      replayEndMinutes: REPLAY_END_MINUTES
    },
    hourly,
    services,
    competitorBenchmarks,
    totals,
    opportunities: {
      summary:
        totals.peakAdditionalBusesNeeded > 0
          ? `Airport demand outruns supply at the peak. ${totals.peakAdditionalBusesNeeded} extra buses would close the tightest hour and unlock more revenue.`
          : "Scheduled supply covers modeled airport demand across the replay window.",
      peakArrivalGapHour: peakArrivalGap?.unmetArrivalDemand ? peakArrivalGap.hour : null,
      peakDepartureGapHour: peakDepartureGap?.unmetDepartureDemand ? peakDepartureGap.hour : null,
      strongestRevenueServiceRouteId: strongestService?.routeId ?? null
    },
    touchpoints: getTransferHubs(buildBangkokDateAtMinutes(REPLAY_START_MINUTES, date), "estimated")
  };
}


// ---------------------------------------------------------------------------
// Post-run report — reads historical snapshots and compares actual fleet
// size to flight demand hour-by-hour.
// ---------------------------------------------------------------------------

export interface HourlyFleetObservation {
  hour: string;
  rawArrivalPax: number;
  rawDeparturePax: number;
  addressableArrivalDemand: number;
  addressableDepartureDemand: number;
  observedAirportBuses: number;
  observedBusRoutes: Record<string, number>;
  seatSupply: number;
  carriedArrivalDemand: number;
  carriedDepartureDemand: number;
  unmetArrivalDemand: number;
  unmetDepartureDemand: number;
  additionalBusesNeeded: number;
  lostRevenueThb: number;
}

export interface OpsRunReport {
  from: string;
  to: string;
  hoursCovered: number;
  totalObservations: number;
  hourly: HourlyFleetObservation[];
  summary: {
    rawAirportArrivalPax: number;
    rawAirportDeparturePax: number;
    addressableArrivalDemand: number;
    addressableDepartureDemand: number;
    totalSeatSupply: number;
    carriedArrivalDemand: number;
    carriedDepartureDemand: number;
    unmetArrivalDemand: number;
    unmetDepartureDemand: number;
    totalRevenueThb: number;
    lostRevenueThb: number;
    peakAdditionalBusesNeeded: number;
    averageAirportBusesOnline: number;
    capturePct: number;
  };
}

export function buildRunReport(fromIso: string, toIso: string): OpsRunReport {
  const history = readVehicleHistoryRange(fromIso, toIso);
  const fromDate = new Date(fromIso);
  const toDate = new Date(toIso);
  const hoursCovered = Math.max(1, Math.ceil((toDate.getTime() - fromDate.getTime()) / (60 * 60_000)));

  // Group history entries by hour
  type HistoryRow = {
    vehicle_id: string;
    route_id: string;
    lat: number;
    lng: number;
    speed_kph: number;
    status: string;
    captured_at: string;
  };

  const rows = history as unknown as HistoryRow[];

  // Build hourly buckets
  const buckets = new Map<number, HistoryRow[]>();
  for (const row of rows) {
    const d = new Date(row.captured_at);
    const hourKey = Math.floor(d.getTime() / (60 * 60_000));
    const existing = buckets.get(hourKey) ?? [];
    existing.push(row);
    buckets.set(hourKey, existing);
  }

  // Get flight demand for the date range (use midpoint date for flight schedule)
  const midDate = new Date(fromDate.getTime() + (toDate.getTime() - fromDate.getTime()) / 2);
  const flights = toFlightsWithMinutes(midDate);

  const hourly: HourlyFleetObservation[] = [];
  let totalObservations = 0;

  for (let h = 0; h < hoursCovered; h++) {
    const hourStart = new Date(fromDate.getTime() + h * 60 * 60_000);
    const hourKey = Math.floor(hourStart.getTime() / (60 * 60_000));
    const bucketRows = buckets.get(hourKey) ?? [];
    totalObservations += bucketRows.length;

    // Count unique vehicles per route in this hour
    const vehiclesByRoute: Record<string, Set<string>> = {};
    for (const row of bucketRows) {
      const set = vehiclesByRoute[row.route_id] ?? new Set<string>();
      set.add(row.vehicle_id);
      vehiclesByRoute[row.route_id] = set;
    }

    const observedBusRoutes: Record<string, number> = {};
    for (const [routeId, set] of Object.entries(vehiclesByRoute)) {
      observedBusRoutes[routeId] = set.size;
    }

    const observedAirportBuses = observedBusRoutes["rawai-airport"] ?? 0;
    const seatSupply = observedAirportBuses * BUS_SEAT_CAPACITY;

    // Flight demand for this hour ( Bangkok time )
    const bangkokHour = (hourStart.getUTCHours() + 7) % 24;
    const rawArrivalPax = flights
      .filter((f) => f.type === "arrival" && Math.floor(f.minutes / 60) === bangkokHour)
      .reduce((s, f) => s + f.estimatedPax, 0);
    const rawDeparturePax = flights
      .filter((f) => f.type === "departure" && Math.floor(f.minutes / 60) === bangkokHour)
      .reduce((s, f) => s + f.estimatedPax, 0);
    const addressableArrivalDemand = Math.ceil(rawArrivalPax * ADDRESSABLE_DEMAND_SHARE);
    const addressableDepartureDemand = Math.ceil(rawDeparturePax * ADDRESSABLE_DEMAND_SHARE);
    const totalAddressable = addressableArrivalDemand + addressableDepartureDemand;

    const carriedArrivalDemand = Math.min(addressableArrivalDemand, seatSupply);
    const carriedDepartureDemand = Math.min(addressableDepartureDemand, Math.max(0, seatSupply - carriedArrivalDemand));
    const unmetArrivalDemand = Math.max(0, addressableArrivalDemand - carriedArrivalDemand);
    const unmetDepartureDemand = Math.max(0, addressableDepartureDemand - carriedDepartureDemand);
    const additionalBusesNeeded = Math.ceil((unmetArrivalDemand + unmetDepartureDemand) / BUS_SEAT_CAPACITY);
    const lostRevenueThb = (unmetArrivalDemand + unmetDepartureDemand) * INVESTOR_FLAT_FARE_THB;

    hourly.push({
      hour: `${String(bangkokHour).padStart(2, "0")}:00`,
      rawArrivalPax,
      rawDeparturePax,
      addressableArrivalDemand,
      addressableDepartureDemand,
      observedAirportBuses,
      observedBusRoutes,
      seatSupply,
      carriedArrivalDemand,
      carriedDepartureDemand,
      unmetArrivalDemand,
      unmetDepartureDemand,
      additionalBusesNeeded,
      lostRevenueThb
    });
  }

  const summary = {
    rawAirportArrivalPax: hourly.reduce((s, h) => s + h.rawArrivalPax, 0),
    rawAirportDeparturePax: hourly.reduce((s, h) => s + h.rawDeparturePax, 0),
    addressableArrivalDemand: hourly.reduce((s, h) => s + h.addressableArrivalDemand, 0),
    addressableDepartureDemand: hourly.reduce((s, h) => s + h.addressableDepartureDemand, 0),
    totalSeatSupply: hourly.reduce((s, h) => s + h.seatSupply, 0),
    carriedArrivalDemand: hourly.reduce((s, h) => s + h.carriedArrivalDemand, 0),
    carriedDepartureDemand: hourly.reduce((s, h) => s + h.carriedDepartureDemand, 0),
    unmetArrivalDemand: hourly.reduce((s, h) => s + h.unmetArrivalDemand, 0),
    unmetDepartureDemand: hourly.reduce((s, h) => s + h.unmetDepartureDemand, 0),
    totalRevenueThb:
      (hourly.reduce((s, h) => s + h.carriedArrivalDemand + h.carriedDepartureDemand, 0)) *
      INVESTOR_FLAT_FARE_THB,
    lostRevenueThb: hourly.reduce((s, h) => s + h.lostRevenueThb, 0),
    peakAdditionalBusesNeeded: hourly.reduce((max, h) => Math.max(max, h.additionalBusesNeeded), 0),
    averageAirportBusesOnline:
      hourly.length > 0
        ? Math.round((hourly.reduce((s, h) => s + h.observedAirportBuses, 0) / hourly.length) * 10) / 10
        : 0,
    capturePct: roundPct(
      hourly.reduce((s, h) => s + h.carriedArrivalDemand + h.carriedDepartureDemand, 0),
      hourly.reduce((s, h) => s + h.addressableArrivalDemand + h.addressableDepartureDemand, 0)
    )
  };

  return {
    from: fromIso,
    to: toIso,
    hoursCovered,
    totalObservations,
    hourly,
    summary
  };
}
