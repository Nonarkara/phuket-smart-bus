import type { LatLngTuple } from "@shared/types";

/** Linear interpolation between two coordinates by `progress` ∈ [0, 1].
 *  Used as the FALLBACK path for vehicles without polyline data
 *  (orange-line, ferries with sparse stops). The polyline-aware path
 *  in LiveMap is preferred — see interpolateAlongPolyline there. */
export function interpolateCoordinate(
  from: LatLngTuple,
  to: LatLngTuple,
  progress: number
): LatLngTuple {
  const r = Math.max(0, Math.min(1, progress));
  return [from[0] + (to[0] - from[0]) * r, from[1] + (to[1] - from[1]) * r];
}

/** Shortest-arc heading interpolation in degrees. */
export function interpolateHeading(from: number, to: number, progress: number): number {
  const r = Math.max(0, Math.min(1, progress));
  const delta = ((((to - from) % 360) + 540) % 360) - 180;
  return (from + delta * r + 360) % 360;
}
