import type { DataSourceStatus, OperationalRouteId, VehiclePosition } from "../../../shared/types.js";
import { BUS_CACHE_MS, BUS_FEED_URL, LIVE_STALE_AFTER_MS, SMARTBUS_BEARER_TOKEN } from "../../config.js";
import { routeDestinationLabel, text } from "../../lib/i18n.js";
import { buildSourceStatus, formatFallbackReason } from "../../lib/sourceStatus.js";
import { fetchJsonWithRetry } from "../../lib/upstream.js";
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

type BusSnapshotResult = {
  expiresAt: number;
  vehicles: VehiclePosition[];
  status: DataSourceStatus;
};

export function inferRoute(record: RawBusRecord): OperationalRouteId | null {
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

function buildStatus(
  state: DataSourceStatus["state"],
  updatedAt: string,
  detail: string,
  fallbackReason: string | null = null
): DataSourceStatus {
  const thaiDetail =
    detail === "Live vehicle feed healthy"
      ? "ระบบรถสดทำงานปกติ"
      : detail === "Using direct GPS telemetry"
        ? "กำลังใช้ข้อมูล GPS ตรงจากอุปกรณ์บนรถ"
        : detail === "Using timetable-shaped mock fleet"
          ? "กำลังใช้ฝูงรถจำลองตามตารางเวลา"
        : "กำลังใช้ตัวอย่างข้อมูลแทน";

  return buildSourceStatus("bus", state, updatedAt, text(detail, thaiDetail), fallbackReason);
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
  if (!SMARTBUS_BEARER_TOKEN) {
    throw new Error("missing SMARTBUS_BEARER_TOKEN");
  }

  return fetchJsonWithRetry<RawBusRecord[]>(
    BUS_FEED_URL,
    {
      headers: {
        Authorization: `Bearer ${SMARTBUS_BEARER_TOKEN}`
      }
    },
    {
      timeoutMs: 5_000,
      retries: 1
    }
  );
}

const ferryRouteSet = new Set<string>(FERRY_ROUTE_IDS);

/** Always generate ferry vehicles from schedule, regardless of bus feed status */
function getMockFerryVehicles(): VehiclePosition[] {
  return buildScheduleMockFleet().filter((v) => ferryRouteSet.has(v.routeId));
}

export async function getBusSnapshot(): Promise<BusSnapshotResult> {
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

    const next: BusSnapshotResult = {
      expiresAt: Date.now() + BUS_CACHE_MS,
      vehicles,
      status: buildStatus("live", latestUpdate, "Live vehicle feed healthy")
    };
    cache = next;
    return next;
  } catch (error) {
    const fallbackReason = formatFallbackReason("bus", error);

    if (telemetryVehicles.length > 0) {
      const vehicles = [...telemetryVehicles, ...ferryVehicles];
      const latestTelemetryUpdate =
        vehicles.map((vehicle) => vehicle.updatedAt).sort().at(-1) ?? new Date().toISOString();

      const next: BusSnapshotResult = {
        expiresAt: Date.now() + BUS_CACHE_MS,
        vehicles,
        status: buildStatus("live", latestTelemetryUpdate, "Using direct GPS telemetry")
      };
      cache = next;
      return next;
    }

    const vehicles = buildScheduleMockFleet();
    const latestUpdate =
      vehicles.map((vehicle) => vehicle.updatedAt).sort().at(-1) ?? new Date().toISOString();

    const next: BusSnapshotResult = {
      expiresAt: Date.now() + BUS_CACHE_MS,
      vehicles,
      status: buildStatus(
        "fallback",
        latestUpdate,
        "Using timetable-shaped mock fleet",
        fallbackReason
      )
    };
    cache = next;
    return next;
  }
}

export function clearBusSnapshotCache() {
  cache = undefined;
}

export async function getVehiclesForRoute(routeId: OperationalRouteId) {
  const snapshot = await getBusSnapshot();
  return {
    vehicles: snapshot.vehicles.filter((vehicle) => vehicle.routeId === routeId),
    status: snapshot.status
  };
}
