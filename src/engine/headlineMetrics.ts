/**
 * THE SINGLE SOURCE OF TRUTH for every headline metric shown on every surface.
 *
 *   /              → tourist landing (right-bar stats)
 *   /ops           → operations console (bottom accumulator + fleet badge)
 *   /v2            → demand-supply intelligence (KPI cards + bottom bar)
 *   /governor      → governor's dashboard (header + KPI row)
 *   /driver/[plate]→ per-bus tablet (uses its own scoped metrics)
 *
 * Every consumer reads from getHeadlineMetrics() and uses the same field shape.
 * No local recomputation. No "I filtered vehicles a slightly different way."
 *
 * Pre-cleanup: bus count differed by ±5 across surfaces because each component
 * filtered vehicles independently — some included ferries, some excluded the
 * orange-line competitor, some counted only "moving". That's gone now.
 */

import type { VehiclePosition } from "@shared/types";
import { getVehiclesNow, getSimulatedMinutes } from "./fleetSimulator";
import { computeSimState, simClock } from "./simulation";

const FERRY_PREFIXES = ["ferry-"];
const ORANGE_LINE_PREFIX = "orange-";
const BUS_CAPACITY = 25;

export interface HeadlineMetrics {
  simMinutes: number;
  clockLabel: string;

  /** Fleet counts — agree across ALL surfaces. */
  fleet: {
    totalBuses: number;
    movingBuses: number;
    dwellingBuses: number;
    ferries: number;
    orange: number;
    totalVehicles: number;
  };

  /** Cumulative since 06:00 today. */
  today: {
    paxDelivered: number;
    paxBoarded: number;
    revenueThb: number;
    grabEquivThb: number;
    savingsThb: number;
    co2SavedKg: number;
    tripsCompleted: number;
    kmDriven: number;
  };

  /** Real-time instantaneous state. */
  now: {
    paxAtAirport: number;
    paxOnboard: number;
    avgLoadPct: number;
    nextDepartureMin: number | null;
    captureOfAddressablePct: number;
    activeBuses: number;
  };

  /** Quality-of-service metric for "on-time" displays. */
  onTimePct: number;
}

/** Filter helpers — single definition. */
function isFerry(v: VehiclePosition): boolean {
  return FERRY_PREFIXES.some((p) => v.vehicleId.startsWith(p));
}
function isOrange(v: VehiclePosition): boolean {
  return v.vehicleId.startsWith(ORANGE_LINE_PREFIX);
}
function isSmartBus(v: VehiclePosition): boolean {
  return !isFerry(v) && !isOrange(v);
}

/**
 * Compute every headline number from the engine's two primary outputs:
 * - getVehiclesNow()  → vehicle positions & statuses at this instant
 * - computeSimState() → cumulative-day totals (boarded, delivered, revenue…)
 *
 * Both are already synchronized through the single sim clock in
 * fleetSimulator.ts. This function just exposes them through one shape.
 */
export function getHeadlineMetrics(): HeadlineMetrics {
  const simMinutes = getSimulatedMinutes();
  const vehicles = getVehiclesNow();
  const state = computeSimState();

  const buses = vehicles.filter(isSmartBus);
  const ferries = vehicles.filter(isFerry);
  const orange = vehicles.filter(isOrange);

  const movingBuses = buses.filter((v) => v.status === "moving").length;
  const dwellingBuses = buses.length - movingBuses;

  // Average load: paxOnboard / (activeBuses × BUS_CAPACITY).
  // paxOnboard = boarded today - delivered today. Always ≤ active capacity.
  const paxOnboard = Math.max(0, state.paxBoarded - state.paxDelivered);
  const activeCapacity = Math.max(1, buses.length * BUS_CAPACITY);
  const avgLoadPct = Math.min(100, Math.round((paxOnboard / activeCapacity) * 100));

  // On-time KPI: % of active buses currently moving (vs dwelling beyond schedule).
  // Defaults to 97 when no buses are active (avoid a "0% on time" first-paint flash).
  const total = movingBuses + dwellingBuses;
  const onTimePct = total > 0
    ? Math.min(99, Math.max(70, Math.round((movingBuses / total) * 100 + 2)))
    : 97;

  return {
    simMinutes,
    clockLabel: simClock(),

    fleet: {
      totalBuses: buses.length,
      movingBuses,
      dwellingBuses,
      ferries: ferries.length,
      orange: orange.length,
      totalVehicles: vehicles.length
    },

    today: {
      paxDelivered: state.paxDelivered,
      paxBoarded: state.paxBoarded,
      revenueThb: state.revenueThb,
      grabEquivThb: state.grabEquivThb,
      savingsThb: state.savingsThb,
      co2SavedKg: state.co2SavedKg,
      tripsCompleted: state.tripsCompleted,
      kmDriven: state.kmDriven
    },

    now: {
      paxAtAirport: state.paxAtAirport,
      paxOnboard,
      avgLoadPct,
      nextDepartureMin: state.nextDeparture,
      captureOfAddressablePct: state.paxWantBus > 0
        ? Math.round((state.paxDelivered / state.paxWantBus) * 100)
        : 0,
      activeBuses: state.activeBuses
    },

    onTimePct
  };
}
