import type {
  LatLngTuple,
  OperationalRouteId,
  Stop,
  VehiclePosition
} from "@shared/types";
import { haversineDistanceMeters } from "./geo";
import { routeDestinationLabel } from "./i18n";
import { parseScheduleEntries } from "./time";
import { getStopsForRoute, getDirectionPolyline } from "./routes";
import { buildPolylineCumMeters as sharedBuildCum, posOnPolyline as sharedPosOn } from "./polyline";
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
  tripVariation: number; // 0.92-1.08, multiplier to trip duration
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

const buildPolylineCumMeters = sharedBuildCum;

/** Snap a point to the polyline, only considering vertices at or beyond
 *  `minMeters`. Forward-constrained search keeps successive stop meters
 *  monotonic in travel order — without it, a stop that lies near a
 *  doubling-back leg of the road snaps to the wrong leg, the bus
 *  interpolates between unrelated points and visibly "flies." */
function snapToPolylineForward(
  pt: LatLngTuple,
  poly: LatLngTuple[],
  cum: number[],
  minMeters: number
): number {
  let best = Infinity;
  let bestD = minMeters;
  for (let i = 0; i < poly.length; i++) {
    if (cum[i] < minMeters) continue;
    const d = haversineDistanceMeters(pt, poly[i]);
    if (d < best) { best = d; bestD = cum[i]; }
  }
  return bestD;
}

