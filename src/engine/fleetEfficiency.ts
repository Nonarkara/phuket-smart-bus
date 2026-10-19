/**
 * Fleet Efficiency & Operational Calibration Engine
 *
 * Collects real-time GPS telemetry to compute true operational efficiency:
 * 1. Vehicle State Breakdown:
 *    - In-transit (moving on road, speed > 4 km/h)
 *    - Dwelling (stopped at curb/traffic/passenger boarding, outside depot)
 *    - Parked in Depot (at PKSB central yard or maintenance base)
 * 2. Moving vs. Idle Ratios & True Operating Speed
 * 3. Bus Bunching Detection (multiple buses on same corridor < 600m apart)
 * 4. Multi-Day / 1-Week Calibration:
 *    - Persists sample counts & distance per day in localStorage
 *    - Calculates actual cycle time inflation vs. official 95-minute timetable
 *    - Computes exact fleet sizing recommendation to meet HKT airport demand
 * 5. Data Export (JSON & CSV) for operator & owner analysis
 */

import type { LatLngTuple } from "@shared/types";
import { haversineDistanceMeters } from "../lib/geo";
import type { LiveGpsPing } from "./liveGpsReceiver";
import { normalizeVehicleKey } from "./liveGpsReceiver";

export type VehicleOperationalState = "in_transit" | "dwelling" | "parked_depot";

export interface VehicleEfficiencyRecord {
  vehicleId: string;
  licensePlate: string;
  totalPings: number;
  inTransitPings: number;
  dwellingPings: number;
  depotPings: number;
  totalDistanceKm: number;
  avgMovingSpeedKph: number;
  maxSpeedKph: number;
  firstSeenAt: number;
  lastSeenAt: number;
  lastCoordinates?: LatLngTuple;
  bunchingEvents: number;
  lastState: VehicleOperationalState;

  // Real financial & passenger metrics
  lastPaxCount?: number;
  apcBoardings: number;
  tripsCompleted: number;
  paxServed: number;
  revenueThb: number;
  operatingCostThb: number;
  netMarginThb: number;
  co2SavedKg: number;
}

export interface DayEfficiencyMetrics {
  date: string; // YYYY-MM-DD
  sampleCount: number;
  activeVehicles: number;
  inTransitHours: number;
  dwellingHours: number;
  depotHours: number;
  totalKmDriven: number;
  avgMovingSpeedKph: number;
  bunchingIncidents: number;

  totalRevenueThb: number;
  totalOperatingCostThb: number;
  netRevenueThb: number;
  totalPaxServed: number;
  tripsCompleted: number;
  totalCo2SavedKg: number;
}

export interface FleetEfficiencyLedger {
  version: number;
  startedAt: number;
  lastUpdatedAt: number;
  vehicles: Record<string, VehicleEfficiencyRecord>;
  dailyBreakdown: Record<string, DayEfficiencyMetrics>;
}

export interface FleetEfficiencySummary {
  totalTrackedVehicles: number;
  activeVehiclesCount: number;
  depotVehiclesCount: number;
  movingRatioPct: number; // inTransit / (inTransit + dwelling)
  fleetUtilizationPct: number; // inTransit / (inTransit + dwelling + depot)
  avgFleetSpeedKph: number;
  totalKmTracked: number;
  detectedBunchingIncidents: number;
  daysCollected: number;
  firstSampleTime: string | null;
  lastSampleTime: string | null;
  observedCycleTimeMin: number;
  cycleTimeInflationFactor: number;
  recommendation: {
    nominalCycleMin: number;
    observedCycleMin: number;
    targetHeadwayMin: number;
    currentActiveBuses: number;
    recommendedBuses: number;
    surplusDeficit: number;
    summaryText: string;
  };

  // Financial & environmental rollups
  totalRevenueThb: number;
  totalOperatingCostThb: number;
  netMarginThb: number;
  profitMarginPct: number;
  totalPaxServed: number;
  /** Buses whose passenger counter rose at least once. 0 = riders and fares unknown. */
  countersReporting: number;
  totalCo2SavedKg: number;
  tripsCompleted: number;
  revenuePerKm: number;
  revenuePerActiveBus: number;
  passengerSavingsThb: number;

  vehicles: VehicleEfficiencyRecord[];
}

const STORAGE_KEY = "pksb:fleet_efficiency_ledger";
const DEPOT_COORDINATES: LatLngTuple = [7.8814, 98.4093]; // PKSB Phuket central depot
const DEPOT_RADIUS_METERS = 450;
const MIN_MOVE_METERS = 15;
const MAX_PLAUSIBLE_SPEED_KPH = 120;
const BUNCHING_DISTANCE_METERS = 600;
const NOMINAL_AIRPORT_TRIP_MIN = 95;
const TARGET_AIRPORT_HEADWAY_MIN = 30;

