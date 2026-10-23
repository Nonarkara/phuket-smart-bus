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

/**
 * Is there a backend at all?
 *
 * THE PROBLEM THIS SOLVES
 *   `USE_LIVE` was hard-coded true, so every call tried the Express API
 *   first and fell back to the engine when it failed. On the STATIC site
 *   there is no Express server — the Pages deployment serves the bundle and
 *   the Functions tree, and /api/routes, /api/health, /api/environment,
 *   /api/compare and every /api/routes/<id>/{stops,vehicles,advisories}
 *   answered 404.
 *
 *   The fallback worked, so the page rendered. But the page paid for
 *   TWENTY-TWO round-trips that could not succeed, on every route, before
 *   the real data appeared — and every one of them printed a red line in
 *   the console. scripts/design/shipaudit.mjs counted 176 dead-endpoint
 *   calls across sixteen routes of the live site.
 *
 * THE FIX
 *   One question, asked once per session, to an endpoint that EXISTS on
 *   every deployment: /api/capabilities. The static Pages Function answers
 *   `backend: false`; the Express server answers `backend: true`.
 *
 *   The answer is a property of the DEPLOYMENT, not a constant in the
 *   source. When the real device telemetry arrives and the server is
 *   deployed behind the same origin, the app switches to the live API by
 *   itself — no source change, no constant to remember to flip. That is
 *   what the probe is for; a boolean in the source would have been a
 *   promise somebody has to keep.
 */
let backendProbe: Promise<boolean> | null = null;

function hasBackend(): Promise<boolean> {
  if (!backendProbe) {
    backendProbe = api
      .getCapabilities()
      .then((caps) => caps.backend === true)
      .catch(() => false);
  }
  return backendProbe;
}

async function withFallback<T>(live: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
  if (!USE_LIVE) return fallback();
  // The probe decides once. Everything after it is free.
  if (!(await hasBackend())) return fallback();
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
