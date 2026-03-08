import type { RouteId, VehiclePosition, DataSourceStatus } from "../../../shared/types.js";
import { BUS_CACHE_MS, BUS_FEED_URL, LIVE_STALE_AFTER_MS, PUBLIC_TRACKER_TOKEN } from "../../config.js";
import { readJsonFile, fromRoot } from "../../lib/files.js";
import { routeDestinationLabel, text } from "../../lib/i18n.js";

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

const fallbackSample = readJsonFile<RawBusRecord[]>(
  fromRoot("server", "data", "fixtures", "bus_live_sample.json")
);

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
    coordinates: [record.data.pos[1], record.data.pos[0]],
    heading: Number(record.data.azm ?? 0),
    speedKph: Number(record.data.spd ?? 0),
    destination: routeDestinationLabel(routeId, destinationHint),
    updatedAt,
    freshness: isFresh ? "fresh" : "stale",
    status:
      record.data.spd > 4 ? "moving" : record.data.spd === 0 ? "dwelling" : "unknown",
    distanceToDestinationMeters: Number.isFinite(extraDistance) ? extraDistance : null,
    stopsAway: Number.isFinite(stopsAway) ? stopsAway : null
  };
}

function buildStatus(state: DataSourceStatus["state"], updatedAt: string, detail: string): DataSourceStatus {
  return {
    source: "bus",
    state,
    updatedAt,
    detail: text(detail, detail === "Live vehicle feed healthy" ? "ระบบรถสดทำงานปกติ" : "กำลังใช้ตัวอย่างข้อมูลแทน")
  };
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

export async function getBusSnapshot() {
  if (cache && cache.expiresAt > Date.now()) {
    return cache;
  }

  try {
    const records = await fetchLiveRecords();
    const vehicles = records.map(normalizeRecord).filter((item): item is VehiclePosition => Boolean(item));
    const latestUpdate =
      vehicles.map((vehicle) => vehicle.updatedAt).sort().at(-1) ?? new Date().toISOString();

    cache = {
      expiresAt: Date.now() + BUS_CACHE_MS,
      vehicles,
      status: buildStatus("live", latestUpdate, "Live vehicle feed healthy")
    };

    return cache;
  } catch {
    const vehicles = fallbackSample
      .map(normalizeRecord)
      .filter((item): item is VehiclePosition => Boolean(item));
    const latestUpdate =
      vehicles.map((vehicle) => vehicle.updatedAt).sort().at(-1) ?? new Date().toISOString();

    cache = {
      expiresAt: Date.now() + BUS_CACHE_MS,
      vehicles,
      status: buildStatus("fallback", latestUpdate, "Using cached live sample")
    };

    return cache;
  }
}

export async function getVehiclesForRoute(routeId: RouteId) {
  const snapshot = await getBusSnapshot();
  return {
    vehicles: snapshot.vehicles.filter((vehicle) => vehicle.routeId === routeId),
    status: snapshot.status
  };
}