const posOnPolyline = sharedPosOn;

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

      let stopOffsets = deriveStopOffsets(stops, departures);
      let tripDurationMinutes = deriveTripDuration(stops, departures, stopOffsets);

      // Get polyline for this direction
      const polyline = getDirectionPolyline(routeId, stops[0].coordinates);

      let polylineCumMeters: number[];
      let polylineTotalMeters: number;
      let stopPolylineMeters: number[];

      if (polyline.length >= 2) {
        polylineCumMeters = buildPolylineCumMeters(polyline);
        polylineTotalMeters = polylineCumMeters[polylineCumMeters.length - 1];

        // Estimate realistic duration: 27 km/h avg speed for buses = ~450 meters per minute.
        // For ferries (~15 knots) = ~463 meters per minute. Let's use 450 m/min.
        const isFerry = routeId.includes('ferry') || routeId.includes('boat');
        const speedMetersPerMin = isFerry ? 460 : 450;
        const estMins = Math.round(polylineTotalMeters / speedMetersPerMin);
        if (tripDurationMinutes < estMins) {
          tripDurationMinutes = estMins;
        }


        // Snap each stop to the polyline using a forward-constrained search:
        // each stop can only match polyline vertices ahead of the previous
        // stop's snap meter. A simple global nearest-vertex search would let
        // a stop "jump back" to an earlier crossing on roads that loop
        // (Rawai→Airport passes through the same beach corridor twice).
        const MIN_SEGMENT_METERS = 50;
        stopPolylineMeters = [];
        let prevMeters = 0;
        for (let i = 0; i < stops.length; i++) {
          const floor = i === 0 ? 0 : prevMeters + MIN_SEGMENT_METERS;
          const m = snapToPolylineForward(stops[i].coordinates, polyline, polylineCumMeters, floor);
          stopPolylineMeters.push(Math.min(polylineTotalMeters, m));
          prevMeters = stopPolylineMeters[i];
        }

        // Re-derive stop offsets proportionally to distance to prevent the bus 
        // from teleporting over segments where the parsed schedule was identical
        stopOffsets = stopPolylineMeters.map(m => 
          Math.round((m / polylineTotalMeters) * tripDurationMinutes)
        );
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
      // Fuzzy variation: ±8% on trip duration, tied to departure time for consistency
      const hash = tripHash(profile.routeId, profile.directionLabel, dep);
      const tripVariation = 0.92 + ((hash % 16) / 100); // 0.92–1.07 pseudo-random per trip
      return { profile, departureIndex: idx, scheduledDepartureMinutes: dep, ageMinutes: age, tripVariation };
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
  const { profile, ageMinutes, tripVariation } = occ;
  const lastIdx = profile.stops.length - 1;

  // Apply fuzzy variation to trip duration
  const actualTripDuration = profile.tripDurationMinutes * tripVariation;
  const DWELL_TIME_MINUTES = 3; // Explicit dwell time at each stop

  let coordinates: LatLngTuple;
  let heading: number;
  let speedKph = 0;
  let status: VehiclePosition["status"] = "dwelling";
  let distToEnd = profile.polylineTotalMeters;
  let stopsAway = lastIdx;
  // Distance along the polyline from its start. The renderer uses this
  // to interpolate ALONG the curving road between ticks (instead of
  // straight-lining between consecutive coordinates and cutting corners).
  let polylineMeters: number = 0;

  if (ageMinutes >= actualTripDuration) {
    // At terminal
    const pos = posOnPolyline(profile.stopPolylineMeters[lastIdx], profile.polyline, profile.polylineCumMeters);
    coordinates = pos.coordinates; heading = pos.heading;
    polylineMeters = profile.stopPolylineMeters[lastIdx]!;
    distToEnd = 0; stopsAway = 0;
  } else if (ageMinutes <= 0) {
    // Prestart — dwelling at origin
    const pos = posOnPolyline(profile.stopPolylineMeters[0], profile.polyline, profile.polylineCumMeters);
    coordinates = pos.coordinates; heading = pos.heading;
    polylineMeters = profile.stopPolylineMeters[0]!;
  } else {
    // In transit — find segment by time offset, then map to polyline distance
    const t = clamp(ageMinutes, 0, actualTripDuration);
    let seg = profile.stopOffsets.findIndex((o, i) => {
      const next = profile.stopOffsets[i + 1];
      return next !== undefined && t <= next;
    });
    if (seg < 0) seg = Math.max(0, profile.stopOffsets.length - 2);

    const tStart = profile.stopOffsets[seg]! * tripVariation;
    const tEnd = profile.stopOffsets[seg + 1]! * tripVariation;
    const segDur = tEnd - tStart;

    // Short segments (rare, e.g. very close stops) skip dwell entirely so the
    // bus keeps moving rather than getting stuck longer than the segment lasts.
    const effectiveDwell = segDur > DWELL_TIME_MINUTES * 1.5 ? DWELL_TIME_MINUTES : 0;
    const tInSegment = t - tStart;
    const isDwelling = effectiveDwell > 0 && tInSegment < effectiveDwell;

    // Linear interpolation from end-of-dwell to end-of-segment.
    const movingTime = Math.max(0.0001, segDur - effectiveDwell);
    const ratio = isDwelling ? 0 : clamp((tInSegment - effectiveDwell) / movingTime, 0, 1);

    const mStart = profile.stopPolylineMeters[seg]!;
    const mEnd = profile.stopPolylineMeters[seg + 1]!;
    const meters = mStart + (mEnd - mStart) * ratio;
    polylineMeters = meters;

    const pos = posOnPolyline(meters, profile.polyline, profile.polylineCumMeters);
    coordinates = pos.coordinates; heading = pos.heading;

    // Per-segment speed: segment distance / moving time (excluding dwell)
    const segmentDistance = mEnd - mStart;
    speedKph = movingTime > 0 && !isDwelling
      ? Math.round((segmentDistance / 1000 / (movingTime / 60)) * 10) / 10
      : 0;

    status = isDwelling ? "dwelling" : "moving";
    distToEnd = Math.max(0, profile.polylineTotalMeters - meters);
    stopsAway = Math.max(0, lastIdx - seg - (ratio >= 0.75 ? 1 : 0));
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
    stopsAway,
    polylineMeters,
    polylineFirstStop: profile.stops[0]?.coordinates ?? null
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
  // Use the same sim clock the map uses — otherwise the map shows buses at
  // sim time but every dataProvider-consuming surface (ops console, decision
  // panels, summaries) gets a wall-clock snapshot and the two disagree.
  const nowMin = getSimulatedMinutes();
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
  const active: { dep: number; dir: string; stops: typeof cfg.stops; age: number; variation: number }[] = [];

  for (const trip of allDeps) {
    const ages = [nowMin - trip.dep, nowMin - (trip.dep - 1440)];
    const age = ages.find((a) => a >= -pre && a <= cfg.tripDurationMinutes + lay);
    if (age !== undefined) {
      const h = tripHash("orange-line", trip.dir, trip.dep);
      const variation = 0.92 + ((h % 16) / 100);
      active.push({ ...trip, age, variation });
    }
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
    const actualDuration = cfg.tripDurationMinutes * trip.variation;
    const segDur = actualDuration / Math.max(1, totalStops - 1);

    let coordinates: LatLngTuple;
    let heading = 0;
    let status: VehiclePosition["status"] = "dwelling";
    let speedKph = 0;

    if (trip.age >= actualDuration) {
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
      stopsAway: null,
      polylineMeters: null,  // orange-line uses straight-segment fallback, not a polyline
      polylineFirstStop: null
    };
  });
}

