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
  parseScheduleEntries
} from "./time";
import { getStopsForRoute, getDirectionPolyline } from "./routes";
import { FERRY_ROUTE_IDS, OPERATIONAL_ROUTE_IDS } from "./config";
import busLiveSample from "../data/fixtures/bus_live_sample.json";

type RawBusRecord = {
  licence: string;
  buffer: string;
  data: {
    buffer: string;
    determineBusDirection: string | [string, number | string, string, number | string, number | string];
    vhc: {
      id: string;
      lc: string;
    };
  };
};

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
  stopOffsets: number[]; // minutes from departure for each stop
  // Polyline geometry for road-snapped interpolation
  polyline: LatLngTuple[];
  polylineCumMeters: number[];
  polylineTotalMeters: number;
  stopPolylineMeters: number[]; // distance along polyline for each stop
};

type TripOccurrence = {
  profile: DirectionProfile;
  departureIndex: number;
  scheduledDepartureMinutes: number;
  ageMinutes: number;
};

const routeIds = OPERATIONAL_ROUTE_IDS;
const ferryRouteSet = new Set<OperationalRouteId>(FERRY_ROUTE_IDS);
const landRouteIds = routeIds.filter((routeId) => !ferryRouteSet.has(routeId));

const fallbackSample = busLiveSample as unknown as RawBusRecord[];

function inferRoute(record: RawBusRecord): OperationalRouteId | null {
  const hint = [
    record.buffer,
    record.data.buffer,
    Array.isArray(record.data.determineBusDirection) ? record.data.determineBusDirection[2] : ""
  ]
    .join(" ")
    .toLowerCase();

  if (hint.includes("dragon")) return "dragon-line";
  if (hint.includes("rawai") || hint.includes("airport")) return "rawai-airport";
  if (hint.includes("patong") || hint.includes("terminal")) return "patong-old-bus-station";
  return null;
}

function forwardDiff(fromMinutes: number, toMinutes: number) {
  return ((toMinutes - fromMinutes) % (24 * 60) + 24 * 60) % (24 * 60);
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

// --- Polyline utilities ---

function buildPolylineCumulativeMeters(polyline: LatLngTuple[]): number[] {
  const cum = [0];
  for (let i = 1; i < polyline.length; i++) {
    cum.push(cum[i - 1] + haversineDistanceMeters(polyline[i - 1], polyline[i]));
  }
  return cum;
}

/** Find the nearest point on the polyline to a given coordinate, return distance along polyline */
function snapToPolyline(
  point: LatLngTuple,
  polyline: LatLngTuple[],
  cumMeters: number[]
): number {
  let bestDist = Infinity;
  let bestPolyDist = 0;

  for (let i = 0; i < polyline.length; i++) {
    const d = haversineDistanceMeters(point, polyline[i]);
    if (d < bestDist) {
      bestDist = d;
      bestPolyDist = cumMeters[i];
    }
  }

  return bestPolyDist;
}

/** Interpolate a position along the polyline at a given distance in meters */
function interpolateAlongPolyline(
  distanceMeters: number,
  polyline: LatLngTuple[],
  cumMeters: number[]
): { coordinates: LatLngTuple; heading: number } {
  const total = cumMeters[cumMeters.length - 1];
  const d = clamp(distanceMeters, 0, total);

  // Binary search for the segment
  let lo = 0;
  let hi = cumMeters.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (cumMeters[mid] <= d) lo = mid;
    else hi = mid;
  }

  const segStart = cumMeters[lo];
  const segEnd = cumMeters[hi];
  const segLen = segEnd - segStart;
  const ratio = segLen > 0 ? (d - segStart) / segLen : 0;

  const from = polyline[lo];
  const to = polyline[hi];

  const coordinates: LatLngTuple = [
    from[0] + (to[0] - from[0]) * ratio,
    from[1] + (to[1] - from[1]) * ratio
  ];

  const heading = bearingDeg(from, to);

  return { coordinates, heading };
}