// Financial constants from Phuket Smart Bus tariff & operational model
export const FARE_THB = 100;
export const OPEX_PER_KM_THB = 35;
export const NOMINAL_CORRIDOR_KM = 35;
export const GRAB_EQUIV_FARE_THB = 720;
export const CO2_KG_PER_PAX_TRIP = 4.2; // 28 km * 0.15 kg/pax-km

function getBangkokDateString(timestampMs = Date.now()): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(new Date(timestampMs));
  } catch {
    return new Date(timestampMs).toISOString().split("T")[0]!;
  }
}

let inMemoryLedger: FleetEfficiencyLedger | null = null;

function loadLedger(): FleetEfficiencyLedger {
  if (inMemoryLedger) {
    return inMemoryLedger;
  }
  if (typeof localStorage === "undefined") {
    inMemoryLedger = createEmptyLedger();
    return inMemoryLedger;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      inMemoryLedger = createEmptyLedger();
      return inMemoryLedger;
    }
    const parsed = JSON.parse(raw) as FleetEfficiencyLedger;
    if (!parsed || typeof parsed !== "object" || parsed.version !== 1) {
      inMemoryLedger = createEmptyLedger();
      return inMemoryLedger;
    }
    inMemoryLedger = parsed;
    return inMemoryLedger;
  } catch {
    inMemoryLedger = createEmptyLedger();
    return inMemoryLedger;
  }
}

function saveLedger(ledger: FleetEfficiencyLedger): void {
  inMemoryLedger = ledger;
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ledger));
  } catch {
    // Storage full or private mode
  }
}

function createEmptyLedger(): FleetEfficiencyLedger {
  const now = Date.now();
  return {
    version: 1,
    startedAt: now,
    lastUpdatedAt: now,
    vehicles: {},
    dailyBreakdown: {},
  };
}

export function isNearDepot(coords: LatLngTuple): boolean {
  return haversineDistanceMeters(coords, DEPOT_COORDINATES) <= DEPOT_RADIUS_METERS;
}

export function classifyVehicleState(
  coords: LatLngTuple,
  speedKph: number
): VehicleOperationalState {
  if (isNearDepot(coords)) {
    return "parked_depot";
  }
  return speedKph > 4 ? "in_transit" : "dwelling";
}

/**
 * Ingest a batch of live GPS pings into the fleet efficiency ledger.
 * Tracks distance, state breakdown, speeds, and bunching.
 */
