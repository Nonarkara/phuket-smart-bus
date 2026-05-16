import type {
  FeatureCollection,
  GeoJsonProperties,
  LineString,
  MultiLineString,
  Point
} from "geojson";
import {
  flattenBoundsSegments,
  flattenLineSegments,
  getBounds,
  haversineDistanceMeters,
  toLatLng
} from "./geo";
import { ROUTE_DEFINITIONS } from "./config";
import { buildTimetableSummary } from "./time";
import { text } from "./i18n";
import type {
  DataSourceStatus,
  LatLngTuple,
  OperationalRouteId,
  Route,
  Stop
} from "@shared/types";

import busStopsData from "../data/upstream/bus_stop_all.json";
import ferryStopsData from "../data/upstream/ferry_stops.json";
import rawaiAirportLine from "../data/upstream/rawai_airport_line.json";
import patongLine from "../data/upstream/patong_old_bus_station_line.json";
import dragonLine from "../data/upstream/dragon_line.json";
import rassadaPhiPhiLine from "../data/upstream/rassada_phi_phi_line.json";
import rassadaAoNangLine from "../data/upstream/rassada_ao_nang_line.json";
import bangRongKohYaoLine from "../data/upstream/bang_rong_koh_yao_line.json";
import chalongRachaLine from "../data/upstream/chalong_racha_line.json";

type StopCollection = FeatureCollection<Point, GeoJsonProperties>;
type LineCollection = FeatureCollection<LineString | MultiLineString, GeoJsonProperties>;

const busStops = busStopsData as unknown as StopCollection;
const ferryStops = ferryStopsData as unknown as StopCollection;
const stopsCollection: StopCollection = {
  type: "FeatureCollection",
  features: [...busStops.features, ...ferryStops.features]
};

const lineCollections: Record<OperationalRouteId, LineCollection> = {
  "rawai-airport": rawaiAirportLine as unknown as LineCollection,
  "patong-old-bus-station": patongLine as unknown as LineCollection,
  "dragon-line": dragonLine as unknown as LineCollection,
  "rassada-phi-phi": rassadaPhiPhiLine as unknown as LineCollection,
  "rassada-ao-nang": rassadaAoNangLine as unknown as LineCollection,
  "bang-rong-koh-yao": bangRongKohYaoLine as unknown as LineCollection,
  "chalong-racha": chalongRachaLine as unknown as LineCollection
};

function buildStops(routeId: OperationalRouteId) {
  const config = ROUTE_DEFINITIONS[routeId];

  return stopsCollection.features
    .filter(
      (
        feature
      ): feature is typeof feature & {
        properties: NonNullable<typeof feature.properties>;
      } => feature.properties !== null && feature.properties.route === config.sourceRoute
    )
    .sort((a, b) => Number(a.properties.no) - Number(b.properties.no))
    .map<Stop>((feature) => {
      const scheduleText = String(feature.properties.time);
      const timetableState = buildTimetableSummary(scheduleText, config.timetableSource);

      return {
        id: `${routeId}-${feature.properties.no}`,
        routeId,
        sequence: Number(feature.properties.no),
        name: text(
          String(feature.properties.stop_name_eng),
          String(feature.properties.stop_name_th)
        ),
        direction: text(
          String(feature.properties.direction),
          routeId === "dragon-line"
            ? "รถวนเมืองเก่า"
            : String(feature.properties.direction)
                .replace("Bus to Airport", "รถไปสนามบิน")
                .replace("Bus to Rawai", "รถไปราไวย์")
                .replace("Bus to Patong", "รถไปป่าตอง")
                .replace("Bus to Terminal 1", "รถไปสถานีขนส่ง 1")
        ),
        routeDirection: text(
          String(feature.properties.route_direction),
          String(feature.properties.route_direction)
        ),
        coordinates: toLatLng(feature.geometry.coordinates),
        scheduleText,
        nextBus: timetableState.nextBus,
        timetable: timetableState.timetable,
        nearbyPlace: {
          name: String(feature.properties.near_place.place_name),
          mapUrl: String(feature.properties.near_place.place_link),
          openingHours: String(feature.properties.near_place.open_close).trim(),
          distanceMeters: Number(feature.properties.near_place.distance_from_place ?? 0),
          walkMinutes: Number(feature.properties.near_place.time_from_place ?? 0)
        }
      };
    });
}

