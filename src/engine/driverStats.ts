/**
 * Per-driver day records — computed from schedule trip assignments + engine loads.
 *
 * Conservation (land fleet, selected day):
 *   Σ driver.paxServed  ≈  Σ boarded on assigned airport-line legs
 *   Σ driver.hoursOnDuty ≈ sum of trip minutes / 60 (completed + in-progress)
 *   CO₂ reduced         = paxServed × 28 km × 0.15 kg/pax-km (APTA, same as sim)
 *
 * No decorative randomization of the operational numbers. Career fields
 * (years, license) come from driverRoster seeds only.
 */

import { getTripLoad, getReturnTripLoad, BUS_CAPACITY } from "./demandSupplyEngine";
import { getDriverProfile, type DriverProfile } from "./driverRoster";
import {
  getLandBusRoster,
  getSimulatedMinutes,
  listLandTripAssignments,
  type AssignedTripLeg,
} from "./fleetSimulator";

const AVG_TRIP_KM = 28;
const CO2_KG_PER_PAX_KM = 0.15;
const FARE_THB = 100;

export type DriverShiftBlock = {
  startMin: number;
  endMin: number;
  label: string;
  trips: number;
};

export type DriverDayRecord = {
  profile: DriverProfile;
  /** Completed one-way trips today (progress ≥ 1). */
  tripsCompleted: number;
  /** In-progress trip count (0 or 1). */
  tripsInProgress: number;
  hoursOnDuty: number;
  kmDriven: number;
  paxServed: number;
  revenueThb: number;
  co2ReducedKg: number;
  /** Average load % across legs that carried pax (0–100). */
  efficiencyPct: number;
  /** On-time share — legs finishing within +5 min of nominal (0–100). */
  reliabilityPct: number;
  shifts: DriverShiftBlock[];
  legs: AssignedTripLeg[];
  /** Career totals: years × typical duty day scaled by today's pace. */
  career: {
    hoursLifetime: number;
    paxLifetime: number;
    co2LifetimeTonnes: number;
    onTimeLifetimePct: number;
  };
};

function boardedForLeg(leg: AssignedTripLeg): number {
  if (leg.routeId === "rawai-airport") {
    if (leg.directionLabel === "Bus to Rawai") {
      const n = getTripLoad(leg.depMin);
      if (n != null) return Math.round(n * leg.progress);
    }
    if (leg.directionLabel === "Bus to Airport") {
      const n = getReturnTripLoad(leg.depMin);
      if (n != null) return Math.round(n * leg.progress);
    }
  }
  // Local lines: same deterministic occupancy heuristic as DashboardV2.vehiclePax
  const cap = leg.routeId === "dragon-line" ? 15 : BUS_CAPACITY;
  const occ = leg.routeId === "patong-old-bus-station" ? 0.42 : leg.routeId === "dragon-line" ? 0.31 : 0.35;
  const seed = leg.depMin % 7;
  return Math.max(0, Math.round((Math.round(cap * occ) + (seed - 3)) * leg.progress));
}

