import type { OperationsOverviewPayload, OperationsRouteSummary, PassengerFlowEvent, RouteId } from "../../shared/types.js";
import { ROUTE_DEFINITIONS } from "../config.js";
import { estimateSeatAvailability } from "./providers/seatProvider.js";
import { getBusSnapshot } from "./providers/busProvider.js";
import { getRecentPassengerFlowEvents } from "./operationsStore.js";
import { getStopById } from "./routes.js";

const CORE_ROUTE_IDS = (Object.entries(ROUTE_DEFINITIONS) as [RouteId, (typeof ROUTE_DEFINITIONS)[RouteId]][])
  .filter(([, config]) => config.tier === "core")
  .map(([routeId]) => routeId);

const ONE_HOUR_MS = 60 * 60 * 1000;

function isWithinLastHour(updatedAt: string) {
  return Date.now() - new Date(updatedAt).getTime() <= ONE_HOUR_MS;
}

function enrichPassengerEvent(event: PassengerFlowEvent): PassengerFlowEvent {
  if (!event.stopId) {
    return event;
  }

  const stop = getStopById(event.routeId, event.stopId);

  if (!stop) {
    return event;
  }

  return {
    ...event,
    stopName: stop.name
  };
}

function buildRouteSummary(routeId: RouteId, events: PassengerFlowEvent[], vehicles: Awaited<ReturnType<typeof getBusSnapshot>>["vehicles"]) {
  const routeConfig = ROUTE_DEFINITIONS[routeId];
  const routeVehicles = vehicles.filter((vehicle) => vehicle.routeId === routeId);
  const seatSummaries = routeVehicles
    .map((vehicle) => estimateSeatAvailability(vehicle))
    .filter((seat): seat is NonNullable<typeof seat> => Boolean(seat));
  const routeEvents = events.filter((event) => event.routeId === routeId && isWithinLastHour(event.updatedAt));
  const boardingsLastHour = routeEvents
    .filter((event) => event.eventType === "boarding")
    .reduce((sum, event) => sum + event.passengers, 0);
  const alightingsLastHour = routeEvents
    .filter((event) => event.eventType === "alighting")
    .reduce((sum, event) => sum + event.passengers, 0);

  return {
    routeId,
    routeName: routeConfig.name,
    shortName: routeConfig.shortName,
    axisLabel: routeConfig.axisLabel,
    tier: routeConfig.tier,
    vehiclesOnline: routeVehicles.length,
    gpsDevicesLive: routeVehicles.length,
    seatCamerasLive: seatSummaries.filter((seat) => seat.basis === "camera_live").length,
    seatsLeftVisible:
      seatSummaries.length > 0
        ? seatSummaries.reduce((sum, seat) => sum + (seat.seatsLeft ?? 0), 0)
        : null,
    boardingsLastHour,
    alightingsLastHour,
    lastEventAt: routeEvents[0]?.updatedAt ?? null
  } satisfies OperationsRouteSummary;
}

export async function getOperationsOverview(): Promise<OperationsOverviewPayload> {
  const snapshot = await getBusSnapshot();
  const recentEvents = getRecentPassengerFlowEvents(250)
    .map(enrichPassengerEvent)
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());

  return {
    checkedAt: new Date().toISOString(),
    routes: CORE_ROUTE_IDS.map((routeId) => buildRouteSummary(routeId, recentEvents, snapshot.vehicles)),
    recentEvents: recentEvents.slice(0, 8)
  };
}