const stopsByRoute = Object.fromEntries(
  Object.keys(ROUTE_DEFINITIONS).map((routeId) => [
    routeId,
    buildStops(routeId as OperationalRouteId)
  ])
) as Record<OperationalRouteId, Stop[]>;

const routeBase = Object.fromEntries(
  Object.entries(ROUTE_DEFINITIONS).map(([routeId, config]) => {
    const segments = flattenLineSegments(lineCollections[routeId as OperationalRouteId]);
    const flat = flattenBoundsSegments(segments);
    const defaultStop =
      stopsByRoute[routeId as OperationalRouteId].find(
        (stop) => stop.name.en === config.defaultStopName
      ) ?? stopsByRoute[routeId as OperationalRouteId][0];

    return [
      routeId,
      {
        id: routeId as OperationalRouteId,
        name: config.name,
        shortName: config.shortName,
        overview: config.overview,
        axis: config.axis,
        axisLabel: config.axisLabel,
        tier: config.tier,
        color: config.color,
        accentColor: config.accentColor,
        bounds: getBounds(flat),
        pathSegments: segments,
        stopCount: stopsByRoute[routeId as OperationalRouteId].length,
        defaultStopId: defaultStop.id
      }
    ];
  })
) as Omit<Route, "activeVehicles" | "status" | "sourceStatus"> extends infer Base
  ? Record<OperationalRouteId, Base>
  : never;

export function getStopsForRoute(routeId: OperationalRouteId) {
  const config = ROUTE_DEFINITIONS[routeId];

  return stopsByRoute[routeId].map((stop) => {
    const timetableState = buildTimetableSummary(stop.scheduleText, config.timetableSource);

    return {
      ...stop,
      nextBus: timetableState.nextBus,
      timetable: timetableState.timetable
    };
  });
}

export function getStopById(routeId: OperationalRouteId, stopId: string) {
  return getStopsForRoute(routeId).find((stop) => stop.id === stopId) ?? null;
}

/** Return the geometric length of a segment in meters. */
function segmentLengthMeters(seg: LatLngTuple[]): number {
  let len = 0;
  for (let i = 1; i < seg.length; i++) {
    len += haversineDistanceMeters(seg[i - 1]!, seg[i]!);
  }
  return len;
}

/**
 * Stitch multiple segments together, reversing them if necessary to minimize jumping.
 * Filters out degenerate (zero-length) segments first — these appear in some GeoJSON
 * exports as artifacts and create polyline spikes that make buses fly off-route.
 */
function stitchSegments(segments: LatLngTuple[][]): LatLngTuple[] {
  const valid = segments.filter((seg) => segmentLengthMeters(seg) > 1);
  if (valid.length === 0) return [];
  const remaining = [...valid];
  const stitched: LatLngTuple[] = remaining.shift()!.slice();

  while (remaining.length > 0) {
    const startPt = stitched[0]!;
    const endPt = stitched[stitched.length - 1]!;
    
    let bestDist = Infinity;
    let bestIdx = -1;
    let reverse = false;
    let prepend = false;
    
    for (let i = 0; i < remaining.length; i++) {
      const seg = remaining[i]!;
      const segStart = seg[0]!;
      const segEnd = seg[seg.length - 1]!;
      
      const distEndToStart = haversineDistanceMeters(endPt, segStart);
      const distEndToEnd = haversineDistanceMeters(endPt, segEnd);
      const distStartToStart = haversineDistanceMeters(startPt, segStart);
      const distStartToEnd = haversineDistanceMeters(startPt, segEnd);
      
      if (distEndToStart < bestDist) {
        bestDist = distEndToStart;
        bestIdx = i;
        reverse = false;
        prepend = false;
      }
      if (distEndToEnd < bestDist) {
        bestDist = distEndToEnd;
        bestIdx = i;
        reverse = true;
        prepend = false;
      }
      if (distStartToStart < bestDist) {
        bestDist = distStartToStart;
        bestIdx = i;
        reverse = true;
        prepend = true;
      }
      if (distStartToEnd < bestDist) {
        bestDist = distStartToEnd;
        bestIdx = i;
        reverse = false;
        prepend = true;
      }
    }
    
    const bestSeg = remaining[bestIdx]!;
    if (reverse) bestSeg.reverse();
    
    if (prepend) {
      stitched.unshift(...bestSeg);
    } else {
      stitched.push(...bestSeg);
    }
    remaining.splice(bestIdx, 1);
  }
  
  return stitched;
}