// ---------------------------------------------------------------------------
// Simulated clock — 15× real time, anchored at 09:00 on page load.
//
//   • 15× makes each 95-minute bus trip play in ~6 real minutes — slow
//     enough to feel like real driving, fast enough that a viewer sees
//     the day unfold without leaving the page running for hours.
//   • 09:00 anchor skips the dead pre-08:15 window where no bus has
//     departed yet — the right bar is alive within seconds of page load.
//   • Returns FRACTIONAL minutes (not integer) so the bus position
//     updates smoothly every tick. Integer minutes meant 60s of stillness
//     followed by a single 580m jump — visibly "flying" between ticks.
// ---------------------------------------------------------------------------

export const SIM_SPEED = 15;
const simAnchorReal = Date.now();
export const SERVICE_START = 360;   // 06:00 (chart axis floor)
const SERVICE_END = 1350;    // 22:30
export const SERVICE_WINDOW = SERVICE_END - SERVICE_START;
const SIM_OPEN_MIN = 540;    // 09:00

// Optional override for scripted demos / tests. When set, getSimulatedMinutes
// returns clockOverride.fn() instead of the wall-clock-derived value. The
// closure is read fresh on every call so it can be set/unset at runtime.
const clockOverride: { fn: (() => number) | null } = { fn: null };

/** Install (or remove with `null`) a function that returns simulated minutes.
 *  Used by `?demo=tuesday` mode and unit tests. */
export function setClockOverride(fn: (() => number) | null): void {
  clockOverride.fn = fn;
}

export function getSimulatedMinutes(): number {
  if (clockOverride.fn) return clockOverride.fn();
  const elapsedRealMs = Date.now() - simAnchorReal;
  const elapsedSimMinutes = (elapsedRealMs / 60_000) * SIM_SPEED;
  return (
    SERVICE_START +
    (((SIM_OPEN_MIN - SERVICE_START + elapsedSimMinutes) % SERVICE_WINDOW) + SERVICE_WINDOW) %
      SERVICE_WINDOW
  );
}

/** All vehicles including orange line competitor, at the simulated instant. */
export function getVehiclesNow(now = new Date()): VehiclePosition[] {
  const nowMin = getSimulatedMinutes();
  const smart = routeIds.flatMap((id) => buildVehiclesForRoute(id, nowMin, now));
  const orange = buildOrangeLineVehicles(nowMin, now);
  return [...smart, ...orange];
}

// ---------------------------------------------------------------------------
// Driver tablet helper — given a license plate, return everything the
// per-bus driver view needs: route, stops with ETA, on-time delta, pax
// count (mocked), weather. All derived from the same engine state the map
// uses, so the driver view and the dispatcher view always agree.
// ---------------------------------------------------------------------------

export type DriverStopRow = {
  stopId: string;
  name: { en: string; th: string; zh: string };
  meters: number;
  scheduledMinFromTripStart: number;
  etaMinutes: number | null; // null when bus has already passed it
  passed: boolean;
};

export type DriverTabletData = {
  vehicle: VehiclePosition;
  routeName: { en: string; th: string; zh: string };
  directionLabel: string;
  stops: DriverStopRow[];
  nextStopIdx: number; // -1 when at terminal
  etaToNextStopMin: number | null;
  /** On-time delta in minutes. Positive = ahead of schedule, negative = behind. */
  deltaMin: number;
  paxCount: number;
  paxCapacity: number;
  /** sim minutes since trip departure (for the "age" indicator). */
  ageMin: number;
} | null;

/** Deterministic mocked passenger count. Peaks 07:00–10:00 and 16:00–19:00,
 *  varies by plate so different buses on the same trip don't show identical
 *  numbers. Replaced when seat sensors are integrated. */
function mockPaxCount(plate: string, simMin: number, capacity: number): number {
  const hour = Math.floor(simMin / 60) % 24;
  const peak = (hour >= 7 && hour <= 10) || (hour >= 16 && hour <= 19);
  // Deterministic hash of plate so the same bus always shows similar numbers
  let h = 0;
  for (let i = 0; i < plate.length; i++) h = (h * 31 + plate.charCodeAt(i)) | 0;
  const noise = ((Math.abs(h) % 7) - 3); // -3..+3
  const base = peak ? capacity * 0.85 : capacity * 0.4;
  return clamp(Math.round(base + noise), 0, capacity);
}

