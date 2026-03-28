import type {
  Advisory,
  AirportGuidePayload,
  DemandForecast,
  DecisionSummary,
  EnvironmentSnapshot,
  FlightInfo,
  HealthPayload,
  HourlyDemandPoint,
  InvestorSimulationPayload,
  OperationsOverviewPayload,
  OpsDashboardPayload,
  PriceComparison,
  Route,
  RouteId,
  SimulationSnapshot,
  Stop,
  VehiclePosition,
  WeatherIntelligence
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

export function getEnvironment() {
  return fetchJson<EnvironmentSnapshot>("/api/environment");
}

export function getOpsOverview() {
  return fetchJson<OperationsOverviewPayload>("/api/operations/overview");
}

export function getOpsFlights() {
  return fetchJson<{ flights: FlightInfo[] }>("/api/ops/flights");
}

export function getOpsDemand() {
  return fetchJson<DemandForecast>("/api/ops/demand");
}

export function getAllVehicles() {
  return fetchJson<{ vehicles: VehiclePosition[]; updatedAt: string }>("/api/vehicles/all");
}

export function getOpsWeather() {
  return fetchJson<WeatherIntelligence>("/api/ops/weather");
}

export function getOpsHourlyDemand() {
  return fetchJson<{ points: HourlyDemandPoint[] }>("/api/ops/hourly-demand");
}

export function getOpsDashboard() {
  return fetchJson<OpsDashboardPayload>("/api/ops/dashboard");
}

export function getInvestorSimulation() {
  return fetchJson<InvestorSimulationPayload>("/api/ops/investor-sim");
}

export function getSimulationFrame(simMinutes: number) {
  return fetchJson<SimulationSnapshot>(`/api/simulate?t=${simMinutes}`);
}
