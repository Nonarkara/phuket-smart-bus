/**
 * Cloudflare Pages Function: GET /api/collect/revenue
 *
 * Computes live operational revenue from real GPS batches stored in
 * Cloudflare KV (PKSB_GPS_HISTORY).
 *
 * Traces the real vehicle telemetry collected by the Phuket GPS producer:
 * - Distance driven per vehicle
 * - Real passenger counts from APC door sensors (or trip-calibrated load)
 * - Gross revenue: pax × ฿100 flat fare
 * - Operating costs: distance × ฿35/km (fuel + amortized maintenance + driver)
 * - Net operating margin: Gross revenue − Operating costs
 * - Environmental impact: pax × 4.2 kg CO₂ saved vs taxi
 */

interface PagesEventContext {
  request: Request;
  env: Record<string, string> & {
    GPS_HISTORY?: any;
  };
}

interface CollectedBusPing {
  vehicleId: string;
  licensePlate?: string;
  coordinates: [number, number];
  speedKph: number;
  heading?: number;
  timestamp: string;
  routeId?: string;
  destinationHint?: string;
  satellites?: number;
  paxCount?: number;
}

interface CollectPayload {
  fetchedAt: number;
  source: string;
  buses: CollectedBusPing[];
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Accept, Content-Type",
  "Cache-Control": "public, max-age=10, s-maxage=20",
};

const FARE_THB = 100;
const OPEX_PER_KM_THB = 35;
const NOMINAL_CORRIDOR_KM = 35;
const CALIBRATED_PAX_PER_TRIP = 18;
const GRAB_EQUIV_FARE_THB = 720;
const CO2_KG_PER_PAX = 4.2;
const DEPOT_COORDS: [number, number] = [7.8814, 98.4093];

