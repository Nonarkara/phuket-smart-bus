import type { LatLngTuple, VehiclePosition } from "@shared/types";
import { haversineDistanceMeters } from "@/engine/geo";

export type RouteAnimationPath = {
  points: LatLngTuple[];
  cumulativeMeters: number[];
  totalMeters: number;
};

export type RouteAnimationIndex = Record<string, RouteAnimationPath>;

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

function bearingDeg(from: LatLngTuple, to: LatLngTuple) {
  const lat1 = (from[0] * Math.PI) / 180;
  const lat2 = (to[0] * Math.PI) / 180;
  const deltaLon = ((to[1] - from[1]) * Math.PI) / 180;

  const y = Math.sin(deltaLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);

  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

function buildCumulativeMeters(points: LatLngTuple[]) {
  const cumulative = [0];

  for (let index = 1; index < points.length; index += 1) {
    cumulative.push(cumulative[index - 1] + haversineDistanceMeters(points[index - 1]!, points[index]!));
  }

  return cumulative;
}

function snapToPolylineDistance(
  point: LatLngTuple,
  path: RouteAnimationPath
) {
  let nearestDistance = Infinity;
  let snappedMeters = 0;

  for (let index = 0; index < path.points.length; index += 1) {
    const sample = path.points[index]!;
    const distance = haversineDistanceMeters(point, sample);

    if (distance < nearestDistance) {
      nearestDistance = distance;
      snappedMeters = path.cumulativeMeters[index] ?? 0;
    }
  }

  return snappedMeters;
}

function positionOnPath(
  meters: number,
  path: RouteAnimationPath
): { coordinates: LatLngTuple; heading: number } {
  const clampedMeters = clamp(meters, 0, path.totalMeters);

  let lower = 0;
  let upper = path.cumulativeMeters.length - 1;

  while (lower < upper - 1) {
    const middle = (lower + upper) >> 1;
    if ((path.cumulativeMeters[middle] ?? 0) <= clampedMeters) {
      lower = middle;
    } else {
      upper = middle;
    }
  }

  const fromPoint = path.points[lower] ?? path.points[0]!;
  const toPoint = path.points[upper] ?? path.points[path.points.length - 1]!;
  const segmentMeters = (path.cumulativeMeters[upper] ?? 0) - (path.cumulativeMeters[lower] ?? 0);
  const segmentProgress =
    segmentMeters > 0
      ? (clampedMeters - (path.cumulativeMeters[lower] ?? 0)) / segmentMeters
      : 0;

  return {
    coordinates: interpolateCoordinate(fromPoint, toPoint, segmentProgress),
    heading: bearingDeg(fromPoint, toPoint)
  };
}

export function buildRouteAnimationIndex(pathsByRouteId: Record<string, LatLngTuple[]>) {
  return Object.fromEntries(
    Object.entries(pathsByRouteId)
      .filter(([, points]) => points.length >= 2)
      .map(([routeId, points]) => {
        const cumulativeMeters = buildCumulativeMeters(points);
        return [
          routeId,
          {
            points,
            cumulativeMeters,
            totalMeters: cumulativeMeters[cumulativeMeters.length - 1] ?? 0
          }
        ];
      })
  ) as RouteAnimationIndex;
}

export function shouldAnimateVehicleFrame(previous: VehiclePosition[], next: VehiclePosition[]) {
  // If vehicle count changed, animate the ones that persist
  if (previous.length !== next.length) {
    return true;
  }

  const previousById = new Map(previous.map((vehicle) => [vehicle.vehicleId, vehicle]));

  return next.some((vehicle) => {
    const current = previousById.get(vehicle.vehicleId);

    if (!current || current.routeId !== vehicle.routeId) {
      // New vehicle appeared — still animate the frame
      return true;
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

export function buildAnimatedVehicleFrameOnRoutes(
  previous: VehiclePosition[],
  next: VehiclePosition[],
  routeIndex: RouteAnimationIndex,
  progress: number
) {
  const previousById = new Map(previous.map((vehicle) => [vehicle.vehicleId, vehicle]));
  const ratio = clamp(progress, 0, 1);

  return next.map((vehicle) => {
    const current = previousById.get(vehicle.vehicleId);
    const path = routeIndex[vehicle.routeId];

    if (!current || current.routeId !== vehicle.routeId || !path || path.points.length < 2) {
      return {
        ...vehicle,
        heading: interpolateHeading(current?.heading ?? vehicle.heading, vehicle.heading, ratio)
      };
    }

    const fromMeters = snapToPolylineDistance(current.coordinates, path);
    const toMeters = snapToPolylineDistance(vehicle.coordinates, path);

    if (Math.abs(toMeters - fromMeters) > path.totalMeters * 0.35) {
      return {
        ...vehicle,
        coordinates: interpolateCoordinate(current.coordinates, vehicle.coordinates, ratio),
        heading: interpolateHeading(current.heading, vehicle.heading, ratio)
      };
    }

    const position = positionOnPath(fromMeters + (toMeters - fromMeters) * ratio, path);

    return {
      ...vehicle,
      coordinates: position.coordinates,
      heading: position.heading
    };
  });
}