export function recordFleetEfficiencySample(
  pings: LiveGpsPing[],
  now = Date.now()
): void {
  if (!Array.isArray(pings) || pings.length === 0) return;

  const ledger = loadLedger();
  ledger.lastUpdatedAt = now;
  const dateKey = getBangkokDateString(now);

  if (!ledger.dailyBreakdown[dateKey]) {
    ledger.dailyBreakdown[dateKey] = {
      date: dateKey,
      sampleCount: 0,
      activeVehicles: 0,
      inTransitHours: 0,
      dwellingHours: 0,
      depotHours: 0,
      totalKmDriven: 0,
      avgMovingSpeedKph: 0,
      bunchingIncidents: 0,
      totalRevenueThb: 0,
      totalOperatingCostThb: 0,
      netRevenueThb: 0,
      totalPaxServed: 0,
      tripsCompleted: 0,
      totalCo2SavedKg: 0,
    };
  }
  const day = ledger.dailyBreakdown[dateKey];
  day.sampleCount++;

  const activePingsInBatch: Array<{ key: string; coords: LatLngTuple }> = [];

  for (const ping of pings) {
    if (!ping?.coordinates || ping.coordinates.length !== 2) continue;
    const [lat, lng] = ping.coordinates;
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) continue;

    const key = normalizeVehicleKey(ping.vehicleId || ping.licensePlate || "");
    if (!key) continue;

    const plate = ping.licensePlate || `กข ${key}`;
    const speed = Math.max(0, ping.speedKph ?? 0);
    const state = classifyVehicleState(ping.coordinates, speed);

    let record = ledger.vehicles[key];
    if (!record) {
      record = {
        vehicleId: key,
        licensePlate: plate,
        totalPings: 0,
        inTransitPings: 0,
        dwellingPings: 0,
        depotPings: 0,
        totalDistanceKm: 0,
        avgMovingSpeedKph: 0,
        maxSpeedKph: 0,
        firstSeenAt: now,
        lastSeenAt: now,
        bunchingEvents: 0,
        lastState: state,
        apcBoardings: 0,
        tripsCompleted: 0,
        paxServed: 0,
        revenueThb: 0,
        operatingCostThb: 0,
        netMarginThb: 0,
        co2SavedKg: 0,
      };
      ledger.vehicles[key] = record;
    } else {
      record.apcBoardings = record.apcBoardings ?? 0;
      record.tripsCompleted = record.tripsCompleted ?? 0;
      record.paxServed = record.paxServed ?? 0;
      record.revenueThb = record.revenueThb ?? 0;
      record.operatingCostThb = record.operatingCostThb ?? 0;
      record.netMarginThb = record.netMarginThb ?? 0;
      record.co2SavedKg = record.co2SavedKg ?? 0;
    }

    record.totalPings++;
    const previousSeenAt = record.lastSeenAt;
    record.lastSeenAt = now;
    record.lastState = state;
    record.maxSpeedKph = Math.max(record.maxSpeedKph, speed);

    if (state === "in_transit") {
      record.inTransitPings++;
      const prevTotalTransit = record.inTransitPings - 1;
      record.avgMovingSpeedKph =
        (record.avgMovingSpeedKph * prevTotalTransit + speed) / record.inTransitPings;
    } else if (state === "dwelling") {
      record.dwellingPings++;
    } else {
      record.depotPings++;
    }

    // Distance computation (filter out jitter & GPS jumps)
    if (record.lastCoordinates) {
      const distMeters = haversineDistanceMeters(record.lastCoordinates, ping.coordinates);
      const timeDiffHours = Math.max(1 / 3600, (now - previousSeenAt) / 3_600_000);
      const impliedSpeedKph = (distMeters / 1000) / timeDiffHours;

      if (distMeters >= MIN_MOVE_METERS && impliedSpeedKph <= MAX_PLAUSIBLE_SPEED_KPH) {
        const km = distMeters / 1000;
        record.totalDistanceKm += km;
        day.totalKmDriven += km;
      }
    }
    record.lastCoordinates = ping.coordinates;

    // Track completed trips (corridor legs)
    const trips = Math.floor(record.totalDistanceKm / NOMINAL_CORRIDOR_KM);
    record.tripsCompleted = Math.max(record.tripsCompleted, trips);

    // Track APC boardings if APC sensor count is present in telemetry
    if (ping.paxCount != null && Number.isFinite(ping.paxCount)) {
      const currentPax = Math.max(0, ping.paxCount);
      if (record.lastPaxCount != null) {
        if (currentPax > record.lastPaxCount) {
          record.apcBoardings += (currentPax - record.lastPaxCount);
        }
      } else if (currentPax > 0) {
        record.apcBoardings += currentPax;
      }
      record.lastPaxCount = currentPax;
    }

    // Riders come from the bus's counter or not at all. A silent counter is
    // "no counter", shown as such — not 18 riders per 35 km, which this panel
    // labelled "real GPS revenue" while every counter in the fleet read 0.
    record.paxServed = record.apcBoardings;

    record.revenueThb = record.paxServed * FARE_THB;
    record.operatingCostThb = Math.round(record.totalDistanceKm * OPEX_PER_KM_THB);
    record.netMarginThb = record.revenueThb - record.operatingCostThb;
    record.co2SavedKg = Math.round(record.paxServed * CO2_KG_PER_PAX_TRIP * 10) / 10;

    if (state !== "parked_depot") {
      activePingsInBatch.push({ key, coords: ping.coordinates });
    }
  }

  // Detect bunching in this batch (< 600m between buses on the road)
  for (let i = 0; i < activePingsInBatch.length; i++) {
    for (let j = i + 1; j < activePingsInBatch.length; j++) {
      const a = activePingsInBatch[i]!;
      const b = activePingsInBatch[j]!;
      const dist = haversineDistanceMeters(a.coords, b.coords);
      if (dist < BUNCHING_DISTANCE_METERS) {
        ledger.vehicles[a.key]!.bunchingEvents++;
        ledger.vehicles[b.key]!.bunchingEvents++;
        day.bunchingIncidents++;
      }
    }
  }

  // Update daily aggregates
  const allVehicles = Object.values(ledger.vehicles);
  const activeKeys = allVehicles.filter(
    (v) => now - v.lastSeenAt < 300_000 && v.lastState !== "parked_depot"
  );
  day.activeVehicles = activeKeys.length;
  day.totalRevenueThb = allVehicles.reduce((sum, v) => sum + (v.revenueThb || 0), 0);
  day.totalOperatingCostThb = allVehicles.reduce((sum, v) => sum + (v.operatingCostThb || 0), 0);
  day.netRevenueThb = day.totalRevenueThb - day.totalOperatingCostThb;
  day.totalPaxServed = allVehicles.reduce((sum, v) => sum + (v.paxServed || 0), 0);
  day.tripsCompleted = allVehicles.reduce((sum, v) => sum + (v.tripsCompleted || 0), 0);
  day.totalCo2SavedKg = Math.round(day.totalPaxServed * CO2_KG_PER_PAX_TRIP * 10) / 10;

  saveLedger(ledger);
}

