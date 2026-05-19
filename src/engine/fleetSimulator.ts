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
import { FERRY_ROUTE_IDS, OPERATIONAL_ROUTE_IDS, ORANGE_LINE_CONFIG, ROUTE_DEFINITIONS } from "./config";

// Detailed timetables — imported from src/data/timetables (copied from server/)
import airportToRawaiTimetable from "../data/timetables/airport-to-rawai.json";
import rawaiToAirportTimetable from "../data/timetables/rawai-to-airport.json";
import ferrySchedules from "../data/timetables/ferry-schedules.json";
import orangeLineTimetable from "../data/timetables/orange-line-8411.json";

// ---------------------------------------------------------------------------
// Detailed timetable types
// ---------------------------------------------------------------------------

type DetailedTimetableStop = { id: string; name: string; name_th: string; lat: number; lng: number };
type DetailedTimetable = {
  route: string;
  direction: string;
  label: string;
  stops: DetailedTimetableStop[];
  departures: { trip: number; times: (string | null)[] }[];
};

type FerryService = {
  operator?: string;
  durationMinutes: number;
  fare?: Record<string, unknown>;
  departures: string[];
  notes?: string;
};
type FerryRouteSchedule = {
  id: string;
  label: string;
  pier: { name: string; lat: number; lng: number };
  destination: { name: string; lat: number; lng: number };
  services: Record<string, FerryService>;
};

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