function bearingDeg(from: LatLngTuple, to: LatLngTuple): number {
  const startLat = (from[0] * Math.PI) / 180;
  const endLat = (to[0] * Math.PI) / 180;
  const deltaLon = ((to[1] - from[1]) * Math.PI) / 180;
  const y = Math.sin(deltaLon) * Math.cos(endLat);
  const x =
    Math.cos(startLat) * Math.sin(endLat) -
    Math.sin(startLat) * Math.cos(endLat) * Math.cos(deltaLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

// --- Fleet roster ---

function buildRouteTargets(totalVehicles: number, knownCounts: Record<OperationalRouteId, number>) {
  const weights = landRouteIds.map((routeId) => ({
    routeId,
    weight: getStopsForRoute(routeId).length
  }));
  const totalWeight = weights.reduce((sum, item) => sum + item.weight, 0);
  const targets = Object.fromEntries(
    landRouteIds.map((routeId) => [routeId, 0])
  ) as Record<OperationalRouteId, number>;
  const minimums = Object.fromEntries(
    landRouteIds.map((routeId) => [routeId, 0])
  ) as Record<OperationalRouteId, number>;
  const remainders = weights.map((item) => {
    const rawTarget = (totalVehicles * item.weight) / totalWeight;
    const minimum = Math.max(knownCounts[item.routeId], estimateRequiredFleet(item.routeId));
    minimums[item.routeId] = minimum;
    const floored = Math.max(Math.floor(rawTarget), minimum);
    targets[item.routeId] = floored;
    return { routeId: item.routeId, remainder: rawTarget - Math.floor(rawTarget) };
  });

  while (Object.values(targets).reduce((sum, value) => sum + value, 0) < totalVehicles) {
    const next = remainders.sort((left, right) => right.remainder - left.remainder).find(() => true);
    if (!next) break;
    targets[next.routeId] += 1;
    next.remainder = 0;
  }

  while (Object.values(targets).reduce((sum, value) => sum + value, 0) > totalVehicles) {
    const reducible = landRouteIds
      .map((routeId) => ({ routeId, excess: targets[routeId] - minimums[routeId] }))
      .sort((left, right) => right.excess - left.excess)[0];
    if (!reducible || reducible.excess <= 0) break;
    targets[reducible.routeId] -= 1;
  }

  return targets;
}

function buildFleetRoster() {
  const sortedRecords = [...fallbackSample].sort((left, right) =>
    (left.data.vhc.lc || left.licence).localeCompare(right.data.vhc.lc || right.licence)
  );
  const known: FleetVehicle[] = [];
  const unknown: Omit<FleetVehicle, "routeId">[] = [];

  for (const record of sortedRecords) {
    const vehicle = {
      vehicleId: record.data.vhc.id,
      licensePlate: record.data.vhc.lc || record.licence
    };
    const routeId = inferRoute(record);

    if (routeId) {
      known.push({ ...vehicle, routeId });
      continue;
    }

    unknown.push(vehicle);
  }

  const knownCounts = Object.fromEntries(
    landRouteIds.map((routeId) => [routeId, 0])
  ) as Record<OperationalRouteId, number>;

  for (const vehicle of known) {
    if (vehicle.routeId in knownCounts) {
      knownCounts[vehicle.routeId] += 1;
    }
  }

  const targets = buildRouteTargets(sortedRecords.length, knownCounts);
  const remainingCapacity = Object.fromEntries(
    landRouteIds.map((routeId) => [routeId, targets[routeId] - knownCounts[routeId]])
  ) as Record<OperationalRouteId, number>;

  const assignedUnknown = unknown.map<FleetVehicle>((vehicle) => {
    const routeId =
      landRouteIds
        .map((candidate) => ({ routeId: candidate, capacity: remainingCapacity[candidate] }))
        .sort((left, right) => right.capacity - left.capacity)[0]?.routeId ?? "rawai-airport";

    remainingCapacity[routeId] = Math.max(0, remainingCapacity[routeId] - 1);
    return { ...vehicle, routeId };
  });

  return [...known, ...assignedUnknown];
}

// --- Schedule derivation ---

function deriveHeadway(departures: number[], interval: number | null) {
  if (interval !== null) return interval;
  const diffs = departures
    .slice(1)
    .map((departure, index) => forwardDiff(departures[index], departure))
    .filter((value) => value > 0 && value <= 180);
  return median(diffs) ?? 30;
}

function deriveStopOffsets(stops: Stop[], departures: number[]) {
  const baseline = departures[0] ?? 0;
  const rawOffsets = stops.map((stop, index) => {
    if (index === 0) return 0;
    const stopDepartures = parseScheduleEntries(stop.scheduleText).departures;
    const candidates = stopDepartures
      .map((departure) => forwardDiff(baseline, departure))
      .filter((value) => value <= 6 * 60);
    return candidates.length > 0 ? Math.min(...candidates) : null;
  });

  const finiteOffsets = rawOffsets.filter((value): value is number => value !== null);
  const inferredDuration = Math.max(finiteOffsets.at(-1) ?? 0, (stops.length - 1) * 3, 20);
  const filled = rawOffsets.map((value, index) => {
    if (value !== null) return value;
    return Math.round((inferredDuration * index) / Math.max(1, stops.length - 1));
  });

  const normalized: number[] = [];
  for (const offset of filled) {
    normalized.push(normalized.length === 0 ? 0 : Math.max(normalized.at(-1) ?? 0, offset));
  }
  normalized[normalized.length - 1] = Math.max(normalized.at(-1) ?? 0, inferredDuration);

  return normalized;
}

function deriveTripDuration(stops: Stop[], departures: number[], stopOffsets: number[]) {
  const lastStopDepartures = parseScheduleEntries(stops.at(-1)?.scheduleText ?? "").departures;
  const pairDurations = departures
    .slice(0, Math.min(departures.length, lastStopDepartures.length))
    .map((departure, index) => forwardDiff(departure, lastStopDepartures[index]!))
    .filter((value) => value > 0 && value <= 6 * 60);
  return clamp(Math.max(median(pairDurations) ?? 0, stopOffsets.at(-1) ?? 0, 20), 20, 6 * 60);
}

// --- Build direction profiles with polyline geometry ---

function buildDirectionProfiles(routeId: OperationalRouteId) {
  const grouped = new Map<string, Stop[]>();

  for (const stop of getStopsForRoute(routeId)) {
    const key = stop.direction.en;
    const current = grouped.get(key);
    if (current) {
      current.push(stop);
      continue;
    }
    grouped.set(key, [stop]);
  }

  return Array.from(grouped.entries())
    .map<DirectionProfile | null>(([directionLabel, stops]) => {
      const { departures, interval } = parseScheduleEntries(stops[0]?.scheduleText ?? "");
      if (stops.length < 2 || departures.length === 0) return null;

      const stopOffsets = deriveStopOffsets(stops, departures);
      const tripDurationMinutes = deriveTripDuration(stops, departures, stopOffsets);

      // Get the polyline for this direction (matched by first stop proximity)
      const polyline = getDirectionPolyline(routeId, stops[0].coordinates);

      let polylineCumMeters: number[];
      let polylineTotalMeters: number;
      let stopPolylineMeters: number[];

      if (polyline.length >= 2) {
        polylineCumMeters = buildPolylineCumulativeMeters(polyline);
        polylineTotalMeters = polylineCumMeters[polylineCumMeters.length - 1];
        // Snap each stop to the nearest polyline point
        stopPolylineMeters = stops.map((stop) =>
          snapToPolyline(stop.coordinates, polyline, polylineCumMeters)
        );
        // Ensure monotonically increasing (stops should progress along the route)
        for (let i = 1; i < stopPolylineMeters.length; i++) {
          if (stopPolylineMeters[i] < stopPolylineMeters[i - 1]) {
            stopPolylineMeters[i] = stopPolylineMeters[i - 1];
          }
        }
      } else {
        // Fallback for routes with no polyline (ferries) — straight-line
        polylineCumMeters = [0];
        polylineTotalMeters = 0;
        let cumDist = 0;
        stopPolylineMeters = stops.map((stop, i) => {
          if (i === 0) return 0;
          cumDist += haversineDistanceMeters(stops[i - 1].coordinates, stop.coordinates);
          return cumDist;
        });
        polylineTotalMeters = cumDist;
        // Build a simple 2-point polyline from first to last stop
        polylineCumMeters = [0, polylineTotalMeters];
      }

      return {
        routeId,
        directionLabel,
        stops,
        departures,
        headwayMinutes: deriveHeadway(departures, interval),
        tripDurationMinutes,
        stopOffsets,
        polyline,
        polylineCumMeters,
        polylineTotalMeters,
        stopPolylineMeters
      };
    })
    .filter((profile): profile is DirectionProfile => Boolean(profile));
}

const profilesByRoute = Object.fromEntries(
  routeIds.map((routeId) => [routeId, buildDirectionProfiles(routeId)])
) as Record<OperationalRouteId, DirectionProfile[]>;

function estimateRequiredFleet(routeId: OperationalRouteId) {
  return profilesByRoute[routeId].reduce((count, profile) => {
    const prestartMinutes = clamp(Math.round(profile.headwayMinutes / 3), 5, 12);
    const layoverMinutes = clamp(Math.round(profile.headwayMinutes / 4), 4, 10);
    const activeSlots =
      Math.ceil((profile.tripDurationMinutes + prestartMinutes + layoverMinutes) / profile.headwayMinutes) + 1;
    return count + activeSlots;
  }, 0);
}

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
  { vehicleId: "ferry-rc-03", licensePlate: "Racha Bay", routeId: "chalong-racha" }
];

const fleetRoster = [...buildFleetRoster(), ...ferryVessels];
const fleetByRoute = Object.fromEntries(
  routeIds.map((routeId) => [
    routeId,
    fleetRoster.filter((vehicle) => vehicle.routeId === routeId)
  ])
) as Record<OperationalRouteId, FleetVehicle[]>;

// --- Stable vehicle assignment ---
// Hash a trip identity to a deterministic pool index so the same bus always serves the same trip
function stableTripHash(routeId: string, directionLabel: string, departureMinutes: number): number {
  let h = 0;
  const key = `${routeId}:${directionLabel}:${departureMinutes}`;
  for (let i = 0; i < key.length; i++) {
    h = ((h << 5) - h + key.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// --- Trip occurrences ---

function buildTripOccurrences(profile: DirectionProfile, currentMinutes: number) {
  const prestartMinutes = clamp(Math.round(profile.headwayMinutes / 3), 5, 12);
  const layoverMinutes = clamp(Math.round(profile.headwayMinutes / 4), 4, 10);

  return profile.departures
    .map<TripOccurrence | null>((departure, departureIndex) => {
      const candidateAges = [currentMinutes - departure, currentMinutes - (departure - 24 * 60)];
      const ageMinutes = candidateAges.find(
        (value) => value >= -prestartMinutes && value <= profile.tripDurationMinutes + layoverMinutes
      );
      if (ageMinutes === undefined) return null;
      return { profile, departureIndex, scheduledDepartureMinutes: departure, ageMinutes };
    })
    .filter((item): item is TripOccurrence => Boolean(item))
    .sort((left, right) => left.ageMinutes - right.ageMinutes);
}

// --- Vehicle positioning (polyline-snapped) ---

function buildVehiclePosition(
  vehicle: FleetVehicle,
  occurrence: TripOccurrence,
  nowIso: string
): VehiclePosition {
  const { profile, ageMinutes } = occurrence;
  const lastStopIndex = profile.stops.length - 1;
  const hasPolyline = profile.polyline.length >= 2;

  let coordinates: LatLngTuple;
  let heading: number;
  let speedKph = 0;
  let status: VehiclePosition["status"] = "dwelling";
  let distanceToDestinationMeters = profile.polylineTotalMeters;
  let stopsAway = lastStopIndex;

  if (ageMinutes >= profile.tripDurationMinutes) {
    // At terminal — use last stop's snapped position on polyline
    if (hasPolyline) {
      const pos = interpolateAlongPolyline(
        profile.stopPolylineMeters[lastStopIndex],
        profile.polyline,
        profile.polylineCumMeters
      );
      coordinates = pos.coordinates;
      heading = pos.heading;
    } else {
      coordinates = profile.stops[lastStopIndex]!.coordinates;
      heading = bearingDeg(profile.stops[Math.max(0, lastStopIndex - 1)]!.coordinates, profile.stops[lastStopIndex]!.coordinates);
    }
    distanceToDestinationMeters = 0;
    stopsAway = 0;
  } else if (ageMinutes <= 0) {
    // Prestart — at first stop
    if (hasPolyline) {
      const pos = interpolateAlongPolyline(
        profile.stopPolylineMeters[0],
        profile.polyline,
        profile.polylineCumMeters
      );
      coordinates = pos.coordinates;
      heading = pos.heading;
    } else {
      coordinates = profile.stops[0]!.coordinates;
      heading = bearingDeg(profile.stops[0]!.coordinates, profile.stops[1]!.coordinates);
    }
  } else {
    // In transit — interpolate along polyline
    const currentOffset = clamp(ageMinutes, 0, profile.tripDurationMinutes);

    // Find which stop segment we're in (by time)
    let segmentIndex = profile.stopOffsets.findIndex((offset, index) => {
      const nextOffset = profile.stopOffsets[index + 1];
      return nextOffset !== undefined && currentOffset <= nextOffset;
    });
    if (segmentIndex < 0) segmentIndex = Math.max(0, profile.stopOffsets.length - 2);

    const startOffset = profile.stopOffsets[segmentIndex]!;
    const endOffset = profile.stopOffsets[segmentIndex + 1]!;
    const segmentRatio =
      endOffset > startOffset ? (currentOffset - startOffset) / (endOffset - startOffset) : 0;
    const ratio = clamp(segmentRatio, 0, 1);

    // Convert time-based ratio to distance along polyline
    const startMeters = profile.stopPolylineMeters[segmentIndex]!;
    const endMeters = profile.stopPolylineMeters[segmentIndex + 1]!;
    const currentMeters = startMeters + (endMeters - startMeters) * ratio;

    if (hasPolyline) {
      const pos = interpolateAlongPolyline(currentMeters, profile.polyline, profile.polylineCumMeters);
      coordinates = pos.coordinates;
      heading = pos.heading;
    } else {
      // Fallback straight-line for ferries
      const from = profile.stops[segmentIndex]!.coordinates;
      const to = profile.stops[segmentIndex + 1]!.coordinates;
      coordinates = [
        from[0] + (to[0] - from[0]) * ratio,
        from[1] + (to[1] - from[1]) * ratio
      ];
      heading = bearingDeg(from, to);
    }

    speedKph =
      profile.tripDurationMinutes > 0
        ? Math.round((profile.polylineTotalMeters / 1000 / (profile.tripDurationMinutes / 60)) * 10) / 10
        : 0;
    const segmentDuration = endOffset - startOffset;
    const atStart = ratio < 0.05;
    const atEnd = ratio > 0.95;
    status = (atStart || atEnd) && segmentDuration > 2 ? "dwelling" : "moving";
    distanceToDestinationMeters = Math.max(0, profile.polylineTotalMeters - currentMeters);
    stopsAway = Math.max(0, lastStopIndex - segmentIndex - (ratio >= 0.85 ? 1 : 0));
  }

  return {
    id: vehicle.vehicleId,
    routeId: vehicle.routeId,
    licensePlate: vehicle.licensePlate,
    vehicleId: vehicle.vehicleId,
    deviceId: null,
    coordinates,
    heading,
    speedKph,
    destination: routeDestinationLabel(vehicle.routeId, profile.directionLabel),
    updatedAt: nowIso,
    telemetrySource: "schedule_mock",
    freshness: "fresh",
    status,
    distanceToDestinationMeters: Math.round(distanceToDestinationMeters),
    stopsAway
  };
}

// --- Build vehicles for route (stable assignment) ---

function buildVehiclesForRoute(
  routeId: OperationalRouteId,
  currentMinutes: number,
  now: Date
) {
  const pool = fleetByRoute[routeId];
  if (pool.length === 0) return [];

  const allOccurrences = profilesByRoute[routeId]
    .flatMap((profile) => buildTripOccurrences(profile, currentMinutes));

  if (allOccurrences.length === 0) return [];

  // Priority: active trips first, then prestart, then layover
  const sorted = allOccurrences
    .slice()
    .sort((left, right) => {
      const leftPriority =
        left.ageMinutes >= 0 && left.ageMinutes <= left.profile.tripDurationMinutes ? 0 : left.ageMinutes < 0 ? 1 : 2;
      const rightPriority =
        right.ageMinutes >= 0 && right.ageMinutes <= right.profile.tripDurationMinutes ? 0 : right.ageMinutes < 0 ? 1 : 2;
      return (
        leftPriority - rightPriority ||
        Math.abs(left.ageMinutes) - Math.abs(right.ageMinutes) ||
        left.scheduledDepartureMinutes - right.scheduledDepartureMinutes
      );
    })
    .slice(0, pool.length);

  const nowIso = now.toISOString();

  // Stable assignment: each trip gets a deterministic vehicle from the pool
  const usedIndices = new Set<number>();

  return sorted.map((occurrence) => {
    const hash = stableTripHash(
      occurrence.profile.routeId,
      occurrence.profile.directionLabel,
      occurrence.scheduledDepartureMinutes
    );
    // Find first unused pool slot starting from hash position
    let idx = hash % pool.length;
    let attempts = 0;
    while (usedIndices.has(idx) && attempts < pool.length) {
      idx = (idx + 1) % pool.length;
      attempts++;
    }
    usedIndices.add(idx);

    return buildVehiclePosition(pool[idx]!, occurrence, nowIso);
  });
}

export function buildScheduleMockFleet(now = new Date()) {
  const currentMinutes = getBangkokNowMinutes(now);
  return routeIds.flatMap((routeId) => buildVehiclesForRoute(routeId, currentMinutes, now));
}

export function getFallbackFleetRoster() {
  return fleetRoster;
}

export function getMockFleetSummary(now = new Date()) {
  const vehicles = buildScheduleMockFleet(now);
  const activeByRoute = Object.fromEntries(
    routeIds.map((routeId) => [routeId, vehicles.filter((vehicle) => vehicle.routeId === routeId).length])
  ) as Record<OperationalRouteId, number>;

  return { rosterSize: fleetRoster.length, activeByRoute };
}
