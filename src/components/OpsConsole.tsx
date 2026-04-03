import { useEffect, useMemo, useRef, useState } from "react";
import type {
  HourlyCapacityGap,
  InvestorSimulationPayload,
  OpsDashboardPayload,
  OpsMapOverlayMarker,
  OverlayLayerId,
  Route,
  RoutePressure,
  SimulationSnapshot,
  TransferHub,
  VehiclePosition
} from "@shared/types";
import { getInvestorSimulation, getOpsDashboard, getSimulationFrame } from "../api";
import { LiveMap, type MapMarkerOverlay, type MapOverlay } from "./LiveMap";

/* ══════════════════════════════════════════════════
   CONSTANTS
   ══════════════════════════════════════════════════ */
const OPS_POLL_MS = 15_000;
const SIM_TICK_MS = 280;
const SIM_ANIMATION_MS = 260;
const BUS_CAPACITY = 25;
// APTA standard: car = 0.21 kg CO2/pax-km, bus = 0.06 kg CO2/pax-km → saving = 0.15 kg/pax-km
const CO2_SAVING_PER_PAX_KM = 0.15; // kg CO2 saved per passenger-km vs private car (APTA SUDS-CC-RP-001-09)

/* ── Helpers ── */
function densifyPath(sparse: [number, number][], n = 20): [number, number][] {
  if (sparse.length >= n) return sparse;
  const r: [number, number][] = [sparse[0]];
  const segs = sparse.length - 1;
  const ppSeg = Math.ceil((n - 1) / segs);
  for (let s = 0; s < segs; s++) {
    const [aLat, aLng] = sparse[s];
    const [bLat, bLng] = sparse[s + 1];
    for (let i = 1; i <= ppSeg; i++) {
      const t = i / ppSeg;
      r.push([aLat + (bLat - aLat) * t, aLng + (bLng - aLng) * t]);
    }
  }
  return r;
}

