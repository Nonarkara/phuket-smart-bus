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
  toLatLng
} from "../lib/geo.js";
import { readJsonFile, fromRoot } from "../lib/files.js";
import { ROUTE_DEFINITIONS } from "../config.js";
import { buildTimetableSummary } from "../lib/time.js";
import { text } from "../lib/i18n.js";
import type { DataSourceStatus, Route, RouteId, Stop } from "../../shared/types.js";

type StopCollection = FeatureCollection<Point, GeoJsonProperties>;
type LineCollection = FeatureCollection<LineString | MultiLineString, GeoJsonProperties>;

const busStops = readJsonFile<StopCollection>(
  fromRoot("server", "data", "upstream", "bus_stop_all.geojson")
);
const ferryStops = readJsonFile<StopCollection>(
  fromRoot("server", "data", "upstream", "ferry_stops.geojson")
);
const stopsCollection: StopCollection = {
  type: "FeatureCollection",
  features: [...busStops.features, ...ferryStops.features]
};

const lineCollections = Object.fromEntries(
  Object.entries(ROUTE_DEFINITIONS).map(([routeId, config]) => [
    routeId,
    readJsonFile<LineCollection>(
      fromRoot("server", "data", "upstream", config.lineFile)
    )
  ])
) as Record<RouteId, LineCollection>;

function buildStops(routeId: RouteId) {
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
    buildStops(routeId as RouteId)
  ])
) as Record<RouteId, Stop[]>;

const routeBase = Object.fromEntries(
  Object.entries(ROUTE_DEFINITIONS).map(([routeId, config]) => {
    const segments = flattenLineSegments(lineCollections[routeId as RouteId]);
    const flat = flattenBoundsSegments(segments);
    const defaultStop =
      stopsByRoute[routeId as RouteId].find(
        (stop) => stop.name.en === config.defaultStopName
      ) ?? stopsByRoute[routeId as RouteId][0];

    return [
      routeId,
      {
        id: routeId as RouteId,
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
        stopCount: stopsByRoute[routeId as RouteId].length,
        defaultStopId: defaultStop.id
      }
    ];
  })
) as Omit<Route, "activeVehicles" | "status" | "sourceStatus"> extends infer Base
  ? Record<RouteId, Base>
  : never;

export function getStopsForRoute(routeId: RouteId) {
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

export function getStopById(routeId: RouteId, stopId: string) {
  return getStopsForRoute(routeId).find((stop) => stop.id === stopId) ?? null;
}

export function getRoutes(sourceStatus: DataSourceStatus, activeVehicles: Record<RouteId, number>) {
  return (Object.keys(routeBase) as RouteId[])
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