/**
 * Compute the comprehensive fleet efficiency summary and calibration recommendations.
 */
export function getFleetEfficiencySummary(now = Date.now()): FleetEfficiencySummary {
  const ledger = loadLedger();
  const vehicles = Object.values(ledger.vehicles);

  let activeCount = 0;
  let depotCount = 0;
  let totalTransitPings = 0;
  let totalDwellingPings = 0;
  let totalDepotPings = 0;
  let totalKm = 0;
  let sumMovingSpeed = 0;
  let movingSpeedCount = 0;
  let totalBunching = 0;

  let totalRevenueThb = 0;
  let totalOperatingCostThb = 0;
  let totalPaxServed = 0;
  let totalTripsCompleted = 0;

  for (const v of vehicles) {
    const isOnline = now - v.lastSeenAt < 300_000; // seen within 5 minutes
    if (isOnline) {
      if (v.lastState === "parked_depot") depotCount++;
      else activeCount++;
    }

    totalTransitPings += v.inTransitPings;
    totalDwellingPings += v.dwellingPings;
    totalDepotPings += v.depotPings;
    totalKm += v.totalDistanceKm;
    totalBunching += v.bunchingEvents;

    totalRevenueThb += v.revenueThb || 0;
    totalOperatingCostThb += v.operatingCostThb || 0;
    totalPaxServed += v.paxServed || 0;
    totalTripsCompleted += v.tripsCompleted || 0;

    if (v.avgMovingSpeedKph > 0) {
      sumMovingSpeed += v.avgMovingSpeedKph;
      movingSpeedCount++;
    }
  }

  const activePings = totalTransitPings + totalDwellingPings;
  const allPings = activePings + totalDepotPings;

  const movingRatioPct =
    activePings > 0 ? Math.round((totalTransitPings / activePings) * 100) : 65;

  const fleetUtilizationPct =
    allPings > 0 ? Math.round((totalTransitPings / allPings) * 100) : 40;

  const avgFleetSpeedKph =
    movingSpeedCount > 0
      ? Math.round((sumMovingSpeed / movingSpeedCount) * 10) / 10
      : 24.5;

  const daysCollected = Math.max(1, Object.keys(ledger.dailyBreakdown).length);

  // Operational Cycle Time Calibration:
  // Nominal trip time is 95 min (speed ~26.5 km/h on 42km corridor).
  // If moving ratio drops below 75% or speed drops below 26.5 km/h,
  // cycle time inflates due to tourist traffic and stop dwell times.
  const speedFactor = avgFleetSpeedKph > 0 ? 26.5 / avgFleetSpeedKph : 1.0;
  const dwellFactor = movingRatioPct > 0 ? 75 / Math.min(95, movingRatioPct) : 1.0;
  const combinedInflation = Math.min(1.6, Math.max(0.9, (speedFactor + dwellFactor) / 2));

  const observedCycleTimeMin = Math.round(NOMINAL_AIRPORT_TRIP_MIN * combinedInflation);
  const cycleTimeInflationFactor = Math.round(combinedInflation * 100) / 100;

  // Fleet Sizing Recommendation:
  // Round trip = observedCycleTimeMin * 2 + 20 min terminal recovery buffer
  const fullRoundTripMin = observedCycleTimeMin * 2 + 20;
  const recommendedBuses = Math.ceil(fullRoundTripMin / TARGET_AIRPORT_HEADWAY_MIN);
  const currentActive = Math.max(activeCount, 6); // default baseline
  const surplusDeficit = recommendedBuses - currentActive;

  let summaryText = "";
  if (surplusDeficit > 0) {
    summaryText = `Observed cycle time inflates from 95 to ${observedCycleTimeMin}m (+${Math.round((combinedInflation - 1) * 100)}%). Add +${surplusDeficit} buses to preserve 30-min headway and prevent passenger queue abandonment at HKT.`;
  } else if (surplusDeficit < 0) {
    summaryText = `Observed speeds allow efficient turnaround. Fleet has ${Math.abs(surplusDeficit)} surplus buses that can be redeployed to Patong or Dragon Line during peak arrivals.`;
  } else {
    summaryText = `Current fleet allocation (${currentActive} active buses) matches observed ${observedCycleTimeMin}m cycle time for 30-min airport service.`;
  }

  const netMarginThb = totalRevenueThb - totalOperatingCostThb;
  const profitMarginPct = totalRevenueThb > 0 ? Math.round((netMarginThb / totalRevenueThb) * 100) : 0;
  const totalCo2SavedKg = Math.round(totalPaxServed * CO2_KG_PER_PAX_TRIP * 10) / 10;
  const passengerSavingsThb = totalPaxServed * (GRAB_EQUIV_FARE_THB - FARE_THB);
  const revenuePerKm = totalKm > 0 ? Math.round((totalRevenueThb / totalKm) * 10) / 10 : 0;
  const activeBusesForRev = Math.max(1, activeCount);
  const revenuePerActiveBus = Math.round(totalRevenueThb / activeBusesForRev);

  return {
    totalTrackedVehicles: vehicles.length,
    activeVehiclesCount: activeCount,
    depotVehiclesCount: depotCount,
    movingRatioPct,
    fleetUtilizationPct,
    avgFleetSpeedKph,
    totalKmTracked: Math.round(totalKm * 10) / 10,
    detectedBunchingIncidents: Math.round(totalBunching / 2),
    daysCollected,
    firstSampleTime: ledger.startedAt ? new Date(ledger.startedAt).toISOString() : null,
    lastSampleTime: ledger.lastUpdatedAt ? new Date(ledger.lastUpdatedAt).toISOString() : null,
    observedCycleTimeMin,
    cycleTimeInflationFactor,
    recommendation: {
      nominalCycleMin: NOMINAL_AIRPORT_TRIP_MIN,
      observedCycleMin: observedCycleTimeMin,
      targetHeadwayMin: TARGET_AIRPORT_HEADWAY_MIN,
      currentActiveBuses: currentActive,
      recommendedBuses,
      surplusDeficit,
      summaryText,
    },
    totalRevenueThb,
    totalOperatingCostThb,
    netMarginThb,
    profitMarginPct,
    totalPaxServed,
    countersReporting: vehicles.filter((v) => (v.apcBoardings ?? 0) > 0).length,
    totalCo2SavedKg,
    tripsCompleted: totalTripsCompleted,
    revenuePerKm,
    revenuePerActiveBus,
    passengerSavingsThb,
    vehicles: vehicles.sort((a, b) => (b.revenueThb || 0) - (a.revenueThb || 0) || b.totalPings - a.totalPings),
  };
}

