import { useEffect, useRef, useState } from "react";
import type {
  DemandForecast,
  EnvironmentSnapshot,
  HealthPayload,
  OperationsOverviewPayload,
  Route,
  VehiclePosition
} from "@shared/types";
import {
  getAllVehicles,
  getEnvironment,
  getHealth,
  getOpsDemand,
  getOpsOverview,
  getRoutes
} from "../api";
import { LiveMap } from "./LiveMap";

const OPS_POLL_MS = 15_000;

export function OpsConsole() {
  const [vehicles, setVehicles] = useState<VehiclePosition[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [overview, setOverview] = useState<OperationsOverviewPayload | null>(null);
  const [demand, setDemand] = useState<DemandForecast | null>(null);
  const [env, setEnv] = useState<EnvironmentSnapshot | null>(null);
  const [clock, setClock] = useState(() => new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Bangkok" }));
  const pollRef = useRef(false);

  // Clock
  useEffect(() => {
    const id = setInterval(() => setClock(new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Bangkok" })), 1000);
    return () => clearInterval(id);
  }, []);

  // Bootstrap
  useEffect(() => {
    let alive = true;
    async function boot() {
      try {
        const [r, h, v, o, d, e] = await Promise.all([
          getRoutes(), getHealth(), getAllVehicles(),
          getOpsOverview(), getOpsDemand(), getEnvironment()
        ]);
        if (!alive) return;
        setRoutes(r);
        setHealth(h);
        setVehicles(v.vehicles);
        setOverview(o);
        setDemand(d);
        setEnv(e);
      } catch { /* degrade gracefully */ }
    }
    void boot();
    return () => { alive = false; };
  }, []);

  // Polling
  useEffect(() => {
    const id = setInterval(async () => {
      if (pollRef.current) return;
      pollRef.current = true;
      try {
        const [v, h, o, d] = await Promise.all([
          getAllVehicles(), getHealth(), getOpsOverview(), getOpsDemand()
        ]);
        setVehicles(v.vehicles);
        setHealth(h);
        setOverview(o);
        setDemand(d);
      } catch { /* keep last state */ }
      finally { pollRef.current = false; }
    }, OPS_POLL_MS);
    return () => clearInterval(id);
  }, []);

  const totalVehicles = vehicles.length;
  const busVehicles = vehicles.filter(v => !v.routeId.includes("rassada") && !v.routeId.includes("bang-rong") && !v.routeId.includes("chalong"));
  const ferryVehicles = vehicles.filter(v => v.routeId.includes("rassada") || v.routeId.includes("bang-rong") || v.routeId.includes("chalong"));
  const movingCount = vehicles.filter(v => v.status === "moving").length;
  const dwellingCount = vehicles.filter(v => v.status === "dwelling").length;

  const healthColor = health?.status === "ok" ? "#34C759" : "#FF9500";

  // Route summary
  const routeSummary = routes.map(r => ({
    name: r.shortName.en,
    color: r.color,
    vehicles: vehicles.filter(v => v.routeId === r.id).length,
    tier: r.tier
  }));

  return (
    <div className="ops">
      {/* Top bar */}
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
          {env ? (
            <span className="ops__weather">{env.tempC}°C · AQI {env.aqi} · Rain {env.rainProb}%</span>
          ) : null}
        </div>
      </header>

      <div className="ops__body">
        {/* Left: Fleet Map */}
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
            <span className="ops__map-stat">{totalVehicles} vehicles</span>
            <span className="ops__map-stat">{movingCount} moving</span>
            <span className="ops__map-stat">{dwellingCount} at stops</span>
          </div>
        </div>

        {/* Right: Analytics */}
        <div className="ops__analytics">
          {/* Fleet Status */}
          <section className="ops-card">
            <h2 className="ops-card__title">Fleet Status</h2>
            <div className="ops-card__grid">
              <div className="ops-metric">
                <span className="ops-metric__value">{busVehicles.length}</span>
                <span className="ops-metric__label">Buses</span>
              </div>
              <div className="ops-metric">
                <span className="ops-metric__value">{ferryVehicles.length}</span>
                <span className="ops-metric__label">Ferries</span>
              </div>
              <div className="ops-metric">
                <span className="ops-metric__value">{movingCount}</span>
                <span className="ops-metric__label">In transit</span>
              </div>
              <div className="ops-metric">
                <span className="ops-metric__value">{dwellingCount}</span>
                <span className="ops-metric__label">At stops</span>
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

          {/* Airport Demand */}
          {demand ? (
            <section className="ops-card ops-card--demand">
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
              <div className="ops-flights">
                <h3>Upcoming Arrivals</h3>
                <div className="ops-flights__list">
                  {demand.flights.slice(0, 8).map((f, i) => (
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

          {/* Passenger Flow */}
          {overview ? (
            <section className="ops-card">
              <h2 className="ops-card__title">Passenger Flow (Last Hour)</h2>
              <div className="ops-card__grid">
                {overview.routes.map(r => (
                  <div key={r.routeId} className="ops-metric">
                    <span className="ops-metric__value">{r.boardingsLastHour + r.alightingsLastHour}</span>
                    <span className="ops-metric__label">{r.shortName.en}</span>
                  </div>
                ))}
              </div>
              {overview.recentEvents.length > 0 ? (
                <div className="ops-events">
                  <h3>Recent Events</h3>
                  {overview.recentEvents.slice(0, 5).map((e, i) => (
                    <div key={i} className="ops-event-row">
                      <span className={`ops-event-row__type ${e.eventType === "boarding" ? "is-board" : "is-alight"}`}>
                        {e.eventType === "boarding" ? "+" : "-"}{e.passengers}
                      </span>
                      <span className="ops-event-row__stop">{e.stopName?.en ?? "Unknown"}</span>
                      <span className="ops-event-row__time">
                        {new Date(e.updatedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          {/* System Health */}
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