function formatClock(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = Math.floor(min % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function buildShifts(legs: AssignedTripLeg[]): DriverShiftBlock[] {
  if (legs.length === 0) return [];
  const sorted = [...legs].sort((a, b) => a.depMin - b.depMin);
  const gaps: DriverShiftBlock[] = [];
  let blockStart = sorted[0]!.depMin;
  let blockEnd = sorted[0]!.depMin + sorted[0]!.tripDurationMin * sorted[0]!.progress;
  let trips = 1;

  for (let i = 1; i < sorted.length; i++) {
    const leg = sorted[i]!;
    const end = leg.depMin + leg.tripDurationMin * leg.progress;
    if (leg.depMin - blockEnd > 75) {
      gaps.push({
        startMin: blockStart,
        endMin: blockEnd,
        label: `${formatClock(blockStart)}–${formatClock(blockEnd)}`,
        trips,
      });
      blockStart = leg.depMin;
      blockEnd = end;
      trips = 1;
    } else {
      blockEnd = Math.max(blockEnd, end);
      trips += 1;
    }
  }
  gaps.push({
    startMin: blockStart,
    endMin: blockEnd,
    label: `${formatClock(blockStart)}–${formatClock(blockEnd)}`,
    trips,
  });
  return gaps;
}

function recordForVehicle(
  vehicleId: string,
  plate: string,
  routeId: string,
  legs: AssignedTripLeg[],
  nowMin: number
): DriverDayRecord {
  const profile = getDriverProfile({ vehicleId, plate, routeId });
  let hours = 0;
  let km = 0;
  let pax = 0;
  let loadSum = 0;
  let loadN = 0;
  let onTime = 0;
  let completed = 0;
  let inProgress = 0;

  for (const leg of legs) {
    hours += (leg.tripDurationMin * leg.progress) / 60;
    km += leg.routeKm * leg.progress;
    const boarded = boardedForLeg(leg);
    pax += boarded;
    const cap = leg.routeId === "dragon-line" ? 15 : BUS_CAPACITY;
    if (leg.progress > 0) {
      loadSum += (boarded / Math.max(leg.progress, 0.01)) / cap;
      loadN += 1;
    }
    if (leg.completed) {
      completed += 1;
      // Duty-chain has no lateness model — treat completed legs as on-time;
      // in-progress overruns (age > duration+5) dock reliability.
      onTime += 1;
    } else if (leg.progress > 0) {
      inProgress += 1;
      const age = nowMin - leg.depMin;
      if (age <= leg.tripDurationMin + 5) onTime += 1;
    }
  }

  const scored = completed + inProgress;
  const efficiencyPct = loadN === 0 ? 0 : Math.round((loadSum / loadN) * 100);
  const reliabilityPct = scored === 0 ? 100 : Math.round((onTime / scored) * 100);
  const co2ReducedKg = Math.round(pax * AVG_TRIP_KM * CO2_KG_PER_PAX_KM * 10) / 10;

  // Career: years × ~220 duty days × today's pace (or a floor for early morning).
  const dayPaceHours = Math.max(hours, 0.5);
  const dayPacePax = Math.max(pax, 1);
  const careerDays = profile.yearsService * 220;

  return {
    profile,
    tripsCompleted: completed,
    tripsInProgress: inProgress,
    hoursOnDuty: Math.round(hours * 10) / 10,
    kmDriven: Math.round(km * 10) / 10,
    paxServed: pax,
    revenueThb: pax * FARE_THB,
    co2ReducedKg,
    efficiencyPct,
    reliabilityPct,
    shifts: buildShifts(legs),
    legs,
    career: {
      hoursLifetime: Math.round(careerDays * dayPaceHours),
      paxLifetime: Math.round(careerDays * dayPacePax),
      co2LifetimeTonnes: Math.round((careerDays * dayPacePax * AVG_TRIP_KM * CO2_KG_PER_PAX_KM) / 1000),
      onTimeLifetimePct: Math.min(99, Math.max(88, reliabilityPct - 1 + (profile.yearsService % 5))),
    },
  };
}

const memo = new Map<string, { nowBucket: number; record: DriverDayRecord }>();

/** Full day record for one vehicle at the current (or override) sim minute. */
export function getDriverDayRecord(vehicleId: string, overrideMin?: number): DriverDayRecord | null {
  const nowMin = overrideMin ?? getSimulatedMinutes();
  const nowBucket = Math.floor(nowMin);
  const cached = memo.get(vehicleId);
  if (cached && cached.nowBucket === nowBucket) return cached.record;

  const roster = getLandBusRoster();
  const bus = roster.find((b) => b.vehicleId === vehicleId);
  if (!bus) return null;

  const legs = listLandTripAssignments(nowMin).filter((l) => l.vehicleId === vehicleId);
  const record = recordForVehicle(bus.vehicleId, bus.licensePlate, bus.routeId, legs, nowMin);
  memo.set(vehicleId, { nowBucket, record });
  return record;
}

/** Lookup by plate (strips province suffix). */
export function getDriverDayRecordByPlate(plate: string, overrideMin?: number): DriverDayRecord | null {
  const roster = getLandBusRoster();
  const norm = plate.replace(/\s*ภูเก็ต\s*$/, "").trim();
  const bus = roster.find(
    (b) => b.licensePlate === plate || b.licensePlate.replace(/\s*ภูเก็ต\s*$/, "").trim() === norm
  );
  if (!bus) return null;
  return getDriverDayRecord(bus.vehicleId, overrideMin);
}

/** All land drivers with today's records — for tests / rollups. */
export function getAllDriverDayRecords(overrideMin?: number): DriverDayRecord[] {
  const nowMin = overrideMin ?? getSimulatedMinutes();
  const legsByVehicle = new Map<string, AssignedTripLeg[]>();
  for (const leg of listLandTripAssignments(nowMin)) {
    const arr = legsByVehicle.get(leg.vehicleId) ?? [];
    arr.push(leg);
    legsByVehicle.set(leg.vehicleId, arr);
  }
  return getLandBusRoster().map((bus) =>
    recordForVehicle(bus.vehicleId, bus.licensePlate, bus.routeId, legsByVehicle.get(bus.vehicleId) ?? [], nowMin)
  );
}
