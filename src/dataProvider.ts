/**
 * Hybrid data provider — prefers live server API, falls back to local simulation.
 *
 * This is the single import point for the tourist app.  Async calls hit the
 * server first; if the server is unreachable or unconfigured they transparently
 * fall back to the schedule-based simulation engine.  Synchronous helpers such
 * as `getVehiclesNow` are kept for animation-frame consumers that cannot wait
 * on a network round-trip.
 */

import type {
  Advisory,
  AirportGuidePayload,
  DecisionSummary,
  EnvironmentSnapshot,
  HealthPayload,
  PriceComparison,
  Route,
  RouteId,
  Stop,
  VehiclePosition
} from "@shared/types";

import * as api from "./api";
import * as sim from "./engine/dataProvider";

const USE_LIVE = true;

async function withFallback<T>(live: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
  if (!USE_LIVE) return fallback();
  try {
    return await live();
  } catch {
    return fallback();
  }
}

export function getHealth(): Promise<HealthPayload> {
  return withFallback(() => api.getHealth(), () => sim.getHealth());
}

export function getRoutes(): Promise<Route[]> {
  return withFallback(() => api.getRoutes(), () => sim.getRoutes());
}

export function getStops(routeId: RouteId): Promise<Stop[]> {
  return withFallback(() => api.getStops(routeId), () => sim.getStops(routeId));
}

export function getVehicles(routeId: RouteId): Promise<{ vehicles: VehiclePosition[] }> {
  return withFallback(() => api.getVehicles(routeId), () => sim.getVehicles(routeId));
}

export function getAdvisories(routeId: RouteId): Promise<{ advisories: Advisory[] }> {
  return withFallback(() => api.getAdvisories(routeId), () => sim.getAdvisories(routeId));
}

export function getDecisionSummary(routeId: RouteId, stopId: string): Promise<DecisionSummary> {
  return withFallback(
    () => api.getDecisionSummary(routeId, stopId),
    () => sim.getDecisionSummary(routeId, stopId)
  );
}

export function getCompare(): Promise<PriceComparison[]> {
  return withFallback(() => api.getCompare(), () => sim.getCompare());
}

export function getEnvironment(): Promise<EnvironmentSnapshot> {
  return withFallback(() => api.getEnvironment(), () => sim.getEnvironment());
}

export function getAirportGuide(destination = ""): Promise<AirportGuidePayload> {
  return withFallback(() => api.getAirportGuide(destination), () => sim.getAirportGuide(destination));
}

export function getAllVehicles(): Promise<{ vehicles: VehiclePosition[]; updatedAt: string }> {
  return withFallback(() => api.getAllVehicles(), () => sim.getAllVehicles());
}

// Synchronous vehicle access — used by animation-frame consumers.
// When live data has been fetched recently this could be swapped for a
// cached snapshot, but for now the simulation engine gives smooth 1 Hz
// updates without blocking on I/O.
export { getVehiclesNow } from "./engine/fleetSimulator";
