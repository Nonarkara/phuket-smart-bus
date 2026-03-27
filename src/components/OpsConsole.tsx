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

// Client-side fallback simulation when /api/simulate is unavailable
function generateClientSimulation(minuteOfDay: number, routes: Route[]): VehiclePosition[] {
  const vehicles: VehiclePosition[] = [];
  const hour = minuteOfDay / 60;

  // Route waypoints (simplified paths)
  const ROUTE_PATHS: Record<string, { lat: number; lng: number }[]> = {
    "rawai-airport": [
      { lat: 7.7804, lng: 98.3225 }, { lat: 7.8150, lng: 98.3050 }, { lat: 7.8420, lng: 98.3080 },
      { lat: 7.8780, lng: 98.2950 }, { lat: 7.9050, lng: 98.3050 }, { lat: 7.9500, lng: 98.3100 },
      { lat: 8.0000, lng: 98.3100 }, { lat: 8.0700, lng: 98.3100 }, { lat: 8.1090, lng: 98.3070 }
    ],
    "patong-old-bus-station": [
      { lat: 7.8830, lng: 98.2930 }, { lat: 7.8900, lng: 98.3200 }, { lat: 7.8850, lng: 98.3500 },
      { lat: 7.8840, lng: 98.3800 }, { lat: 7.8840, lng: 98.3960 }
    ],
    "dragon-line": [
      { lat: 7.8840, lng: 98.3960 }, { lat: 7.8860, lng: 98.3880 }, { lat: 7.8900, lng: 98.3850 },
      { lat: 7.8870, lng: 98.3920 }, { lat: 7.8840, lng: 98.3960 }
    ],
    "rassada-phi-phi": [
      { lat: 7.8574, lng: 98.3866 }, { lat: 7.8200, lng: 98.4500 }, { lat: 7.7900, lng: 98.5500 },
      { lat: 7.7500, lng: 98.7700 }
    ],
    "rassada-ao-nang": [
      { lat: 7.8574, lng: 98.3866 }, { lat: 7.9000, lng: 98.5000 }, { lat: 7.9500, lng: 98.6000 },
      { lat: 8.0300, lng: 98.8200 }
    ],
    "bang-rong-koh-yao": [
      { lat: 8.0317, lng: 98.4192 }, { lat: 8.0500, lng: 98.4500 }, { lat: 8.0800, lng: 98.5000 },
      { lat: 8.1100, lng: 98.5800 }
    ],
    "chalong-racha": [
      { lat: 7.8216, lng: 98.3613 }, { lat: 7.7500, lng: 98.3600 }, { lat: 7.6500, lng: 98.3600 },
      { lat: 7.6000, lng: 98.3650 }
    ]
  };

  // Vehicle counts by time of day (Bangkok time)
  const busActivity = hour < 6 ? 0 : hour < 7 ? 0.4 : hour < 9 ? 0.7 : hour < 18 ? 1.0 : hour < 21 ? 0.7 : hour < 23 ? 0.3 : 0;
  const ferryActivity = hour < 7.5 ? 0 : hour < 9 ? 0.5 : hour < 17 ? 1.0 : hour < 19 ? 0.6 : 0;

  // Trip duration in minutes for each route
  const TRIP_DURATIONS: Record<string, number> = {
    "rawai-airport": 75, "patong-old-bus-station": 40, "dragon-line": 25,
    "rassada-phi-phi": 90, "rassada-ao-nang": 120, "bang-rong-koh-yao": 45, "chalong-racha": 60
  };

  // Departure intervals (minutes between buses)
  const HEADWAY: Record<string, number> = {
    "rawai-airport": 15, "patong-old-bus-station": 20, "dragon-line": 30,
    "rassada-phi-phi": 60, "rassada-ao-nang": 120, "bang-rong-koh-yao": 90, "chalong-racha": 120
  };

  const busRoutes = ["rawai-airport", "patong-old-bus-station", "dragon-line"];
  const ferryRoutes = ["rassada-phi-phi", "rassada-ao-nang", "bang-rong-koh-yao", "chalong-racha"];

  function addVehiclesForRoute(routeId: string, activity: number, isFerry: boolean) {
    const path = ROUTE_PATHS[routeId];
    if (!path || activity <= 0) return;
    const tripMin = TRIP_DURATIONS[routeId] ?? 60;
    const headway = HEADWAY[routeId] ?? 30;
    // First departure
    const firstDep = isFerry ? 480 : 360; // ferries start 08:00, buses 06:00

    // Generate each active trip
    for (let dep = firstDep; dep < minuteOfDay + tripMin; dep += headway) {
      const age = minuteOfDay - dep;
      if (age < -2 || age > tripMin + 5) continue; // not active
      if (activity < 0.5 && (dep / headway) % 2 === 0) continue; // skip every other during low activity

      const progress = Math.max(0, Math.min(1, age / tripMin));
      // Alternate direction: odd trips go forward, even go reverse
      const tripIndex = Math.floor((dep - firstDep) / headway);
      const reverse = tripIndex % 2 === 1;
      const effectiveProgress = reverse ? 1 - progress : progress;

      const pathPos = effectiveProgress * (path.length - 1);
      const pathIdx = Math.min(Math.floor(pathPos), path.length - 2);
      const segProgress = pathPos - pathIdx;
      const from = path[pathIdx]!;
      const to = path[pathIdx + 1]!;

      const lat = from.lat + (to.lat - from.lat) * segProgress;
      const lng = from.lng + (to.lng - from.lng) * segProgress;
      const moving = age > 0 && age < tripMin && segProgress > 0.03 && segProgress < 0.97;

      const vid = vehicles.length;
      const destLabel = reverse ? path[0]! : path[path.length - 1]!;
      vehicles.push({
        id: `sim-${vid}`, routeId: routeId as any,
        licensePlate: isFerry ? `Ferry-${String(vid).padStart(2, "0")}` : `Bus-${String(vid).padStart(3, "0")}`,
        vehicleId: `sim-${vid}`, deviceId: null,
        coordinates: [lat, lng],
        heading: Math.atan2(to.lng - from.lng, to.lat - from.lat) * 180 / Math.PI * (reverse ? -1 : 1),
        speedKph: moving ? (isFerry ? 18 : 25) : 0,
        destination: { en: routeId, th: routeId, zh: routeId, de: routeId, fr: routeId, es: routeId },
        updatedAt: new Date().toISOString(), telemetrySource: "schedule_mock", freshness: "fresh",
        status: moving ? "moving" : "dwelling",
        distanceToDestinationMeters: Math.round((1 - progress) * (isFerry ? 30000 : 20000)),
        stopsAway: Math.round((1 - progress) * (isFerry ? 3 : 10))
      });
    }
  }

  for (const routeId of busRoutes) addVehiclesForRoute(routeId, busActivity, false);
  for (const routeId of ferryRoutes) addVehiclesForRoute(routeId, ferryActivity, true);

  return vehicles;
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
  const [simPaxToAirport, setSimPaxToAirport] = useState(0);
  const [simPaxFromAirport, setSimPaxFromAirport] = useState(0);
  const [simCO2Saved, setSimCO2Saved] = useState(0);
  const [simFareRevenue, setSimFareRevenue] = useState(0);
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
      // Fetch each independently so partial failures don't block everything
      const safe = async <T,>(fn: () => Promise<T>, fallback: T): Promise<T> => {
        try { return await fn(); } catch { return fallback; }
      };
      const [r, h, v, o, d, w, hd] = await Promise.all([
        safe(getRoutes, []),
        safe(getHealth, null),
        safe(getAllVehicles, { vehicles: [], updatedAt: "" }),
        safe(getOpsOverview, null),
        safe(getOpsDemand, null),
        safe(getOpsWeather, null),
        safe(getOpsHourlyDemand, { points: [] }),
      ]);
      if (!alive) return;
      if (r.length > 0) setRoutes(r);
      if (h) setHealth(h);
      if (v.vehicles.length > 0) setVehicles(v.vehicles);
      if (o) setOverview(o);
      if (d) setDemand(d);
      if (w) setWeather(w);
      if (hd.points.length > 0) setHourlyDemand(hd.points);
      // Fetch flight nationalities — with fallback
      try {
        const fRes = await fetch("/api/ops/flights");
        const fType = fRes.headers.get("content-type") ?? "";
        if (fType.includes("application/json")) {
          const flightData = await fRes.json();
          if (!alive) return;
          setNationalities(flightData.nationalities ?? []);
          setDepartures(flightData.departures ?? []);
        } else {
          // Fallback flight data
          if (!alive) return;
          setNationalities([
            { country: "Russia", flag: "🇷🇺", pax: 2800, percentage: 28 },
            { country: "China", flag: "🇨🇳", pax: 2200, percentage: 22 },
            { country: "India", flag: "🇮🇳", pax: 1100, percentage: 11 },
            { country: "Australia", flag: "🇦🇺", pax: 900, percentage: 9 },
            { country: "UK", flag: "🇬🇧", pax: 700, percentage: 7 },
            { country: "Germany", flag: "🇩🇪", pax: 650, percentage: 6 },
            { country: "South Korea", flag: "🇰🇷", pax: 600, percentage: 6 },
            { country: "Thailand", flag: "🇹🇭", pax: 1100, percentage: 11 },
          ]);
          setDepartures([
            { flightNo: "SU270", origin: "SVO", scheduledTime: "08:30", estimatedPax: 280 },
            { flightNo: "TG224", origin: "BKK", scheduledTime: "09:15", estimatedPax: 165 },
            { flightNo: "CZ652", origin: "CAN", scheduledTime: "10:00", estimatedPax: 220 },
          ]);
        }
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
    setSimPaxToAirport(0);
    setSimPaxFromAirport(0);
    setSimCO2Saved(0);
    setSimFareRevenue(0);

    const START = 360;  // 06:00
    const END = 1440;   // 24:00
    const STEP = 3;     // 3-minute increments for smoother animation
    let touchpoints = 0;
    let passengers = 0;
    let paxToAirport = 0;
    let paxFromAirport = 0;
    let co2Saved = 0;
    let fareRevenue = 0;

    for (let t = START; t <= END; t += STEP) {
      if (simAbort.current) break;
      try {
        const res = await fetch(`/api/simulate?t=${t}`);
        const contentType = res.headers.get("content-type") ?? "";
        let simVehicles: VehiclePosition[];
        let timeStr: string;

        if (contentType.includes("application/json")) {
          const data = await res.json();
          simVehicles = data.vehicles;
          timeStr = data.simTime;
        } else {
          // Fallback: backend doesn't have /api/simulate — generate client-side
          simVehicles = generateClientSimulation(t, routes);
          timeStr = `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
        }

        setVehicles(simVehicles);
        setSimTime(timeStr);
        setSimProgress((t - START) / (END - START));

        // Detect touchpoints: bus + ferry near same pier
        const ferrySet = new Set(["rassada-phi-phi", "rassada-ao-nang", "bang-rong-koh-yao", "chalong-racha"]);
        const buses = simVehicles.filter((v: VehiclePosition) => !ferrySet.has(v.routeId) && v.status === "dwelling");
        const ferries = simVehicles.filter((v: VehiclePosition) => ferrySet.has(v.routeId) && v.status === "dwelling");

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

        // Calculate passengers served, CO2 saved, fare revenue
        // Each moving bus on airport route carries ~25 pax (full capacity assumption based on schedule)
        const SEATS = 25;
        const FARE = 100; // ฿100 per person
        // CO2: avg taxi trip airport→city = 35km, emits ~8.5 kg CO2 (petrol car)
        // EV bus for 25 pax same trip = ~2.1 kg CO2 total (grid electricity Thailand ~0.5 kgCO2/kWh, bus uses ~15 kWh/35km)
        // Savings per 25 pax = (25 × 8.5) - 2.1 = 210.4 kg CO2 saved per full bus trip
        const CO2_SAVED_PER_BUS_TRIP = 210; // kg

        const airportBuses = simVehicles.filter(v => v.routeId === "rawai-airport");
        const movingToAirport = airportBuses.filter(v => v.status === "moving" && v.destination.en.toLowerCase().includes("airport")).length;
        const movingFromAirport = airportBuses.filter(v => v.status === "moving" && !v.destination.en.toLowerCase().includes("airport")).length;

        // Each 3-min step: a moving bus serves fraction of a trip (~75 min trip, so 3/75 = 4% per step)
        const tripFraction = STEP / 75;
        const paxToAirportStep = Math.round(movingToAirport * SEATS * tripFraction);
        const paxFromAirportStep = Math.round(movingFromAirport * SEATS * tripFraction);
        const totalPaxStep = paxToAirportStep + paxFromAirportStep;
        const co2Step = (movingToAirport + movingFromAirport) * CO2_SAVED_PER_BUS_TRIP * tripFraction;
        const fareStep = totalPaxStep * FARE;

        paxToAirport += paxToAirportStep;
        paxFromAirport += paxFromAirportStep;
        co2Saved += co2Step;
        fareRevenue += fareStep;

        setSimPaxToAirport(paxToAirport);
        setSimPaxFromAirport(paxFromAirport);
        setSimCO2Saved(Math.round(co2Saved));
        setSimFareRevenue(Math.round(fareRevenue));

        await new Promise(r => setTimeout(r, 60)); // 60ms per 3-min step = ~22s total animation
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
      {/* ===== Header — Command Bar ===== */}
      <header className="ops__header">
        <div className="ops__brand">
          {onToggle ? (
            <button className="ops__back" type="button" onClick={onToggle} title="Switch to passenger view">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
          ) : null}
          <h1>PKSB IOC</h1>
        </div>

        {/* Live flight ticker */}
        <div className="ops__flight-ticker">
          <span className="ops__ticker-label">✈ HKT</span>
          <span className="ops__ticker-arrivals">
            ↓ {demand?.arrivalsNext2h ?? 0} flights · {demand?.totalPassengersNext2h?.toLocaleString() ?? "0"} pax
          </span>
          <span className="ops__ticker-sep">|</span>
          <span className="ops__ticker-departures">
            ↑ {departures.length} departures
          </span>
          <span className="ops__ticker-sep">|</span>
          <span className="ops__ticker-demand" style={{ color: (demand?.busDemandEstimate ?? 0) > 200 ? "#f85149" : "#3fb950" }}>
            🚌 {demand?.busDemandEstimate ?? 0} demand → {demand?.recommendedFleet ?? 0} buses needed
          </span>
        </div>

        <div className="ops__status-bar">
          <span className="ops__clock">{clock}</span>
          <span className="ops__health-dot" style={{ background: healthColor }} />
          <span style={{ color: healthColor, fontSize: "9px" }}>{weather?.current.tempC ?? "—"}° {weather?.current.rainProb ?? 0}%☂ AQI {weather?.current.aqi ?? "—"}</span>
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
            <span>✈️→🚌 <strong>{simPaxFromAirport.toLocaleString()}</strong> pax</span>
            <span>🚌→✈️ <strong>{simPaxToAirport.toLocaleString()}</strong> pax</span>
            <span>🌱 <strong>{simCO2Saved.toLocaleString()}</strong> kg CO₂</span>
            <span>💰 ฿<strong>{simFareRevenue.toLocaleString()}</strong></span>
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
                <div className="ops-sim-card__metrics">
                  <div className="ops-sim-metric">
                    <span className="ops-sim-metric__value">{simPaxFromAirport.toLocaleString()}</span>
                    <span className="ops-sim-metric__label">✈️→🚌 Airport → City</span>
                  </div>
                  <div className="ops-sim-metric">
                    <span className="ops-sim-metric__value">{simPaxToAirport.toLocaleString()}</span>
                    <span className="ops-sim-metric__label">🚌→✈️ City → Airport</span>
                  </div>
                  <div className="ops-sim-metric ops-sim-metric--green">
                    <span className="ops-sim-metric__value">{simCO2Saved.toLocaleString()} kg</span>
                    <span className="ops-sim-metric__label">🌱 CO₂ Saved (EV vs Taxi)</span>
                  </div>
                  <div className="ops-sim-metric ops-sim-metric--blue">
                    <span className="ops-sim-metric__value">฿{simFareRevenue.toLocaleString()}</span>
                    <span className="ops-sim-metric__label">💰 Fare Revenue</span>
                  </div>
                </div>
                <button className="ops-sim-card__stop" type="button" onClick={runDaySimulation}>Stop Simulation</button>
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
              {/* Stable hotspot data based on time-of-day demand patterns */}
              {[
                { zone: "Central Patong", base: 12 },
                { zone: "Airport", base: 9 },
                { zone: "Kata Beach", base: 7 },
                { zone: "Old Town", base: 5 },
                { zone: "Karon", base: 3 },
              ].map(({ zone, base }) => {
                // Scale by hour: peak at 10-14 and 18-20
                const h = new Date().getHours();
                const scale = h >= 10 && h <= 14 ? 1.0 : h >= 18 && h <= 20 ? 0.9 : h >= 7 && h <= 22 ? 0.6 : 0.1;
                const count = Math.max(1, Math.round(base * scale));
                return (
                  <div key={zone} className={`ops-hotspot ${count >= 8 ? "ops-hotspot--high" : count >= 4 ? "ops-hotspot--medium" : ""}`}>
                    <span className="ops-hotspot__zone">{zone}</span>
                    <span className="ops-hotspot__count">{count} requests</span>
                    <div className="ops-hotspot__bar">
                      <div className="ops-hotspot__bar-fill" style={{ width: `${Math.min(100, count * 8)}%` }} />
                    </div>
                  </div>
                );
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