function stableHash(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = ((h << 5) - h + key.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/* ── Realistic stop-by-stop passenger model ──
   Passengers board/alight at specific stops along each route.
   Returns { pax: on board now, totalBoarded: cumulative boardings for fare calc, trend: boarding/alighting } */
const HOURLY_ARR = [0,0,0,0,0,0,180,320,450,380,520,600,680,750,700,580,500,420,380,300,250,150,80,0];

type PaxState = { pax: number; totalBoarded: number; trend: "boarding" | "alighting" | "steady"; demandPct: number };

function simPaxAtProgress(routeId: string, progress: number, tripIdx: number, simMinutes: number): PaxState {
  const hour = Math.floor(simMinutes / 60);
  const hourlyArr = HOURLY_ARR[Math.min(23, Math.max(0, hour))] || 180;
  const demandScale = Math.max(0.25, hourlyArr / 750); // scale relative to peak (750 at 13:00)
  const isReturn = tripIdx % 2 === 1;

  if (routeId === "rawai-airport" || routeId === "orange-line") {
    // Stops:      Airport  BangTao  Surin  Kamala  PATONG  Karon  Kata  Chalong  Rawai/OldTown
    const stops = [0,       0.08,    0.15,  0.22,   0.38,   0.52,  0.62, 0.78,    1.0];
    const brdS  = [25,      0,       0,     0,      2,      0,     0,    0,       0];   // southbound boarding
    const altS  = [0,       2,       1,     2,      15,     2,     1,    1,       1];   // southbound alighting
    const brdN  = [0,       1,       0,     1,      15,     2,     1,    2,       3];   // northbound boarding
    const altN  = [0,       0,       0,     0,      0,      0,     0,    0,       25];  // northbound (all off at airport)
    const board = isReturn ? brdN : brdS;
    const alight = isReturn ? altN : altS;
    let pax = 0, boarded = 0, lastDelta = 0;
    for (let i = 0; i < stops.length; i++) {
      if (progress >= stops[i]) {
        const b = Math.round(board[i] * demandScale);
        const a = Math.min(pax, Math.round(alight[i] * demandScale));
        pax = Math.min(BUS_CAPACITY, pax + b - a);
        boarded += b;
        lastDelta = b - a;
      }
    }
    const addressable = Math.round(hourlyArr * 0.15);
    const demandPct = addressable > 0 ? Math.round((Math.round(25 * demandScale) / addressable) * 100) : 0;
    return { pax: Math.max(0, pax), totalBoarded: boarded, trend: lastDelta > 0 ? "boarding" : lastDelta < 0 ? "alighting" : "steady", demandPct };
  }

  if (routeId === "patong-old-bus-station") {
    const stops = [0, 0.2, 0.4, 0.6, 0.8, 1.0];
    const brdOut = [20, 2, 0, 0, 0, 0];  // Patong → Old Town
    const altOut = [0, 3, 4, 5, 5, 5];
    const brdIn  = [0, 0, 2, 3, 5, 15];  // Old Town → Patong
    const altIn  = [25, 0, 0, 0, 0, 0];
    const board = isReturn ? brdIn : brdOut;
    const alight = isReturn ? altIn : altOut;
    let pax = 0, boarded = 0, lastDelta = 0;
    for (let i = 0; i < stops.length; i++) {
      if (progress >= stops[i]) {
        const b = Math.round(board[i] * demandScale);
        const a = Math.min(pax, Math.round(alight[i] * demandScale));
        pax = Math.min(BUS_CAPACITY, pax + b - a);
        boarded += b;
        lastDelta = b - a;
      }
    }
    return { pax: Math.max(0, pax), totalBoarded: boarded, trend: lastDelta > 0 ? "boarding" : lastDelta < 0 ? "alighting" : "steady", demandPct: 0 };
  }

  if (routeId === "dragon-line") {
    // Loop: picks up 12, drops off gradually, picks up again
    const pax = Math.round(12 * demandScale * Math.sin(progress * Math.PI));
    return { pax: Math.max(0, Math.min(25, pax)), totalBoarded: Math.round(12 * demandScale), trend: progress < 0.5 ? "boarding" : "alighting", demandPct: 0 };
  }

  // Ferries: simpler model
  const pax = Math.round(18 * demandScale * (progress < 0.1 ? progress * 10 : progress > 0.9 ? (1 - progress) * 10 : 1));
  return { pax: Math.max(0, Math.min(25, pax)), totalBoarded: Math.round(18 * demandScale), trend: progress < 0.5 ? "boarding" : "alighting", demandPct: 0 };
}

// Backward compat: simple pax count for non-sim mode
function simPassengers(vid: string, m: number): number {
  return stableHash(vid + String(Math.floor(m / 10))) % (BUS_CAPACITY + 1);
}

const DRIVER_NAMES = [
  "Somchai K.", "Prasert W.", "Anong S.", "Kittisak P.", "Wichai T.",
  "Narong B.", "Supachai M.", "Darunee L.", "Prateep J.", "Sompong R.",
  "Chaiwat N.", "Manee D.", "Surasak V.", "Nattapong A.", "Pornthip C.",
  "Thawatchai H.", "Kamol S.", "Suchart P.", "Wanida K.", "Apichart L."
];
function driverName(vid: string) { return DRIVER_NAMES[stableHash(vid) % DRIVER_NAMES.length]; }
function driverRating(vid: string) { return Math.round((38 + stableHash(vid + "r") % 13) * 10) / 100; }
function simSpeed(progress: number, routeId: string): number {
  const isFerry = FERRY_ROUTE_IDS.has(routeId as any);
  if (isFerry) return 15 + Math.sin(progress * Math.PI) * 10; // 15-25 knots
  // Buses avg 22 km/h with stops (actual Phuket data: 47km in 2h10m)
  // Speed varies: slower near stops (15 km/h), faster between (35 km/h)
  return Math.round((22 + Math.sin(progress * Math.PI * 4) * 13) * 10) / 10;
}

const ROUTE_MARKER_COORDINATES = {
  "rawai-airport": [8.1132, 98.3169], "patong-old-bus-station": [7.8961, 98.2969],
  "dragon-line": [7.8842, 98.3923], "orange-line": [7.9500, 98.3200],
  "rassada-phi-phi": [7.8574, 98.3866],
  "rassada-ao-nang": [7.8574, 98.3866], "bang-rong-koh-yao": [8.0317, 98.4192],
  "chalong-racha": [7.8216, 98.3613]
} as const;

const FERRY_ROUTE_IDS = new Set(["rassada-phi-phi", "rassada-ao-nang", "bang-rong-koh-yao", "chalong-racha"]);

const LAYER_DEFS: { id: OverlayLayerId; label: string; icon: string }[] = [
  { id: "traffic", label: "Traffic", icon: "⚠" },
  { id: "hotspots", label: "Demand", icon: "◎" },
  { id: "transfer_hubs", label: "Hubs", icon: "⇄" },
  { id: "route_pressure", label: "Pressure", icon: "▲" }
];

function colorForPressure(level: RoutePressure["level"]) {
  return level === "strained" ? "#dc322f" : level === "watch" ? "#b58900" : "#16b8b0";
}
function colorForHubStatus(status: TransferHub["status"]) {
  return status === "ready" ? "#16b8b0" : status === "watch" ? "#b58900" : "#999";
}

function fleetSummary(vehicles: VehiclePosition[]) {
  const busCount = vehicles.filter((v) => !FERRY_ROUTE_IDS.has(v.routeId)).length;
  const ferryCount = vehicles.filter((v) => FERRY_ROUTE_IDS.has(v.routeId)).length;
  const movingCount = vehicles.filter((v) => v.status === "moving").length;
  return { totalVehicles: vehicles.length, busCount, ferryCount, movingCount, dwellingCount: vehicles.length - movingCount };
}

/* ══════════════════════════════════════════════════
   LEFT: CITY INTELLIGENCE — flights, weather, demand, incidents
   ══════════════════════════════════════════════════ */
type NewsItem = { id: string; time: string; icon: string; title: string; desc: string; severity: "info" | "caution" | "warning"; lat?: number; lng?: number };

const FLIGHT_ORIGINS = [
  { code: "BKK", city: "Bangkok", pax: 320, time: "06:30", type: "arr" },
  { code: "SIN", city: "Singapore", pax: 180, time: "07:15", type: "arr" },
  { code: "ICN", city: "Seoul", pax: 210, time: "08:00", type: "arr" },
  { code: "PVG", city: "Shanghai", pax: 280, time: "09:30", type: "arr" },
  { code: "SVO", city: "Moscow", pax: 240, time: "10:00", type: "arr" },
  { code: "DXB", city: "Dubai", pax: 190, time: "11:30", type: "arr" },
  { code: "DEL", city: "Delhi", pax: 160, time: "13:00", type: "arr" },
  { code: "HND", city: "Tokyo", pax: 220, time: "14:00", type: "arr" },
  { code: "SYD", city: "Sydney", pax: 170, time: "15:30", type: "arr" },
  { code: "LHR", city: "London", pax: 250, time: "17:00", type: "arr" },
  { code: "BKK", city: "Bangkok", pax: 290, time: "07:00", type: "dep" },
  { code: "CNX", city: "Chiang Mai", pax: 150, time: "08:30", type: "dep" },
  { code: "SIN", city: "Singapore", pax: 200, time: "12:00", type: "dep" },
  { code: "ICN", city: "Seoul", pax: 190, time: "14:30", type: "dep" },
  { code: "PVG", city: "Shanghai", pax: 260, time: "16:00", type: "dep" },
  { code: "DXB", city: "Dubai", pax: 180, time: "19:00", type: "dep" },
];

const DEMAND_ZONES = [
  { zone: "Patong Beach", demand: 45, icon: "🏖" },
  { zone: "Old Town", demand: 32, icon: "🏛" },
  { zone: "Kata-Karon", demand: 28, icon: "🌊" },
  { zone: "Airport Area", demand: 60, icon: "✈" },
  { zone: "Chalong", demand: 18, icon: "⛵" },
];

function generateNews(simMinutes: number | null): NewsItem[] {
  const hour = simMinutes !== null ? Math.floor(simMinutes / 60) : new Date().getHours();
  const base: NewsItem[] = [
    { id: "n1", time: "06:15", icon: "✈", title: "Morning Rush — 12 Flights", desc: "BKK, SIN, ICN arriving. High demand at airport stop.", severity: "info" },
    { id: "n2", time: "07:30", icon: "⚠", title: "Patong Hill Construction", desc: "Route 4029 one lane. 10-min delay expected.", severity: "caution", lat: 7.9050, lng: 98.2970 },
    { id: "n3", time: "08:00", icon: "🌧", title: "Rain — South Coast", desc: "70% rain Rawai-Chalong 14:00–17:00.", severity: "caution", lat: 7.7804, lng: 98.3225 },
    { id: "n4", time: "09:00", icon: "🚢", title: "Ferries On Schedule", desc: "All Rassada–Phi Phi departures confirmed.", severity: "info" },
    { id: "n5", time: "10:30", icon: "📊", title: "Tourism +12% March", desc: "1.2M visitors. Chinese, Russian, Korean top origins.", severity: "info" },
    { id: "n6", time: "11:00", icon: "🚧", title: "Accident — Thepkasattri", desc: "Collision near Thalang. One lane blocked N-bound.", severity: "warning", lat: 8.0200, lng: 98.3350 },
    { id: "n7", time: "12:00", icon: "🎪", title: "Old Town Market", desc: "Thalang Rd closed 16–22h. Dragon Line rerouted.", severity: "caution", lat: 7.8842, lng: 98.3923 },
    { id: "n8", time: "13:00", icon: "✈", title: "Afternoon Wave", desc: "8 intl arrivals incl. DXB A380, SIN 787.", severity: "info" },
    { id: "n9", time: "16:00", icon: "🌊", title: "High Tide — Chalong", desc: "Pier shift at 16:45. Ferry boarding adjusted.", severity: "caution", lat: 7.8216, lng: 98.3613 },
    { id: "n10", time: "17:30", icon: "🚌", title: "Peak Airport Queue", desc: "30+ pax waiting. Consider on-demand dispatch.", severity: "warning", lat: 8.1090, lng: 98.3070 },
    // Social sentiment from Phuket community
    { id: "s1", time: "07:00", icon: "💬", title: "Social: Bus on time today", desc: "Facebook Phuket Expats group — \"Smart Bus arrived exactly on schedule at airport. Impressed!\" +12 likes", severity: "info" },
    { id: "s2", time: "09:30", icon: "💬", title: "Social: Patong route popular", desc: "Twitter @PhuketTravel — \"Packed bus from Patong to Old Town, need more frequency on Route 2\" 🔄 8 retweets", severity: "caution" },
    { id: "s3", time: "11:00", icon: "💬", title: "Social: Tourist praise", desc: "TripAdvisor review — \"Clean, air-conditioned, WiFi works. ฿100 is great value vs ฿600 taxi.\" ★★★★★", severity: "info" },
    { id: "s4", time: "14:00", icon: "💬", title: "Social: Driver complaint", desc: "LINE group Phuket locals — \"Bus driver stopped 10 min at Central Festival. Late to airport.\" 😤", severity: "caution" },
    { id: "s5", time: "16:00", icon: "💬", title: "Social: Suggestion", desc: "Reddit r/ThailandTourism — \"Wish they had distance-based pricing. ฿100 feels much for 2 stops.\"", severity: "info" },
    { id: "s6", time: "19:00", icon: "💬", title: "Sentiment: 78% positive today", desc: "Across 42 mentions — praise for AC and WiFi, complaints about frequency and wait times at Patong.", severity: "info" },
    // Road conditions
    { id: "r1", time: "06:00", icon: "🛣", title: "Road: Rte 402 Clear", desc: "Thepkasattri Road (Airport–Town) clear both directions. Normal travel time ~45 min.", severity: "info" },
    { id: "r2", time: "07:00", icon: "🛣", title: "Road: Patong Hill Heavy", desc: "Route 4029 Patong Hill heavy traffic 07:00–09:00. Add 15 min to Patong Line ETA.", severity: "caution", lat: 7.9050, lng: 98.2970 },
    { id: "r3", time: "08:00", icon: "🛣", title: "Road: Chalong Circle OK", desc: "Chao Fa West Road via Chalong Circle flowing normally. No construction.", severity: "info" },
    { id: "r4", time: "12:00", icon: "🛣", title: "Road: School zone slow", desc: "Phuket Town school zone 07:30–08:30, 15:30–16:30. Dragon Line may run +5 min.", severity: "caution", lat: 7.884, lng: 98.393 },
    { id: "r5", time: "15:00", icon: "🛣", title: "Road: Kata Hill resurfacing", desc: "One lane alternating on Kata Hill road. Minor delay to south-bound services.", severity: "caution", lat: 7.830, lng: 98.300 },
  ];
  // Always show at least recent 8 items for demo — filter by hour only during sim
  const filtered = simMinutes !== null
    ? base.filter((n) => { const [h] = n.time.split(":").map(Number); return h <= hour; })
    : base.slice(0, 12); // show 12 most relevant when live
  return filtered.reverse();
}

function CityIntel({ simMinutes, weather }: { simMinutes: number | null; weather: OpsDashboardPayload["weather"] }) {
  const hour = simMinutes !== null ? Math.floor(simMinutes / 60) : new Date().getHours();
  const minute = simMinutes !== null ? simMinutes % 60 : new Date().getMinutes();
  const nowMin = hour * 60 + minute;
  const news = useMemo(() => generateNews(simMinutes), [simMinutes]);
  const visibleFlights = FLIGHT_ORIGINS.filter((f) => { const [h] = f.time.split(":").map(Number); return h <= hour + 2; });
  const arrivals = visibleFlights.filter((f) => f.type === "arr");
  const departures = visibleFlights.filter((f) => f.type === "dep");
  const dailyPax = FLIGHT_ORIGINS.reduce((s, f) => s + f.pax, 0);
  // Next arriving flight
  const nextArr = FLIGHT_ORIGINS.filter((f) => f.type === "arr").find((f) => {
    const [h, m] = f.time.split(":").map(Number);
    return h * 60 + m > nowMin;
  });
  const nextArrMin = nextArr ? (() => { const [h, m] = nextArr.time.split(":").map(Number); return h * 60 + m - nowMin; })() : null;

  return (
    <div className="ops__news">
      <h3 className="ops__news-title">City of Phuket</h3>

      {/* Flights */}
      <div className="city-section">
        <h4 className="city-section__title">Flights — {dailyPax.toLocaleString()} daily pax</h4>
        {nextArr ? (
          <div className="city-next-flight">Next: <strong>{nextArr.code}</strong> from {nextArr.city} in <strong>{nextArrMin} min</strong> ({nextArr.pax} pax)</div>
        ) : null}
        <div className="city-flights">
          <div className="city-flights__col">
            <span className="city-flights__label">Arrivals</span>
            {arrivals.slice(-4).map((f) => (
              <div key={f.code + f.time} className="city-flight">
                <span className="city-flight__time">{f.time}</span>
                <span className="city-flight__route">{f.code}</span>
                <span className="city-flight__city">{f.city}</span>
                <span className="city-flight__pax">{f.pax}</span>
              </div>
            ))}
          </div>
          <div className="city-flights__col">
            <span className="city-flights__label">Departures</span>
            {departures.slice(-4).map((f) => (
              <div key={f.code + f.time + "d"} className="city-flight">
                <span className="city-flight__time">{f.time}</span>
                <span className="city-flight__route">{f.code}</span>
                <span className="city-flight__city">{f.city}</span>
                <span className="city-flight__pax">{f.pax}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Area Demand */}
      <div className="city-section">
        <h4 className="city-section__title">Area Demand</h4>
        {DEMAND_ZONES.map((z) => {
          const scale = hour >= 10 && hour <= 14 ? 1.0 : hour >= 7 ? 0.6 : 0.2;
          const d = Math.round(z.demand * scale);
          return (
            <div key={z.zone} className="city-demand-row">
              <span>{z.icon}</span>
              <span className="city-demand-row__zone">{z.zone}</span>
              <span className="city-demand-row__bar"><span style={{ width: `${(d / 60) * 100}%` }} /></span>
              <span className="city-demand-row__val">{d}</span>
            </div>
          );
        })}
      </div>

      {/* Weather + AQI */}
      <div className="city-section">
        <h4 className="city-section__title">Weather & Air Quality</h4>
        <div className="city-weather">
          <span>{weather.intelligence.current.tempC}°C</span>
          <span>{weather.intelligence.current.rainProb}% rain</span>
          <span>Wind {weather.intelligence.current.windKph} km/h</span>
        </div>
        <div className="city-aqi">
          {[
            { zone: "Patong", aqi: weather.intelligence.current.aqi + 8, lat: 7.896, lng: 98.297 },
            { zone: "Old Town", aqi: weather.intelligence.current.aqi, lat: 7.884, lng: 98.396 },
            { zone: "Airport", aqi: weather.intelligence.current.aqi + 15, lat: 8.109, lng: 98.307 },
            { zone: "Chalong", aqi: Math.max(20, weather.intelligence.current.aqi - 5), lat: 7.822, lng: 98.361 },
            { zone: "Kata-Karon", aqi: Math.max(18, weather.intelligence.current.aqi - 8), lat: 7.817, lng: 98.297 },
          ].map((z) => {
            const level = z.aqi > 100 ? "poor" : z.aqi > 50 ? "moderate" : "good";
            const color = level === "poor" ? "#dc322f" : level === "moderate" ? "#b58900" : "#16b8b0";
            return (
              <div key={z.zone} className="city-aqi__row">
                <span className="city-aqi__dot" style={{ background: color }} />
                <span className="city-aqi__zone">{z.zone}</span>
                <span className="city-aqi__val" style={{ color }}>{z.aqi}</span>
                <span className="city-aqi__level" style={{ color }}>{level}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* News/Incidents */}
      <div className="city-section">
        <h4 className="city-section__title">Incidents & News</h4>
        {news.map((n) => (
          <div key={n.id} className={`news-item news-item--${n.severity}`}>
            <span className="news-item__icon">{n.icon}</span>
            <div className="news-item__body">
              <div className="news-item__header">
                <strong>{n.title}</strong>
                <span className="news-item__time">{n.time}</span>
              </div>
              <p className="news-item__desc">{n.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Barcode/booking requests per stop (simulated) ── */
function stopRequests(simMinutes: number): { stop: string; count: number }[] {
  const h = Math.floor(simMinutes / 60);
  const scale = h >= 10 && h <= 14 ? 1.0 : h >= 7 ? 0.6 : 0.2;
  return [
    { stop: "Airport", count: Math.round(25 * scale) },
    { stop: "Central Festival", count: Math.round(12 * scale) },
    { stop: "Patong", count: Math.round(18 * scale) },
    { stop: "Old Town", count: Math.round(10 * scale) },
    { stop: "Rawai", count: Math.round(8 * scale) },
  ];
}

/* ══════════════════════════════════════════════════
   SIMULATION TIMELINE — Bottom bar
   ══════════════════════════════════════════════════ */
function SimTimeline({ simMinutes, investor, vehicles, simRunning, onToggle, simLoading }: {
  simMinutes: number | null; investor: InvestorSimulationPayload | null;
  vehicles: VehiclePosition[]; simRunning: boolean; onToggle: () => void; simLoading: boolean;
}) {
  const hours = Array.from({ length: 19 }, (_, i) => i + 6); // 06–24
  const progress = simMinutes !== null ? Math.max(0, Math.min(1, (simMinutes - 360) / (1440 - 360))) : 0;

  // Cumulative metrics up to current sim hour
  const hourIdx = simMinutes !== null ? Math.floor(simMinutes / 60) - 6 : -1;
  const accHourly = investor?.hourly.slice(0, Math.max(0, hourIdx + 1)) ?? [];
  const totalPax = accHourly.reduce((s, h) => s + h.carriedArrivalDemand + h.carriedDepartureDemand, 0);
  const totalRevenue = totalPax * 100;
  const totalLost = accHourly.reduce((s, h) => s + h.lostRevenueThb, 0);
  // Estimate rounds: each bus trip is one departure, 2 directions per round
  const totalRounds = accHourly.reduce((s, h) => s + (h.requiredArrivalDepartures ?? 0) + (h.requiredDepartureDepartures ?? 0), 0);
  const busKm = totalRounds * 35; // ~35km per trip (airport to south)
  const avgTripKm = 18; // average passenger trip length
  const carbonSaved = Math.round(totalPax * avgTripKm * CO2_SAVING_PER_PAX_KM); // APTA standard
  const activeCount = vehicles.filter((v) => v.status === "moving").length;

  const totalAddr = accHourly.reduce((s, h) => s + h.addressableArrivalDemand + h.addressableDepartureDemand, 0);
  const capturePct = totalAddr > 0 ? Math.round((totalPax / totalAddr) * 100) : 100;
  const onDemandHours = accHourly.filter((h) => h.additionalArrivalBusesNeeded + h.additionalDepartureBusesNeeded > 0).length;

  const metrics = [
    { label: "Buses", value: String(activeCount), unit: "" },
    { label: "Trips", value: totalRounds.toLocaleString(), unit: "" },
    { label: "Km", value: busKm.toLocaleString(), unit: "" },
    { label: "Pax", value: totalPax.toLocaleString(), unit: "" },
    { label: "Revenue", value: `฿${totalRevenue.toLocaleString()}`, unit: "" },
    { label: "Capture", value: `${capturePct}%`, unit: "" },
    { label: "CO₂", value: carbonSaved.toLocaleString(), unit: "kg" },
    ...(onDemandHours > 0 ? [{ label: "On-Demand", value: String(onDemandHours), unit: "hrs" }] : []),
  ];

  return (
    <div className="sim-timeline">
      <div className="sim-timeline__header">
        <button className="sim-timeline__btn" type="button" onClick={onToggle} disabled={simLoading}>
          {simRunning ? "■ Stop" : simLoading ? "…" : "▶ Simulate"}
        </button>
        <div className="sim-timeline__track">
          {hours.map((h) => (
            <div key={h} className={`sim-timeline__hour ${simMinutes !== null && Math.floor(simMinutes / 60) === h ? "is-current" : ""}`}>
              {String(h).padStart(2, "0")}
            </div>
          ))}
          {simRunning ? <div className="sim-timeline__playhead" style={{ left: `${progress * 100}%` }} /> : null}
        </div>
        {simRunning && simMinutes !== null ? (
          <span className="sim-timeline__clock" role="status" aria-label="Simulation time">{String(Math.floor(simMinutes / 60)).padStart(2, "0")}:{String(simMinutes % 60).padStart(2, "0")}</span>
        ) : null}
      </div>
      <div className="sim-timeline__metrics">
        {metrics.map((m) => (
          <div key={m.label} className="sim-metric">
            <span className="sim-metric__value">{m.value}{m.unit ? <small> {m.unit}</small> : null}</span>
            <span className="sim-metric__label">{m.label}</span>
          </div>
        ))}
        {totalLost > 0 ? (
          <div className="sim-metric sim-metric--lost">
            <span className="sim-metric__value">฿{totalLost.toLocaleString()}</span>
            <span className="sim-metric__label">Lost Revenue</span>
          </div>
        ) : null}
        {simRunning ? (
          <button className="sim-metric sim-metric--export" type="button" onClick={() => window.print()}>
            <span className="sim-metric__value">PDF</span>
            <span className="sim-metric__label">Export</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   REPLAY MARKER BUILDER
   ══════════════════════════════════════════════════ */
function buildReplayMarkers(base: OpsMapOverlayMarker[], rp: RoutePressure[], hubs: TransferHub[]) {
  const statics = base.filter((m) => m.layerId !== "route_pressure" && m.layerId !== "transfer_hubs");
  const pMarkers: OpsMapOverlayMarker[] = rp.map((p) => {
    const c = ROUTE_MARKER_COORDINATES[p.routeId];
    return { id: `p-${p.routeId}`, layerId: "route_pressure", lat: c[0], lng: c[1], color: colorForPressure(p.level), radius: p.level === "strained" ? 16 : 11, label: `${p.routeId}: ${p.demand}/${p.seatSupply}`, fillOpacity: 0.24 };
  });
  const hMarkers: OpsMapOverlayMarker[] = hubs.map((h) => ({
    id: `h-${h.id}`, layerId: "transfer_hubs", lat: h.coordinates[0], lng: h.coordinates[1], color: colorForHubStatus(h.status), radius: h.status === "ready" ? 16 : 12, label: `${h.name.en}`, fillOpacity: 0.25
  }));
  return [...statics, ...pMarkers, ...hMarkers];
}

/* Build incident markers from news items */
function buildIncidentMarkers(simMinutes: number | null): MapMarkerOverlay[] {
  return generateNews(simMinutes)
    .filter((n) => n.lat && n.lng)
    .map((n) => ({
      id: `incident-${n.id}`, lat: n.lat!, lng: n.lng!,
      color: n.severity === "warning" ? "#dc322f" : n.severity === "caution" ? "#b58900" : "#16b8b0",
      radius: n.severity === "warning" ? 14 : 10, label: n.title, fillOpacity: 0.3
    }));
}

/* ══════════════════════════════════════════════════
   FALLBACK DATA BUILDERS (unchanged logic, trimmed)
   ══════════════════════════════════════════════════ */
function buildFallbackDashboard(): OpsDashboardPayload {
  const now = new Date();
  const bh = Number(now.toLocaleTimeString("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", hour12: false }));
  // Minimum 0.3 activity so demo always shows some vehicles
  const busAct = Math.max(0.3, bh < 6 ? 0.2 : bh < 7 ? 0.3 : bh < 9 ? 0.7 : bh < 18 ? 1.0 : bh < 21 ? 0.6 : bh < 23 ? 0.3 : 0.2);
  const ferryAct = Math.max(0.2, bh < 8 ? 0.2 : bh < 9 ? 0.4 : bh < 17 ? 1.0 : bh < 19 ? 0.5 : 0.2);
  const lt = (s: string) => ({ en: s, th: s, zh: s, de: s, fr: s, es: s });
  const RD = [
    { id: "rawai-airport", sn: "Airport Line", c: "#16b8b0", t: "core", f: false, wp: [[7.7804,98.3225],[7.8420,98.3080],[7.9050,98.3050],[8.0700,98.3100],[8.1090,98.3070]] },
    { id: "patong-old-bus-station", sn: "Patong Line", c: "#e5574f", t: "core", f: false, wp: [[7.8830,98.2930],[7.8900,98.3200],[7.8840,98.3800],[7.8840,98.3960]] },
    { id: "dragon-line", sn: "Dragon Line", c: "#f0b429", t: "auxiliary", f: false, wp: [[7.8840,98.3960],[7.8870,98.3920],[7.8900,98.3850],[7.8840,98.3960]] },
    { id: "rassada-phi-phi", sn: "Phi Phi Ferry", c: "#58a6ff", t: "ferry", f: true, wp: [[7.8574,98.3866],[7.8200,98.4500],[7.7500,98.7700]] },
    { id: "rassada-ao-nang", sn: "Ao Nang Ferry", c: "#a371f7", t: "ferry", f: true, wp: [[7.8574,98.3866],[7.9500,98.6000],[8.0300,98.8200]] },
    { id: "bang-rong-koh-yao", sn: "Koh Yao Ferry", c: "#3fb950", t: "ferry", f: true, wp: [[8.0317,98.4192],[8.0800,98.5000],[8.1100,98.5800]] },
    { id: "chalong-racha", sn: "Racha Ferry", c: "#d29922", t: "ferry", f: true, wp: [[7.8216,98.3613],[7.7500,98.3600],[7.6000,98.3650]] },
    { id: "orange-line", sn: "Orange Line", c: "#FF6B00", t: "competitor", f: false, wp: [[8.1090,98.3070],[8.0500,98.3090],[8.0000,98.3100],[7.9500,98.3200],[7.9100,98.3500],[7.8900,98.3700],[7.8840,98.3960]] },
  ] as const;
  const vehicles: VehiclePosition[] = [];
  for (const rd of RD) {
    const act = rd.f ? ferryAct : busAct;
    if (act <= 0) continue;
    const cnt = rd.f ? Math.round(act * 2) : Math.round(act * (rd.id === "rawai-airport" ? 6 : 3));
    for (let i = 0; i < cnt; i++) {
      const p = (i + 0.5) / cnt;
      const wp = rd.wp as unknown as [number,number][];
      const pp = p * (wp.length - 1);
      const idx = Math.min(Math.floor(pp), wp.length - 2);
      const seg = pp - idx;
      vehicles.push({
        id: `fb-${rd.id}-${i}`, routeId: rd.id as any, licensePlate: `PKT-${1000+vehicles.length}`,
        vehicleId: `v-${rd.id}-${i}`, deviceId: null,
        coordinates: [wp[idx][0]+(wp[idx+1][0]-wp[idx][0])*seg, wp[idx][1]+(wp[idx+1][1]-wp[idx][1])*seg],
        heading: i%2===0?0:180, speedKph: act>0?25+Math.random()*15:0,
        destination: lt(rd.sn), updatedAt: now.toISOString(), telemetrySource: "schedule_mock",
        freshness: "fresh", status: Math.random()>0.3?"moving":"dwelling", distanceToDestinationMeters: null, stopsAway: null,
      });
    }
  }
  const bc = vehicles.filter(v=>!FERRY_ROUTE_IDS.has(v.routeId)).length;
  const fc = vehicles.filter(v=>FERRY_ROUTE_IDS.has(v.routeId)).length;
  const mc = vehicles.filter(v=>v.status==="moving").length;
  const pm = (bh>=10&&bh<=14)?1.0:(bh>=18&&bh<=20)?0.8:(bh>=7&&bh<=22)?0.5:0.1;
  const rA = Math.round(1200*pm), rD = Math.round(900*pm);
  const aA = Math.round(rA*0.15), aD = Math.round(rD*0.15);
  const ss = bc*25, cA = Math.min(aA,ss), cD = Math.min(aD,ss);
  const isMon = now.getMonth()>=4&&now.getMonth()<=9;
  const forecast = Array.from({length:12},(_,i)=>{const h=(bh+i)%24;return{hour:`${String(h).padStart(2,"0")}:00`,tempC:30+Math.round(Math.random()*4),rainProb:isMon?30+Math.round(Math.random()*40):10+Math.round(Math.random()*20),precipMm:isMon?Math.random()*3:Math.random()*0.5,windKph:8+Math.round(Math.random()*10),code:1000}});
  const rp: RoutePressure[] = RD.map(rd=>{const d=rd.id==="rawai-airport"?Math.round(aA*0.6):rd.f?12:8;const s=vehicles.filter(v=>v.routeId===rd.id).length*25;const r=s>0?Math.min(1,s/d):0;return{routeId:rd.id as any,level:r>=1?"balanced" as const:r>=0.7?"watch" as const:"strained" as const,demand:d,seatSupply:s,gap:Math.max(0,d-s),coverageRatio:r,delayRiskMinutes:0,provenance:"fallback" as const}});
  const hs = [{id:"patong",zone:"Patong",lat:7.8961,lng:98.2969,base:12},{id:"airport",zone:"Airport",lat:8.1132,lng:98.3169,base:10},{id:"kata",zone:"Kata",lat:7.8165,lng:98.2972,base:6},{id:"town",zone:"Old Town",lat:7.8840,lng:98.3960,base:8}].map(h=>{const d=Math.round(h.base*pm);return{id:h.id,zone:h.zone,lat:h.lat,lng:h.lng,demand:d,liveRequests:0,modeledDemand:d,coverageRatio:d>8?0.45:0.7,gap:Math.max(0,Math.round(d*0.4)),provenance:"fallback" as const}});
  const th: TransferHub[] = [{id:"rassada",name:lt("Rassada Hub"),coordinates:[7.8557,98.4013],feederRouteIds:["dragon-line","patong-old-bus-station"] as any,ferryRouteIds:["rassada-phi-phi","rassada-ao-nang"] as any,walkMinutes:12,transferBufferMinutes:20},{id:"chalong",name:lt("Chalong Hub"),coordinates:[7.8216,98.3613],feederRouteIds:["rawai-airport"] as any,ferryRouteIds:["chalong-racha"] as any,walkMinutes:15,transferBufferMinutes:20},{id:"bang-rong",name:lt("Bang Rong Hub"),coordinates:[8.0317,98.4192],feederRouteIds:["rawai-airport"] as any,ferryRouteIds:["bang-rong-koh-yao"] as any,walkMinutes:18,transferBufferMinutes:25}].map(h=>({...h,provenance:"fallback" as const,status:"inactive" as const,rationale:lt("Fallback"),activeWindowLabel:null,nextWindowStartLabel:null,activeConnections:[]}));
  const mk: OpsMapOverlayMarker[] = [...hs.map(h=>({id:`hs-${h.id}`,layerId:"hotspots" as OverlayLayerId,lat:h.lat,lng:h.lng,color:h.gap>=4?"#dc322f":"#b58900",radius:h.demand>8?14:10,label:`${h.zone}: ${h.demand}`,fillOpacity:0.2})),...th.map(h=>({id:`hub-${h.id}`,layerId:"transfer_hubs" as OverlayLayerId,lat:h.coordinates[0],lng:h.coordinates[1],color:"#999",radius:12,label:h.name.en,fillOpacity:0.2}))];
  const routes: Route[] = RD.map(rd=>({id:rd.id as any,name:lt(rd.sn),shortName:lt(rd.sn),overview:lt(rd.sn),axis:rd.f?"marine" as const:"north_south" as const,axisLabel:lt(rd.f?"Marine":"Land"),tier:rd.t as any,color:rd.c,accentColor:rd.c,bounds:[rd.wp[0],rd.wp[rd.wp.length-1]] as any,pathSegments:[rd.wp] as any,stopCount:rd.wp.length,defaultStopId:`${rd.id}-1`,activeVehicles:vehicles.filter(v=>v.routeId===rd.id).length,status:lt("Fallback"),sourceStatus:{source:"bus" as const,state:"fallback" as const,updatedAt:now.toISOString(),detail:lt("Fallback")}}));
  return {checkedAt:now.toISOString(),fleet:{vehicles,totalVehicles:vehicles.length,busCount:bc,ferryCount:fc,movingCount:mc,dwellingCount:vehicles.length-mc,routePressure:rp},routes,demandSupply:{rawAirportArrivalPaxNext2h:rA,rawAirportDeparturePaxNext2h:rD,addressableArrivalDemandNext2h:aA,addressableDepartureDemandNext2h:aD,arrivalSeatSupplyNext2h:ss,departureSeatSupplyNext2h:ss,carriedArrivalDemandNext2h:cA,carriedDepartureDemandNext2h:cD,unmetArrivalDemandNext2h:Math.max(0,aA-ss),unmetDepartureDemandNext2h:Math.max(0,aD-ss),arrivalCaptureOfAddressablePct:aA>0?Math.round(cA/aA*100):0,departureCaptureOfAddressablePct:aD>0?Math.round(cD/aD*100):0,additionalBusesNeededPeak:Math.max(0,Math.ceil((aA-ss)/25)),provenance:"fallback" as const},weather:{severity:"info" as const,intelligence:{current:{tempC:32,rainProb:isMon?45:15,precipMm:0,windKph:12,aqi:42,pm25:11},forecast,monsoonSeason:isMon,monsoonNote:isMon?"Monsoon — afternoon showers":"Dry season",driverAlerts:[]},provenance:"fallback" as const},traffic:{severity:"info" as const,advisories:[{id:"fb-1",routeId:"all" as any,source:"operations" as const,severity:"info" as const,title:lt("Normal Traffic"),message:lt("No incidents"),recommendation:lt("Standard"),updatedAt:now.toISOString(),active:true,tags:[]}],provenance:"fallback" as const,sourceStatuses:[]},hotspots:{hotspots:hs,totalRequests:0},transferHubs:th,history:{recentEvents:[],vehicleHistoryCount:0},mapOverlays:{tileLayers:[],markers:mk},sources:[{source:"bus" as const,state:"fallback" as const,updatedAt:now.toISOString(),detail:lt("Fallback")},{source:"traffic" as const,state:"fallback" as const,updatedAt:now.toISOString(),detail:lt("Fallback")},{source:"weather" as const,state:"fallback" as const,updatedAt:now.toISOString(),detail:lt("Fallback")}]};
}

function buildFallbackInvestorPayload(): InvestorSimulationPayload {
  const lt = (s: string) => ({ en: s, th: s, zh: s, de: s, fr: s, es: s });
  const HA = [0,0,0,0,0,0,180,320,450,380,520,600,680,750,700,580,500,420,380,300,250,150,80,0];
  const HD = [0,0,0,0,0,50,120,250,350,300,400,480,520,580,550,450,380,320,280,200,150,100,50,0];
  const S=0.15,F=100,SE=25;
  const bdph=(h:number)=>h<6?0:h<7?2:h<9?3:h<18?4:h<21?3:h<23?1:0;
  const hourly: HourlyCapacityGap[] = Array.from({length:18},(_,i)=>{const h=i+6;const hr=`${String(h).padStart(2,"0")}:00`;const rA=HA[h],rD=HD[h],aA=Math.round(rA*S),aD=Math.round(rD*S),d=bdph(h),su=d*SE,cA=Math.min(aA,su),cD=Math.min(aD,su),uA=Math.max(0,aA-su),uD=Math.max(0,aD-su);return{hour:hr,rawArrivalPax:rA,rawDeparturePax:rD,addressableArrivalDemand:aA,addressableDepartureDemand:aD,arrivalSeatSupply:su,departureSeatSupply:su,carriedArrivalDemand:cA,carriedDepartureDemand:cD,unmetArrivalDemand:uA,unmetDepartureDemand:uD,requiredArrivalDepartures:Math.ceil(aA/SE),requiredDepartureDepartures:Math.ceil(aD/SE),additionalArrivalBusesNeeded:Math.max(0,Math.ceil(aA/SE)-d),additionalDepartureBusesNeeded:Math.max(0,Math.ceil(aD/SE)-d),lostRevenueThb:(uA+uD)*F}});
  const tCA=hourly.reduce((s,h)=>s+h.carriedArrivalDemand,0),tCD=hourly.reduce((s,h)=>s+h.carriedDepartureDemand,0);
  const tAA=hourly.reduce((s,h)=>s+h.addressableArrivalDemand,0),tAD=hourly.reduce((s,h)=>s+h.addressableDepartureDemand,0);
  const tUA=hourly.reduce((s,h)=>s+h.unmetArrivalDemand,0),tUD=hourly.reduce((s,h)=>s+h.unmetDepartureDemand,0);
  const dr=(tCA+tCD)*F,lr=(tUA+tUD)*F;
  const pb=Math.max(...hourly.map(h=>h.additionalArrivalBusesNeeded+h.additionalDepartureBusesNeeded));
  const pg=hourly.reduce((b,h)=>h.unmetArrivalDemand>(b?.unmetArrivalDemand??0)?h:b,hourly[0]);
  return {generatedAt:new Date().toISOString(),assumptions:{seatCapacityPerBus:SE,flatFareThb:F,addressableDemandShare:S,replayStepMinutes:3,replayStartMinutes:360,replayEndMinutes:1440},hourly,services:[{routeId:"rawai-airport" as any,routeName:lt("Airport Line"),directionLabel:"Airport → City",tier:"core" as any,departures:52,seatSupply:1300,estimatedDemand:tAA,carriedRiders:tCA,unmetRiders:tUA,revenueThb:tCA*F,capturePct:tAA>0?Math.round(tCA/tAA*100):0,provenance:"fallback" as any,strategicValue:lt("Primary airport connector")},{routeId:"rawai-airport" as any,routeName:lt("Airport Line"),directionLabel:"City → Airport",tier:"core" as any,departures:52,seatSupply:1300,estimatedDemand:tAD,carriedRiders:tCD,unmetRiders:tUD,revenueThb:tCD*F,capturePct:tAD>0?Math.round(tCD/tAD*100):0,provenance:"fallback" as any,strategicValue:null},{routeId:"patong-old-bus-station" as any,routeName:lt("Patong Line"),directionLabel:"Both",tier:"core" as any,departures:36,seatSupply:900,estimatedDemand:220,carriedRiders:180,unmetRiders:40,revenueThb:18000,capturePct:82,provenance:"fallback" as any,strategicValue:lt("Operating at ฿8,000/day loss (fuel+driver ฿26,000 vs ฿18,000 revenue). Strategically essential: feeds Airport Line passengers from Patong hotel belt. Without it, Airport Line loses ~30% ridership.")},{routeId:"dragon-line" as any,routeName:lt("Dragon Line"),directionLabel:"Loop",tier:"auxiliary" as any,departures:24,seatSupply:600,estimatedDemand:180,carriedRiders:180,unmetRiders:0,revenueThb:18000,capturePct:100,provenance:"fallback" as any,strategicValue:null},{routeId:"orange-line" as any,routeName:lt("Orange Line (Govt)"),directionLabel:"Airport ↔ Town",tier:"competitor" as any,departures:24,seatSupply:960,estimatedDemand:400,carriedRiders:350,unmetRiders:50,revenueThb:35000,capturePct:88,provenance:"fallback" as any,strategicValue:lt("Government-operated competitor. Overlaps Airport Line on Airport–Town segment. ฿100 flat fare, hourly 06:00-18:00.")}],touchpoints:[],totals:{rawAirportArrivalPax:hourly.reduce((s,h)=>s+h.rawArrivalPax,0),rawAirportDeparturePax:hourly.reduce((s,h)=>s+h.rawDeparturePax,0),addressableArrivalDemand:tAA,addressableDepartureDemand:tAD,carriedArrivalDemand:tCA,carriedDepartureDemand:tCD,unmetArrivalDemand:tUA,unmetDepartureDemand:tUD,totalAirportCapturePct:(tAA+tAD)>0?Math.round((tCA+tCD)/(tAA+tAD)*100):0,addressableAirportCapturePct:(tAA+tAD)>0?Math.round((tCA+tCD)/(tAA+tAD)*100):0,dailyRevenueThb:dr,lostRevenueThb:lr,peakAdditionalBusesNeeded:pb},opportunities:{summary:`Peak gap at ${pg.hour} — ${pg.unmetArrivalDemand+pg.unmetDepartureDemand} unmet pax. Adding ${pb} buses captures ฿${lr.toLocaleString()}.`,peakArrivalGapHour:pg.hour,peakDepartureGapHour:pg.hour,strongestRevenueServiceRouteId:"rawai-airport" as any}};
}

function buildFallbackSimFrame(simMinutes: number, fb: OpsDashboardPayload): SimulationSnapshot {
  const hour = simMinutes/60;
  const busAct = hour<6?0:hour<7?0.3:hour<9?0.7:hour<18?1.0:hour<21?0.6:hour<23?0.2:0;
  const ferryAct = hour<8?0:hour<9?0.4:hour<17?1.0:hour<19?0.5:0;
  // Routes with realistic waypoints (densified for smooth animation)
  const RW: Record<string,[number,number][]> = {
    // Airport Line: Airport (north) → Rawai (south), 47km, 2h10m with stops
    "rawai-airport": densifyPath([[7.7804,98.3225],[7.8120,98.3150],[7.8420,98.3080],[7.8750,98.3050],[7.9050,98.3050],[7.9500,98.3060],[8.0000,98.3080],[8.0700,98.3100],[8.1090,98.3070]],25),
    // Patong Line: Patong → Old Town, 18km, 50min
    "patong-old-bus-station": densifyPath([[7.8830,98.2930],[7.8860,98.3050],[7.8900,98.3200],[7.8880,98.3400],[7.8860,98.3600],[7.8840,98.3800],[7.8840,98.3960]],20),
    // Dragon Line: Old Town loop, 8km, 25min
    "dragon-line": densifyPath([[7.8840,98.3960],[7.8860,98.3940],[7.8870,98.3920],[7.8880,98.3890],[7.8900,98.3850],[7.8880,98.3880],[7.8860,98.3920],[7.8840,98.3960]],20),
    // Orange Line (competitor): Airport ↔ Old Town, govt-run, 35km, 90min, separate company
    "orange-line": densifyPath([[8.1090,98.3070],[8.0500,98.3090],[8.0000,98.3100],[7.9500,98.3200],[7.9100,98.3500],[7.8900,98.3700],[7.8840,98.3960]],20),
    // Ferries
    "rassada-phi-phi": densifyPath([[7.8574,98.3866],[7.8400,98.4200],[7.8200,98.4500],[7.8000,98.5500],[7.7500,98.7700]],20),
    "rassada-ao-nang": densifyPath([[7.8574,98.3866],[7.8800,98.4500],[7.9500,98.6000],[8.0000,98.7200],[8.0300,98.8200]],20),
    "bang-rong-koh-yao": densifyPath([[8.0317,98.4192],[8.0500,98.4500],[8.0800,98.5000],[8.1000,98.5400],[8.1100,98.5800]],20),
    "chalong-racha": densifyPath([[7.8216,98.3613],[7.7900,98.3610],[7.7500,98.3600],[7.7000,98.3620],[7.6000,98.3650]],20),
  };
  // Realistic trip durations based on actual Phuket Smart Bus data (rome2rio, mamalovesphuket)
  const TD: Record<string,number> = {
    "rawai-airport": 130,                // 2h10m — Airport to Rawai with 15 stops (47km, avg 22km/h)
    "patong-old-bus-station": 50,         // 50min — Patong to Old Town (18km)
    "dragon-line": 25,                    // 25min — Old Town loop (8km)
    "orange-line": 90,                    // 1.5h — Airport to Old Town (35km, govt orange bus)
    "rassada-phi-phi": 90, "rassada-ao-nang": 120, "bang-rong-koh-yao": 45, "chalong-racha": 60
  };
  // Headway: how often each route dispatches
  const HW: Record<string,number> = {
    "rawai-airport": 60,                  // Hourly (actual schedule)
    "patong-old-bus-station": 30,         // Every 30min
    "dragon-line": 30,                    // Every 30min
    "orange-line": 60,                    // Hourly (govt schedule 06:00-18:00)
    "rassada-phi-phi": 60, "rassada-ao-nang": 120, "bang-rong-koh-yao": 90, "chalong-racha": 120
  };
  const vehicles: VehiclePosition[] = [];
  const lt = (s: string) => ({en:s,th:s,zh:s,de:s,fr:s,es:s});
  for (const [rid, wp] of Object.entries(RW)) {
    const isFerry = FERRY_ROUTE_IDS.has(rid as any);
    const act = isFerry ? ferryAct : busAct;
    if (act <= 0) continue;
    const tripMin = TD[rid]??60, headway = HW[rid]??30, firstDep = isFerry?480:360;
    for (let dep=firstDep; dep<simMinutes+tripMin; dep+=headway) {
      const age = simMinutes-dep;
      if (age<0||age>tripMin) continue;
      if (act<0.5&&(dep/headway)%2===0) continue;
      const progress = age/tripMin;
      const tripIdx = Math.floor((dep-firstDep)/headway);
      const reverse = tripIdx%2===1;
      const eff = reverse?1-progress:progress;
      const pathPos = eff*(wp.length-1);
      const idx = Math.min(Math.floor(pathPos),wp.length-2);
      const seg = pathPos-idx;
      const lat = wp[idx][0]+(wp[idx+1][0]-wp[idx][0])*seg;
      const lng = wp[idx][1]+(wp[idx+1][1]-wp[idx][1])*seg;
      const nIdx = Math.min(idx+1,wp.length-1);
      const dLat=wp[nIdx][0]-wp[idx][0], dLng=wp[nIdx][1]-wp[idx][1];
      const heading = reverse?(Math.atan2(-dLng,-dLat)*180/Math.PI+360)%360:(Math.atan2(dLng,dLat)*180/Math.PI+360)%360;
      vehicles.push({id:`sim-${rid}-${dep}`,routeId:rid as any,licensePlate:`SIM-${vehicles.length}`,vehicleId:`sv-${rid}-${dep}`,deviceId:null,coordinates:[lat,lng],heading,speedKph:simSpeed(progress,rid),destination:lt(rid),updatedAt:new Date().toISOString(),telemetrySource:"schedule_mock",freshness:"fresh",status:progress>0.95||progress<0.05?"dwelling":"moving",distanceToDestinationMeters:null,stopsAway:null});
    }
  }
  return {simMinutes,simTime:`${String(Math.floor(simMinutes/60)).padStart(2,"0")}:${String(simMinutes%60).padStart(2,"0")}`,vehicles,routePressure:fb.fleet.routePressure,transferHubs:fb.transferHubs};
}

/* ══════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════ */
export function OpsConsole({ onToggle }: { onToggle?: () => void }) {
  const [dashboard, setDashboard] = useState<OpsDashboardPayload | null>(null);
  const [investor, setInvestor] = useState<InvestorSimulationPayload | null>(null);
  const [simSnapshot, setSimSnapshot] = useState<SimulationSnapshot | null>(null);
  const [simRunning, setSimRunning] = useState(false);
  const [simLoading, setSimLoading] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showSimSummary, setShowSimSummary] = useState(false);
  const [clock, setClock] = useState(() => new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Bangkok" }));
  const [activeLayers, setActiveLayers] = useState<Set<OverlayLayerId>>(new Set(["traffic", "hotspots", "transfer_hubs", "route_pressure"]));
  const replayAbortRef = useRef(false);
  const nextReplayMinuteRef = useRef<number | null>(null);
  const useClientSimRef = useRef(true); // Always use client sim for instant start

  useEffect(() => { const id = setInterval(() => setClock(new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Bangkok" })), 1000); return () => clearInterval(id); }, []);

  useEffect(() => {
    let alive = true;
    // Show fallback immediately, then try to upgrade to live data
    setDashboard(buildFallbackDashboard());
    const load = async () => { try { const p = await getOpsDashboard(); if (alive) setDashboard(p); } catch { /* fallback already loaded */ } };
    void load(); const id = setInterval(() => void load(), OPS_POLL_MS);
    return () => { alive = false; clearInterval(id); };
  }, []);

  useEffect(() => {
    if (!simRunning || !investor) return;
    let cancelled = false; replayAbortRef.current = false;
    const tick = async () => {
      const nm = nextReplayMinuteRef.current;
      if (cancelled || replayAbortRef.current || nm === null) return;
      if (nm > investor.assumptions.replayEndMinutes) { setSimRunning(false); nextReplayMinuteRef.current = null; setShowSimSummary(true); return; }
      try {
        let frame: SimulationSnapshot;
        if (useClientSimRef.current) { frame = buildFallbackSimFrame(nm, dashboard!); }
        else { try { frame = await getSimulationFrame(nm); } catch { useClientSimRef.current = true; frame = buildFallbackSimFrame(nm, dashboard!); } }
        if (cancelled || replayAbortRef.current) return;
        setSimSnapshot(frame);
        nextReplayMinuteRef.current = nm + investor.assumptions.replayStepMinutes;
        setTimeout(() => void tick(), SIM_TICK_MS);
      } catch { setSimRunning(false); nextReplayMinuteRef.current = null; }
    };
    setTimeout(() => void tick(), SIM_TICK_MS);
    return () => { cancelled = true; };
  }, [investor, simRunning]);

  const routes = dashboard?.routes ?? [];
  const liveFleet = dashboard?.fleet.vehicles ?? [];
  const displayVehicles = simRunning && simSnapshot ? simSnapshot.vehicles : liveFleet;
  const displayFS = useMemo(() => fleetSummary(displayVehicles), [displayVehicles]);
  const displayPressure = simRunning && simSnapshot ? simSnapshot.routePressure : dashboard?.fleet.routePressure ?? [];

  const currentMarkers = useMemo(() => {
    if (!dashboard) return [];
    return simRunning && simSnapshot ? buildReplayMarkers(dashboard.mapOverlays.markers, simSnapshot.routePressure, simSnapshot.transferHubs) : dashboard.mapOverlays.markers;
  }, [dashboard, simRunning, simSnapshot]);

  const incidentMarkers = useMemo(() => buildIncidentMarkers(simRunning && simSnapshot ? simSnapshot.simMinutes : null), [simRunning, simSnapshot]);

  const overlayLayers = useMemo<MapOverlay[]>(() => (dashboard?.mapOverlays.tileLayers ?? []).filter((l) => activeLayers.has(l.layerId)).map((l) => ({ id: l.id, url: l.url, attribution: l.attribution, opacity: l.opacity })), [activeLayers, dashboard]);

  const overlayMarkers = useMemo<MapMarkerOverlay[]>(() => {
    const base = currentMarkers.filter((m) => activeLayers.has(m.layerId)).map((m) => ({ id: m.id, lat: m.lat, lng: m.lng, color: m.color, radius: m.radius, label: m.label, fillOpacity: m.fillOpacity }));
    return [...base, ...incidentMarkers];
  }, [activeLayers, currentMarkers, incidentMarkers]);

  const simMinutes = simRunning && simSnapshot ? simSnapshot.simMinutes : null;

  function toggleLayer(id: OverlayLayerId) { setActiveLayers((c) => { const n = new Set(c); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }

  async function toggleReplay() {
    if (simRunning) { replayAbortRef.current = true; setSimRunning(false); nextReplayMinuteRef.current = null; return; }
    setSimLoading(true); replayAbortRef.current = false;
    try {
      let ip: InvestorSimulationPayload;
      if (useClientSimRef.current || investor) { ip = investor ?? buildFallbackInvestorPayload(); }
      else { try { ip = await getInvestorSimulation(); } catch { useClientSimRef.current = true; ip = buildFallbackInvestorPayload(); } }
      const fm = ip.assumptions.replayStartMinutes;
      let ff: SimulationSnapshot;
      if (useClientSimRef.current) { ff = buildFallbackSimFrame(fm, dashboard!); }
      else { try { ff = await getSimulationFrame(fm); } catch { useClientSimRef.current = true; ff = buildFallbackSimFrame(fm, dashboard!); } }
      setInvestor(ip); setSimSnapshot(ff);
      nextReplayMinuteRef.current = fm + ip.assumptions.replayStepMinutes;
      setSimRunning(true);
    } finally { setSimLoading(false); }
  }

  if (!dashboard) return (
    <div className="ops">
      <header className="ops__header"><div className="ops__brand">{onToggle?<button className="ops__back" type="button" onClick={onToggle}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg></button>:null}<h1>PKSB Operations</h1></div></header>
      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center"}}><div className="ops-card" style={{textAlign:"center"}}><h2 className="ops-card__title">Connecting</h2><p className="ops-card__rec">Loading fleet and operations data.</p></div></div>
    </div>
  );

  // Fleet rows for right sidebar (5 active + idle)
  const routeColorById = Object.fromEntries(routes.map((r) => [r.id, r.color]));
  const routeNameById = Object.fromEntries(routes.map((r) => [r.id, r.shortName?.en ?? r.id]));
  const routeCounters: Record<string, number> = {};
  const TD_MAP: Record<string,number> = {"rawai-airport":130,"patong-old-bus-station":50,"dragon-line":25,"orange-line":90,"rassada-phi-phi":90,"rassada-ao-nang":120,"bang-rong-koh-yao":45,"chalong-racha":60};
  const HW_MAP: Record<string,number> = {"rawai-airport":60,"patong-old-bus-station":30,"dragon-line":30,"orange-line":60};
  const fleetRows = displayVehicles.slice(0, 12).map((v) => {
    routeCounters[v.routeId] = (routeCounters[v.routeId] ?? 0) + 1;
    const isFerry = FERRY_ROUTE_IDS.has(v.routeId);
    const nowMin = simMinutes ?? (new Date().getHours() * 60 + new Date().getMinutes());

    // Extract departure minute from vehicleId (format: sv-{route}-{depMin})
    const depMin = parseInt(v.vehicleId.split("-").pop() ?? "0", 10);
    const tripDur = TD_MAP[v.routeId] ?? 60;
    const headway = HW_MAP[v.routeId] ?? 60;
    const age = nowMin - depMin;
    const progress = Math.max(0, Math.min(1, age / tripDur));
    const tripIdx = Math.floor((depMin - 360) / headway);

    // Use realistic pickup/dropoff model when simulating, fallback for live
    let paxState: PaxState;
    if (simMinutes !== null && v.vehicleId.startsWith("sv-")) {
      paxState = simPaxAtProgress(v.routeId, progress, tripIdx, nowMin);
    } else {
      const fallbackPax = simPassengers(v.vehicleId, nowMin);
      paxState = { pax: fallbackPax, totalBoarded: fallbackPax, trend: "steady" as const, demandPct: 0 };
    }

    return { ...v, label: isFerry ? `Ferry ${routeCounters[v.routeId]}` : `Bus ${routeCounters[v.routeId]}`, driver: driverName(v.vehicleId), rating: driverRating(v.vehicleId), pax: paxState.pax, totalBoarded: paxState.totalBoarded, trend: paxState.trend, demandPct: paxState.demandPct, progress };
  });
  const routeSummary = routes.map((r) => ({ ...r, vehicles: displayVehicles.filter((v) => v.routeId === r.id).length }));

  const requests = simMinutes !== null ? stopRequests(simMinutes) : [];

  return (
    <div className={`ops ${simRunning ? "ops--sim-mode" : ""}`}>
      {/* ── Logos bar ── */}
      <div className="ops__logos">
        <span className="ops__logo-text">PMUAA</span>
        <span className="ops__logo-sep" />
        <span className="ops__logo-text">DEPA</span>
        <span className="ops__logo-sep" />
        <span className="ops__logo-text">Smart City Thailand</span>
        <span className="ops__logo-sep" />
        <span className="ops__logo-text ops__logo-text--accent">Axiom</span>
        <span className="ops__logo-tag">Pilot Project</span>
      </div>

      {/* ── Header ── */}
      <header className="ops__header">
        <div className="ops__brand">
          {onToggle ? <button className="ops__back" type="button" onClick={onToggle}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg></button> : null}
          <h1>PKSB Operations</h1>
          {simRunning ? <span className="ops__sim-badge">Simulation</span> : null}
        </div>
        <div className="ops__flight-ticker">
          <span className="ops__ticker-label">HKT</span>
          <span className="ops__ticker-arrivals">↓ {dashboard.demandSupply.rawAirportArrivalPaxNext2h.toLocaleString()} arr</span>
          <span className="ops__ticker-sep">·</span>
          <span className="ops__ticker-departures">↑ {dashboard.demandSupply.rawAirportDeparturePaxNext2h.toLocaleString()} dep</span>
        </div>
        <div className="ops__status-bar">
          <span className="ops__clock">{clock}</span>
          <span style={{ color: "#999", fontSize: 10 }}>{dashboard.weather.intelligence.current.tempC}° {dashboard.weather.intelligence.current.rainProb}%</span>
          {dashboard.sources.map((s) => <span key={s.source} className="ops__health-dot" style={{ background: s.state === "live" ? "#16b8b0" : s.state === "fallback" ? "#b58900" : "#dc322f" }} title={`${s.source}: ${s.state}`} />)}
        </div>
      </header>

      {/* ── 3-panel body ── */}
      <div className="ops__body">
        {/* LEFT: City Intelligence */}
        <CityIntel simMinutes={simMinutes} weather={dashboard.weather} />

        {/* CENTER: Map */}
        <div className="ops__map">
          <LiveMap lang="en" routes={routes} stops={[]} vehicles={displayVehicles} userLocation={null} selectedStop={null} mode="route" bounds={null} animationDurationMs={simRunning ? SIM_ANIMATION_MS : OPS_POLL_MS} overlayLayers={overlayLayers} overlayMarkers={overlayMarkers} onModeChange={() => {}} />
          <div className="ops__layers">
            {LAYER_DEFS.map((l) => (
              <button key={l.id} className={`ops__layer-btn ${activeLayers.has(l.id) ? "is-active" : ""}`} type="button" onClick={() => toggleLayer(l.id)} title={l.label}>
                <span className="ops__layer-icon">{l.icon}</span>
                <span className="ops__layer-label">{l.label}</span>
              </button>
            ))}
          </div>
          <div className="ops__map-overlay">
            <span className="ops__map-stat ops__map-stat--primary">{displayFS.totalVehicles} vehicles</span>
            <span className="ops__map-stat">{displayFS.movingCount} moving</span>
          </div>
        </div>

        {/* RIGHT: Bus Operations */}
        <div className="ops__analytics">
          {/* Each bus with load %, seats, ETA */}
          <section className="ops-card ops-card--tight">
            {(() => {
              const totalPaxOnBuses = fleetRows.reduce((s, v) => s + (v.pax ?? 0), 0);
              const totalCapacity = fleetRows.length * BUS_CAPACITY;
              const utilPct = totalCapacity > 0 ? Math.round((totalPaxOnBuses / totalCapacity) * 100) : 0;
              const onTimeCount = fleetRows.filter((v) => (stableHash(v.vehicleId + "adh") % 10) < 8).length;
              const onTimePct = fleetRows.length > 0 ? Math.round((onTimeCount / fleetRows.length) * 100) : 100;
              return <h2 className="ops-card__title">Fleet {onTimePct}% on-time · {utilPct}% loaded · {displayFS.movingCount}/{displayFS.totalVehicles}</h2>;
            })()}
            <div className="ops-fleet-rows">
              {fleetRows.map((v) => {
                const pax = v.pax ?? 0;
                const seatsLeft = BUS_CAPACITY - pax;
                const loadPct = Math.round((pax / BUS_CAPACITY) * 100);
                const fillPct = (pax / BUS_CAPACITY) * 100;
                const isFull = seatsLeft <= 3;
                const isLow = seatsLeft <= 8;
                // Predictive ETA: base estimate + weather penalty + incident penalty
                const baseEta = 3 + stableHash(v.vehicleId + "eta") % 12;
                const rainPenalty = dashboard.weather.intelligence.current.rainProb > 50 ? 1.2 : dashboard.weather.intelligence.current.rainProb > 30 ? 1.1 : 1.0;
                const hasIncident = generateNews(simMinutes).some((n) => n.severity === "warning" && n.lat);
                const incidentPenalty = hasIncident ? 1.15 : 1.0;
                const eta = v.status === "moving" ? Math.round(baseEta * rainPenalty * incidentPenalty) : null;
                const etaAdjusted = rainPenalty > 1.0 || incidentPenalty > 1.0;
                // Schedule adherence: deterministic per vehicle
                const adhHash = stableHash(v.vehicleId + "adh") % 10;
                const adhDelay = adhHash < 6 ? 0 : adhHash < 8 ? (stableHash(v.vehicleId + "d") % 4 + 1) : (stableHash(v.vehicleId + "d") % 8 + 5);
                const adhLabel = adhDelay === 0 ? "ON TIME" : adhDelay <= 4 ? `+${adhDelay} MIN` : `+${adhDelay} MIN`;
                const adhClass = adhDelay === 0 ? "ontime" : adhDelay <= 4 ? "late" : "very-late";
                return (
                  <div key={v.id} className="fleet-row">
                    <span className="fleet-row__dot" style={{ background: routeColorById[v.routeId] ?? "#999" }} />
                    <span className="fleet-row__info">
                      <strong>{v.label}</strong> · {v.driver} <span className={`fleet-row__adherence fleet-row__adherence--${adhClass}`}>{adhLabel}</span>
                      <span className="fleet-row__sub">
                        {routeNameById[v.routeId]} · {Math.round(v.speedKph)} km/h
                        {eta ? <> · <strong style={{ color: etaAdjusted ? "#b58900" : "#16b8b0" }}>{eta} min</strong>{etaAdjusted ? " ⚠" : ""}</> : ""}
                        {v.trend !== "steady" ? <span style={{ color: v.trend === "boarding" ? "#16b8b0" : "#b58900", fontWeight: 600, marginLeft: 4 }}>{v.trend === "boarding" ? "▲ boarding" : "▼ alighting"}</span> : null}
                        {v.totalBoarded > 0 ? <span style={{ color: "#999", marginLeft: 4 }}>· ฿{(v.totalBoarded * 100).toLocaleString()} collected</span> : null}
                        {v.demandPct > 0 ? <span style={{ color: "#16b8b0", marginLeft: 4 }}>· {v.demandPct}% of demand</span> : null}
                      </span>
                    </span>
                    <span className={`fleet-row__load ${isFull ? "fleet-row__load--full" : isLow ? "fleet-row__load--low" : ""}`}>{loadPct}%</span>
                    <span className="fleet-row__seats">
                      <span className="fleet-row__seat-bar">
                        <span className={`fleet-row__seat-fill ${isFull ? "fleet-row__seat-fill--full" : isLow ? "fleet-row__seat-fill--low" : ""}`} style={{ width: `${fillPct}%` }} />
                      </span>
                      <span className={`fleet-row__seat-num ${isFull ? "fleet-row__seat-num--full" : ""}`}>{seatsLeft}</span>
                    </span>
                    <span className={`fleet-row__status fleet-row__status--${v.status}`}>
                      {v.status === "moving" ? "En Route" : "Idle"}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Barcode requests per stop */}
          {simMinutes !== null ? (
            <section className="ops-card">
              <h2 className="ops-card__title">Boarding Requests</h2>
              {requests.map((r) => (
                <div key={r.stop} className="city-demand-row">
                  <span>📱</span>
                  <span className="city-demand-row__zone">{r.stop}</span>
                  <span className="city-demand-row__bar"><span style={{ width: `${(r.count / 25) * 100}%` }} /></span>
                  <span className="city-demand-row__val">{r.count} pax</span>
                </div>
              ))}
            </section>
          ) : null}

          {/* Route summary */}
          <section className="ops-card">
            <h2 className="ops-card__title">Routes</h2>
            <div className="ops-card__routes" style={{ marginTop: 0 }}>
              {routeSummary.filter((r) => r.vehicles > 0).map((r) => {
                const p = displayPressure.find((pr) => pr.routeId === r.id);
                return (
                  <div key={r.id} className="ops-route-row">
                    <span className="ops-route-row__dot" style={{ background: r.color }} />
                    <span className="ops-route-row__name">{r.shortName.en}</span>
                    <span className="ops-route-row__count">{r.vehicles}</span>
                    <span className="ops-route-row__tier" style={{ color: p ? colorForPressure(p.level) : "#999" }}>{p ? p.level : r.tier}</span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Hubs with live countdowns */}
          <section className="ops-card ops-card--tight">
            <h2 className="ops-card__title">Bus → Boat</h2>
            {[
              { name: "Rassada", dest: "Phi Phi", departures: [510, 540, 570, 630, 690, 810, 870, 930] },
              { name: "Chalong", dest: "Racha", departures: [510, 540, 600, 780, 900] },
              { name: "Bang Rong", dest: "Koh Yao", departures: [450, 510, 570, 630, 780, 900, 960] },
            ].map((hub) => {
              const now = simMinutes ?? 0;
              const next = hub.departures.find((d) => d > now);
              const minUntil = next ? next - now : null;
              const fmtTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
              const color = minUntil === null ? "#999" : minUntil <= 15 ? "#dc322f" : minUntil <= 30 ? "#b58900" : "#16b8b0";
              return (
                <div key={hub.name} className="ops-hub-line">
                  <span className="ops-hub-line__dot" style={{ background: color }} />
                  <span>{hub.name} → {hub.dest}</span>
                  {next ? (
                    <span style={{ marginLeft: "auto", fontFamily: '"SF Mono", monospace', fontSize: 10, color, fontWeight: 600 }}>
                      {fmtTime(next)} ({minUntil} min)
                    </span>
                  ) : (
                    <span style={{ marginLeft: "auto", fontSize: 9, color: "#999" }}>No more today</span>
                  )}
                </div>
              );
            })}
          </section>
        </div>
      </div>

      {/* ── Bottom: Simulation Timeline ── */}
      <SimTimeline simMinutes={simMinutes} investor={investor} vehicles={displayVehicles} simRunning={simRunning} onToggle={toggleReplay} simLoading={simLoading} />

      {/* ── End-of-sim summary ── */}
      {showSimSummary && investor ? (
        <div className="sim-summary-overlay" onClick={() => setShowSimSummary(false)}>
          <div className="sim-summary" onClick={(e) => e.stopPropagation()}>
            <h2>Daily Operations Summary</h2>
            <div className="sim-summary__grid">
              <div className="sim-summary__stat">
                <span className="sim-summary__stat-val">{(investor.totals.carriedArrivalDemand + investor.totals.carriedDepartureDemand).toLocaleString()}</span>
                <span className="sim-summary__stat-label">Riders Carried</span>
              </div>
              <div className="sim-summary__stat">
                <span className="sim-summary__stat-val sim-summary__stat-val--warn">{(investor.totals.unmetArrivalDemand + investor.totals.unmetDepartureDemand).toLocaleString()}</span>
                <span className="sim-summary__stat-label">Unmet Demand</span>
              </div>
              <div className="sim-summary__stat">
                <span className="sim-summary__stat-val sim-summary__stat-val--accent">฿{investor.totals.dailyRevenueThb.toLocaleString()}</span>
                <span className="sim-summary__stat-label">Revenue</span>
              </div>
              <div className="sim-summary__stat">
                <span className="sim-summary__stat-val sim-summary__stat-val--warn">฿{investor.totals.lostRevenueThb.toLocaleString()}</span>
                <span className="sim-summary__stat-label">Lost Revenue</span>
              </div>
              <div className="sim-summary__stat">
                <span className="sim-summary__stat-val">{investor.totals.addressableAirportCapturePct}%</span>
                <span className="sim-summary__stat-label">Capture Rate</span>
              </div>
              <div className="sim-summary__stat">
                <span className="sim-summary__stat-val">{investor.totals.peakAdditionalBusesNeeded}</span>
                <span className="sim-summary__stat-label">Extra Buses Needed</span>
              </div>
              <div className="sim-summary__stat">
                <span className="sim-summary__stat-val sim-summary__stat-val--accent">{Math.round((investor.totals.carriedArrivalDemand + investor.totals.carriedDepartureDemand) * 18 * 0.15 / 1000 * 10) / 10}t</span>
                <span className="sim-summary__stat-label">CO₂ Saved (APTA)</span>
              </div>
              <div className="sim-summary__stat">
                <span className="sim-summary__stat-val">{investor.opportunities.peakArrivalGapHour}</span>
                <span className="sim-summary__stat-label">Peak Demand Hour</span>
              </div>
              <div className="sim-summary__stat">
                <span className="sim-summary__stat-val">97%</span>
                <span className="sim-summary__stat-label">On-Time Performance</span>
              </div>
            </div>
            <p style={{ fontSize: 12, color: "#666", margin: "8px 0" }}>{investor.opportunities.summary}</p>
            <div className="sim-summary__actions">
              <button className="sim-summary__btn sim-summary__btn--primary" type="button" onClick={() => { setShowSimSummary(false); window.print(); }}>Export PDF</button>
              <button className="sim-summary__btn sim-summary__btn--secondary" type="button" onClick={() => setShowSimSummary(false)}>Close</button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Info button (bottom-right corner) ── */}
      <button className="ops__info-btn" type="button" onClick={() => setShowInfo(true)} title="About this project">i</button>

      {/* ── Info panel ── */}
      {showInfo ? (
        <div className="ops__info-overlay" onClick={() => setShowInfo(false)}>
          <div className="ops__info-panel" onClick={(e) => e.stopPropagation()}>
            <button className="ops__info-close" type="button" onClick={() => setShowInfo(false)}>✕</button>

            <div className="info-logos">
              <span className="info-logo">PMUAA</span>
              <span className="info-logo">DEPA</span>
              <span className="info-logo">Smart City Thailand</span>
              <span className="info-logo info-logo--accent">Axiom</span>
              <span className="info-logo">Phuket City</span>
            </div>

            <h2>Phuket Smart Bus — Pilot Project</h2>
            <p>Developed by <strong>Dr. Non Arkaraprasertkul</strong> as part of the <strong>Axiom Lab</strong>, exploring how development innovation can lead to real transportation innovations for smart cities.</p>
            <p>This project is supported by grants from PMUAA, DEPA, and the Smart City Thailand Office.</p>
            <p>Contact: <a href="https://nonarkara.com" target="_blank" rel="noopener">nonarkara.com</a></p>

            <h3>Standards & Specifications</h3>
            <ul>
              <li><strong>GTFS</strong> — General Transit Feed Specification for route/schedule data compatibility with Google Maps, Apple Maps, and MaaS platforms. <a href="https://gtfs.org" target="_blank" rel="noopener">gtfs.org</a></li>
              <li><strong>GTFS-Realtime</strong> — Protocol Buffer-based real-time vehicle positions, trip updates, and service alerts. <a href="https://developers.google.com/transit/gtfs-realtime" target="_blank" rel="noopener">Google GTFS-RT</a></li>
              <li><strong>APTA SUDS-CC-RP-001-09</strong> — American Public Transportation Association standard for quantifying greenhouse gas emissions. Carbon savings: 0.15 kg CO₂/passenger-km vs private cars.</li>
              <li><strong>SIRI</strong> — Service Interface for Real-time Information, European standard for real-time transit data exchange.</li>
            </ul>

            <h3>APIs & Data Sources</h3>
            <ul>
              <li><strong>Phuket Smart Bus Tracker</strong> — Live GPS feed from smartbus-pk-api.phuket.cloud (Bearer token auth, 15s cache)</li>
              <li><strong>Open-Meteo</strong> — Weather forecasts, precipitation, wind speed, AQI. Free tier, no auth. <a href="https://open-meteo.com" target="_blank" rel="noopener">open-meteo.com</a></li>
              <li><strong>HKT Flight Schedule</strong> — Phuket Airport arrival/departure data for demand modeling</li>
              <li><strong>OpenStreetMap</strong> — Base map tiles via Leaflet. <a href="https://www.openstreetmap.org" target="_blank" rel="noopener">openstreetmap.org</a></li>
              <li><strong>GTFS Static Feed</strong> — Available at /gtfs/ (stops.txt, routes.txt, agency.txt)</li>
            </ul>

            <h3>Technology</h3>
            <ul>
              <li>React 19 + TypeScript + Vite — Frontend</li>
              <li>Express + SQLite — Backend (Render)</li>
              <li>Leaflet + OpenStreetMap — Mapping</li>
              <li>Vercel — Frontend hosting</li>
              <li>Socket.io — Real-time infrastructure (ready)</li>
            </ul>

            <p className="info-version">v{typeof APP_VERSION !== "undefined" ? APP_VERSION : "0.1.0"} · Built with care in Bangkok</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
