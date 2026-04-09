import type {
  LatLngTuple,
  OperationalRouteId,
  Stop,
  VehiclePosition
} from "@shared/types";
import { haversineDistanceMeters } from "./geo";
import { routeDestinationLabel } from "./i18n";
import {
  getBangkokNowMinutes,
  getBangkokNowFractionalMinutes,
  parseScheduleEntries
} from "./time";
import { getStopsForRoute, getDirectionPolyline } from "./routes";
import { FERRY_ROUTE_IDS, OPERATIONAL_ROUTE_IDS, ORANGE_LINE_CONFIG } from "./config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FleetVehicle = {
  vehicleId: string;
  licensePlate: string;
  routeId: OperationalRouteId;
};

type DirectionProfile = {
  routeId: OperationalRouteId;
  directionLabel: string;
  stops: Stop[];
  departures: number[];
  headwayMinutes: number;
  tripDurationMinutes: number;
  stopOffsets: number[];
  polyline: LatLngTuple[];
  polylineCumMeters: number[];
  polylineTotalMeters: number;
  stopPolylineMeters: number[];
};

type TripOccurrence = {
  profile: DirectionProfile;
  departureIndex: number;
  scheduledDepartureMinutes: number;
  ageMinutes: number;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const routeIds = OPERATIONAL_ROUTE_IDS;
const ferryRouteSet = new Set<OperationalRouteId>(FERRY_ROUTE_IDS);
const landRouteIds = routeIds.filter((id) => !ferryRouteSet.has(id));

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function forwardDiff(a: number, b: number) {
  return ((b - a) % 1440 + 1440) % 1440;
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const m = sorted.length >> 1;
  return sorted.length & 1 ? sorted[m] : Math.round((sorted[m - 1]! + sorted[m]!) / 2);
}

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

function bearingDeg(from: LatLngTuple, to: LatLngTuple): number {
  const lat1 = (from[0] * Math.PI) / 180;
  const lat2 = (to[0] * Math.PI) / 180;
  const dLon = ((to[1] - from[1]) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

// ---------------------------------------------------------------------------
// Polyline helpers
// ---------------------------------------------------------------------------

function buildPolylineCumMeters(poly: LatLngTuple[]): number[] {
  const cum = [0];
  for (let i = 1; i < poly.length; i++) {
    cum.push(cum[i - 1] + haversineDistanceMeters(poly[i - 1], poly[i]));
  }
  return cum;
}

/** Find the distance along `poly` that is closest to `pt`. */
function snapToPolyline(pt: LatLngTuple, poly: LatLngTuple[], cum: number[]): number {
  let best = Infinity;
  let bestD = 0;
  for (let i = 0; i < poly.length; i++) {
    const d = haversineDistanceMeters(pt, poly[i]);
    if (d < best) { best = d; bestD = cum[i]; }
  }
  return bestD;
}

/** Interpolate coordinates + heading at `meters` along the polyline. */
function posOnPolyline(
  meters: number,
  poly: LatLngTuple[],
  cum: number[]
): { coordinates: LatLngTuple; heading: number } {
  const total = cum[cum.length - 1];
  const d = clamp(meters, 0, total);

  // binary search
  let lo = 0;
  let hi = cum.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= d) lo = mid; else hi = mid;
  }

  const segLen = cum[hi] - cum[lo];
  const r = segLen > 0 ? (d - cum[lo]) / segLen : 0;
  const a = poly[lo];
  const b = poly[hi];

  return {
    coordinates: [a[0] + (b[0] - a[0]) * r, a[1] + (b[1] - a[1]) * r],
    heading: bearingDeg(a, b)
  };
}

// ---------------------------------------------------------------------------
// Fleet roster — 20 realistic land buses + 13 ferries
// ---------------------------------------------------------------------------

const landBuses: FleetVehicle[] = [
  // Airport Line (Rawai–Airport): 10 buses
  { vehicleId: "pksb-01", licensePlate: "กข 1001 ภูเก็ต", routeId: "rawai-airport" },
  { vehicleId: "pksb-02", licensePlate: "กข 1002 ภูเก็ต", routeId: "rawai-airport" },
  { vehicleId: "pksb-03", licensePlate: "กข 1003 ภูเก็ต", routeId: "rawai-airport" },
  { vehicleId: "pksb-04", licensePlate: "กข 1004 ภูเก็ต", routeId: "rawai-airport" },
  { vehicleId: "pksb-05", licensePlate: "กข 1005 ภูเก็ต", routeId: "rawai-airport" },
  { vehicleId: "pksb-06", licensePlate: "กข 1006 ภูเก็ต", routeId: "rawai-airport" },
  { vehicleId: "pksb-07", licensePlate: "กข 1007 ภูเก็ต", routeId: "rawai-airport" },
  { vehicleId: "pksb-08", licensePlate: "กข 1008 ภูเก็ต", routeId: "rawai-airport" },
  { vehicleId: "pksb-09", licensePlate: "กข 1009 ภูเก็ต", routeId: "rawai-airport" },
  { vehicleId: "pksb-10", licensePlate: "กข 1010 ภูเก็ต", routeId: "rawai-airport" },
  // Patong Line: 7 buses
  { vehicleId: "pksb-11", licensePlate: "กค 2001 ภูเก็ต", routeId: "patong-old-bus-station" },
  { vehicleId: "pksb-12", licensePlate: "กค 2002 ภูเก็ต", routeId: "patong-old-bus-station" },
  { vehicleId: "pksb-13", licensePlate: "กค 2003 ภูเก็ต", routeId: "patong-old-bus-station" },
  { vehicleId: "pksb-14", licensePlate: "กค 2004 ภูเก็ต", routeId: "patong-old-bus-station" },
  { vehicleId: "pksb-15", licensePlate: "กค 2005 ภูเก็ต", routeId: "patong-old-bus-station" },
  { vehicleId: "pksb-16", licensePlate: "กค 2006 ภูเก็ต", routeId: "patong-old-bus-station" },
  { vehicleId: "pksb-17", licensePlate: "กค 2007 ภูเก็ต", routeId: "patong-old-bus-station" },
  // Dragon Line: 3 buses
  { vehicleId: "pksb-18", licensePlate: "กง 3001 ภูเก็ต", routeId: "dragon-line" },
  { vehicleId: "pksb-19", licensePlate: "กง 3002 ภูเก็ต", routeId: "dragon-line" },
  { vehicleId: "pksb-20", licensePlate: "กง 3003 ภูเก็ต", routeId: "dragon-line" },
];

const ferryVessels: FleetVehicle[] = [
  { vehicleId: "ferry-aw-01", licensePlate: "AW Master I", routeId: "rassada-phi-phi" },
  { vehicleId: "ferry-aw-02", licensePlate: "AW Master II", routeId: "rassada-phi-phi" },
  { vehicleId: "ferry-pc-01", licensePlate: "PP Cruiser", routeId: "rassada-phi-phi" },
  { vehicleId: "ferry-ck-01", licensePlate: "Chaokoh 1", routeId: "rassada-phi-phi" },
  { vehicleId: "ferry-ck-02", licensePlate: "Chaokoh 2", routeId: "rassada-phi-phi" },
  { vehicleId: "ferry-an-01", licensePlate: "AO Princess", routeId: "rassada-ao-nang" },
  { vehicleId: "ferry-sw-01", licensePlate: "Suwimol SB", routeId: "bang-rong-koh-yao" },
  { vehicleId: "ferry-sl-01", licensePlate: "Solomon SB", routeId: "bang-rong-koh-yao" },
  { vehicleId: "ferry-ss-01", licensePlate: "Sun Smile", routeId: "bang-rong-koh-yao" },
  { vehicleId: "ferry-ss-02", licensePlate: "Sun Smile II", routeId: "bang-rong-koh-yao" },
  { vehicleId: "ferry-rc-01", licensePlate: "Racha Diver", routeId: "chalong-racha" },
  { vehicleId: "ferry-rc-02", licensePlate: "Racha Star", routeId: "chalong-racha" },
  { vehicleId: "ferry-rc-03", licensePlate: "Racha Bay", routeId: "chalong-racha" },
];

const fleetRoster = [...landBuses, ...ferryVessels];
const fleetByRoute = Object.fromEntries(
  routeIds.map((id) => [id, fleetRoster.filter((v) => v.routeId === id)])
) as Record<OperationalRouteId, FleetVehicle[]>;

// ---------------------------------------------------------------------------
// Schedule derivation
// ---------------------------------------------------------------------------

function deriveHeadway(deps: number[], interval: number | null) {
  if (interval !== null) return interval;
  const diffs = deps.slice(1).map((d, i) => forwardDiff(deps[i], d)).filter((d) => d > 0 && d <= 180);
  return median(diffs) ?? 30;
}

function deriveStopOffsets(stops: Stop[], departures: number[]) {
  const base = departures[0] ?? 0;
  const raw = stops.map((s, i) => {
    if (i === 0) return 0;
    const sd = parseScheduleEntries(s.scheduleText).departures;
    const cands = sd.map((d) => forwardDiff(base, d)).filter((d) => d <= 360);
    return cands.length > 0 ? Math.min(...cands) : null;
  });

  const finite = raw.filter((v): v is number => v !== null);
  const dur = Math.max(finite.at(-1) ?? 0, (stops.length - 1) * 3, 20);
  const filled = raw.map((v, i) => v ?? Math.round((dur * i) / Math.max(1, stops.length - 1)));

  const norm: number[] = [];
  for (const v of filled) norm.push(norm.length === 0 ? 0 : Math.max(norm.at(-1)!, v));
  norm[norm.length - 1] = Math.max(norm.at(-1)!, dur);
  return norm;
}

function deriveTripDuration(stops: Stop[], departures: number[], offsets: number[]) {
  const lastDeps = parseScheduleEntries(stops.at(-1)?.scheduleText ?? "").departures;
  const pairs = departures
    .slice(0, Math.min(departures.length, lastDeps.length))
    .map((d, i) => forwardDiff(d, lastDeps[i]!))
    .filter((d) => d > 0 && d <= 360);
  return clamp(Math.max(median(pairs) ?? 0, offsets.at(-1) ?? 0, 20), 20, 360);
}

// ---------------------------------------------------------------------------
// Build direction profiles with polyline geometry
// ---------------------------------------------------------------------------

function buildDirectionProfiles(routeId: OperationalRouteId) {
  const grouped = new Map<string, Stop[]>();
  for (const stop of getStopsForRoute(routeId)) {
    const key = stop.direction.en;
    const arr = grouped.get(key);
    if (arr) arr.push(stop); else grouped.set(key, [stop]);
  }

  return Array.from(grouped.entries())
    .map<DirectionProfile | null>(([dirLabel, stops]) => {
      const { departures, interval } = parseScheduleEntries(stops[0]?.scheduleText ?? "");
      if (stops.length < 2 || departures.length === 0) return null;

      const stopOffsets = deriveStopOffsets(stops, departures);
      const tripDurationMinutes = deriveTripDuration(stops, departures, stopOffsets);

      // Get polyline for this direction
      const polyline = getDirectionPolyline(routeId, stops[0].coordinates);

      let polylineCumMeters: number[];
      let polylineTotalMeters: number;
      let stopPolylineMeters: number[];

      if (polyline.length >= 2) {
        polylineCumMeters = buildPolylineCumMeters(polyline);
        polylineTotalMeters = polylineCumMeters[polylineCumMeters.length - 1];

        // Snap each stop to polyline, enforce monotonic increasing
        stopPolylineMeters = stops.map((s) => snapToPolyline(s.coordinates, polyline, polylineCumMeters));
        for (let i = 1; i < stopPolylineMeters.length; i++) {
          if (stopPolylineMeters[i] < stopPolylineMeters[i - 1]) {
            stopPolylineMeters[i] = stopPolylineMeters[i - 1];
          }
        }
      } else {
        // Ferries with no/tiny polyline — build straight-line polyline from stops
        const pts: LatLngTuple[] = stops.map((s) => s.coordinates);
        polylineCumMeters = buildPolylineCumMeters(pts);
        polylineTotalMeters = polylineCumMeters[polylineCumMeters.length - 1];
        stopPolylineMeters = polylineCumMeters.slice(); // 1:1 mapping
        // Replace polyline with the stop-derived one
        return {
          routeId, directionLabel: dirLabel, stops, departures,
          headwayMinutes: deriveHeadway(departures, interval),
          tripDurationMinutes, stopOffsets,
          polyline: pts, polylineCumMeters, polylineTotalMeters, stopPolylineMeters
        };
      }

      return {
        routeId, directionLabel: dirLabel, stops, departures,
        headwayMinutes: deriveHeadway(departures, interval),
        tripDurationMinutes, stopOffsets,
        polyline, polylineCumMeters, polylineTotalMeters, stopPolylineMeters
      };
    })
    .filter((p): p is DirectionProfile => Boolean(p));
}

const profilesByRoute = Object.fromEntries(
  routeIds.map((id) => [id, buildDirectionProfiles(id)])
) as Record<OperationalRouteId, DirectionProfile[]>;

function estimateRequiredFleet(routeId: OperationalRouteId) {
  return profilesByRoute[routeId].reduce((n, p) => {
    const pre = clamp(Math.round(p.headwayMinutes / 3), 5, 12);
    const lay = clamp(Math.round(p.headwayMinutes / 4), 4, 10);
    return n + Math.ceil((p.tripDurationMinutes + pre + lay) / p.headwayMinutes) + 1;
  }, 0);
}

// ---------------------------------------------------------------------------
// Stable trip → vehicle mapping
// ---------------------------------------------------------------------------

function tripHash(routeId: string, dir: string, dep: number): number {
  let h = 0;
  const key = `${routeId}:${dir}:${dep}`;
  for (let i = 0; i < key.length; i++) h = ((h << 5) - h + key.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// ---------------------------------------------------------------------------
// Trip occurrences
// ---------------------------------------------------------------------------

function buildTripOccurrences(profile: DirectionProfile, nowMin: number) {
  const pre = clamp(Math.round(profile.headwayMinutes / 3), 5, 12);
  const lay = clamp(Math.round(profile.headwayMinutes / 4), 4, 10);

  return profile.departures
    .map<TripOccurrence | null>((dep, idx) => {
      const ages = [nowMin - dep, nowMin - (dep - 1440)];
      const age = ages.find((a) => a >= -pre && a <= profile.tripDurationMinutes + lay);
      if (age === undefined) return null;
      return { profile, departureIndex: idx, scheduledDepartureMinutes: dep, ageMinutes: age };
    })
    .filter((t): t is TripOccurrence => Boolean(t));
}

// ---------------------------------------------------------------------------
// Position a single vehicle along its polyline
// ---------------------------------------------------------------------------

function buildVehiclePosition(
  vehicle: FleetVehicle,
  occ: TripOccurrence,
  nowIso: string
): VehiclePosition {
  const { profile, ageMinutes } = occ;
  const lastIdx = profile.stops.length - 1;

  let coordinates: LatLngTuple;
  let heading: number;
  let speedKph = 0;
  let status: VehiclePosition["status"] = "dwelling";
  let distToEnd = profile.polylineTotalMeters;
  let stopsAway = lastIdx;

  if (ageMinutes >= profile.tripDurationMinutes) {
    // At terminal
    const pos = posOnPolyline(profile.stopPolylineMeters[lastIdx], profile.polyline, profile.polylineCumMeters);
    coordinates = pos.coordinates; heading = pos.heading;
    distToEnd = 0; stopsAway = 0;
  } else if (ageMinutes <= 0) {
    // Prestart — dwelling at origin
    const pos = posOnPolyline(profile.stopPolylineMeters[0], profile.polyline, profile.polylineCumMeters);
    coordinates = pos.coordinates; heading = pos.heading;
  } else {
    // In transit — find segment by time offset, then map to polyline distance
    const t = clamp(ageMinutes, 0, profile.tripDurationMinutes);
    let seg = profile.stopOffsets.findIndex((o, i) => {
      const next = profile.stopOffsets[i + 1];
      return next !== undefined && t <= next;
    });
    if (seg < 0) seg = Math.max(0, profile.stopOffsets.length - 2);

    const tStart = profile.stopOffsets[seg]!;
    const tEnd = profile.stopOffsets[seg + 1]!;
    const ratio = tEnd > tStart ? clamp((t - tStart) / (tEnd - tStart), 0, 1) : 0;

    const mStart = profile.stopPolylineMeters[seg]!;
    const mEnd = profile.stopPolylineMeters[seg + 1]!;
    const meters = mStart + (mEnd - mStart) * ratio;

    const pos = posOnPolyline(meters, profile.polyline, profile.polylineCumMeters);
    coordinates = pos.coordinates; heading = pos.heading;

    speedKph = profile.tripDurationMinutes > 0
      ? Math.round((profile.polylineTotalMeters / 1000 / (profile.tripDurationMinutes / 60)) * 10) / 10
      : 0;
    const segDur = tEnd - tStart;
    status = (ratio < 0.05 || ratio > 0.95) && segDur > 2 ? "dwelling" : "moving";
    distToEnd = Math.max(0, profile.polylineTotalMeters - meters);
    stopsAway = Math.max(0, lastIdx - seg - (ratio >= 0.85 ? 1 : 0));
  }

  return {
    id: vehicle.vehicleId,
    routeId: vehicle.routeId,
    licensePlate: vehicle.licensePlate,
    vehicleId: vehicle.vehicleId,
    deviceId: null,
    coordinates, heading, speedKph,
    destination: routeDestinationLabel(vehicle.routeId, occ.profile.directionLabel),
    updatedAt: nowIso,
    telemetrySource: "schedule_mock",
    freshness: "fresh",
    status,
    distanceToDestinationMeters: Math.round(distToEnd),
    stopsAway
  };
}

// ---------------------------------------------------------------------------
// Build all vehicles for a route (stable assignment)
// ---------------------------------------------------------------------------

function buildVehiclesForRoute(routeId: OperationalRouteId, nowMin: number, now: Date) {
  const pool = fleetByRoute[routeId];
  if (pool.length === 0) return [];

  const occs = profilesByRoute[routeId].flatMap((p) => buildTripOccurrences(p, nowMin));
  if (occs.length === 0) return [];

  // Priority: active > prestart > layover, then by closeness to now
  const sorted = occs.slice().sort((a, b) => {
    const pa = a.ageMinutes >= 0 && a.ageMinutes <= a.profile.tripDurationMinutes ? 0 : a.ageMinutes < 0 ? 1 : 2;
    const pb = b.ageMinutes >= 0 && b.ageMinutes <= b.profile.tripDurationMinutes ? 0 : b.ageMinutes < 0 ? 1 : 2;
    return pa - pb || Math.abs(a.ageMinutes) - Math.abs(b.ageMinutes) || a.scheduledDepartureMinutes - b.scheduledDepartureMinutes;
  }).slice(0, pool.length);

  const nowIso = now.toISOString();
  const used = new Set<number>();

  return sorted.map((occ) => {
    const h = tripHash(occ.profile.routeId, occ.profile.directionLabel, occ.scheduledDepartureMinutes);
    let idx = h % pool.length;
    let tries = 0;
    while (used.has(idx) && tries < pool.length) { idx = (idx + 1) % pool.length; tries++; }
    used.add(idx);
    return buildVehiclePosition(pool[idx]!, occ, nowIso);
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function buildScheduleMockFleet(now = new Date()) {
  const nowMin = getBangkokNowMinutes(now);
  return routeIds.flatMap((id) => buildVehiclesForRoute(id, nowMin, now));
}

export function getFallbackFleetRoster() {
  return fleetRoster;
}

export function getMockFleetSummary(now = new Date()) {
  const vehicles = buildScheduleMockFleet(now);
  const activeByRoute = Object.fromEntries(
    routeIds.map((id) => [id, vehicles.filter((v) => v.routeId === id).length])
  ) as Record<OperationalRouteId, number>;
  return { rosterSize: fleetRoster.length, activeByRoute };
}

// ---------------------------------------------------------------------------
// Orange Line competitor vehicles (simulated on map as visual reference)
// ---------------------------------------------------------------------------

const orangeBuses: FleetVehicle[] = [
  { vehicleId: "orange-01", licensePlate: "นข 8411 ภูเก็ต", routeId: "rawai-airport" as OperationalRouteId },
  { vehicleId: "orange-02", licensePlate: "นข 8412 ภูเก็ต", routeId: "rawai-airport" as OperationalRouteId },
  { vehicleId: "orange-03", licensePlate: "นข 8413 ภูเก็ต", routeId: "rawai-airport" as OperationalRouteId },
];

function buildOrangeLineVehicles(nowMin: number, now: Date): VehiclePosition[] {
  const cfg = ORANGE_LINE_CONFIG;
  const allDeps = [
    ...cfg.airportDepartures.map((d) => ({ dep: d, dir: "Airport to Town", stops: cfg.stops })),
    ...cfg.townDepartures.map((d) => ({ dep: d, dir: "Town to Airport", stops: [...cfg.stops].reverse() })),
  ];

  const pre = 8;
  const lay = 6;
  const active: { dep: number; dir: string; stops: typeof cfg.stops; age: number }[] = [];

  for (const trip of allDeps) {
    const ages = [nowMin - trip.dep, nowMin - (trip.dep - 1440)];
    const age = ages.find((a) => a >= -pre && a <= cfg.tripDurationMinutes + lay);
    if (age !== undefined) active.push({ ...trip, age });
  }

  active.sort((a, b) => {
    const pa = a.age >= 0 && a.age <= cfg.tripDurationMinutes ? 0 : a.age < 0 ? 1 : 2;
    const pb = b.age >= 0 && b.age <= cfg.tripDurationMinutes ? 0 : b.age < 0 ? 1 : 2;
    return pa - pb || Math.abs(a.age) - Math.abs(b.age);
  });

  const used = new Set<number>();
  const nowIso = now.toISOString();

  return active.slice(0, orangeBuses.length).map((trip) => {
    const h = tripHash("orange-line", trip.dir, trip.dep);
    let idx = h % orangeBuses.length;
    while (used.has(idx)) idx = (idx + 1) % orangeBuses.length;
    used.add(idx);
    const bus = orangeBuses[idx]!;

    const stops = trip.stops;
    const totalStops = stops.length;
    const segDur = cfg.tripDurationMinutes / Math.max(1, totalStops - 1);

    let coordinates: LatLngTuple;
    let heading = 0;
    let status: VehiclePosition["status"] = "dwelling";
    let speedKph = 0;

    if (trip.age >= cfg.tripDurationMinutes) {
      coordinates = stops[totalStops - 1].coordinates;
    } else if (trip.age <= 0) {
      coordinates = stops[0].coordinates;
    } else {
      const seg = Math.min(Math.floor(trip.age / segDur), totalStops - 2);
      const ratio = clamp((trip.age - seg * segDur) / segDur, 0, 1);
      const from = stops[seg].coordinates;
      const to = stops[seg + 1].coordinates;
      coordinates = [from[0] + (to[0] - from[0]) * ratio, from[1] + (to[1] - from[1]) * ratio];
      heading = bearingDeg(from, to);
      status = "moving";
      speedKph = 25;
    }

    return {
      id: bus.vehicleId,
      routeId: "rawai-airport" as OperationalRouteId, // show on map alongside airport line
      licensePlate: bus.licensePlate,
      vehicleId: bus.vehicleId,
      deviceId: null,
      coordinates, heading, speedKph,
      destination: { en: trip.dir, th: trip.dir === "Airport to Town" ? "สนามบิน→เมือง" : "เมือง→สนามบิน", zh: trip.dir, de: trip.dir, fr: trip.dir, es: trip.dir },
      updatedAt: nowIso,
      telemetrySource: "schedule_mock" as const,
      freshness: "fresh" as const,
      status,
      distanceToDestinationMeters: null,
      stopsAway: null
    };
  });
}

/** All vehicles including orange line competitor, computed at current instant.
 *  Uses fractional minutes (seconds precision) for smooth sub-minute animation. */
export function getVehiclesNow(now = new Date()): VehiclePosition[] {
  const nowMin = getBangkokNowFractionalMinutes(now);
  const smart = routeIds.flatMap((id) => buildVehiclesForRoute(id, nowMin, now));
  const orange = buildOrangeLineVehicles(nowMin, now);
  return [...smart, ...orange];
}
