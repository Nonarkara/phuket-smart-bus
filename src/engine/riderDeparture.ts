import type { RouteId } from "@shared/types";
import { getPublishedAirportDepartures } from "./fleetSimulator";
import { getScheduledServices } from "./scheduleService";

export type RiderDeparture = {
  departureMin: number;
  waitMin: number;
  destination: string;
};

/**
 * One timetable answer for every rider surface.
 *
 * The airport corridor uses the official per-stop timetable directly. Other
 * routes use the same published service records consumed by the legacy map.
 * `nowMin` is Bangkok wall-clock minutes and the result wraps to tomorrow.
 */
export function getNextRiderDeparture(
  routeId: RouteId | null,
  nowMin: number
): RiderDeparture | null {
  if (!routeId) return null;
  const dayMin = ((nowMin % 1440) + 1440) % 1440;

  const candidates = routeId === "rawai-airport"
    ? getPublishedAirportDepartures().map((departureMin) => ({
        departureMin,
        destination: "Patong & Rawai"
      }))
    : getScheduledServices(routeId).flatMap((service) =>
        service.departures.map((departureMin) => ({
          departureMin,
          destination: service.directionLabel || "destination"
        }))
      );

  if (candidates.length === 0) return null;
  const ordered = candidates.slice().sort((a, b) => a.departureMin - b.departureMin);
  const next = ordered.find((candidate) => candidate.departureMin > dayMin) ?? ordered[0];
  if (!next) return null;
  const departureMin = next.departureMin > dayMin ? next.departureMin : next.departureMin + 1440;
  return {
    departureMin,
    waitMin: departureMin - dayMin,
    destination: next.destination
  };
}
