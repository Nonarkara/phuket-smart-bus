import type {
  Advisory,
  AirportGuidePayload,
  DecisionSummary,
  HealthPayload,
  PriceComparison,
  Route,
  RouteId,
  Stop,
  VehiclePosition
} from "@shared/types";

async function fetchOnce<T>(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

async function fetchJson<T>(url: string) {
  try {
    return await fetchOnce<T>(url);
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 3_000));
    return await fetchOnce<T>(url);
  }
}

export function getHealth() {
  return fetchJson<HealthPayload>("/api/health");
}

export function getRoutes() {
  return fetchJson<Route[]>("/api/routes");
}

export function getStops(routeId: RouteId) {
  return fetchJson<Stop[]>(`/api/routes/${routeId}/stops`);
}

export function getVehicles(routeId: RouteId) {
  return fetchJson<{ vehicles: VehiclePosition[] }>("/api/routes/" + routeId + "/vehicles");
}

export function getAdvisories(routeId: RouteId) {
  return fetchJson<{ advisories: Advisory[] }>(`/api/routes/${routeId}/advisories`);
}

export function getDecisionSummary(routeId: RouteId, stopId: string) {
  return fetchJson<DecisionSummary>(
    `/api/decision-summary?routeId=${routeId}&stopId=${stopId}`
  );
}

export function getAirportGuide(destination = "") {
  const query = new URLSearchParams({ destination });
  return fetchJson<AirportGuidePayload>(`/api/airport-guide?${query.toString()}`);
}

export function getCompare() {
  return fetchJson<PriceComparison[]>("/api/compare");
}
