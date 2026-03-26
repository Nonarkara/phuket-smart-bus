import { useEffect, useRef, useState } from "react";
import type {
  DemandForecast,
  HealthPayload,
  HourlyDemandPoint,
  OperationsOverviewPayload,
  Route,
  VehiclePosition,
  WeatherIntelligence
} from "@shared/types";
import {
  getAllVehicles,
  getHealth,
  getOpsDemand,
  getOpsHourlyDemand,
  getOpsOverview,
  getOpsWeather,
  getRoutes
} from "../api";
import { LiveMap } from "./LiveMap";

const OPS_POLL_MS = 15_000;

// --- SVG Bar Chart for demand vs capacity ---
function DemandChart({ points }: { points: HourlyDemandPoint[] }) {
  if (points.length === 0) return null;
  const maxVal = Math.max(...points.map(p => Math.max(p.busDemand, p.seatsAvailable)), 1);
  const barW = 100 / points.length;
  const currentIdx = 4; // current hour is index 4 (offset -4 to +8)

  return (
    <div className="ops-chart">
      <div className="ops-chart__legend">
        <span className="ops-chart__legend-item"><span className="ops-chart__dot" style={{ background: "#58a6ff" }} /> Bus demand</span>
        <span className="ops-chart__legend-item"><span className="ops-chart__dot" style={{ background: "rgba(255,255,255,0.15)" }} /> Seats available</span>
      </div>
      <svg viewBox={`0 0 ${points.length * 40} 120`} className="ops-chart__svg">
        {points.map((p, i) => {
          const x = i * 40;
          const demandH = (p.busDemand / maxVal) * 90;
          const seatsH = (p.seatsAvailable / maxVal) * 90;
          const isCurrent = i === currentIdx;
          return (
            <g key={i}>
              {/* Seats bar (background) */}
              <rect x={x + 4} y={100 - seatsH} width={14} height={seatsH} rx={2}
                fill="rgba(255,255,255,0.08)" />
              {/* Demand bar (foreground) */}
              <rect x={x + 20} y={100 - demandH} width={14} height={demandH} rx={2}
                fill={p.busDemand > p.seatsAvailable ? "#f85149" : "#58a6ff"}
                opacity={isCurrent ? 1 : 0.6} />
              {/* Hour label */}
              <text x={x + 20} y={115} textAnchor="middle" fontSize="8"
                fill={isCurrent ? "#e6edf3" : "#484f58"} fontWeight={isCurrent ? "600" : "400"}>
                {p.hour.slice(0, 2)}
              </text>
              {/* Now marker */}
              {isCurrent ? <line x1={x} y1={0} x2={x} y2={100} stroke="#58a6ff" strokeWidth="0.5" strokeDasharray="2 2" /> : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// --- Weather forecast mini chart ---
function WeatherBar({ forecast }: { forecast: WeatherIntelligence["forecast"] }) {
  if (forecast.length === 0) return null;
  return (
    <div className="ops-weather-bar">
      {forecast.slice(0, 8).map((h, i) => (
        <div key={i} className="ops-weather-bar__hour">
          <span className="ops-weather-bar__time">{h.hour.slice(0, 2)}</span>
          <div className="ops-weather-bar__rain" style={{ height: `${Math.max(4, h.rainProb * 0.4)}px`, background: h.rainProb > 60 ? "#58a6ff" : h.rainProb > 30 ? "rgba(88,166,255,0.4)" : "rgba(88,166,255,0.15)" }} />
          <span className="ops-weather-bar__temp">{h.tempC}°</span>
          <span className="ops-weather-bar__prob">{h.rainProb}%</span>
        </div>
      ))}
    </div>
  );
}

export function OpsConsole() {
  const [vehicles, setVehicles] = useState<VehiclePosition[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [overview, setOverview] = useState<OperationsOverviewPayload | null>(null);
  const [demand, setDemand] = useState<DemandForecast | null>(null);
  const [weather, setWeather] = useState<WeatherIntelligence | null>(null);
  const [hourlyDemand, setHourlyDemand] = useState<HourlyDemandPoint[]>([]);
  const [clock, setClock] = useState(() => new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Bangkok" }));
  const pollRef = useRef(false);

  useEffect(() => {
    const id = setInterval(() => setClock(new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Bangkok" })), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let alive = true;
    async function boot() {
      try {
        const [r, h, v, o, d, w, hd] = await Promise.all([
          getRoutes(), getHealth(), getAllVehicles(),
          getOpsOverview(), getOpsDemand(), getOpsWeather(), getOpsHourlyDemand()
        ]);
        if (!alive) return;
        setRoutes(r); setHealth(h); setVehicles(v.vehicles);
        setOverview(o); setDemand(d); setWeather(w); setHourlyDemand(hd.points);
      } catch { /* degrade */ }
    }
    void boot();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const id = setInterval(async () => {
      if (pollRef.current) return;
      pollRef.current = true;
      try {
        const [v, h, o, d] = await Promise.all([
          getAllVehicles(), getHealth(), getOpsOverview(), getOpsDemand()
        ]);
        setVehicles(v.vehicles); setHealth(h); setOverview(o); setDemand(d);
      } catch { /* keep last */ }
      finally { pollRef.current = false; }
    }, OPS_POLL_MS);
    return () => clearInterval(id);
  }, []);

  const totalVehicles = vehicles.length;
  const movingCount = vehicles.filter(v => v.status === "moving").length;
  const dwellingCount = vehicles.filter(v => v.status === "dwelling").length;
  const healthColor = health?.status === "ok" ? "#3fb950" : "#d29922";

  const routeSummary = routes.map(r => ({
    name: r.shortName.en,
    color: r.color,
    vehicles: vehicles.filter(v => v.routeId === r.id).length,
    tier: r.tier
  }));

  return (
    <div className="ops">
      {/* ===== Header ===== */}
      <header className="ops__header">
        <div className="ops__brand">
          <h1>Phuket Smart Bus</h1>
          <span className="ops__subtitle">Operations Console</span>
        </div>
        <div className="ops__status-bar">
          <span className="ops__clock">{clock} ICT</span>
          <span className="ops__health" style={{ color: healthColor }}>
            <span className="ops__health-dot" style={{ background: healthColor }} />
            {health?.status === "ok" ? "All systems live" : "Degraded"}
          </span>
          {weather ? (
            <span className="ops__weather-pill">
              {weather.current.tempC}°C · AQI {weather.current.aqi} · Rain {weather.current.rainProb}%
              {weather.monsoonSeason ? " · Monsoon" : ""}
            </span>
          ) : null}
        </div>
      </header>

      <div className="ops__body">
        {/* ===== Left: Fleet Map ===== */}
        <div className="ops__map">
          <LiveMap
            lang="en"
            routes={routes}
            stops={[]}
            vehicles={vehicles}
            userLocation={null}
            selectedStop={null}
            mode="route"
            bounds={null}
            animationDurationMs={OPS_POLL_MS}
            onModeChange={() => {}}
          />
          <div className="ops__map-overlay">
            <span className="ops__map-stat ops__map-stat--primary">{totalVehicles} vehicles</span>
            <span className="ops__map-stat">{movingCount} moving</span>
            <span className="ops__map-stat">{dwellingCount} at stops</span>
          </div>
        </div>

        {/* ===== Right: Analytics ===== */}
        <div className="ops__analytics">

          {/* --- Fleet Status --- */}
          <section className="ops-card">
            <h2 className="ops-card__title">Fleet Status</h2>
            <div className="ops-card__grid">
              <div className="ops-metric">
                <span className="ops-metric__value">{totalVehicles}</span>
                <span className="ops-metric__label">Online</span>
              </div>
              <div className="ops-metric">
                <span className="ops-metric__value">{movingCount}</span>
                <span className="ops-metric__label">In transit</span>
              </div>
            </div>
            <div className="ops-card__routes">
              {routeSummary.map(r => (
                <div key={r.name} className="ops-route-row">
                  <span className="ops-route-row__dot" style={{ background: r.color }} />
                  <span className="ops-route-row__name">{r.name}</span>
                  <span className="ops-route-row__count">{r.vehicles}</span>
                  <span className="ops-route-row__tier">{r.tier}</span>
                </div>
              ))}
            </div>
          </section>

          {/* --- Weather Intelligence --- */}
          {weather ? (
            <section className="ops-card ops-card--weather">
              <h2 className="ops-card__title">Weather Intelligence</h2>
              <div className="ops-card__grid">
                <div className="ops-metric">
                  <span className="ops-metric__value">{weather.current.tempC}°</span>
                  <span className="ops-metric__label">Temp</span>
                </div>
                <div className="ops-metric">
                  <span className="ops-metric__value">{weather.current.rainProb}%</span>
                  <span className="ops-metric__label">Rain</span>
                </div>
                <div className="ops-metric">
                  <span className="ops-metric__value">{weather.current.windKph}</span>
                  <span className="ops-metric__label">Wind km/h</span>
                </div>
                <div className={`ops-metric ${weather.current.aqi > 100 ? "ops-metric--alert" : ""}`}>
                  <span className="ops-metric__value">{weather.current.aqi}</span>
                  <span className="ops-metric__label">AQI</span>
                </div>
              </div>

              {/* Monsoon indicator */}
              <div className={`ops-monsoon ${weather.monsoonSeason ? "is-active" : ""}`}>
                <span className="ops-monsoon__badge">{weather.monsoonSeason ? "MONSOON SEASON" : "DRY SEASON"}</span>
                <p className="ops-monsoon__note">{weather.monsoonNote}</p>
              </div>

              {/* 8-hour forecast */}
              <WeatherBar forecast={weather.forecast} />

              {/* Driver alerts */}
              {weather.driverAlerts.length > 0 ? (
                <div className="ops-driver-alerts">
                  <h3>Driver Alerts</h3>
                  {weather.driverAlerts.map((alert, i) => (
                    <div key={i} className="ops-driver-alert">{alert}</div>
                  ))}
                </div>
              ) : (
                <div className="ops-driver-alerts ops-driver-alerts--clear">
                  <p>No active driver alerts. Clear conditions.</p>
                </div>
              )}
            </section>
          ) : null}

          {/* --- Demand vs Capacity Chart --- */}
          {hourlyDemand.length > 0 ? (
            <section className="ops-card">
              <h2 className="ops-card__title">Demand vs Capacity (12h)</h2>
              <DemandChart points={hourlyDemand} />
            </section>
          ) : null}

          {/* --- Airport Demand --- */}
          {demand ? (
            <section className="ops-card">
              <h2 className="ops-card__title">HKT Airport Demand</h2>
              <div className="ops-card__grid">
                <div className="ops-metric">
                  <span className="ops-metric__value">{demand.arrivalsNext2h}</span>
                  <span className="ops-metric__label">Flights (2h)</span>
                </div>
                <div className="ops-metric">
                  <span className="ops-metric__value">{demand.estimatedPaxNext2h.toLocaleString()}</span>
                  <span className="ops-metric__label">Passengers</span>
                </div>
                <div className="ops-metric">
                  <span className="ops-metric__value">{demand.busDemandEstimate}</span>
                  <span className="ops-metric__label">Bus demand</span>
                </div>
                <div className="ops-metric ops-metric--highlight">
                  <span className="ops-metric__value">{demand.recommendedFleet}</span>
                  <span className="ops-metric__label">Recommended</span>
                </div>
              </div>
              <p className="ops-card__rec">{demand.recommendation}</p>

              {/* Flight table */}
              <div className="ops-flights">
                <h3>Upcoming Arrivals</h3>
                <div className="ops-flights__list">
                  {demand.flights.slice(0, 6).map((f, i) => (
                    <div key={i} className="ops-flight-row">
                      <span className="ops-flight-row__time">{f.scheduledTime}</span>
                      <span className="ops-flight-row__flight">{f.flightNo}</span>
                      <span className="ops-flight-row__origin">{f.origin}</span>
                      <span className="ops-flight-row__airline">{f.airline}</span>
                      <span className="ops-flight-row__pax">{f.estimatedPax} pax</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {/* --- System Health --- */}
          {health ? (
            <section className="ops-card">
              <h2 className="ops-card__title">System Health</h2>
              <div className="ops-health-grid">
                {health.sources.map(s => (
                  <div key={s.source} className={`ops-health-item is-${s.state}`}>
                    <span className="ops-health-item__name">{s.source}</span>
                    <span className="ops-health-item__state">{s.state}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