/**
 * Extract individual polyline features as LatLngTuple[] arrays.
 * Each GeoJSON feature is one direction of a route.
 */
function extractPolylineFeatures(routeId: OperationalRouteId): LatLngTuple[][] {
  const collection = lineCollections[routeId];
  const result: LatLngTuple[][] = [];

  for (const feature of collection.features) {
    const geo = feature.geometry;
    if (geo.type === "MultiLineString") {
      const segments = geo.coordinates.map(segment => segment.map(toLatLng));
      result.push(stitchSegments(segments));
    } else if (geo.type === "LineString") {
      result.push(geo.coordinates.map(toLatLng));
    }
  }

  return result;
}

const polylineCache = new Map<string, LatLngTuple[]>();

/**
 * Get the polyline for a specific route + direction.
 * Matches by finding the polyline whose start or end is closest to the first stop.
 */
export function getDirectionPolyline(routeId: OperationalRouteId, firstStopCoords: LatLngTuple): LatLngTuple[] {
  const key = `${routeId}:${firstStopCoords[0].toFixed(4)},${firstStopCoords[1].toFixed(4)}`;
  const cached = polylineCache.get(key);
  if (cached) return cached;

  const features = extractPolylineFeatures(routeId);

  if (features.length === 0) return [];
  if (features.length === 1) {
    const polyline = features[0];
    const startDist = haversineDistanceMeters(polyline[0], firstStopCoords);
    const endDist = haversineDistanceMeters(polyline[polyline.length - 1], firstStopCoords);
    if (endDist < startDist) {
      polyline.reverse();
    }
    polylineCache.set(key, polyline);
    return polyline;
  }

  // Match the polyline whose start or end point is closest to the first stop
  let bestFeature = features[0];
  let bestDistance = Infinity;
  let reverseBest = false;

  for (const polyline of features) {
    const startDist = haversineDistanceMeters(polyline[0], firstStopCoords);
    const endDist = haversineDistanceMeters(polyline[polyline.length - 1], firstStopCoords);
    
    if (startDist < bestDistance) {
      bestDistance = startDist;
      bestFeature = polyline;
      reverseBest = false;
    }
    if (endDist < bestDistance) {
      bestDistance = endDist;
      bestFeature = polyline;
      reverseBest = true;
    }
  }

  const result = reverseBest ? [...bestFeature].reverse() : bestFeature;
  polylineCache.set(key, result);
  return result;
}

export function getRoutes(
  sourceStatus: DataSourceStatus,
  activeVehicles: Record<OperationalRouteId, number>
) {
  return (Object.keys(routeBase) as OperationalRouteId[])
    .sort((left, right) => {
      const tierOrder = { core: 0, auxiliary: 1, ferry: 2 } as const;
      return (tierOrder[routeBase[left].tier] ?? 9) - (tierOrder[routeBase[right].tier] ?? 9);
    })
    .map<Route>((routeId) => ({
      ...routeBase[routeId],
      activeVehicles: activeVehicles[routeId] ?? 0,
      status:
        activeVehicles[routeId] > 0
          ? routeBase[routeId].tier === "ferry"
            ? text(
                `${activeVehicles[routeId]} ferries active`,
                `มีเรือออนไลน์ ${activeVehicles[routeId]} ลำ`
              )
            : text(
                `${activeVehicles[routeId]} buses reporting live`,
                `มีรถออนไลน์ ${activeVehicles[routeId]} คัน`
              )
          : text("Falling back to schedule confidence", "กำลังใช้ความเชื่อมั่นจากตารางเวลาแทน"),
      sourceStatus
    }));
}