function haversineKm(c1: [number, number], c2: [number, number]): number {
  const [lat1, lon1] = c1;
  const [lat2, lon2] = c2;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function computeRevenueFromBatches(batches: Array<CollectPayload & { storedAt?: number }>) {
  // Sort chronologically
  const sorted = [...batches].sort((a, b) => a.fetchedAt - b.fetchedAt);

  interface VehicleLedger {
    vehicleId: string;
    licensePlate: string;
    totalPings: number;
    inTransitPings: number;
    dwellingPings: number;
    depotPings: number;
    totalDistanceKm: number;
    lastCoords?: [number, number];
    lastTimestampMs?: number;
    lastPaxCount?: number;
    apcBoardings: number;
    tripsCompleted: number;
    paxServed: number;
    revenueThb: number;
    operatingCostThb: number;
    netMarginThb: number;
    co2SavedKg: number;
    lastSpeedKph: number;
    lastSeenAt: string;
    lastState: "in_transit" | "dwelling" | "parked_depot";
  }

  const vehicles = new Map<string, VehicleLedger>();

  for (const batch of sorted) {
    const batchTime = batch.fetchedAt;
    for (const bus of batch.buses) {
      if (!bus?.coordinates || bus.coordinates.length !== 2) continue;
      const [lat, lon] = bus.coordinates;
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || (lat === 0 && lon === 0)) continue;

      const id = bus.vehicleId || bus.licensePlate || "unknown";
      let v = vehicles.get(id);
      if (!v) {
        v = {
          vehicleId: id,
          licensePlate: bus.licensePlate || id,
          totalPings: 0,
          inTransitPings: 0,
          dwellingPings: 0,
          depotPings: 0,
          totalDistanceKm: 0,
          apcBoardings: 0,
          tripsCompleted: 0,
          paxServed: 0,
          revenueThb: 0,
          operatingCostThb: 0,
          netMarginThb: 0,
          co2SavedKg: 0,
          lastSpeedKph: 0,
          lastSeenAt: bus.timestamp,
          lastState: "dwelling",
        };
        vehicles.set(id, v);
      }

      v.totalPings++;
      v.lastSeenAt = bus.timestamp;
      v.lastSpeedKph = bus.speedKph;

      const isDepot = haversineKm(bus.coordinates, DEPOT_COORDS) <= 0.45;
      const state = isDepot ? "parked_depot" : bus.speedKph > 4 ? "in_transit" : "dwelling";
      v.lastState = state;

      if (state === "in_transit") v.inTransitPings++;
      else if (state === "dwelling") v.dwellingPings++;
      else v.depotPings++;

      // Distance calculation
      if (v.lastCoords && v.lastTimestampMs) {
        const dKm = haversineKm(v.lastCoords, bus.coordinates);
        const timeDiffHours = Math.max(1 / 3600, (batchTime - v.lastTimestampMs) / 3_600_000);
        const impliedSpeed = dKm / timeDiffHours;

        if (dKm >= 0.015 && impliedSpeed <= 120) {
          v.totalDistanceKm += dKm;
        }
      }
      v.lastCoords = bus.coordinates;
      v.lastTimestampMs = batchTime;

      // Trips
      v.tripsCompleted = Math.max(v.tripsCompleted, Math.floor(v.totalDistanceKm / NOMINAL_CORRIDOR_KM));

      // APC boardings
      if (bus.paxCount != null && Number.isFinite(bus.paxCount)) {
        const cur = Math.max(0, bus.paxCount);
        if (v.lastPaxCount != null) {
          if (cur > v.lastPaxCount) v.apcBoardings += (cur - v.lastPaxCount);
        } else if (cur > 0) {
          v.apcBoardings += cur;
        }
        v.lastPaxCount = cur;
      }

      // Pax served & financials
      if (v.apcBoardings > 0) {
        v.paxServed = v.apcBoardings;
      } else {
        const inTransitKm = v.totalDistanceKm % NOMINAL_CORRIDOR_KM;
        const inTransitPax = Math.round(inTransitKm * 0.5);
        v.paxServed = (v.tripsCompleted * CALIBRATED_PAX_PER_TRIP) + inTransitPax;
      }

      v.revenueThb = v.paxServed * FARE_THB;
      v.operatingCostThb = Math.round(v.totalDistanceKm * OPEX_PER_KM_THB);
      v.netMarginThb = v.revenueThb - v.operatingCostThb;
      v.co2SavedKg = Math.round(v.paxServed * CO2_KG_PER_PAX * 10) / 10;
    }
  }

  const vehicleList = Array.from(vehicles.values()).sort(
    (a, b) => b.revenueThb - a.revenueThb || b.totalDistanceKm - a.totalDistanceKm
  );

  const totalKmTracked = Math.round(vehicleList.reduce((s, v) => s + v.totalDistanceKm, 0) * 10) / 10;
  const totalRevenueThb = vehicleList.reduce((s, v) => s + v.revenueThb, 0);
  const totalOperatingCostThb = vehicleList.reduce((s, v) => s + v.operatingCostThb, 0);
  const netMarginThb = totalRevenueThb - totalOperatingCostThb;
  const profitMarginPct = totalRevenueThb > 0 ? Math.round((netMarginThb / totalRevenueThb) * 100) : 0;
  const totalPaxServed = vehicleList.reduce((s, v) => s + v.paxServed, 0);
  const totalTripsCompleted = vehicleList.reduce((s, v) => s + v.tripsCompleted, 0);
  const totalCo2SavedKg = Math.round(totalPaxServed * CO2_KG_PER_PAX * 10) / 10;
  const passengerSavingsThb = totalPaxServed * (GRAB_EQUIV_FARE_THB - FARE_THB);

  return {
    totalTrackedVehicles: vehicleList.length,
    activeVehiclesCount: vehicleList.filter((v) => v.lastState !== "parked_depot").length,
    depotVehiclesCount: vehicleList.filter((v) => v.lastState === "parked_depot").length,
    totalKmTracked,
    totalPaxServed,
    totalRevenueThb,
    totalOperatingCostThb,
    netMarginThb,
    profitMarginPct,
    totalTripsCompleted,
    totalCo2SavedKg,
    passengerSavingsThb,
    revenuePerKm: totalKmTracked > 0 ? Math.round((totalRevenueThb / totalKmTracked) * 10) / 10 : 0,
    vehicles: vehicleList.map((v) => ({
      vehicleId: v.vehicleId,
      licensePlate: v.licensePlate,
      totalDistanceKm: Math.round(v.totalDistanceKm * 10) / 10,
      tripsCompleted: v.tripsCompleted,
      paxServed: v.paxServed,
      revenueThb: v.revenueThb,
      operatingCostThb: v.operatingCostThb,
      netMarginThb: v.netMarginThb,
      co2SavedKg: v.co2SavedKg,
      lastState: v.lastState,
      lastSpeedKph: v.lastSpeedKph,
      lastSeenAt: v.lastSeenAt,
    })),
  };
}

export async function onRequestGet(context: PagesEventContext): Promise<Response> {
  const kv = context.env.GPS_HISTORY;
  if (!kv) {
    return new Response(
      JSON.stringify({ error: "KV binding GPS_HISTORY is not configured on this Pages project" }),
      { status: 503, headers: { "Content-Type": "application/json", ...CORS } }
    );
  }

  try {
    const listed = await kv.list({ prefix: "batch:", limit: 100 });
    const batches: Array<CollectPayload & { storedAt?: number }> = [];

    for (const entry of listed.keys) {
      const val = await kv.get(entry.name, "json");
      if (val && Array.isArray((val as any).buses)) {
        batches.push(val as CollectPayload);
      }
    }

    const revenueSummary = computeRevenueFromBatches(batches);

    return new Response(
      JSON.stringify({
        ok: true,
        batchesAnalyzed: batches.length,
        ...revenueSummary,
        serverTime: Date.now(),
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...CORS } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: "Failed to compute revenue from KV batches",
        details: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: { "Content-Type": "application/json", ...CORS } }
    );
  }
}

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Accept, Content-Type",
      "Access-Control-Max-Age": "600",
    },
  });
}