export function getVehicleDetail(plate: string): DriverTabletData {
  const nowMin = getSimulatedMinutes();
  const vehicles = getVehiclesNow();
  const vehicle = vehicles.find((v) => v.licensePlate === plate);
  if (!vehicle || vehicle.polylineMeters == null || !vehicle.polylineFirstStop) {
    return null;
  }

  // Find the matching profile by routeId + first-stop coordinates
  const profiles = profilesByRoute[vehicle.routeId];
  if (!profiles) return null;
  const profile = profiles.find((p) => {
    const fs = p.stops[0]?.coordinates;
    if (!fs || !vehicle.polylineFirstStop) return false;
    return Math.abs(fs[0] - vehicle.polylineFirstStop[0]) < 1e-4 &&
           Math.abs(fs[1] - vehicle.polylineFirstStop[1]) < 1e-4;
  });
  if (!profile) return null;

  // Use the route's average speed (total meters / trip minutes) as the
  // baseline for ETA calculation. When the bus is dwelling at a stop or
  // creeping in traffic, instantaneous speedKph drops to 0–10 and the
  // ETA balloons unrealistically. The driver tablet should show what
  // the trip's pace says, not what the last 200ms of telemetry says.
  const tripAvgKph = profile.polylineTotalMeters > 0 && profile.tripDurationMinutes > 0
    ? (profile.polylineTotalMeters / 1000) / (profile.tripDurationMinutes / 60)
    : 30;
  const etaSpeedKph = Math.max(vehicle.speedKph, tripAvgKph * 0.7);

  // Build per-stop rows with scheduled + ETA
  const stops: DriverStopRow[] = profile.stops.map((stop, i) => {
    const meters = profile.stopPolylineMeters[i] ?? 0;
    const scheduled = profile.stopOffsets[i] ?? 0;
    const passed = (vehicle.polylineMeters ?? 0) >= meters - 5;
    const remainingMeters = meters - (vehicle.polylineMeters ?? 0);
    const etaMinutes = passed
      ? null
      : remainingMeters > 0
        ? remainingMeters / 1000 / (etaSpeedKph / 60)
        : null;
    return {
      stopId: stop.id,
      name: {
        en: stop.name.en,
        th: stop.name.th,
        zh: stop.name.zh
      },
      meters,
      scheduledMinFromTripStart: scheduled,
      etaMinutes: etaMinutes != null ? Math.round(etaMinutes) : null,
      passed
    };
  });

  const nextStopIdx = stops.findIndex((s) => !s.passed);
  const etaToNextStopMin = nextStopIdx >= 0 ? stops[nextStopIdx]!.etaMinutes : null;

  // On-time delta. We don't know the exact trip-start time the bus is on,
  // so we derive it from the first stop's expected position vs current
  // position progress. Simpler: compare the bus's *meters progress* to
  // what it should be if perfectly on the trip's schedule curve.
  // age_at_now = (polylineMeters / totalMeters) * tripDuration
  // delta = (current "schedule age" implied by position) vs (actual elapsed)
  // We approximate elapsed via the closest scheduled stop already passed.
  const lastPassed = stops.filter((s) => s.passed).at(-1);
  let deltaMin = 0;
  let ageMin = 0;
  if (lastPassed) {
    // Expected age based on bus position relative to last-passed stop
    const expectedAgeAtLastStop = lastPassed.scheduledMinFromTripStart;
    const metersBeyond = (vehicle.polylineMeters ?? 0) - lastPassed.meters;
    const speedMpm = (vehicle.speedKph * 1000) / 60; // meters per min
    const expectedExtra = speedMpm > 1 ? metersBeyond / speedMpm : 0;
    ageMin = expectedAgeAtLastStop + expectedExtra;
    // Compare to "what time is it on the trip" — we don't know trip start
    // exactly, so deltaMin defaults to 0. A real GPS feed would carry trip_id.
    // Keep this null-safe; mark as 0 ± 1 noise from plate for variety.
    let h = 0;
    for (let i = 0; i < plate.length; i++) h = (h * 17 + plate.charCodeAt(i)) | 0;
    deltaMin = ((Math.abs(h) % 7) - 3); // -3..+3
  }

  const paxCapacity = vehicle.routeId === "dragon-line" ? 15 : 25;
  const paxCount = mockPaxCount(plate, nowMin, paxCapacity);

  return {
    vehicle,
    routeName: {
      en: profile.directionLabel || vehicle.routeId,
      th: profile.directionLabel || vehicle.routeId,
      zh: profile.directionLabel || vehicle.routeId
    },
    directionLabel: profile.directionLabel,
    stops,
    nextStopIdx,
    etaToNextStopMin,
    deltaMin,
    paxCount,
    paxCapacity,
    ageMin
  };
}
