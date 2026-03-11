import type { LatLngTuple, VehiclePosition } from "@shared/types";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function interpolateCoordinate(
  from: LatLngTuple,
  to: LatLngTuple,
  progress: number
): LatLngTuple {
  const ratio = clamp(progress, 0, 1);

  return [
    from[0] + (to[0] - from[0]) * ratio,
    from[1] + (to[1] - from[1]) * ratio
  ];
}

export function interpolateHeading(from: number, to: number, progress: number) {
  const ratio = clamp(progress, 0, 1);
  const delta = ((((to - from) % 360) + 540) % 360) - 180;

  return (from + delta * ratio + 360) % 360;
}

export function shouldAnimateVehicleFrame(previous: VehiclePosition[], next: VehiclePosition[]) {
  const previousById = new Map(previous.map((vehicle) => [vehicle.vehicleId, vehicle]));

  return next.some((vehicle) => {
    const current = previousById.get(vehicle.vehicleId);

    if (!current || current.routeId !== vehicle.routeId) {
      return false;
    }

    return (
      current.coordinates[0] !== vehicle.coordinates[0] ||
      current.coordinates[1] !== vehicle.coordinates[1] ||
      current.heading !== vehicle.heading
    );
  });
}

export function buildAnimatedVehicleFrame(
  previous: VehiclePosition[],
  next: VehiclePosition[],
  progress: number
) {
  const previousById = new Map(previous.map((vehicle) => [vehicle.vehicleId, vehicle]));
  const ratio = clamp(progress, 0, 1);

  return next.map((vehicle) => {
    const current = previousById.get(vehicle.vehicleId);

    if (!current || current.routeId !== vehicle.routeId) {
      return vehicle;
    }

    return {
      ...vehicle,
      coordinates: interpolateCoordinate(current.coordinates, vehicle.coordinates, ratio),
      heading: interpolateHeading(current.heading, vehicle.heading, ratio)
    };
  });
}
