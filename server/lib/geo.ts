import type { Feature, FeatureCollection, GeoJsonProperties, LineString, MultiLineString, Position } from "geojson";
import type { LatLngTuple } from "../../shared/types.js";

export function toLatLng(position: Position): LatLngTuple {
  return [position[1], position[0]];
}

export function flattenLineSegments(
  collection: FeatureCollection<LineString | MultiLineString, GeoJsonProperties>
): LatLngTuple[][] {
  const segments: LatLngTuple[][] = [];

  for (const feature of collection.features) {
    if (feature.geometry.type === "LineString") {
      segments.push(feature.geometry.coordinates.map(toLatLng));
      continue;
    }

    for (const segment of feature.geometry.coordinates) {
      segments.push(segment.map(toLatLng));
    }
  }

  return segments;
}

export function getBounds(segments: LatLngTuple[]): [LatLngTuple, LatLngTuple] {
  let minLat = Infinity;
  let minLon = Infinity;
  let maxLat = -Infinity;
  let maxLon = -Infinity;

  for (const [lat, lon] of segments) {
    minLat = Math.min(minLat, lat);
    minLon = Math.min(minLon, lon);
    maxLat = Math.max(maxLat, lat);
    maxLon = Math.max(maxLon, lon);
  }

  return [
    [minLat, minLon],
    [maxLat, maxLon]
  ];
}

export function flattenBoundsSegments(segments: LatLngTuple[][]) {
  return segments.flat();
}

export function haversineDistanceMeters(a: LatLngTuple, b: LatLngTuple) {
  const earthRadius = 6371e3;
  const lat1 = (a[0] * Math.PI) / 180;
  const lat2 = (b[0] * Math.PI) / 180;
  const deltaLat = ((b[0] - a[0]) * Math.PI) / 180;
  const deltaLon = ((b[1] - a[1]) * Math.PI) / 180;

  const sinLat = Math.sin(deltaLat / 2);
  const sinLon = Math.sin(deltaLon / 2);

  const angle =
    sinLat * sinLat +
    Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;

  return 2 * earthRadius * Math.atan2(Math.sqrt(angle), Math.sqrt(1 - angle));
}
