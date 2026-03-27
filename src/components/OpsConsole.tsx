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

// Available map overlay layers
type LayerId = "precipitation" | "accidents" | "aqi" | "alerts";

const LAYER_DEFS: { id: LayerId; label: string; icon: string; description: string }[] = [
  { id: "precipitation", label: "Precipitation", icon: "🌧️", description: "Live rain radar" },
  { id: "accidents", label: "Incidents", icon: "⚠️", description: "Road accidents & closures" },
  { id: "aqi", label: "Air Quality", icon: "🌫️", description: "PM2.5 & AQI heatmap" },
  { id: "alerts", label: "City Alerts", icon: "🏙️", description: "Flooding, construction, events" },
];

function buildOverlayLayers(active: Set<LayerId>): MapOverlay[] {
  const layers: MapOverlay[] = [];
  // When any layer is active, switch to dark satellite-style base
  if (active.size > 0) {
    layers.push({
      id: "dark-base",
      url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      attribution: "CartoDB",
      opacity: 0.5
    });
  }
  return layers;
}

// Mock data for map marker overlays
const INCIDENT_MARKERS = [
  { lat: 7.9037, lng: 98.2948, type: "accident", label: "Minor collision - Patong Hill" },
  { lat: 7.8804, lng: 98.3923, type: "construction", label: "Road works - Phuket Town" },
  { lat: 8.0710, lng: 98.3065, type: "flooding", label: "Low-lying area - Thalang" },
];

const AQI_ZONES = [
  { lat: 7.88, lng: 98.38, aqi: 55, label: "Phuket Town" },
  { lat: 7.90, lng: 98.30, aqi: 42, label: "Patong" },
  { lat: 7.82, lng: 98.30, aqi: 38, label: "Kata-Karon" },
  { lat: 8.11, lng: 98.32, aqi: 61, label: "Airport" },
  { lat: 7.77, lng: 98.33, aqi: 35, label: "Rawai" },
];

const CITY_ALERTS = [
  { lat: 7.85, lng: 98.36, type: "event", label: "Vegetarian Festival - Phuket Town" },
  { lat: 7.95, lng: 98.28, type: "flood_risk", label: "Flood watch - Surin Beach area" },
];

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

