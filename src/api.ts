import type {
  Advisory,
  AirportGuidePayload,
  DecisionSummary,
  HealthPayload,
  OperationsOverviewPayload,
  Route,
  RouteId,
  Stop,
  VehiclePosition
} from "@shared/types";

async function fetchJson<T>(url: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
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

export function getOperationsOverview() {
  return fetchJson<OperationsOverviewPayload>("/api/operations/overview");
}
