import type { RouteId, VehiclePosition, DataSourceStatus } from "../../../shared/types.js";
import { BUS_CACHE_MS, BUS_FEED_URL, LIVE_STALE_AFTER_MS, PUBLIC_TRACKER_TOKEN } from "../../config.js";
import { routeDestinationLabel, text } from "../../lib/i18n.js";
import { getTelemetryVehicles } from "../operationsStore.js";
import { buildScheduleMockFleet } from "./mockFleetProvider.js";
import { FERRY_ROUTE_IDS } from "../../config.js";

type RawBusRecord = {
  id: number;
  licence: string;
  date: string;
  buffer: string;
  data: {
    azm: number;
    pos: [number, number];
    spd: number;
    time: string;
    buffer: string;
    determineBusDirection: string | [string, number | string, string, number | string, number | string];
    vhc: {
      id: string;
      lc: string;
    };
  };
};

let cache:
  | {
      expiresAt: number;
      vehicles: VehiclePosition[];
      status: DataSourceStatus;
    }
  | undefined;

export function inferRoute(record: RawBusRecord): RouteId | null {
  const hint = [
    record.buffer,
    record.data.buffer,
    Array.isArray(record.data.determineBusDirection)
      ? record.data.determineBusDirection[2]
      : ""
  ]
    .join(" ")
    .toLowerCase();

  if (hint.includes("dragon")) {
    return "dragon-line";
  }

  if (hint.includes("rawai") || hint.includes("airport")) {
    return "rawai-airport";
  }

  if (hint.includes("patong") || hint.includes("terminal")) {
    return "patong-old-bus-station";
  }

  return null;
}

export function normalizeRecord(record: RawBusRecord): VehiclePosition | null {
  const routeId = inferRoute(record);

  if (!routeId) {
    return null;
  }

  const destinationHint = Array.isArray(record.data.determineBusDirection)
    ? String(record.data.determineBusDirection[2])
    : record.data.buffer || record.buffer || "";

  const updatedAt = record.data.time || record.date;
  const isFresh = Date.now() - new Date(updatedAt).getTime() < LIVE_STALE_AFTER_MS;
  const extraDistance = Array.isArray(record.data.determineBusDirection)
    ? Number(record.data.determineBusDirection[3])
    : Number.NaN;
  const stopsAway = Array.isArray(record.data.determineBusDirection)
    ? Number(record.data.determineBusDirection[4])
    : Number.NaN;

  return {
    id: String(record.id),
    routeId,
    licensePlate: record.data.vhc.lc || record.licence,
    vehicleId: record.data.vhc.id,
    deviceId: null,
    coordinates: [record.data.pos[1], record.data.pos[0]],
    heading: Number(record.data.azm ?? 0),
    speedKph: Number(record.data.spd ?? 0),
    destination: routeDestinationLabel(routeId, destinationHint),
    updatedAt,
    telemetrySource: "public_tracker",
    freshness: isFresh ? "fresh" : "stale",
    status:
      record.data.spd > 4 ? "moving" : record.data.spd === 0 ? "dwelling" : "unknown",
    distanceToDestinationMeters: Number.isFinite(extraDistance) ? extraDistance : null,
    stopsAway: Number.isFinite(stopsAway) ? stopsAway : null
  };
}

function buildStatus(state: DataSourceStatus["state"], updatedAt: string, detail: string): DataSourceStatus {
  const thaiDetail =
    detail === "Live vehicle feed healthy"
      ? "ระบบรถสดทำงานปกติ"
      : detail === "Using direct GPS telemetry"
        ? "กำลังใช้ข้อมูล GPS ตรงจากอุปกรณ์บนรถ"
        : detail === "Using timetable-shaped mock fleet"
          ? "กำลังใช้ฝูงรถจำลองตามตารางเวลา"
        : "กำลังใช้ตัวอย่างข้อมูลแทน";

  return {
    source: "bus",
    state,
    updatedAt,
    detail: text(detail, thaiDetail)
  };
}

export function mergeVehiclesWithTelemetry(baseVehicles: VehiclePosition[]) {
  const merged = new Map(baseVehicles.map((vehicle) => [vehicle.vehicleId, vehicle]));

  for (const telemetryVehicle of getTelemetryVehicles()) {
    const existing = merged.get(telemetryVehicle.vehicleId);

    if (!existing || new Date(telemetryVehicle.updatedAt).getTime() >= new Date(existing.updatedAt).getTime()) {
      merged.set(telemetryVehicle.vehicleId, telemetryVehicle);
    }
  }

  return Array.from(merged.values());
}

async function fetchLiveRecords() {
  const response = await fetch(BUS_FEED_URL, {
    headers: {
      Authorization: `Bearer ${PUBLIC_TRACKER_TOKEN}`
    },
    signal: AbortSignal.timeout(5_000)
  });

  if (!response.ok) {
    throw new Error(`Bus feed failed with ${response.status}`);
  }

  return (await response.json()) as RawBusRecord[];
}

const ferryRouteSet = new Set<string>(FERRY_ROUTE_IDS);

/** Always generate ferry vehicles from schedule, regardless of bus feed status */
function getMockFerryVehicles(): VehiclePosition[] {
  return buildScheduleMockFleet().filter((v) => ferryRouteSet.has(v.routeId));
}

export async function getBusSnapshot() {
  if (cache && cache.expiresAt > Date.now()) {
    return cache;
  }

  const telemetryVehicles = getTelemetryVehicles();
  const ferryVehicles = getMockFerryVehicles();

  try {
    const records = await fetchLiveRecords();
    const busVehicles = mergeVehiclesWithTelemetry(
      records.map(normalizeRecord).filter((item): item is VehiclePosition => Boolean(item))
    );
    // Merge live bus data with simulated ferry data
    const vehicles = [...busVehicles, ...ferryVehicles];
    const latestUpdate =
      vehicles.map((vehicle) => vehicle.updatedAt).sort().at(-1) ?? new Date().toISOString();

    cache = {
      expiresAt: Date.now() + BUS_CACHE_MS,
      vehicles,
      status: buildStatus("live", latestUpdate, "Live vehicle feed healthy")
    };

    return cache;
  } catch {
    if (telemetryVehicles.length > 0) {
      const vehicles = [...telemetryVehicles, ...ferryVehicles];
      const latestTelemetryUpdate =
        vehicles.map((vehicle) => vehicle.updatedAt).sort().at(-1) ?? new Date().toISOString();

      cache = {
        expiresAt: Date.now() + BUS_CACHE_MS,
        vehicles,
        status: buildStatus("live", latestTelemetryUpdate, "Using direct GPS telemetry")
      };

      return cache;
    }

    const vehicles = buildScheduleMockFleet();
    const latestUpdate =
      vehicles.map((vehicle) => vehicle.updatedAt).sort().at(-1) ?? new Date().toISOString();

    cache = {
      expiresAt: Date.now() + BUS_CACHE_MS,
      vehicles,
      status: buildStatus("fallback", latestUpdate, "Using timetable-shaped mock fleet")
    };

    return cache;
  }
}

export function clearBusSnapshotCache() {
  cache = undefined;
}

export async function getVehiclesForRoute(routeId: RouteId) {
  const snapshot = await getBusSnapshot();
  return {
    vehicles: snapshot.vehicles.filter((vehicle) => vehicle.routeId === routeId),
    status: snapshot.status
  };
}
