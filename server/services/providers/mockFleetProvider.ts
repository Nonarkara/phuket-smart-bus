import type { RouteId, Stop, VehiclePosition } from "../../../shared/types.js";
import { haversineDistanceMeters } from "../../lib/geo.js";
import { readJsonFile, fromRoot } from "../../lib/files.js";
import { routeDestinationLabel } from "../../lib/i18n.js";
import {
  getBangkokNowMinutes,
  parseScheduleEntries
} from "../../lib/time.js";
import { getStopsForRoute } from "../routes.js";
import { FERRY_ROUTE_IDS } from "../../config.js";

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
  routeId: RouteId;
};

type DirectionProfile = {
  routeId: RouteId;
  directionLabel: string;
  stops: Stop[];
  departures: number[];
  headwayMinutes: number;
  tripDurationMinutes: number;
  routeLengthMeters: number;
  stopOffsets: number[];
  cumulativeDistances: number[];
};

type TripOccurrence = {
  profile: DirectionProfile;
  departureIndex: number;
  scheduledDepartureMinutes: number;
  ageMinutes: number;
};

const routeIds: RouteId[] = [
  "rawai-airport",
  "patong-old-bus-station",
  "dragon-line",
  "rassada-phi-phi",
  "rassada-ao-nang",
  "bang-rong-koh-yao",
  "chalong-racha"
];
const ferryRouteSet = new Set<RouteId>(FERRY_ROUTE_IDS);
const landRouteIds = routeIds.filter((routeId) => !ferryRouteSet.has(routeId));

const fallbackSample = readJsonFile<RawBusRecord[]>(
  fromRoot("server", "data", "fixtures", "bus_live_sample.json")
);

