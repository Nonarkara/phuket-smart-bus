import type { VehiclePosition } from "@shared/types";
import { getDayModel, getReturnTripLoad } from "./demandSupplyEngine";
import { getVehiclesNow } from "./fleetSimulator";
import type { SimState } from "./simulation";

/**
 * Translate the production-ready fleet shape into the small instrument shape
 * the map paints. Both the full console and every embedded map call this same
 * function, so an embedded map cannot quietly fall back to a different fleet.
 */
export function getMapVehicles(nowMin: number): SimState["vehicles"] {
  return getVehiclesNow(undefined, nowMin).map((vehicle) => ({
    id: vehicle.vehicleId,
    lat: vehicle.coordinates[0],
    lng: vehicle.coordinates[1],
    heading: vehicle.heading,
    status: vehicle.status === "moving" ? "moving" : "dwelling",
    route: vehicle.routeId,
    pax: vehiclePax(vehicle),
    plate: vehicle.licensePlate,
    isBoarding: isBoardingAtCurb(vehicle, nowMin),
  }));
}

/** Join an airport-line duty to the exact load produced by the demand model. */
function vehiclePax(vehicle: VehiclePosition): number {
  if (vehicle.routeId === "rawai-airport" && vehicle.tripStartMin != null) {
    if (vehicle.directionLabel === "Bus to Rawai") {
      const trip = getDayModel().trips.find(
        (candidate) => Math.abs(candidate.depMin - vehicle.tripStartMin!) <= 2
      );
      if (trip) return trip.boarded;
    }
    if (vehicle.directionLabel === "Bus to Airport") {
      const load = getReturnTripLoad(vehicle.tripStartMin);
      if (load !== null) return load;
    }
  }

  // Local routes do not use the airport queue. Their deterministic estimate
  // is intentionally modest until real APC/camera counts replace it.
  const capacity = vehicle.routeId === "dragon-line" ? 15 : 25;
  const occupancy = vehicle.routeId === "patong-old-bus-station"
    ? 0.42
    : vehicle.routeId === "dragon-line"
      ? 0.31
      : 0.35;
  const variation = (vehicle.tripStartMin ?? 0) % 7;
  return Math.max(0, Math.round(capacity * occupancy) + (variation - 3));
}

function isBoardingAtCurb(vehicle: VehiclePosition, nowMin: number): boolean {
  if (
    vehicle.routeId !== "rawai-airport" ||
    vehicle.tripStartMin == null ||
    vehicle.directionLabel !== "Bus to Rawai"
  ) return false;

  const age = nowMin - vehicle.tripStartMin;
  return vehicle.status !== "moving" && age >= -3 && age <= 3;
}