export function OpsConsole({ onToggle }: { onToggle?: () => void }) {
  const [vehicles, setVehicles] = useState<VehiclePosition[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [overview, setOverview] = useState<OperationsOverviewPayload | null>(null);
  const [demand, setDemand] = useState<DemandForecast | null>(null);
  const [weather, setWeather] = useState<WeatherIntelligence | null>(null);
  const [hourlyDemand, setHourlyDemand] = useState<HourlyDemandPoint[]>([]);
  const [nationalities, setNationalities] = useState<{ country: string; flag: string; pax: number; percentage: number }[]>([]);
  const [departures, setDepartures] = useState<{ flightNo: string; origin: string; scheduledTime: string; estimatedPax: number }[]>([]);
  const [clock, setClock] = useState(() => new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Bangkok" }));
  const pollRef = useRef(false);

  // Easter egg: day simulation
  const [simRunning, setSimRunning] = useState(false);
  const [simTime, setSimTime] = useState("");
  const [simProgress, setSimProgress] = useState(0);
  const [simTouchpoints, setSimTouchpoints] = useState(0);
  const [simPassengers, setSimPassengers] = useState(0);
  const simAbort = useRef(false);
  const [activeLayers, setActiveLayers] = useState<Set<LayerId>>(new Set());

  function toggleLayer(id: LayerId) {
    setActiveLayers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const overlayLayers = buildOverlayLayers(activeLayers);

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
      // Fetch flight nationalities separately
      try {
        const flightData = await fetch("/api/ops/flights").then(r => r.json());
        if (!alive) return;
        setNationalities(flightData.nationalities ?? []);
        setDepartures(flightData.departures ?? []);
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

  // Pier proximity zones for touchpoint detection (lat, lng)
  // Wider threshold (~1km) to catch bus stops near ferry piers
  const PIER_ZONES = [
    { name: "Rassada Pier", lat: 7.8574, lng: 98.3866 },
    { name: "Chalong Pier", lat: 7.8216, lng: 98.3613 },
    { name: "Bang Rong Pier", lat: 8.0317, lng: 98.4192 },
  ];
  const PROXIMITY = 0.012; // ~1.3km in lat/lng degrees

  async function runDaySimulation() {
    if (simRunning) { simAbort.current = true; return; }
    simAbort.current = false;
    setSimRunning(true);
    setSimTouchpoints(0);
    setSimPassengers(0);

    const START = 360;  // 06:00
    const END = 1440;   // 24:00
    const STEP = 5;     // 5-minute increments
    let touchpoints = 0;
    let passengers = 0;

    for (let t = START; t <= END; t += STEP) {
      if (simAbort.current) break;
      try {
        const res = await fetch(`/api/simulate?t=${t}`);
        const data = await res.json();
        setVehicles(data.vehicles);
        setSimTime(data.simTime);
        setSimProgress((t - START) / (END - START));

        // Detect touchpoints: bus + ferry near same pier
        const ferrySet = new Set(["rassada-phi-phi", "rassada-ao-nang", "bang-rong-koh-yao", "chalong-racha"]);
        const buses = data.vehicles.filter((v: VehiclePosition) => !ferrySet.has(v.routeId) && v.status === "dwelling");
        const ferries = data.vehicles.filter((v: VehiclePosition) => ferrySet.has(v.routeId) && v.status === "dwelling");

        for (const pier of PIER_ZONES) {
          const nearBus = buses.some((b: VehiclePosition) =>
            Math.abs(b.coordinates[0] - pier.lat) < PROXIMITY && Math.abs(b.coordinates[1] - pier.lng) < PROXIMITY
          );
          const nearFerry = ferries.some((f: VehiclePosition) =>
            Math.abs(f.coordinates[0] - pier.lat) < PROXIMITY && Math.abs(f.coordinates[1] - pier.lng) < PROXIMITY
          );
          if (nearBus && nearFerry) {
            touchpoints++;
            passengers += Math.floor(20 + Math.random() * 60);
          }
        }
        setSimTouchpoints(touchpoints);
        setSimPassengers(passengers);

        await new Promise(r => setTimeout(r, 80)); // 80ms per step = ~14s total animation
      } catch { break; }
    }

    setSimRunning(false);
    setSimProgress(0);
    setSimTime("");
  }

  const FERRY_ROUTES = new Set(["rassada-phi-phi", "rassada-ao-nang", "bang-rong-koh-yao", "chalong-racha"]);
  const totalVehicles = vehicles.length;
  const busCount = vehicles.filter(v => !FERRY_ROUTES.has(v.routeId)).length;
  const ferryCount = vehicles.filter(v => FERRY_ROUTES.has(v.routeId)).length;
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
          {onToggle ? (
            <button className="ops__back" type="button" onClick={onToggle} title="Switch to passenger view">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
          ) : null}
          <h1>Phuket Smart Bus</h1>
          <span className="ops__subtitle">Intelligent Operations Center</span>
        </div>
        <div className="ops__status-bar">
          <span className="ops__clock">
            <span className="ops__date">{new Date().toLocaleDateString("en-GB", { timeZone: "Asia/Bangkok", weekday: "short", day: "numeric", month: "short" })}</span>
            {" "}{clock} ICT
          </span>
          <span className="ops__health" style={{ color: healthColor }}>
            <span className="ops__health-dot" style={{ background: healthColor }} />
            {health?.status === "ok" ? "All systems live" : "Degraded"}
          </span>
        </div>
      </header>

      {/* ===== Key Metrics Strip ===== */}
      <div className="ops__kpi-strip">
        <div className="ops-kpi">
          <span className="ops-kpi__value">{totalVehicles}</span>
          <span className="ops-kpi__label">Fleet Online</span>
        </div>
        <div className="ops-kpi">
          <span className="ops-kpi__value">{movingCount}</span>
          <span className="ops-kpi__label">In Transit</span>
        </div>
        <div className="ops-kpi">
          <span className="ops-kpi__value">{demand?.busDemandEstimate ?? "—"}</span>
          <span className="ops-kpi__label">Demand Now</span>
        </div>
        <div className="ops-kpi ops-kpi--highlight">
          <span className="ops-kpi__value">{demand?.recommendedFleet ?? "—"}</span>
          <span className="ops-kpi__label">Recommended</span>
        </div>
        <div className="ops-kpi">
          <span className="ops-kpi__value">{weather?.current.tempC ?? "—"}°</span>
          <span className="ops-kpi__label">{weather?.current.rainProb ?? 0}% Rain</span>
        </div>
        <div className="ops-kpi">
          <span className="ops-kpi__value">{demand?.arrivalsNext2h ?? "—"}</span>
          <span className="ops-kpi__label">Flights (2h)</span>
        </div>
        <div className="ops-kpi">
          <span className="ops-kpi__value">{weather?.current.aqi ?? "—"}</span>
          <span className="ops-kpi__label">AQI</span>
        </div>
        {!simRunning ? (
          <button className="ops-kpi ops-kpi--sim" type="button" onClick={runDaySimulation}>
            <span className="ops-kpi__value">▶</span>
            <span className="ops-kpi__label">Simulate</span>
          </button>
        ) : (
          <button className="ops-kpi ops-kpi--sim-active" type="button" onClick={runDaySimulation}>
            <span className="ops-kpi__value">{simTime}</span>
            <span className="ops-kpi__label">■ Stop</span>
          </button>
        )}
      </div>

      {/* Simulation progress bar (full width) */}
      {simRunning ? (
        <div className="ops__sim-strip">
          <div className="ops__sim-bar"><div className="ops__sim-bar-fill" style={{ width: `${simProgress * 100}%` }} /></div>
          <div className="ops__sim-stats">
            <span>🕐 {simTime}</span>
            <span>Touchpoints: <strong>{simTouchpoints}</strong></span>
            <span>Passengers: <strong>{simPassengers.toLocaleString()}</strong></span>
          </div>
        </div>
      ) : null}

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
            overlayLayers={overlayLayers}
            overlayMarkers={[
              ...(activeLayers.has("accidents") ? INCIDENT_MARKERS.map((m, i) => ({
                id: `inc-${i}`, lat: m.lat, lng: m.lng, color: m.type === "accident" ? "#f85149" : m.type === "construction" ? "#d29922" : "#58a6ff",
                radius: 12, label: `${m.type === "accident" ? "⚠️" : m.type === "construction" ? "🏗️" : "🌊"} ${m.label}`, fillOpacity: 0.4
              })) : []),
              ...(activeLayers.has("aqi") ? AQI_ZONES.map((z, i) => ({
                id: `aqi-${i}`, lat: z.lat, lng: z.lng, color: z.aqi > 50 ? "#d29922" : "#3fb950",
                radius: z.aqi > 50 ? 20 : 15, label: `AQI ${z.aqi} — ${z.label}`, fillOpacity: 0.25
              })) : []),
              ...(activeLayers.has("alerts") ? CITY_ALERTS.map((a, i) => ({
                id: `alert-${i}`, lat: a.lat, lng: a.lng, color: a.type === "flood_risk" ? "#58a6ff" : "#a371f7",
                radius: 14, label: `${a.type === "flood_risk" ? "🌊" : "📢"} ${a.label}`, fillOpacity: 0.35
              })) : []),
            ]}
            onModeChange={() => {}}
          />
          {/* Layer toggles */}
          <div className="ops__layers">
            {LAYER_DEFS.map(l => (
              <button
                key={l.id}
                className={`ops__layer-btn ${activeLayers.has(l.id) ? "is-active" : ""}`}
                type="button"
                onClick={() => toggleLayer(l.id)}
                title={l.description}
              >
                <span className="ops__layer-icon">{l.icon}</span>
                <span className="ops__layer-label">{l.label}</span>
              </button>
            ))}
          </div>
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
                <span className="ops-metric__value">{busCount}</span>
                <span className="ops-metric__label">Buses</span>
              </div>
              <div className="ops-metric">
                <span className="ops-metric__value">{ferryCount}</span>
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
                  {demand.flights.filter(f => f.type === "arrival").slice(0, 5).map((f, i) => (
                    <div key={`a-${i}`} className="ops-flight-row">
                      <span className="ops-flight-row__time">{f.scheduledTime}</span>
                      <span className="ops-flight-row__flight">{f.flightNo}</span>
                      <span className="ops-flight-row__origin">{f.origin}</span>
                      <span className="ops-flight-row__airline">{f.airline}</span>
                      <span className="ops-flight-row__pax">{f.estimatedPax} pax</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Departures — people need buses TO airport */}
              {departures.length > 0 ? (
                <div className="ops-flights">
                  <h3>Departures (bus demand to airport)</h3>
                  <div className="ops-flights__list">
                    {departures.slice(0, 4).map((f, i) => (
                      <div key={`d-${i}`} className="ops-flight-row ops-flight-row--dep">
                        <span className="ops-flight-row__time">{f.scheduledTime}</span>
                        <span className="ops-flight-row__flight">{f.flightNo}</span>
                        <span className="ops-flight-row__origin">→ {f.origin}</span>
                        <span className="ops-flight-row__pax">{f.estimatedPax} pax</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          {/* --- Passenger Nationalities --- */}
          {nationalities.length > 0 ? (
            <section className="ops-card">
              <h2 className="ops-card__title">Arriving Passengers by Country</h2>
              <div className="ops-nationalities">
                {nationalities.slice(0, 8).map(n => (
                  <div key={n.country} className="ops-nationality">
                    <span className="ops-nationality__flag">{n.flag}</span>
                    <span className="ops-nationality__country">{n.country}</span>
                    <span className="ops-nationality__pax">{n.pax.toLocaleString()}</span>
                    <div className="ops-nationality__bar">
                      <div className="ops-nationality__bar-fill" style={{ width: `${n.percentage}%` }} />
                    </div>
                    <span className="ops-nationality__pct">{n.percentage}%</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {/* --- Precipitation Impact --- */}
          {weather ? (
            <section className="ops-card">
              <h2 className="ops-card__title">Precipitation Impact on Operations</h2>
              <div className="ops-precip">
                <div className="ops-precip__current">
                  <div className={`ops-precip__level ${weather.current.rainProb > 60 ? "ops-precip__level--high" : weather.current.rainProb > 30 ? "ops-precip__level--medium" : "ops-precip__level--low"}`}>
                    <span className="ops-precip__prob">{weather.current.rainProb}%</span>
                    <span className="ops-precip__label">Rain probability</span>
                  </div>
                  <div className="ops-precip__effects">
                    {weather.current.rainProb > 60 ? (
                      <>
                        <div className="ops-precip__effect ops-precip__effect--red">⏱️ +15-20 min delays expected on all routes</div>
                        <div className="ops-precip__effect ops-precip__effect--red">🌊 Ferry services may be suspended</div>
                        <div className="ops-precip__effect ops-precip__effect--amber">👁️ Reduced visibility on hillside routes</div>
                      </>
                    ) : weather.current.rainProb > 30 ? (
                      <>
                        <div className="ops-precip__effect ops-precip__effect--amber">⏱️ +5-10 min possible delays</div>
                        <div className="ops-precip__effect ops-precip__effect--amber">🌧️ Patong Hill may slow down</div>
                      </>
                    ) : (
                      <div className="ops-precip__effect ops-precip__effect--green">✓ Clear conditions — no weather delays</div>
                    )}
                  </div>
                </div>
                {/* Next hours forecast mini */}
                <div className="ops-precip__forecast">
                  {weather.forecast.slice(0, 6).map((h, i) => (
                    <div key={i} className={`ops-precip__hour ${h.rainProb > 60 ? "is-high" : h.rainProb > 30 ? "is-medium" : ""}`}>
                      <span>{String(h.hour).padStart(2, "0")}:00</span>
                      <span>{h.rainProb}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {/* --- Day Simulation --- */}
          <section className="ops-card ops-card--sim">
            <h2 className="ops-card__title">Fleet Simulation</h2>
            {!simRunning ? (
              <div className="ops-sim-card">
                <p className="ops-sim-card__desc">Watch 18 hours of fleet movement across all routes — buses, ferries, and pier connections.</p>
                <button className="ops-sim-card__btn" type="button" onClick={runDaySimulation}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
                  Run Day Simulation
                </button>
              </div>
            ) : (
              <div className="ops-sim-card">
                <div className="ops__sim-clock">{simTime}</div>
                <div className="ops__sim-bar"><div className="ops__sim-bar-fill" style={{ width: `${simProgress * 100}%` }} /></div>
                <div className="ops__sim-stats">
                  <span>Touchpoints: <strong>{simTouchpoints}</strong></span>
                  <span>Passengers: <strong>{simPassengers.toLocaleString()}</strong></span>
                </div>
                <button className="ops-sim-card__stop" type="button" onClick={runDaySimulation}>Stop</button>
              </div>
            )}
          </section>

          {/* --- Road Incidents (mock) --- */}
          <section className="ops-card">
            <h2 className="ops-card__title">Road Conditions</h2>
            <div className="ops-incidents">
              {weather && weather.current.rainProb > 50 ? (
                <div className="ops-incident ops-incident--warning">
                  <span className="ops-incident__icon">⚠️</span>
                  <div>
                    <strong>Heavy rain expected</strong>
                    <p>{weather.current.rainProb}% precipitation probability. Advise caution on hillside routes.</p>
                  </div>
                </div>
              ) : null}
              {weather && weather.current.windKph > 25 ? (
                <div className="ops-incident ops-incident--warning">
                  <span className="ops-incident__icon">💨</span>
                  <div>
                    <strong>Strong winds ({weather.current.windKph} km/h)</strong>
                    <p>Ferry services may be affected. Monitor Rassada and Chalong piers.</p>
                  </div>
                </div>
              ) : null}
              <div className="ops-incident ops-incident--info">
                <span className="ops-incident__icon">🛣️</span>
                <div>
                  <strong>Route 402 — Normal flow</strong>
                  <p>Main highway clear. No reported incidents.</p>
                </div>
              </div>
              <div className="ops-incident ops-incident--info">
                <span className="ops-incident__icon">🏗️</span>
                <div>
                  <strong>Patong Hill — Construction zone</strong>
                  <p>Expect 5-10 min delays on Patong Line between 08:00-17:00.</p>
                </div>
              </div>
            </div>
          </section>

          {/* --- Demand Hotspots --- */}
          <section className="ops-card">
            <h2 className="ops-card__title">Demand Hotspots</h2>
            <div className="ops-hotspots">
              {/* Mock hotspot data — will be replaced by real /api/ops/demand-requests */}
              {["Central Patong", "Kata Beach", "Airport", "Old Town", "Karon"].map((zone, i) => {
                const count = Math.max(0, Math.floor(Math.random() * 15) - 5);
                return count > 0 ? (
                  <div key={zone} className={`ops-hotspot ${count >= 8 ? "ops-hotspot--high" : count >= 4 ? "ops-hotspot--medium" : ""}`}>
                    <span className="ops-hotspot__zone">{zone}</span>
                    <span className="ops-hotspot__count">{count} requests</span>
                    <div className="ops-hotspot__bar">
                      <div className="ops-hotspot__bar-fill" style={{ width: `${Math.min(100, count * 8)}%` }} />
                    </div>
                  </div>
                ) : null;
              })}
              <p className="ops-hotspots__note">Passenger bus requests from the app (last hour)</p>
            </div>
          </section>

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