/**
 * Reset the fleet efficiency ledger for a fresh recording session.
 */
export function resetFleetEfficiencyLedger(): void {
  const fresh = createEmptyLedger();
  inMemoryLedger = fresh;
  saveLedger(fresh);
}

/**
 * Export full fleet efficiency ledger as formatted JSON.
 */
export function exportFleetEfficiencyJson(): string {
  const summary = getFleetEfficiencySummary();
  const ledger = loadLedger();
  return JSON.stringify({ summary, ledger }, null, 2);
}

/**
 * Export fleet efficiency report as CSV for spreadsheet analysis.
 */
export function exportFleetEfficiencyCsv(): string {
  const summary = getFleetEfficiencySummary();
  const rows = [
    [
      "Vehicle ID",
      "License Plate",
      "Total Pings",
      "In-Transit Pings",
      "Dwelling Pings",
      "Depot Pings",
      "Total Distance (km)",
      "Trips Completed",
      "Pax Served",
      "Gross Revenue (THB)",
      "Operating Cost (THB)",
      "Net Margin (THB)",
      "CO2 Saved (kg)",
      "Avg Moving Speed (km/h)",
      "Max Speed (km/h)",
      "Bunching Incidents",
      "Current State",
      "Last Seen (BKK)",
    ].join(","),
  ];

  for (const v of summary.vehicles) {
    rows.push(
      [
        `"${v.vehicleId}"`,
        `"${v.licensePlate}"`,
        v.totalPings,
        v.inTransitPings,
        v.dwellingPings,
        v.depotPings,
        v.totalDistanceKm.toFixed(2),
        v.tripsCompleted || 0,
        v.paxServed || 0,
        v.revenueThb || 0,
        v.operatingCostThb || 0,
        v.netMarginThb || 0,
        (v.co2SavedKg || 0).toFixed(1),
        v.avgMovingSpeedKph.toFixed(1),
        v.maxSpeedKph.toFixed(1),
        v.bunchingEvents,
        `"${v.lastState}"`,
        `"${new Date(v.lastSeenAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}"`,
      ].join(",")
    );
  }

  return rows.join("\n");
}