function inferRoute(record: RawBusRecord): RouteId | null {
  const hint = [
    record.buffer,
    record.data.buffer,
    Array.isArray(record.data.determineBusDirection) ? record.data.determineBusDirection[2] : ""
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

function forwardDiff(fromMinutes: number, toMinutes: number) {
  return ((toMinutes - fromMinutes) % (24 * 60) + 24 * 60) % (24 * 60);
}

function median(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[middle];
  }

  return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function buildRouteTargets(totalVehicles: number, knownCounts: Record<RouteId, number>) {
  const weights = landRouteIds.map((routeId) => ({
    routeId,
    weight: getStopsForRoute(routeId).length
  }));
  const totalWeight = weights.reduce((sum, item) => sum + item.weight, 0);
  const targets = Object.fromEntries(landRouteIds.map((routeId) => [routeId, 0])) as Record<RouteId, number>;
  const minimums = Object.fromEntries(landRouteIds.map((routeId) => [routeId, 0])) as Record<RouteId, number>;
  const remainders = weights.map((item) => {
    const rawTarget = (totalVehicles * item.weight) / totalWeight;
    const minimum = Math.max(knownCounts[item.routeId], estimateRequiredFleet(item.routeId));
    minimums[item.routeId] = minimum;
    const floored = Math.max(Math.floor(rawTarget), minimum);
    targets[item.routeId] = floored;

    return {
      routeId: item.routeId,
      remainder: rawTarget - Math.floor(rawTarget)
    };
  });

  while (Object.values(targets).reduce((sum, value) => sum + value, 0) < totalVehicles) {
    const next = remainders
      .sort((left, right) => right.remainder - left.remainder)
      .find((item) => true);

    if (!next) {
      break;
    }

    targets[next.routeId] += 1;
    next.remainder = 0;
  }

  while (Object.values(targets).reduce((sum, value) => sum + value, 0) > totalVehicles) {
    const reducible = landRouteIds
      .map((routeId) => ({
        routeId,
        excess: targets[routeId] - minimums[routeId]
      }))
      .sort((left, right) => right.excess - left.excess)[0];

    if (!reducible || reducible.excess <= 0) {
      break;
    }

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
      known.push({
        ...vehicle,
        routeId
      });
      continue;
    }

    unknown.push(vehicle);
  }

  const knownCounts = Object.fromEntries(landRouteIds.map((routeId) => [routeId, 0])) as Record<RouteId, number>;

  for (const vehicle of known) {
    if (vehicle.routeId in knownCounts) {
      knownCounts[vehicle.routeId] += 1;
    }
  }

  const targets = buildRouteTargets(sortedRecords.length, knownCounts);
  const remainingCapacity = Object.fromEntries(
    landRouteIds.map((routeId) => [routeId, targets[routeId] - knownCounts[routeId]])
  ) as Record<RouteId, number>;

  const assignedUnknown = unknown.map<FleetVehicle>((vehicle) => {
    const routeId =
      landRouteIds
        .map((candidate) => ({
          routeId: candidate,
          capacity: remainingCapacity[candidate]
        }))
        .sort((left, right) => right.capacity - left.capacity)[0]?.routeId ?? "rawai-airport";

    remainingCapacity[routeId] = Math.max(0, remainingCapacity[routeId] - 1);

    return {
      ...vehicle,
      routeId
    };
  });

  return [...known, ...assignedUnknown];
}

function deriveHeadway(departures: number[], interval: number | null) {
  if (interval !== null) {
    return interval;
  }

  const diffs = departures
    .slice(1)
    .map((departure, index) => forwardDiff(departures[index], departure))
    .filter((value) => value > 0 && value <= 180);

  return median(diffs) ?? 30;
}

function deriveStopOffsets(stops: Stop[], departures: number[]) {
  const baseline = departures[0] ?? 0;
  const rawOffsets = stops.map((stop, index) => {
    if (index === 0) {
      return 0;
    }

    const stopDepartures = parseScheduleEntries(stop.scheduleText).departures;
    const candidates = stopDepartures
      .map((departure) => forwardDiff(baseline, departure))
      .filter((value) => value <= 6 * 60);

    return candidates.length > 0 ? Math.min(...candidates) : null;
  });

  const finiteOffsets = rawOffsets.filter((value): value is number => value !== null);
  const inferredDuration = Math.max(finiteOffsets.at(-1) ?? 0, (stops.length - 1) * 3, 20);
  const filled = rawOffsets.map((value, index) => {
    if (value !== null) {
      return value;
    }

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

function buildCumulativeDistances(stops: Stop[]) {
  const distances = [0];

  for (let index = 1; index < stops.length; index += 1) {
    distances.push(
      distances[index - 1] +
        haversineDistanceMeters(stops[index - 1]!.coordinates, stops[index]!.coordinates)
    );
  }

  return distances;
}

function buildDirectionProfiles(routeId: RouteId) {
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

      if (stops.length < 2 || departures.length === 0) {
        return null;
      }

      const stopOffsets = deriveStopOffsets(stops, departures);
      const tripDurationMinutes = deriveTripDuration(stops, departures, stopOffsets);
      const cumulativeDistances = buildCumulativeDistances(stops);

      return {
        routeId,
        directionLabel,
        stops,
        departures,
        headwayMinutes: deriveHeadway(departures, interval),
        tripDurationMinutes,
        routeLengthMeters: cumulativeDistances.at(-1) ?? 0,
        stopOffsets,
        cumulativeDistances
      };
    })
    .filter((profile): profile is DirectionProfile => Boolean(profile));
}

const profilesByRoute = Object.fromEntries(
  routeIds.map((routeId) => [routeId, buildDirectionProfiles(routeId)])
) as Record<RouteId, DirectionProfile[]>;

function estimateRequiredFleet(routeId: RouteId) {
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
) as Record<RouteId, FleetVehicle[]>;

function getRotationOffset(now: Date, poolLength: number) {
  if (poolLength === 0) {
    return 0;
  }

  const hourSeed = Math.floor(now.getTime() / 3_600_000);
  return Math.abs(hourSeed) % poolLength;
}

function interpolateCoordinate(from: Stop, to: Stop, ratio: number) {
  return [
    from.coordinates[0] + (to.coordinates[0] - from.coordinates[0]) * ratio,
    from.coordinates[1] + (to.coordinates[1] - from.coordinates[1]) * ratio
  ] as [number, number];
}

function estimateHeading(from: Stop, to: Stop) {
  const startLat = (from.coordinates[0] * Math.PI) / 180;
  const endLat = (to.coordinates[0] * Math.PI) / 180;
  const deltaLon = ((to.coordinates[1] - from.coordinates[1]) * Math.PI) / 180;
  const y = Math.sin(deltaLon) * Math.cos(endLat);
  const x =
    Math.cos(startLat) * Math.sin(endLat) -
    Math.sin(startLat) * Math.cos(endLat) * Math.cos(deltaLon);

  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function buildTripOccurrences(profile: DirectionProfile, currentMinutes: number) {
  const prestartMinutes = clamp(Math.round(profile.headwayMinutes / 3), 5, 12);
  const layoverMinutes = clamp(Math.round(profile.headwayMinutes / 4), 4, 10);

  return profile.departures
    .map<TripOccurrence | null>((departure, departureIndex) => {
      const candidateAges = [currentMinutes - departure, currentMinutes - (departure - 24 * 60)];
      const ageMinutes = candidateAges.find(
        (value) => value >= -prestartMinutes && value <= profile.tripDurationMinutes + layoverMinutes
      );

      if (ageMinutes === undefined) {
        return null;
      }

      return {
        profile,
        departureIndex,
        scheduledDepartureMinutes: departure,
        ageMinutes
      };
    })
    .filter((item): item is TripOccurrence => Boolean(item))
    .sort((left, right) => left.ageMinutes - right.ageMinutes);
}

function buildVehiclePosition(
  vehicle: FleetVehicle,
  occurrence: TripOccurrence,
  nowIso: string
): VehiclePosition {
  const { profile, ageMinutes } = occurrence;
  const lastStopIndex = profile.stops.length - 1;
  let coordinates = profile.stops[0]!.coordinates;
  let heading = estimateHeading(profile.stops[0]!, profile.stops[1]!);
  let speedKph = 0;
  let status: VehiclePosition["status"] = "dwelling";
  let distanceToDestinationMeters = profile.routeLengthMeters;
  let stopsAway = lastStopIndex;

  if (ageMinutes >= profile.tripDurationMinutes) {
    coordinates = profile.stops[lastStopIndex]!.coordinates;
    heading = estimateHeading(profile.stops[Math.max(0, lastStopIndex - 1)]!, profile.stops[lastStopIndex]!);
    distanceToDestinationMeters = 0;
    stopsAway = 0;
  } else if (ageMinutes > 0) {
    const currentOffset = clamp(ageMinutes, 0, profile.tripDurationMinutes);
    let segmentIndex = profile.stopOffsets.findIndex((offset, index) => {
      const nextOffset = profile.stopOffsets[index + 1];
      return nextOffset !== undefined && currentOffset <= nextOffset;
    });

    if (segmentIndex < 0) {
      segmentIndex = Math.max(0, profile.stopOffsets.length - 2);
    }

    const startStop = profile.stops[segmentIndex]!;
    const endStop = profile.stops[segmentIndex + 1]!;
    const startOffset = profile.stopOffsets[segmentIndex]!;
    const endOffset = profile.stopOffsets[segmentIndex + 1]!;
    const segmentRatio =
      endOffset > startOffset ? (currentOffset - startOffset) / (endOffset - startOffset) : 0;
    const ratio = clamp(segmentRatio, 0, 1);
    const travelledMeters =
      profile.cumulativeDistances[segmentIndex]! +
      haversineDistanceMeters(startStop.coordinates, endStop.coordinates) * ratio;

    coordinates = interpolateCoordinate(startStop, endStop, ratio);
    heading = estimateHeading(startStop, endStop);
    speedKph =
      profile.tripDurationMinutes > 0
        ? Math.round((profile.routeLengthMeters / 1000 / (profile.tripDurationMinutes / 60)) * 10) / 10
        : 0;
    // Moving if between stops; dwelling only when exactly at a stop
    const segmentDuration = endOffset - startOffset;
    const atStart = ratio < 0.05;
    const atEnd = ratio > 0.95;
    status = (atStart || atEnd) && segmentDuration > 2 ? "dwelling" : "moving";
    distanceToDestinationMeters = Math.max(0, profile.routeLengthMeters - travelledMeters);
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

function buildVehiclesForRoute(routeId: RouteId, currentMinutes: number, now: Date) {
  const pool = fleetByRoute[routeId];
  const prioritizedOccurrences = profilesByRoute[routeId]
    .flatMap((profile) => buildTripOccurrences(profile, currentMinutes))
    .sort(
      (left, right) =>
        left.scheduledDepartureMinutes - right.scheduledDepartureMinutes ||
        left.profile.directionLabel.localeCompare(right.profile.directionLabel)
    );

  if (prioritizedOccurrences.length === 0 || pool.length === 0) {
    return [];
  }

  const occurrences = prioritizedOccurrences
    .slice()
    .sort((left, right) => {
      const leftPriority =
        left.ageMinutes >= 0 && left.ageMinutes <= left.profile.tripDurationMinutes
          ? 0
          : left.ageMinutes < 0
            ? 1
            : 2;
      const rightPriority =
        right.ageMinutes >= 0 && right.ageMinutes <= right.profile.tripDurationMinutes
          ? 0
          : right.ageMinutes < 0
            ? 1
            : 2;

      return (
        leftPriority - rightPriority ||
        Math.abs(left.ageMinutes) - Math.abs(right.ageMinutes) ||
        left.scheduledDepartureMinutes - right.scheduledDepartureMinutes
      );
    })
    .slice(0, pool.length)
    .sort(
      (left, right) =>
        left.scheduledDepartureMinutes - right.scheduledDepartureMinutes ||
        left.profile.directionLabel.localeCompare(right.profile.directionLabel)
    );

  const offset = getRotationOffset(now, pool.length);
  const orderedPool = pool.map((_, index) => pool[(offset + index) % pool.length]!);
  const nowIso = now.toISOString();

  return occurrences.map((occurrence, index) =>
    buildVehiclePosition(orderedPool[index]!, occurrence, nowIso)
  );
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
  ) as Record<RouteId, number>;

  return {
    rosterSize: fleetRoster.length,
    activeByRoute
  };
}
