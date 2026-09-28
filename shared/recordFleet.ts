/**
 * One writer for the real-bus archive.
 *
 * `/api/live-buses` (the wall screen) and `/api/collect/tick` (the
 * minute cron) both call this. A second sample inside the gap is
 * dropped, so the two callers cannot double-count a boarding or
 * flood KV. The day ledger is still one key per Bangkok date.
 */
import type { LiveBus } from "./pksbFeed";
import {
  applyBusesToDay,
  emptyGpsDay,
  gpsBatchKey,
  gpsDayKey,
  GPS_HISTORY_TTL_S,
  summarizeGpsDay,
  type GpsBusPing,
  type GpsDay,
} from "./gpsBatch";

/** Two samples a minute. A stop is longer than this; a double-fired cron is not. */
export const RECORD_MIN_GAP_MS = 25_000;

export type FleetKv = {
  get(key: string, type: "json"): Promise<unknown>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<unknown>;
};

export type RecordResult = {
  recorded: boolean;
  reason?: "recent" | "no-vehicles";
  date: string;
  vehicles: number;
  totalKmTracked: number;
  totalPaxServed: number;
  totalRevenueThb: number;
  updatedAt: number | null;
};

export function liveBusesToPings(vehicles: LiveBus[]): GpsBusPing[] {
  const pings: GpsBusPing[] = [];
  for (const v of vehicles) {
    if (!v?.plate || !Number.isFinite(v.lat) || !Number.isFinite(v.lng)) continue;
    const ping: GpsBusPing = {
      vehicleId: v.plate,
      licensePlate: v.plate,
      coordinates: [v.lat, v.lng],
      speedKph: v.speedKph,
      heading: v.heading,
      timestamp: v.updatedAt,
    };
    if (v.routeId) ping.routeId = v.routeId;
    if (v.destination) ping.destinationHint = v.destination;
    if (v.paxOnBoard != null) ping.paxCount = v.paxOnBoard;
    pings.push(ping);
  }
  return pings;
}

function totalsOf(day: GpsDay): Pick<RecordResult, "vehicles" | "totalKmTracked" | "totalPaxServed" | "totalRevenueThb" | "updatedAt"> {
  const summary = summarizeGpsDay(day);
  return {
    vehicles: summary.totalTrackedVehicles,
    totalKmTracked: summary.totalKmTracked,
    totalPaxServed: summary.totalPaxServed,
    totalRevenueThb: summary.totalRevenueThb,
    updatedAt: day.updatedAt,
  };
}

export async function recordFleetSample(kv: FleetKv, buses: GpsBusPing[], nowMs: number): Promise<RecordResult> {
  const dayKey = gpsDayKey(nowMs);
  const raw = (await kv.get(dayKey, "json")) as GpsDay | null;
  const prev = raw && typeof raw === "object" && raw.vehicles ? raw : null;

  if (prev && nowMs - prev.updatedAt < RECORD_MIN_GAP_MS) {
    return { recorded: false, reason: "recent", date: prev.date, ...totalsOf(prev) };
  }
  if (buses.length === 0) {
    const date = prev?.date ?? emptyGpsDay(nowMs).date;
    return {
      recorded: false,
      reason: "no-vehicles",
      date,
      vehicles: prev ? Object.keys(prev.vehicles).length : 0,
      totalKmTracked: prev ? totalsOf(prev).totalKmTracked : 0,
      totalPaxServed: prev ? totalsOf(prev).totalPaxServed : 0,
      totalRevenueThb: prev ? totalsOf(prev).totalRevenueThb : 0,
      updatedAt: prev?.updatedAt ?? null,
    };
  }

  const batch = { fetchedAt: nowMs, storedAt: nowMs, source: "pksb-tracker", buses };
  await kv.put(gpsBatchKey(nowMs), JSON.stringify(batch), { expirationTtl: GPS_HISTORY_TTL_S });
  const next = applyBusesToDay(prev ?? emptyGpsDay(nowMs), buses, nowMs);
  await kv.put(dayKey, JSON.stringify(next), { expirationTtl: GPS_HISTORY_TTL_S });
  return { recorded: true, date: next.date, ...totalsOf(next) };
}
