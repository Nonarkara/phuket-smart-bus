import type { RouteId, RouteTier, Stop } from "../../shared/types.js";
import { FERRY_ROUTE_IDS, ROUTE_DEFINITIONS } from "../config.js";
import { formatClockLabel, parseScheduleEntries } from "../lib/time.js";
import { getStopsForRoute } from "./routes.js";

export type ScheduledService = {
  id: string;
  routeId: RouteId;
  routeTier: RouteTier;
  directionLabel: string;
  originStopId: string;
  originStopName: string;
  terminalStopId: string;
  terminalStopName: string;
  departures: number[];
  headwayMinutes: number;
  tripDurationMinutes: number;
  inferredHubTravelMinutes: number | null;
};

const routeIds = Object.keys(ROUTE_DEFINITIONS) as RouteId[];
const serviceCache = new Map<RouteId, ScheduledService[]>();

function forwardDiff(fromMinutes: number, toMinutes: number) {
  return ((toMinutes - fromMinutes) % (24 * 60) + 24 * 60) % (24 * 60);
}

function median(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[middle] ?? null;
  }

  const leftValue = sorted[middle - 1];
  const rightValue = sorted[middle];

  if (leftValue === undefined || rightValue === undefined) {
    return null;
  }

  return Math.round((leftValue + rightValue) / 2);
}

function deriveHeadway(departures: number[], interval: number | null) {
  if (interval !== null) {
    return interval;
  }

  const diffs = departures
    .slice(1)
    .map((departure, index) => forwardDiff(departures[index] ?? departure, departure))
    .filter((value) => value > 0 && value <= 180);

  return median(diffs) ?? 30;
}

function deriveTripDuration(stops: Stop[], departures: number[]) {
  const lastStopDepartures = parseScheduleEntries(stops.at(-1)?.scheduleText ?? "").departures;
  const pairDurations = departures
    .slice(0, Math.min(departures.length, lastStopDepartures.length))
    .map((departure, index) => forwardDiff(departure, lastStopDepartures[index] ?? departure))
    .filter((value) => value > 0 && value <= 6 * 60);

  return Math.max(median(pairDurations) ?? 20, 20);
}

function inferHubTravelMinutes(routeId: RouteId) {
  if (routeId === "dragon-line") {
    return 12;
  }

  if (routeId === "rawai-airport") {
    return 15;
  }

  if (routeId === "patong-old-bus-station") {
    return 18;
  }

  return null;
}

function buildScheduledServices(routeId: RouteId) {
  const grouped = new Map<string, Stop[]>();

  for (const stop of getStopsForRoute(routeId)) {
    const key = stop.direction.en;
    const current = grouped.get(key);

    if (current) {
      current.push(stop);
      continue;
    }

    grouped.set(key, [stop]);
  }

  return Array.from(grouped.entries())
    .map<ScheduledService | null>(([directionLabel, stops]) => {
      const firstStop = stops[0];
      const lastStop = stops.at(-1);
      const { departures, interval } = parseScheduleEntries(firstStop?.scheduleText ?? "");

      if (!firstStop || !lastStop || stops.length < 2 || departures.length === 0) {
        return null;
      }

      return {
        id: `${routeId}:${directionLabel}`,
        routeId,
        routeTier: ROUTE_DEFINITIONS[routeId].tier,
        directionLabel,
        originStopId: firstStop.id,
        originStopName: firstStop.name.en,
        terminalStopId: lastStop.id,
        terminalStopName: lastStop.name.en,
        departures,
        headwayMinutes: deriveHeadway(departures, interval),
        tripDurationMinutes: deriveTripDuration(stops, departures),
        inferredHubTravelMinutes: inferHubTravelMinutes(routeId)
      };
    })
    .filter((service): service is ScheduledService => Boolean(service));
}

export function getScheduledServices(routeId?: RouteId): ScheduledService[] {
  if (routeId) {
    const cached = serviceCache.get(routeId);

    if (cached) {
      return cached;
    }

    const built = buildScheduledServices(routeId);
    serviceCache.set(routeId, built);
    return built;
  }

  return routeIds.flatMap((candidateRouteId) => getScheduledServices(candidateRouteId));
}

export function getBusScheduledServices(): ScheduledService[] {
  return getScheduledServices().filter((service) => !FERRY_ROUTE_IDS.includes(service.routeId));
}

export function getFerryScheduledServices(): ScheduledService[] {
  return getScheduledServices().filter((service) => FERRY_ROUTE_IDS.includes(service.routeId));
}

export function departuresForHour(departures: number[], hour: number) {
  return departures.filter((departure) => Math.floor(departure / 60) === hour);
}

export function getNextDepartureMinutes(departures: number[], currentMinutes: number) {
  const nextDeparture = departures.find((departure) => departure >= currentMinutes);

  if (nextDeparture !== undefined) {
    return nextDeparture;
  }

  return departures[0] !== undefined ? departures[0] + 24 * 60 : null;
}

export function formatDepartureLabel(totalMinutes: number | null) {
  return totalMinutes === null ? null : formatClockLabel(totalMinutes);
}