/** Parse "HH:MM" to minutes from midnight. */
function parseTimeToMinutes(t: string | null): number | null {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

/** Build a lightweight Stop object from timetable data. */
function buildTimetableStop(
  tStop: DetailedTimetableStop,
  seq: number,
  routeId: OperationalRouteId,
  directionLabel: string
): Stop {
  return {
    id: tStop.id,
    routeId,
    sequence: seq,
    name: { en: tStop.name, th: tStop.name_th, zh: tStop.name, de: tStop.name, fr: tStop.name, es: tStop.name },
    direction: { en: directionLabel, th: directionLabel, zh: directionLabel, de: directionLabel, fr: directionLabel, es: directionLabel },
    routeDirection: { en: directionLabel, th: directionLabel, zh: directionLabel, de: directionLabel, fr: directionLabel, es: directionLabel },
    coordinates: [tStop.lat, tStop.lng] as LatLngTuple,
    scheduleText: "",
    nextBus: { label: "", minutesUntil: null, basis: "fallback", notes: { en: "", th: "", zh: "", de: "", fr: "", es: "" } },
    timetable: { firstDepartureLabel: null, lastDepartureLabel: null, nextDepartures: [], serviceWindowLabel: null, sourceLabel: { en: "", th: "", zh: "", de: "", fr: "", es: "" }, sourceUrl: "", sourceUpdatedAt: null, notes: { en: "", th: "", zh: "", de: "", fr: "", es: "" } },
    nearbyPlace: { name: "", mapUrl: "", openingHours: "", distanceMeters: 0, walkMinutes: 0 },
  };
}

/** Build airport-line DirectionProfile from the detailed timetable JSON.
 *  This gives us exact per-stop arrival times instead of the 450 m/min estimate. */
function buildAirportLineProfile(timetable: DetailedTimetable, directionLabel: string): DirectionProfile | null {
  const stops = timetable.stops.map((s, i) => buildTimetableStop(s, i + 1, "rawai-airport", directionLabel));
  if (stops.length < 2) return null;

  // Calculate average segment times across all trips
  const segmentTimes: number[][] = Array.from({ length: stops.length - 1 }, () => []);
  for (const dep of timetable.departures) {
    const times = dep.times.map(parseTimeToMinutes);
    for (let i = 0; i < times.length - 1; i++) {
      const a = times[i];
      const b = times[i + 1];
      if (a !== null && b !== null) {
        const diff = forwardDiff(a, b);
        if (diff > 0 && diff < 120) segmentTimes[i]!.push(diff);
      }
    }
  }

  // Build stop offsets from averaged segment times
  const stopOffsets: number[] = [0];
  for (const segArray of segmentTimes) {
    const avg = segArray.length > 0
      ? Math.round(segArray.reduce((a, b) => a + b, 0) / segArray.length)
      : 5; // fallback 5 min
    stopOffsets.push(stopOffsets[stopOffsets.length - 1]! + avg);
  }

  // Trip duration = offset of last stop
  const tripDurationMinutes = stopOffsets[stopOffsets.length - 1]!;

  // Departures = first-stop times from all trips
  const departures = timetable.departures
    .map(d => parseTimeToMinutes(d.times[0]))
    .filter((t): t is number => t !== null)
    .sort((a, b) => a - b);

  if (departures.length === 0) return null;

  // Headway = median gap between departures
  const headwayMinutes = deriveHeadway(departures, null);

  // Polyline matching
  const firstStopCoords = stops[0]!.coordinates;
  const polyline = getDirectionPolyline("rawai-airport", firstStopCoords);
  const usePolyline = polyline.length >= 2 && polylineMatchesStops(polyline, stops, "rawai-airport");

  if (usePolyline) {
    const polylineCumMeters = buildPolylineCumMeters(polyline);
    const polylineTotalMeters = polylineCumMeters[polylineCumMeters.length - 1]!;

    // Snap each stop to polyline
    const MIN_SEGMENT_METERS = 50;
    const stopPolylineMeters: number[] = [];
    let prevMeters = 0;
    for (let i = 0; i < stops.length; i++) {
      const floor = i === 0 ? 0 : prevMeters + MIN_SEGMENT_METERS;
      const m = snapToPolylineForward(stops[i]!.coordinates, polyline, polylineCumMeters, floor);
      stopPolylineMeters.push(Math.min(polylineTotalMeters, m));
      prevMeters = stopPolylineMeters[i]!;
    }

    return {
      routeId: "rawai-airport",
      directionLabel,
      stops,
      departures,
      headwayMinutes,
      tripDurationMinutes,
      stopOffsets,
      polyline,
      polylineCumMeters,
      polylineTotalMeters,
      stopPolylineMeters,
    };
  }

  // Fallback: straight-line polyline from stops
  const pts = stops.map(s => s.coordinates);
  const polylineCumMeters = buildPolylineCumMeters(pts);
  const polylineTotalMeters = polylineCumMeters[polylineCumMeters.length - 1]!;
  return {
    routeId: "rawai-airport",
    directionLabel,
    stops,
    departures,
    headwayMinutes,
    tripDurationMinutes,
    stopOffsets,
    polyline: pts,
    polylineCumMeters,
    polylineTotalMeters,
    stopPolylineMeters: polylineCumMeters.slice(),
  };
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
// Fleet roster — dynamically generated from schedule-derived fleet sizes
// ---------------------------------------------------------------------------

const FERRY_VESSELS: FleetVehicle[] = [
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

/** Minimum fleet required to maintain a single direction's schedule. */
function computeMinimumFleet(profile: DirectionProfile): number {
  const layover = 10; // minutes
  const roundTrip = profile.tripDurationMinutes * 2 + layover;
  return Math.max(1, Math.ceil(roundTrip / profile.headwayMinutes));
}

/** Generate a land-bus fleet roster sized to the published schedule.
 *  License plates follow Thai prefix conventions by route. */
function generateLandBusRoster(profiles: Record<OperationalRouteId, DirectionProfile[]>): FleetVehicle[] {
  const prefixByRoute: Record<OperationalRouteId, string> = {
    "rawai-airport": "กข",
    "patong-old-bus-station": "กค",
    "dragon-line": "กง",
    "rassada-phi-phi": "",
    "rassada-ao-nang": "",
    "bang-rong-koh-yao": "",
    "chalong-racha": "",
  };

  const roster: FleetVehicle[] = [];
  let globalCounter = 1;

  for (const routeId of landRouteIds) {
    const routeProfiles = profiles[routeId] ?? [];
    // Sum minimum fleet across all direction profiles
    const required = routeProfiles.reduce((n, p) => n + computeMinimumFleet(p), 0);
    const prefix = prefixByRoute[routeId] ?? "กจ";
    for (let i = 0; i < required; i++) {
      roster.push({
        vehicleId: `pksb-${globalCounter}`,
        licensePlate: `${prefix} ${1000 + i + 1} ภูเก็ต`,
        routeId,
      });
      globalCounter++;
    }
  }

  return roster;
}

const fleetRoster: FleetVehicle[] = [];
const fleetByRoute: Record<OperationalRouteId, FleetVehicle[]> = Object.fromEntries(
  routeIds.map((id) => [id, [] as FleetVehicle[]])
) as unknown as Record<OperationalRouteId, FleetVehicle[]>;

/** Late-initialise the fleet roster once profiles are built.
 *  Called automatically on first use. */
let _fleetInit = false;
function ensureFleetRoster() {
  if (_fleetInit) return;
  _fleetInit = true;

  const landBuses = generateLandBusRoster(profilesByRoute);
  const all = [...landBuses, ...FERRY_VESSELS];

  fleetRoster.length = 0;
  fleetRoster.push(...all);

  for (const id of routeIds) {
    fleetByRoute[id] = all.filter((v) => v.routeId === id);
  }
}

// ---------------------------------------------------------------------------
// Fleet analysis — exposed to UI for the right-panel "Buses Required" metric
// ---------------------------------------------------------------------------

export type FleetAnalysis = {
  routeId: OperationalRouteId;
  routeName: string;
  requiredBuses: number;
  headwayMinutes: number;
  tripDurationMinutes: number;
  directionProfiles: {
    directionLabel: string;
    requiredBuses: number;
    headwayMinutes: number;
    tripDurationMinutes: number;
    departuresCount: number;
  }[];
};

/** Get all scheduled departures and hourly seat capacity across ALL routes.
 *  Used by the demand-supply engine in simulation.ts. */
export function getScheduleSupply(): {
  allDepartures: number[];
  capacityByHour: { hour: number; seats: number }[];
} {
  const capacityMap = new Map<number, number>();
  const allDeps: number[] = [];

  for (const routeId of routeIds) {
    const profiles = profilesByRoute[routeId];
    const capacity = routeId === "dragon-line" ? 15 : routeId.includes("ferry") ? 100 : 25;
    for (const profile of profiles) {
      for (const dep of profile.departures) {
        allDeps.push(dep);
        const hour = Math.floor(dep / 60);
        capacityMap.set(hour, (capacityMap.get(hour) ?? 0) + capacity);
      }
    }
  }

  return {
    allDepartures: allDeps.sort((a, b) => a - b),
    capacityByHour: Array.from(capacityMap.entries())
      .map(([hour, seats]) => ({ hour, seats }))
      .sort((a, b) => a.hour - b.hour),
  };
}

/** Get departures from the Airport → Rawai direction only.
 *  Used by the demand-supply engine for airport passenger boarding. */
export function getAirportDepartures(): number[] {
  const profiles = profilesByRoute["rawai-airport"];
  if (!profiles) return [];
  const airportProfile = profiles.find((p) => p.directionLabel === "Bus to Rawai");
  return airportProfile?.departures ?? [];
}

export function getFleetAnalysis(): FleetAnalysis[] {
  ensureFleetRoster();
  return routeIds.map((routeId) => {
    const profiles = profilesByRoute[routeId];
    const routeDef = ROUTE_DEFINITIONS[routeId];
    return {
      routeId,
      routeName: routeDef?.shortName?.en ?? routeId,
      requiredBuses: profiles.reduce((n, p) => n + computeMinimumFleet(p), 0),
      headwayMinutes: profiles[0]?.headwayMinutes ?? 0,
      tripDurationMinutes: profiles[0]?.tripDurationMinutes ?? 0,
      directionProfiles: profiles.map((p) => ({
        directionLabel: p.directionLabel,
        requiredBuses: computeMinimumFleet(p),
        headwayMinutes: p.headwayMinutes,
        tripDurationMinutes: p.tripDurationMinutes,
        departuresCount: p.departures.length,
      })),
    };
  });
}

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

/** Some route datasets reuse the same direction label for multiple
 *  disconnected routes (e.g. Patong line has two separate "Bus to Terminal 1"
 *  routes). Detect gaps > 2.5 km between consecutive stops and split.
 *  Ferries are never split — their stops are naturally far apart (sea crossings). */
function splitDirectionGroups(stops: Stop[], routeId: OperationalRouteId): Stop[][] {
  if (stops.length === 0) return [];
  const isFerry = FERRY_ROUTE_IDS.includes(routeId as never);
  // Airport line is a long-distance corridor — stops can be 8 km apart.
  // Patong/Dragon are local routes where >2.5 km usually means a merged
  // unrelated route (the original bug this function was written for).
  const threshold = isFerry ? Infinity : routeId === "rawai-airport" ? 10000 : 2500;
  const groups: Stop[][] = [[stops[0]!]];
  for (let i = 1; i < stops.length; i++) {
    const prev = stops[i - 1]!;
    const curr = stops[i]!;
    const gap = haversineDistanceMeters(prev.coordinates, curr.coordinates);
    if (gap > threshold) {
      groups.push([curr]);
    } else {
      groups[groups.length - 1]!.push(curr);
    }
  }
  return groups.filter((g) => g.length >= 2);
}

/** If the polyline endpoints are far from the first/last stops, the polyline
 *  doesn't match the route (corrupt/incomplete GeoJSON). Fall back to
 *  straight-line stop-to-stop geometry so buses still move sensibly.
 *  Ferries use a much larger threshold because pier coordinates may not align
 *  exactly with the sea-crossing polyline endpoints. */
function polylineMatchesStops(poly: LatLngTuple[], stops: Stop[], routeId: OperationalRouteId): boolean {
  if (poly.length < 2 || stops.length < 2) return false;

  // Check that both the first and last stop lie somewhere NEAR the polyline
  // (not just near the endpoints). Bus stops are sometimes several hundred
  // metres from a polyline terminus — the Patong outbound first stop is
  // 760m from the polyline start but still clearly on the route. Checking
  // only endpoints caused Patong and Dragon to fall back to straight-line.
  const isFerry = FERRY_ROUTE_IDS.includes(routeId as never);
  const nearestThreshold = isFerry ? 5000 : 500; // max acceptable stop→polyline gap

  function nearestDistToPolyline(pt: LatLngTuple): number {
    let best = Infinity;
    // Subsample to avoid O(n) on 4k-point polylines per call
    const step = Math.max(1, Math.floor(poly.length / 300));
    for (let i = 0; i < poly.length; i += step) {
      const d = haversineDistanceMeters(pt, poly[i]!);
      if (d < best) best = d;
    }
    return best;
  }

  const firstDist = nearestDistToPolyline(stops[0].coordinates);
  const lastDist  = nearestDistToPolyline(stops[stops.length - 1].coordinates);
  return firstDist <= nearestThreshold && lastDist <= nearestThreshold;
}

function buildDirectionProfiles(routeId: OperationalRouteId) {
  const grouped = new Map<string, Stop[]>();
  for (const stop of getStopsForRoute(routeId)) {
    const key = stop.direction.en;
    const arr = grouped.get(key);
    if (arr) arr.push(stop); else grouped.set(key, [stop]);
  }

  // Flatten to individual direction groups, splitting on large gaps
  const allGroups: { dirLabel: string; stops: Stop[] }[] = [];
  for (const [dirLabel, stops] of grouped.entries()) {
    for (const split of splitDirectionGroups(stops, routeId)) {
      allGroups.push({ dirLabel, stops: split });
    }
  }

  return allGroups
    .map<DirectionProfile | null>(({ dirLabel, stops }) => {
      const { departures, interval } = parseScheduleEntries(stops[0]?.scheduleText ?? "");
      if (stops.length < 2 || departures.length === 0) return null;

      let stopOffsets = deriveStopOffsets(stops, departures);
      let tripDurationMinutes = deriveTripDuration(stops, departures, stopOffsets);

      // Get polyline for this direction
      const polyline = getDirectionPolyline(routeId, stops[0].coordinates);
      const usePolyline = polyline.length >= 2 && polylineMatchesStops(polyline, stops, routeId);

      let polylineCumMeters: number[];
      let polylineTotalMeters: number;
      let stopPolylineMeters: number[];

      if (usePolyline) {
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
        // Polyline missing or doesn't match stops — build straight-line polyline from stops
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

// Patch airport-line profiles with detailed timetable data.
// The GeoJSON stop times are corrupted for many stops; the JSON timetables
// have exact per-stop arrival times from the official PKSB schedule.
profilesByRoute["rawai-airport"] = patchAirportProfiles(profilesByRoute["rawai-airport"]);

function patchAirportProfiles(profiles: DirectionProfile[]): DirectionProfile[] {
  return profiles.map((profile) => {
    const timetable =
      profile.directionLabel === "Bus to Rawai" ? airportToRawaiTimetable
      : profile.directionLabel === "Bus to Airport" ? rawaiToAirportTimetable
      : null;
    if (!timetable) return profile;

    // 1. Calculate timetable segment times (average across all trips)
    const segmentTimes: number[][] = Array.from({ length: timetable.stops.length - 1 }, () => []);
    for (const dep of timetable.departures) {
      const times = dep.times.map(parseTimeToMinutes);
      for (let i = 0; i < times.length - 1; i++) {
        const a = times[i];
        const b = times[i + 1];
        if (a !== null && b !== null) {
          const diff = forwardDiff(a, b);
          if (diff > 0 && diff < 120) segmentTimes[i]!.push(diff);
        }
      }
    }
    const avgSegmentTimes = segmentTimes.map((arr) =>
      arr && arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 5
    );

    // 2. Build timetable stop offsets
    const timetableOffsets: number[] = [0];
    for (const seg of avgSegmentTimes) {
      timetableOffsets.push(timetableOffsets[timetableOffsets.length - 1]! + seg);
    }

    // 3. Map timetable stops to profile (GeoJSON) stops by coordinates
    const offsetMap = new Map<number, number>();
    for (let ti = 0; ti < timetable.stops.length; ti++) {
      const tStop = timetable.stops[ti];
      let bestIdx = -1;
      let bestDist = Infinity;
      for (let pi = 0; pi < profile.stops.length; pi++) {
        const d = haversineDistanceMeters([tStop.lat, tStop.lng], profile.stops[pi].coordinates);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = pi;
        }
      }
      if (bestIdx >= 0 && bestDist < 2000) {
        // If multiple timetable stops map to the same profile stop, use the earlier offset
        if (!offsetMap.has(bestIdx) || timetableOffsets[ti]! < offsetMap.get(bestIdx)!) {
          offsetMap.set(bestIdx, timetableOffsets[ti]!);
        }
      }
    }

    // 4. Ensure monotonic mapped offsets
    const mappedIdx = Array.from(offsetMap.keys()).sort((a, b) => a - b);
    const monotonicMap = new Map<number, number>();
    let prevO = 0;
    for (const idx of mappedIdx) {
      const o = Math.max(prevO, offsetMap.get(idx)!);
      monotonicMap.set(idx, o);
      prevO = o;
    }

    // 5. Interpolate for all profile stops using polyline distance
    const firstIdx = mappedIdx[0] ?? 0;
    const lastIdx = mappedIdx[mappedIdx.length - 1] ?? profile.stops.length - 1;
    const firstOffset = monotonicMap.get(firstIdx) ?? 0;
    const lastOffset = monotonicMap.get(lastIdx) ?? timetableOffsets[timetableOffsets.length - 1]!;
    const firstMeters = profile.stopPolylineMeters[firstIdx] ?? 0;
    const lastMeters = profile.stopPolylineMeters[lastIdx] ?? profile.polylineTotalMeters;

    const newOffsets = profile.stops.map((_, i) => {
      if (monotonicMap.has(i)) return monotonicMap.get(i)!;
      if (i <= firstIdx) return 0;
      if (i >= lastIdx) {
        const m = profile.stopPolylineMeters[i] ?? profile.polylineTotalMeters;
        if (lastMeters <= firstMeters) return lastOffset;
        const ratio = (m - firstMeters) / (lastMeters - firstMeters);
        return Math.round(firstOffset + (lastOffset - firstOffset) * ratio);
      }
      const prev = mappedIdx.filter((idx) => idx < i).pop()!;
      const next = mappedIdx.find((idx) => idx > i)!;
      const prevM = profile.stopPolylineMeters[prev]!;
      const nextM = profile.stopPolylineMeters[next]!;
      const prevO = monotonicMap.get(prev)!;
      const nextO = monotonicMap.get(next)!;
      const m = profile.stopPolylineMeters[i]!;
      const ratio = (m - prevM) / (nextM - prevM);
      return Math.round(prevO + (nextO - prevO) * ratio);
    });

    // 6. Final monotonic pass
    const finalOffsets: number[] = [];
    for (const v of newOffsets) {
      finalOffsets.push(finalOffsets.length === 0 ? 0 : Math.max(finalOffsets[finalOffsets.length - 1]!, v));
    }

    // 7. Update departures from timetable
    const departures = timetable.departures
      .map((d) => parseTimeToMinutes(d.times[0]))
      .filter((t): t is number => t !== null)
      .sort((a, b) => a - b);

    return {
      ...profile,
      departures,
      headwayMinutes: deriveHeadway(departures, null),
      tripDurationMinutes: timetableOffsets[timetableOffsets.length - 1]!,
      stopOffsets: finalOffsets,
    };
  });
}

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
    // Use profile.polyline[0] (the actual polyline start vertex) rather than
    // stops[0].coordinates. The renderer calls getDirectionPolyline(routeId,
    // polylineFirstStop) to look up the same polyline the engine used. When
    // stops[0] is in the middle of the route (e.g., Patong Terminal 1 is
    // 1462m into the outbound Patong line), the endpoint-distance search
    // picks the wrong direction and buses appear kilometres off-road.
    polylineFirstStop: profile.polyline[0] ?? profile.stops[0]?.coordinates ?? null
  };
}

// ---------------------------------------------------------------------------
// Build all vehicles for a route (stable assignment)
// ---------------------------------------------------------------------------

function buildVehiclesForRoute(routeId: OperationalRouteId, nowMin: number, now: Date) {
  ensureFleetRoster();
  const pool = fleetByRoute[routeId];
  if (!pool || pool.length === 0) return [];

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

export function buildScheduleMockFleet(now = new Date(), overrideMinutes?: number) {
  // overrideMinutes: use when replaying a specific sim-time (ops console scrubber,
  // getSimulationFrame). When absent, use the live sim clock so the map and
  // the live-ops panel always agree.
  const nowMin = overrideMinutes !== undefined ? overrideMinutes : getSimulatedMinutes();
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
export const SERVICE_START = 330;   // 05:30 — first northbound trip
export const SERVICE_END = 1440;    // 24:00 (00:00 next day)
export const SERVICE_WINDOW = SERVICE_END - SERVICE_START;
const SIM_OPEN_MIN = 540;    // 09:00 — default start time

// ---------------------------------------------------------------------------
// Controllable simulation clock — replaces the old wall-clock-only anchor.
// The clock can be scrubbed, paused, and played at variable speeds.
// All consumers (map, panels, analytics) read from the same source.
// ---------------------------------------------------------------------------

type SimClockState = {
  mode: 'playing' | 'paused';
  currentMinutes: number;
  speed: number;
  lastRealTime: number;
};

const simClock: SimClockState = {
  mode: 'playing',
  currentMinutes: SIM_OPEN_MIN,
  speed: SIM_SPEED,
  lastRealTime: Date.now(),
};

// Optional override for scripted demos / tests. When set, getSimulatedMinutes
// returns clockOverride.fn() instead of the state-derived value.
const clockOverride: { fn: (() => number) | null } = { fn: null };

/** Install (or remove with `null`) a function that returns simulated minutes.
 *  Used by `?demo=tuesday` mode and unit tests. */
export function setClockOverride(fn: (() => number) | null): void {
  clockOverride.fn = fn;
}

export function getSimulatedMinutes(): number {
  if (clockOverride.fn) return clockOverride.fn();

  if (simClock.mode === 'playing') {
    const now = Date.now();
    const elapsedRealMs = now - simClock.lastRealTime;
    const elapsedSimMinutes = (elapsedRealMs / 60_000) * simClock.speed;
    simClock.currentMinutes += elapsedSimMinutes;
    simClock.lastRealTime = now;

    // Wrap around at service end
    if (simClock.currentMinutes >= SERVICE_END) {
      simClock.currentMinutes = SERVICE_START + (simClock.currentMinutes - SERVICE_END) % SERVICE_WINDOW;
    }
  }

  return simClock.currentMinutes;
}

/** Set the simulated time directly (e.g. when user scrubs the time bar). */
export function setSimulatedMinutes(min: number): void {
  simClock.currentMinutes = Math.max(SERVICE_START, Math.min(SERVICE_END, min));
  simClock.lastRealTime = Date.now();
}

/** Pause the simulation clock. */
export function pause(): void {
  simClock.mode = 'paused';
  simClock.lastRealTime = Date.now();
}

/** Resume the simulation clock. */
export function play(): void {
  simClock.mode = 'playing';
  simClock.lastRealTime = Date.now();
}

/** Toggle between playing and paused. */
export function togglePlayPause(): void {
  if (simClock.mode === 'playing') pause();
  else play();
}

/** Set playback speed (1× to 60×). */
export function setSpeed(s: number): void {
  simClock.speed = Math.max(1, Math.min(60, s));
  simClock.lastRealTime = Date.now();
}

export function getClockState(): { mode: SimClockState['mode']; speed: number } {
  return { mode: simClock.mode, speed: simClock.speed };
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

  // Find the matching profile by routeId + polyline start.
  // polylineFirstStop is now profile.polyline[0] (the actual polyline start
  // vertex), not stops[0].coordinates, so we match against p.polyline[0].
  const profiles = profilesByRoute[vehicle.routeId];
  if (!profiles) return null;
  const profile = profiles.find((p) => {
    const pStart = p.polyline[0];
    if (!pStart || !vehicle.polylineFirstStop) return false;
    return Math.abs(pStart[0] - vehicle.polylineFirstStop[0]) < 1e-4 &&
           Math.abs(pStart[1] - vehicle.polylineFirstStop[1]) < 1e-4;
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
