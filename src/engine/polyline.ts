import type { LatLngTuple } from "@shared/types";
import { haversineDistanceMeters } from "./geo";

/** Cumulative distance in meters at each polyline vertex from the start. */
export function buildPolylineCumMeters(poly: LatLngTuple[]): number[] {
  const cum = [0];
  for (let i = 1; i < poly.length; i++) {
    cum.push(cum[i - 1] + haversineDistanceMeters(poly[i - 1], poly[i]));
  }
  return cum;
}

/** Interpolate coordinates + heading at `meters` along the polyline.
 *  This is what makes a bus follow the curve of the road instead of
 *  cutting straight lines between sample points. */
export function posOnPolyline(
  meters: number,
  poly: LatLngTuple[],
  cum: number[]
): { coordinates: LatLngTuple; heading: number } {
  const total = cum[cum.length - 1] ?? 0;
  const d = Math.max(0, Math.min(total, meters));

  // Binary search for the segment containing `d`.
  let lo = 0;
  let hi = cum.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= d) lo = mid; else hi = mid;
  }

  const a = poly[lo]!;
  const b = poly[hi]!;
  const segLen = cum[hi]! - cum[lo]!;
  const r = segLen > 0 ? (d - cum[lo]!) / segLen : 0;
  const lat = a[0] + (b[0] - a[0]) * r;
  const lng = a[1] + (b[1] - a[1]) * r;

  // Bearing from a→b
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const la1 = (a[0] * Math.PI) / 180;
  const la2 = (b[0] * Math.PI) / 180;
  const heading =
    ((Math.atan2(
      Math.sin(dLon) * Math.cos(la2),
      Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLon)
    ) *
      180) /
      Math.PI +
      360) %
    360;

  return { coordinates: [lat, lng], heading };
}
