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

const OPS_POLL_MS = 15_000;
const SIM_TICK_MS = 400; // slow enough for visible interpolation on map
const SIM_ANIMATION_MS = 380; // just under tick so interpolation completes before next frame

const ROUTE_MARKER_COORDINATES = {
  "rawai-airport": [8.1132, 98.3169],
  "patong-old-bus-station": [7.8961, 98.2969],
  "dragon-line": [7.8842, 98.3923],
  "rassada-phi-phi": [7.8574, 98.3866],
  "rassada-ao-nang": [7.8574, 98.3866],
  "bang-rong-koh-yao": [8.0317, 98.4192],
  "chalong-racha": [7.8216, 98.3613]
} as const;
const FERRY_ROUTE_IDS = new Set([
  "rassada-phi-phi",
  "rassada-ao-nang",
  "bang-rong-koh-yao",
  "chalong-racha"
]);
const LAYER_DEFS: { id: OverlayLayerId; label: string; icon: string; description: string }[] = [
  { id: "traffic", label: "Traffic", icon: "⚠", description: "Road incidents and delays" },
  { id: "weather", label: "Rain", icon: "☔", description: "Wet-road and rain risk" },
  { id: "hotspots", label: "Demand", icon: "◎", description: "Passenger pressure by zone" },
  { id: "transfer_hubs", label: "Hubs", icon: "⇄", description: "Bus-to-boat touchpoints" },
  { id: "route_pressure", label: "Pressure", icon: "▲", description: "Supply vs demand by route" }
];

/* ── Color helpers (Dieter Rams palette: muted, purposeful) ── */
function colorForPressure(level: RoutePressure["level"]) {
  return level === "strained" ? "#dc322f" : level === "watch" ? "#b58900" : "#16b8b0";
}

function colorForHubStatus(status: TransferHub["status"]) {
  return status === "ready" ? "#16b8b0" : status === "watch" ? "#b58900" : "#999";
}

/* ── Fleet summary ── */
function fleetSummary(vehicles: VehiclePosition[]) {
  const busCount = vehicles.filter((v) => !FERRY_ROUTE_IDS.has(v.routeId)).length;
  const ferryCount = vehicles.filter((v) => FERRY_ROUTE_IDS.has(v.routeId)).length;
  const movingCount = vehicles.filter((v) => v.status === "moving").length;
  const dwellingCount = vehicles.filter((v) => v.status === "dwelling").length;
  return { totalVehicles: vehicles.length, busCount, ferryCount, movingCount, dwellingCount };
}

/* ── Capacity gap chart (minimal SVG bars) ── */
function CapacityGapChart({ hourly, currentHour }: { hourly: HourlyCapacityGap[]; currentHour: string | null }) {
  if (hourly.length === 0) return null;

  const points = hourly.map((p) => ({
    hour: p.hour,
    demand: p.addressableArrivalDemand + p.addressableDepartureDemand,
    supply: p.arrivalSeatSupply + p.departureSeatSupply
  }));
  const maxVal = Math.max(...points.map((p) => Math.max(p.demand, p.supply)), 1);

  return (
    <div className="ops-chart">
      <div className="ops-chart__legend">
        <span className="ops-chart__legend-item">
          <span className="ops-chart__dot" style={{ background: "#16b8b0" }} /> Demand
        </span>
        <span className="ops-chart__legend-item">
          <span className="ops-chart__dot" style={{ background: "#ddd" }} /> Supply
        </span>
      </div>
      <svg viewBox={`0 0 ${points.length * 44} 120`} className="ops-chart__svg">
        {points.map((p, i) => {
          const x = i * 44;
          const dH = (p.demand / maxVal) * 90;
          const sH = (p.supply / maxVal) * 90;
          const isCurrent = p.hour === currentHour;
          return (
            <g key={p.hour}>
              <rect x={x + 4} y={100 - sH} width={15} height={sH} rx={2} fill="#e8e8e8" />
              <rect
                x={x + 23} y={100 - dH} width={15} height={dH} rx={2}
                fill={p.demand > p.supply ? "#dc322f" : "#16b8b0"}
                opacity={isCurrent ? 1 : 0.5}
              />
              <text x={x + 22} y={115} textAnchor="middle" fontSize="8"
                fill={isCurrent ? "#1a1a1a" : "#999"} fontWeight={isCurrent ? "600" : "400"}>
                {p.hour.slice(0, 2)}
              </text>
              {isCurrent ? (
                <line x1={x} y1={0} x2={x} y2={100} stroke="#16b8b0" strokeWidth="0.5" strokeDasharray="2 2" />
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ── Weather bar ── */
function WeatherBar({ forecast }: { forecast: OpsDashboardPayload["weather"]["intelligence"]["forecast"] }) {
  if (forecast.length === 0) return null;
  return (
    <div className="ops-weather-bar">
      {forecast.slice(0, 8).map((h) => (
        <div key={h.hour} className="ops-weather-bar__hour">
          <span className="ops-weather-bar__time">{h.hour.slice(0, 2)}</span>
          <div className="ops-weather-bar__rain" style={{
            height: `${Math.max(4, h.rainProb * 0.4)}px`,
            background: h.rainProb > 60 ? "#16b8b0" : h.rainProb > 30 ? "rgba(22,184,176,0.4)" : "rgba(22,184,176,0.15)"
          }} />
          <span className="ops-weather-bar__temp">{h.tempC}°</span>
          <span className="ops-weather-bar__prob">{h.rainProb}%</span>
        </div>
      ))}
    </div>
  );
}

/* ── Demand overflow indicator ── */
function DemandOverflow({ hourly, currentHour }: { hourly: HourlyCapacityGap[]; currentHour: string | null }) {
  // Find on-demand windows: consecutive hours where demand > supply
  const windows: { start: string; end: string; extraBuses: number; overflowPct: number }[] = [];
  let windowStart: string | null = null;
  let maxBuses = 0;
  let maxPct = 0;

  for (const h of hourly) {
    const totalDemand = h.addressableArrivalDemand + h.addressableDepartureDemand;
    const totalSupply = h.arrivalSeatSupply + h.departureSeatSupply;
    const extra = h.additionalArrivalBusesNeeded + h.additionalDepartureBusesNeeded;
    const pct = totalSupply > 0 ? Math.round(((totalDemand - totalSupply) / totalSupply) * 100) : totalDemand > 0 ? 100 : 0;

    if (extra > 0) {
      if (!windowStart) windowStart = h.hour;
      maxBuses = Math.max(maxBuses, extra);
      maxPct = Math.max(maxPct, pct);
    } else if (windowStart) {
      windows.push({ start: windowStart, end: h.hour, extraBuses: maxBuses, overflowPct: maxPct });
      windowStart = null;
      maxBuses = 0;
      maxPct = 0;
    }
  }
  if (windowStart) {
    windows.push({ start: windowStart, end: "24:00", extraBuses: maxBuses, overflowPct: maxPct });
  }

  // Current hour overflow
  const current = currentHour ? hourly.find((h) => h.hour === currentHour) : hourly[0];
  const curDemand = current ? current.addressableArrivalDemand + current.addressableDepartureDemand : 0;
  const curSupply = current ? current.arrivalSeatSupply + current.departureSeatSupply : 0;
  const curOverflow = curSupply > 0 ? Math.round(((curDemand - curSupply) / curSupply) * 100) : 0;
  const barSupplyPct = curDemand > 0 ? Math.min(100, Math.round((curSupply / curDemand) * 100)) : 100;

  return (
    <div className="ops-overflow">
      <div className="ops-overflow__label">
        <span>Supply covers {barSupplyPct}% of demand</span>
        <span className={`ops-overflow__pct ${curOverflow <= 0 ? "ops-overflow__pct--ok" : ""}`}>
          {curOverflow > 0 ? `+${curOverflow}% overflow` : "Balanced"}
        </span>
      </div>
      <div className="ops-overflow__bar">
        <div className="ops-overflow__bar-demand" style={{ width: "100%" }} />
        <div className="ops-overflow__bar-supply" style={{ width: `${barSupplyPct}%` }} />
      </div>
      {windows.length > 0 ? (
        <div className="ops-ondemand">
          <h3 className="ops-ondemand__title">On-Demand Windows</h3>
          {windows.map((w) => (
            <div key={w.start} className="ops-ondemand__row">
              <span className="ops-ondemand__time">{w.start.slice(0, 5)} – {w.end.slice(0, 5)}</span>
              <span className={`ops-ondemand__buses ${w.extraBuses === 0 ? "ops-ondemand__buses--ok" : ""}`}>
                +{w.extraBuses} buses needed ({w.overflowPct > 0 ? `${w.overflowPct}%` : "0%"} over)
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="ops-ondemand">
          <p style={{ fontSize: 12, color: "#999", margin: 0 }}>No on-demand windows — supply meets demand.</p>
        </div>
      )}
    </div>
  );
}

/* ── Replay marker builder ── */
function buildReplayMarkers(
  baseMarkers: OpsMapOverlayMarker[],
  routePressure: RoutePressure[],
  transferHubs: TransferHub[]
) {
  const staticMarkers = baseMarkers.filter(
    (m) => m.layerId !== "route_pressure" && m.layerId !== "transfer_hubs"
  );
  const pressureMarkers: OpsMapOverlayMarker[] = routePressure.map((p) => {
    const coords = ROUTE_MARKER_COORDINATES[p.routeId];
    return {
      id: `pressure-${p.routeId}`, layerId: "route_pressure",
      lat: coords[0], lng: coords[1],
      color: colorForPressure(p.level),
      radius: p.level === "strained" ? 16 : 11,
      label: `${p.routeId}: ${p.demand} demand / ${p.seatSupply} seats`,
      fillOpacity: 0.24
    };
  });
  const hubMarkers: OpsMapOverlayMarker[] = transferHubs.map((h) => ({
    id: `hub-${h.id}`, layerId: "transfer_hubs",
    lat: h.coordinates[0], lng: h.coordinates[1],
    color: colorForHubStatus(h.status),
    radius: h.status === "ready" ? 16 : 12,
    label: `${h.name.en}: ${h.nextWindowStartLabel ?? "no window"}`,
    fillOpacity: 0.25
  }));
  return [...staticMarkers, ...pressureMarkers, ...hubMarkers];
}

/* ── Client-side fallback when /api/ops/dashboard is unreachable ── */
function buildFallbackDashboard(): OpsDashboardPayload {
  const now = new Date();
  const bangkokHour = Number(now.toLocaleTimeString("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", hour12: false }));

  const busActivity = bangkokHour < 6 ? 0 : bangkokHour < 7 ? 0.3 : bangkokHour < 9 ? 0.7 : bangkokHour < 18 ? 1.0 : bangkokHour < 21 ? 0.6 : bangkokHour < 23 ? 0.2 : 0;
  const ferryActivity = bangkokHour < 8 ? 0 : bangkokHour < 9 ? 0.4 : bangkokHour < 17 ? 1.0 : bangkokHour < 19 ? 0.5 : 0;

  const ROUTE_DEFS: { id: string; shortName: string; color: string; tier: string; isFerry: boolean; waypoints: [number, number][] }[] = [
    { id: "rawai-airport", shortName: "Airport Line", color: "#16b8b0", tier: "core", isFerry: false, waypoints: [[7.7804,98.3225],[7.8420,98.3080],[7.9050,98.3050],[8.0700,98.3100],[8.1090,98.3070]] },
    { id: "patong-old-bus-station", shortName: "Patong Line", color: "#e5574f", tier: "core", isFerry: false, waypoints: [[7.8830,98.2930],[7.8900,98.3200],[7.8840,98.3800],[7.8840,98.3960]] },
    { id: "dragon-line", shortName: "Dragon Line", color: "#f0b429", tier: "auxiliary", isFerry: false, waypoints: [[7.8840,98.3960],[7.8870,98.3920],[7.8900,98.3850],[7.8840,98.3960]] },
    { id: "rassada-phi-phi", shortName: "Phi Phi Ferry", color: "#58a6ff", tier: "ferry", isFerry: true, waypoints: [[7.8574,98.3866],[7.8200,98.4500],[7.7500,98.7700]] },
    { id: "rassada-ao-nang", shortName: "Ao Nang Ferry", color: "#a371f7", tier: "ferry", isFerry: true, waypoints: [[7.8574,98.3866],[7.9500,98.6000],[8.0300,98.8200]] },
    { id: "bang-rong-koh-yao", shortName: "Koh Yao Ferry", color: "#3fb950", tier: "ferry", isFerry: true, waypoints: [[8.0317,98.4192],[8.0800,98.5000],[8.1100,98.5800]] },
    { id: "chalong-racha", shortName: "Racha Ferry", color: "#d29922", tier: "ferry", isFerry: true, waypoints: [[7.8216,98.3613],[7.7500,98.3600],[7.6000,98.3650]] },
  ];

  const vehicles: VehiclePosition[] = [];
  for (const rd of ROUTE_DEFS) {
    const activity = rd.isFerry ? ferryActivity : busActivity;
    if (activity <= 0) continue;
    const count = rd.isFerry ? Math.round(activity * 2) : Math.round(activity * (rd.id === "rawai-airport" ? 6 : 3));
    for (let i = 0; i < count; i++) {
      const progress = (i + 0.5) / count;
      const wp = rd.waypoints;
      const pathPos = progress * (wp.length - 1);
      const idx = Math.min(Math.floor(pathPos), wp.length - 2);
      const seg = pathPos - idx;
      const lat = wp[idx][0] + (wp[idx + 1][0] - wp[idx][0]) * seg;
      const lng = wp[idx][1] + (wp[idx + 1][1] - wp[idx][1]) * seg;
      vehicles.push({
        id: `fb-${rd.id}-${i}`, routeId: rd.id as any,
        licensePlate: `PKT-${String(1000 + vehicles.length)}`, vehicleId: `v-${rd.id}-${i}`, deviceId: null,
        coordinates: [lat, lng], heading: i % 2 === 0 ? 0 : 180, speedKph: activity > 0 ? 25 + Math.random() * 15 : 0,
        destination: { en: rd.shortName, th: rd.shortName, zh: rd.shortName, de: rd.shortName, fr: rd.shortName, es: rd.shortName },
        updatedAt: now.toISOString(), telemetrySource: "schedule_mock", freshness: "fresh",
        status: Math.random() > 0.3 ? "moving" : "dwelling", distanceToDestinationMeters: null, stopsAway: null,
      });
    }
  }

  const busCount = vehicles.filter(v => !FERRY_ROUTE_IDS.has(v.routeId)).length;
  const ferryCount = vehicles.filter(v => FERRY_ROUTE_IDS.has(v.routeId)).length;
  const movingCount = vehicles.filter(v => v.status === "moving").length;
  const peakMultiplier = (bangkokHour >= 10 && bangkokHour <= 14) ? 1.0 : (bangkokHour >= 18 && bangkokHour <= 20) ? 0.8 : (bangkokHour >= 7 && bangkokHour <= 22) ? 0.5 : 0.1;
  const rawArrivals = Math.round(1200 * peakMultiplier);
  const rawDepartures = Math.round(900 * peakMultiplier);
  const addressableArr = Math.round(rawArrivals * 0.15);
  const addressableDep = Math.round(rawDepartures * 0.15);
  const seatSupply = busCount * 25;
  const carriedArr = Math.min(addressableArr, seatSupply);
  const carriedDep = Math.min(addressableDep, seatSupply);

  const lt = (s: string) => ({ en: s, th: s, zh: s, de: s, fr: s, es: s });

  const routes: Route[] = ROUTE_DEFS.map(rd => ({
    id: rd.id as any, name: lt(rd.shortName), shortName: lt(rd.shortName), overview: lt(`${rd.shortName} route`),
    axis: rd.isFerry ? "marine" as const : "north_south" as const, axisLabel: lt(rd.isFerry ? "Marine" : "Land"),
    tier: rd.tier as any, color: rd.color, accentColor: rd.color,
    bounds: [rd.waypoints[0], rd.waypoints[rd.waypoints.length - 1]] as any,
    pathSegments: [rd.waypoints] as any, stopCount: rd.waypoints.length, defaultStopId: `${rd.id}-stop-1`,
    activeVehicles: vehicles.filter(v => v.routeId === rd.id).length, status: lt("Fallback data"),
    sourceStatus: { source: "bus" as const, state: "fallback" as const, updatedAt: now.toISOString(), detail: lt("Client-side fallback") },
  }));

  const routePressure: RoutePressure[] = ROUTE_DEFS.map(rd => {
    const demand = rd.id === "rawai-airport" ? Math.round(addressableArr * 0.6) : rd.isFerry ? 12 : 8;
    const supply = vehicles.filter(v => v.routeId === rd.id).length * 25;
    const ratio = supply > 0 ? Math.min(1, supply / demand) : 0;
    return {
      routeId: rd.id as any,
      level: ratio >= 1 ? "balanced" as const : ratio >= 0.7 ? "watch" as const : "strained" as const,
      demand, seatSupply: supply, gap: Math.max(0, demand - supply), coverageRatio: ratio, delayRiskMinutes: 0, provenance: "fallback" as const,
    };
  });

  const hotspots = [
    { id: "patong", zone: "Central Patong", lat: 7.8961, lng: 98.2969, base: 12 },
    { id: "airport", zone: "HKT Airport", lat: 8.1132, lng: 98.3169, base: 10 },
    { id: "kata", zone: "Kata Beach", lat: 7.8165, lng: 98.2972, base: 6 },
    { id: "town", zone: "Phuket Town", lat: 7.8840, lng: 98.3960, base: 8 },
    { id: "chalong", zone: "Chalong Circle", lat: 7.8216, lng: 98.3613, base: 5 },
  ].map(h => {
    const demand = Math.round(h.base * peakMultiplier);
    return { id: h.id, zone: h.zone, lat: h.lat, lng: h.lng, demand, liveRequests: 0, modeledDemand: demand,
      coverageRatio: demand > 8 ? 0.45 : 0.7, gap: Math.max(0, Math.round(demand * 0.4)), provenance: "fallback" as const };
  });

  const transferHubs: TransferHub[] = [
    { id: "rassada", name: lt("Rassada Feeder Hub"), coordinates: [7.8557, 98.4013], feederRouteIds: ["dragon-line", "patong-old-bus-station"] as any, ferryRouteIds: ["rassada-phi-phi", "rassada-ao-nang"] as any, walkMinutes: 12, transferBufferMinutes: 20 },
    { id: "chalong", name: lt("Chalong Feeder Hub"), coordinates: [7.8216, 98.3613], feederRouteIds: ["rawai-airport"] as any, ferryRouteIds: ["chalong-racha"] as any, walkMinutes: 15, transferBufferMinutes: 20 },
    { id: "bang-rong", name: lt("Bang Rong Feeder Hub"), coordinates: [8.0317, 98.4192], feederRouteIds: ["rawai-airport"] as any, ferryRouteIds: ["bang-rong-koh-yao"] as any, walkMinutes: 18, transferBufferMinutes: 25 },
  ].map(h => ({
    ...h, provenance: "fallback" as const, status: "inactive" as const,
    rationale: lt("Fallback data"), activeWindowLabel: null, nextWindowStartLabel: null, activeConnections: [],
  }));

  const markers: OpsMapOverlayMarker[] = [
    ...hotspots.map(h => ({
      id: `hotspot-${h.id}`, layerId: "hotspots" as OverlayLayerId,
      lat: h.lat, lng: h.lng, color: h.gap >= 4 ? "#dc322f" : "#b58900",
      radius: h.demand > 8 ? 14 : 10, label: `${h.zone}: ${h.demand} demand`, fillOpacity: 0.2,
    })),
    ...transferHubs.map(h => ({
      id: `hub-${h.id}`, layerId: "transfer_hubs" as OverlayLayerId,
      lat: h.coordinates[0], lng: h.coordinates[1], color: "#999",
      radius: 12, label: `${h.name.en}: inactive`, fillOpacity: 0.2,
    })),
    ...routePressure.filter(rp => rp.level !== "balanced").map(rp => {
      const coords = ROUTE_MARKER_COORDINATES[rp.routeId as keyof typeof ROUTE_MARKER_COORDINATES];
      return {
        id: `pressure-${rp.routeId}`, layerId: "route_pressure" as OverlayLayerId,
        lat: coords[0], lng: coords[1], color: colorForPressure(rp.level),
        radius: rp.level === "strained" ? 16 : 11, label: `${rp.routeId}: ${rp.demand}/${rp.seatSupply}`, fillOpacity: 0.2,
      };
    }),
  ];

  const isMonsoon = now.getMonth() >= 4 && now.getMonth() <= 9;
  const forecast = Array.from({ length: 12 }, (_, i) => {
    const h = (bangkokHour + i) % 24;
    return {
      hour: `${String(h).padStart(2, "0")}:00`, tempC: 30 + Math.round(Math.random() * 4),
      rainProb: isMonsoon ? 30 + Math.round(Math.random() * 40) : 10 + Math.round(Math.random() * 20),
      precipMm: isMonsoon ? Math.random() * 3 : Math.random() * 0.5,
      windKph: 8 + Math.round(Math.random() * 10), code: 1000,
    };
  });

  return {
    checkedAt: now.toISOString(),
    fleet: { vehicles, totalVehicles: vehicles.length, busCount, ferryCount, movingCount, dwellingCount: vehicles.length - movingCount, routePressure },
    routes, demandSupply: {
      rawAirportArrivalPaxNext2h: rawArrivals, rawAirportDeparturePaxNext2h: rawDepartures,
      addressableArrivalDemandNext2h: addressableArr, addressableDepartureDemandNext2h: addressableDep,
      arrivalSeatSupplyNext2h: seatSupply, departureSeatSupplyNext2h: seatSupply,
      carriedArrivalDemandNext2h: carriedArr, carriedDepartureDemandNext2h: carriedDep,
      unmetArrivalDemandNext2h: Math.max(0, addressableArr - seatSupply),
      unmetDepartureDemandNext2h: Math.max(0, addressableDep - seatSupply),
      arrivalCaptureOfAddressablePct: addressableArr > 0 ? Math.round((carriedArr / addressableArr) * 100) : 0,
      departureCaptureOfAddressablePct: addressableDep > 0 ? Math.round((carriedDep / addressableDep) * 100) : 0,
      additionalBusesNeededPeak: Math.max(0, Math.ceil((addressableArr - seatSupply) / 25)),
      provenance: "fallback" as const,
    },
    weather: {
      severity: "info" as const,
      intelligence: {
        current: { tempC: 32, rainProb: isMonsoon ? 45 : 15, precipMm: 0, windKph: 12, aqi: 42, pm25: 11 },
        forecast, monsoonSeason: isMonsoon,
        monsoonNote: isMonsoon ? "Monsoon season — expect afternoon showers" : "Dry season — low rain risk",
        driverAlerts: [],
      },
      provenance: "fallback" as const,
    },
    traffic: {
      severity: "info" as const,
      advisories: [
        { id: "fb-1", routeId: "all" as any, source: "operations" as const, severity: "info" as const, title: lt("Normal Traffic"), message: lt("No incidents reported"), recommendation: lt("Standard schedules"), updatedAt: now.toISOString(), active: true, tags: [] },
      ],
      provenance: "fallback" as const, sourceStatuses: [],
    },
    hotspots: { hotspots, totalRequests: 0 }, transferHubs,
    history: { recentEvents: [], vehicleHistoryCount: 0 },
    mapOverlays: { tileLayers: [], markers },
    sources: [
      { source: "bus" as const, state: "fallback" as const, updatedAt: now.toISOString(), detail: lt("Client-side fallback") },
      { source: "traffic" as const, state: "fallback" as const, updatedAt: now.toISOString(), detail: lt("Client-side fallback") },
      { source: "weather" as const, state: "fallback" as const, updatedAt: now.toISOString(), detail: lt("Client-side fallback") },
    ],
  };
}

/* ── Client-side investor simulation fallback ── */
function buildFallbackInvestorPayload(): InvestorSimulationPayload {
  const lt = (s: string) => ({ en: s, th: s, zh: s, de: s, fr: s, es: s });
  const HOURLY_ARRIVALS = [0,0,0,0,0,0,180,320,450,380,520,600,680,750,700,580,500,420,380,300,250,150,80,0];
  const HOURLY_DEPARTURES = [0,0,0,0,0,50,120,250,350,300,400,480,520,580,550,450,380,320,280,200,150,100,50,0];
  const SHARE = 0.15, FARE = 100, SEAT = 25;
  const busDepsPerHour = (h: number) => h < 6 ? 0 : h < 7 ? 2 : h < 9 ? 3 : h < 18 ? 4 : h < 21 ? 3 : h < 23 ? 1 : 0;

  const hourly: HourlyCapacityGap[] = Array.from({ length: 18 }, (_, i) => {
    const h = i + 6;
    const hour = `${String(h).padStart(2, "0")}:00`;
    const rawArr = HOURLY_ARRIVALS[h];
    const rawDep = HOURLY_DEPARTURES[h];
    const addrArr = Math.round(rawArr * SHARE);
    const addrDep = Math.round(rawDep * SHARE);
    const deps = busDepsPerHour(h);
    const supply = deps * SEAT;
    const carriedArr = Math.min(addrArr, supply);
    const carriedDep = Math.min(addrDep, supply);
    const unmetArr = Math.max(0, addrArr - supply);
    const unmetDep = Math.max(0, addrDep - supply);
    return {
      hour, rawArrivalPax: rawArr, rawDeparturePax: rawDep,
      addressableArrivalDemand: addrArr, addressableDepartureDemand: addrDep,
      arrivalSeatSupply: supply, departureSeatSupply: supply,
      carriedArrivalDemand: carriedArr, carriedDepartureDemand: carriedDep,
      unmetArrivalDemand: unmetArr, unmetDepartureDemand: unmetDep,
      requiredArrivalDepartures: Math.ceil(addrArr / SEAT),
      requiredDepartureDepartures: Math.ceil(addrDep / SEAT),
      additionalArrivalBusesNeeded: Math.max(0, Math.ceil(addrArr / SEAT) - deps),
      additionalDepartureBusesNeeded: Math.max(0, Math.ceil(addrDep / SEAT) - deps),
      lostRevenueThb: (unmetArr + unmetDep) * FARE,
    };
  });

  const totalCarriedArr = hourly.reduce((s, h) => s + h.carriedArrivalDemand, 0);
  const totalCarriedDep = hourly.reduce((s, h) => s + h.carriedDepartureDemand, 0);
  const totalAddrArr = hourly.reduce((s, h) => s + h.addressableArrivalDemand, 0);
  const totalAddrDep = hourly.reduce((s, h) => s + h.addressableDepartureDemand, 0);
  const totalUnmetArr = hourly.reduce((s, h) => s + h.unmetArrivalDemand, 0);
  const totalUnmetDep = hourly.reduce((s, h) => s + h.unmetDepartureDemand, 0);
  const dailyRevenue = (totalCarriedArr + totalCarriedDep) * FARE;
  const lostRevenue = (totalUnmetArr + totalUnmetDep) * FARE;
  const peakBuses = Math.max(...hourly.map(h => h.additionalArrivalBusesNeeded + h.additionalDepartureBusesNeeded));
  const peakGapHour = hourly.reduce((best, h) => h.unmetArrivalDemand > (best?.unmetArrivalDemand ?? 0) ? h : best, hourly[0]);

  return {
    generatedAt: new Date().toISOString(),
    assumptions: { seatCapacityPerBus: SEAT, flatFareThb: FARE, addressableDemandShare: SHARE, replayStepMinutes: 3, replayStartMinutes: 360, replayEndMinutes: 1440 },
    hourly,
    services: [
      { routeId: "rawai-airport" as any, routeName: lt("Airport Line"), directionLabel: "Airport → City", tier: "core" as any, departures: 52, seatSupply: 1300, estimatedDemand: totalAddrArr, carriedRiders: totalCarriedArr, unmetRiders: totalUnmetArr, revenueThb: totalCarriedArr * FARE, capturePct: totalAddrArr > 0 ? Math.round(totalCarriedArr / totalAddrArr * 100) : 0, provenance: "fallback" as any, strategicValue: lt("Primary airport connector") },
      { routeId: "rawai-airport" as any, routeName: lt("Airport Line"), directionLabel: "City → Airport", tier: "core" as any, departures: 52, seatSupply: 1300, estimatedDemand: totalAddrDep, carriedRiders: totalCarriedDep, unmetRiders: totalUnmetDep, revenueThb: totalCarriedDep * FARE, capturePct: totalAddrDep > 0 ? Math.round(totalCarriedDep / totalAddrDep * 100) : 0, provenance: "fallback" as any, strategicValue: null },
      { routeId: "patong-old-bus-station" as any, routeName: lt("Patong Line"), directionLabel: "Both", tier: "core" as any, departures: 36, seatSupply: 900, estimatedDemand: 320, carriedRiders: 280, unmetRiders: 40, revenueThb: 28000, capturePct: 88, provenance: "fallback" as any, strategicValue: lt("Highest beach demand") },
      { routeId: "dragon-line" as any, routeName: lt("Dragon Line"), directionLabel: "Loop", tier: "auxiliary" as any, departures: 24, seatSupply: 600, estimatedDemand: 180, carriedRiders: 180, unmetRiders: 0, revenueThb: 18000, capturePct: 100, provenance: "fallback" as any, strategicValue: null },
    ],
    touchpoints: [],
    totals: {
      rawAirportArrivalPax: hourly.reduce((s, h) => s + h.rawArrivalPax, 0),
      rawAirportDeparturePax: hourly.reduce((s, h) => s + h.rawDeparturePax, 0),
      addressableArrivalDemand: totalAddrArr, addressableDepartureDemand: totalAddrDep,
      carriedArrivalDemand: totalCarriedArr, carriedDepartureDemand: totalCarriedDep,
      unmetArrivalDemand: totalUnmetArr, unmetDepartureDemand: totalUnmetDep,
      totalAirportCapturePct: (totalAddrArr + totalAddrDep) > 0 ? Math.round((totalCarriedArr + totalCarriedDep) / (totalAddrArr + totalAddrDep) * 100) : 0,
      addressableAirportCapturePct: (totalAddrArr + totalAddrDep) > 0 ? Math.round((totalCarriedArr + totalCarriedDep) / (totalAddrArr + totalAddrDep) * 100) : 0,
      dailyRevenueThb: dailyRevenue, lostRevenueThb: lostRevenue, peakAdditionalBusesNeeded: peakBuses,
    },
    opportunities: {
      summary: `Peak gap at ${peakGapHour.hour} — ${peakGapHour.unmetArrivalDemand + peakGapHour.unmetDepartureDemand} unmet pax. Adding ${peakBuses} buses could capture ฿${lostRevenue.toLocaleString()} in lost revenue.`,
      peakArrivalGapHour: peakGapHour.hour, peakDepartureGapHour: peakGapHour.hour,
      strongestRevenueServiceRouteId: "rawai-airport" as any,
    },
  };
}

/* ── Client-side sim frame builder ── */
function buildFallbackSimFrame(simMinutes: number, fallbackDashboard: OpsDashboardPayload): SimulationSnapshot {
  const hour = simMinutes / 60;
  const busActivity = hour < 6 ? 0 : hour < 7 ? 0.3 : hour < 9 ? 0.7 : hour < 18 ? 1.0 : hour < 21 ? 0.6 : hour < 23 ? 0.2 : 0;
  const ferryActivity = hour < 8 ? 0 : hour < 9 ? 0.4 : hour < 17 ? 1.0 : hour < 19 ? 0.5 : 0;

  const ROUTE_WP: Record<string, [number,number][]> = {
    "rawai-airport": [[7.7804,98.3225],[7.8420,98.3080],[7.9050,98.3050],[8.0700,98.3100],[8.1090,98.3070]],
    "patong-old-bus-station": [[7.8830,98.2930],[7.8900,98.3200],[7.8840,98.3800],[7.8840,98.3960]],
    "dragon-line": [[7.8840,98.3960],[7.8870,98.3920],[7.8900,98.3850],[7.8840,98.3960]],
    "rassada-phi-phi": [[7.8574,98.3866],[7.8200,98.4500],[7.7500,98.7700]],
    "rassada-ao-nang": [[7.8574,98.3866],[7.9500,98.6000],[8.0300,98.8200]],
    "bang-rong-koh-yao": [[8.0317,98.4192],[8.0800,98.5000],[8.1100,98.5800]],
    "chalong-racha": [[7.8216,98.3613],[7.7500,98.3600],[7.6000,98.3650]],
  };
  const TRIP_DUR: Record<string, number> = { "rawai-airport": 75, "patong-old-bus-station": 40, "dragon-line": 25, "rassada-phi-phi": 90, "rassada-ao-nang": 120, "bang-rong-koh-yao": 45, "chalong-racha": 60 };
  const HEADWAY: Record<string, number> = { "rawai-airport": 15, "patong-old-bus-station": 20, "dragon-line": 30, "rassada-phi-phi": 60, "rassada-ao-nang": 120, "bang-rong-koh-yao": 90, "chalong-racha": 120 };

  const vehicles: VehiclePosition[] = [];
  const lt = (s: string) => ({ en: s, th: s, zh: s, de: s, fr: s, es: s });

  for (const [routeId, wp] of Object.entries(ROUTE_WP)) {
    const isFerry = FERRY_ROUTE_IDS.has(routeId as any);
    const activity = isFerry ? ferryActivity : busActivity;
    if (activity <= 0) continue;
    const tripMin = TRIP_DUR[routeId] ?? 60;
    const headway = HEADWAY[routeId] ?? 30;
    const firstDep = isFerry ? 480 : 360;

    for (let dep = firstDep; dep < simMinutes + tripMin; dep += headway) {
      const age = simMinutes - dep;
      if (age < 0 || age > tripMin) continue;
      if (activity < 0.5 && (dep / headway) % 2 === 0) continue;

      const progress = age / tripMin;
      const tripIdx = Math.floor((dep - firstDep) / headway);
      const reverse = tripIdx % 2 === 1;
      const eff = reverse ? 1 - progress : progress;
      const pathPos = eff * (wp.length - 1);
      const idx = Math.min(Math.floor(pathPos), wp.length - 2);
      const seg = pathPos - idx;
      const lat = wp[idx][0] + (wp[idx + 1][0] - wp[idx][0]) * seg;
      const lng = wp[idx][1] + (wp[idx + 1][1] - wp[idx][1]) * seg;

      // Compute heading from direction of travel
      const nextIdx = Math.min(idx + 1, wp.length - 1);
      const dLat = wp[nextIdx][0] - wp[idx][0];
      const dLng = wp[nextIdx][1] - wp[idx][1];
      const heading = reverse
        ? (Math.atan2(-dLng, -dLat) * 180 / Math.PI + 360) % 360
        : (Math.atan2(dLng, dLat) * 180 / Math.PI + 360) % 360;

      vehicles.push({
        id: `sim-${routeId}-${dep}`, routeId: routeId as any,
        licensePlate: `SIM-${vehicles.length}`, vehicleId: `sv-${routeId}-${dep}`, deviceId: null,
        coordinates: [lat, lng], heading, speedKph: 30,
        destination: lt(routeId), updatedAt: new Date().toISOString(),
        telemetrySource: "schedule_mock", freshness: "fresh",
        status: progress > 0.95 || progress < 0.05 ? "dwelling" : "moving",
        distanceToDestinationMeters: null, stopsAway: null,
      });
    }
  }

  const hh = String(Math.floor(simMinutes / 60)).padStart(2, "0");
  const mm = String(simMinutes % 60).padStart(2, "0");

  return {
    simMinutes, simTime: `${hh}:${mm}`, vehicles,
    routePressure: fallbackDashboard.fleet.routePressure,
    transferHubs: fallbackDashboard.transferHubs,
  };
}

/* ══════════════════════════════════════════════════════════════════
   OpsConsole — Main Component
   ══════════════════════════════════════════════════════════════════ */
export function OpsConsole({ onToggle }: { onToggle?: () => void }) {
  const [dashboard, setDashboard] = useState<OpsDashboardPayload | null>(null);
  const [investor, setInvestor] = useState<InvestorSimulationPayload | null>(null);
  const [simSnapshot, setSimSnapshot] = useState<SimulationSnapshot | null>(null);
  const [simRunning, setSimRunning] = useState(false);
  const [simLoading, setSimLoading] = useState(false);
  const [clock, setClock] = useState(() =>
    new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Bangkok" })
  );
  const [activeLayers, setActiveLayers] = useState<Set<OverlayLayerId>>(
    new Set(["traffic", "weather", "hotspots", "transfer_hubs", "route_pressure"])
  );
  const replayAbortRef = useRef(false);
  const nextReplayMinuteRef = useRef<number | null>(null);
  const useClientSimRef = useRef(false);

  // Clock tick
  useEffect(() => {
    const id = window.setInterval(() => {
      setClock(new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Bangkok" }));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  // Dashboard polling
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const payload = await getOpsDashboard();
        if (alive) setDashboard(payload);
      } catch {
        if (alive) setDashboard((cur) => cur ?? buildFallbackDashboard());
      }
    };
    void load();
    const id = window.setInterval(() => void load(), OPS_POLL_MS);
    return () => { alive = false; window.clearInterval(id); };
  }, []);

  // Simulation replay loop — KEY FIX: tick at SIM_TICK_MS (400ms) for visible movement
  useEffect(() => {
    if (!simRunning || !investor) return;

    let cancelled = false;
    replayAbortRef.current = false;

    const tick = async () => {
      const nextMinute = nextReplayMinuteRef.current;
      if (cancelled || replayAbortRef.current || nextMinute === null) return;

      if (nextMinute > investor.assumptions.replayEndMinutes) {
        setSimRunning(false);
        nextReplayMinuteRef.current = null;
        return;
      }

      try {
        let frame: SimulationSnapshot;
        if (useClientSimRef.current) {
          frame = buildFallbackSimFrame(nextMinute, dashboard!);
        } else {
          try {
            frame = await getSimulationFrame(nextMinute);
          } catch {
            useClientSimRef.current = true;
            frame = buildFallbackSimFrame(nextMinute, dashboard!);
          }
        }
        if (cancelled || replayAbortRef.current) return;

        setSimSnapshot(frame);
        nextReplayMinuteRef.current = nextMinute + investor.assumptions.replayStepMinutes;
        window.setTimeout(() => void tick(), SIM_TICK_MS);
      } catch {
        setSimRunning(false);
        nextReplayMinuteRef.current = null;
      }
    };

    window.setTimeout(() => void tick(), SIM_TICK_MS);
    return () => { cancelled = true; };
  }, [investor, simRunning]);

  // Derived state
  const routes = dashboard?.routes ?? [];
  const liveFleet = dashboard?.fleet.vehicles ?? [];
  const displayVehicles = simRunning && simSnapshot ? simSnapshot.vehicles : liveFleet;
  const displayFleetSummary = useMemo(() => fleetSummary(displayVehicles), [displayVehicles]);
  const displayPressure = simRunning && simSnapshot ? simSnapshot.routePressure : dashboard?.fleet.routePressure ?? [];
  const displayTransferHubs = simRunning && simSnapshot ? simSnapshot.transferHubs : dashboard?.transferHubs ?? [];

  const currentMarkers = useMemo(() => {
    if (!dashboard) return [];
    return simRunning && simSnapshot
      ? buildReplayMarkers(dashboard.mapOverlays.markers, simSnapshot.routePressure, simSnapshot.transferHubs)
      : dashboard.mapOverlays.markers;
  }, [dashboard, simRunning, simSnapshot]);

  const overlayLayers = useMemo<MapOverlay[]>(() => {
    return (dashboard?.mapOverlays.tileLayers ?? [])
      .filter((l) => activeLayers.has(l.layerId))
      .map((l) => ({ id: l.id, url: l.url, attribution: l.attribution, opacity: l.opacity }));
  }, [activeLayers, dashboard]);

  const overlayMarkers = useMemo<MapMarkerOverlay[]>(() => {
    return currentMarkers
      .filter((m) => activeLayers.has(m.layerId))
      .map((m) => ({ id: m.id, lat: m.lat, lng: m.lng, color: m.color, radius: m.radius, label: m.label, fillOpacity: m.fillOpacity }));
  }, [activeLayers, currentMarkers]);

  const currentGap = useMemo(() => {
    if (!investor || !simSnapshot) return null;
    const currentHour = `${String(Math.floor(simSnapshot.simMinutes / 60)).padStart(2, "0")}:00`;
    return investor.hourly.find((h) => h.hour === currentHour) ?? null;
  }, [investor, simSnapshot]);

  const simProgress = investor && simSnapshot
    ? Math.max(0, Math.min(1, (simSnapshot.simMinutes - investor.assumptions.replayStartMinutes) / (investor.assumptions.replayEndMinutes - investor.assumptions.replayStartMinutes)))
    : 0;

  const routeSummary = routes.map((route) => ({
    ...route,
    vehicles: displayVehicles.filter((v) => v.routeId === route.id).length
  }));

  function toggleLayer(layerId: OverlayLayerId) {
    setActiveLayers((cur) => {
      const next = new Set(cur);
      if (next.has(layerId)) next.delete(layerId);
      else next.add(layerId);
      return next;
    });
  }

  async function toggleReplay() {
    if (simRunning) {
      replayAbortRef.current = true;
      setSimRunning(false);
      nextReplayMinuteRef.current = null;
      return;
    }

    setSimLoading(true);
    replayAbortRef.current = false;

    try {
      let investorPayload: InvestorSimulationPayload;
      if (useClientSimRef.current || investor) {
        investorPayload = investor ?? buildFallbackInvestorPayload();
      } else {
        try {
          investorPayload = await getInvestorSimulation();
        } catch {
          useClientSimRef.current = true;
          investorPayload = buildFallbackInvestorPayload();
        }
      }

      const firstMinute = investorPayload.assumptions.replayStartMinutes;
      let firstFrame: SimulationSnapshot;
      if (useClientSimRef.current) {
        firstFrame = buildFallbackSimFrame(firstMinute, dashboard!);
      } else {
        try {
          firstFrame = await getSimulationFrame(firstMinute);
        } catch {
          useClientSimRef.current = true;
          firstFrame = buildFallbackSimFrame(firstMinute, dashboard!);
        }
      }

      setInvestor(investorPayload);
      setSimSnapshot(firstFrame);
      nextReplayMinuteRef.current = firstMinute + investorPayload.assumptions.replayStepMinutes;
      setSimRunning(true);
    } finally {
      setSimLoading(false);
    }
  }

  /* ── Loading state ── */
  if (!dashboard) {
    return (
      <div className="ops">
        <header className="ops__header">
          <div className="ops__brand">
            {onToggle ? (
              <button className="ops__back" type="button" onClick={onToggle} title="Passenger view">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
            ) : null}
            <h1>PKSB Operations</h1>
          </div>
        </header>
        <div className="ops__body">
          <div className="ops__analytics" style={{ gridColumn: "1 / -1", justifyContent: "center", alignItems: "center" }}>
            <section className="ops-card" style={{ textAlign: "center" }}>
              <h2 className="ops-card__title">Connecting</h2>
              <p className="ops-card__rec">Pulling fleet, demand, weather, and transfer-hub state.</p>
            </section>
          </div>
        </div>
      </div>
    );
  }

  /* ── Main render ── */
  const currentSimHour = simRunning && simSnapshot ? `${String(Math.floor(simSnapshot.simMinutes / 60)).padStart(2, "0")}:00` : null;

  return (
    <div className="ops">
      {/* ── Header ── */}
      <header className="ops__header">
        <div className="ops__brand">
          {onToggle ? (
            <button className="ops__back" type="button" onClick={onToggle} title="Passenger view">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          ) : null}
          <h1>PKSB Operations</h1>
        </div>

        <div className="ops__flight-ticker">
          <span className="ops__ticker-label">HKT</span>
          <span className="ops__ticker-arrivals">
            ↓ {dashboard.demandSupply.rawAirportArrivalPaxNext2h.toLocaleString()} arr
          </span>
          <span className="ops__ticker-sep">·</span>
          <span className="ops__ticker-departures">
            ↑ {dashboard.demandSupply.rawAirportDeparturePaxNext2h.toLocaleString()} dep
          </span>
          <span className="ops__ticker-sep">·</span>
          <span className="ops__ticker-demand" style={{
            color: dashboard.demandSupply.additionalBusesNeededPeak > 0 ? "#dc322f" : "#16b8b0"
          }}>
            {simRunning && investor
              ? `฿${investor.totals.dailyRevenueThb.toLocaleString()} revenue`
              : `${dashboard.demandSupply.additionalBusesNeededPeak} extra buses at peak`}
          </span>
        </div>

        <div className="ops__status-bar">
          <span className="ops__clock">{clock}</span>
          <span style={{ color: "#999", fontSize: 11 }}>
            {dashboard.weather.intelligence.current.tempC}° · {dashboard.weather.intelligence.current.rainProb}%
          </span>
          {dashboard.sources.map((s) => (
            <span key={s.source} className="ops__health-dot" style={{
              background: s.state === "live" ? "#16b8b0" : s.state === "fallback" ? "#b58900" : "#dc322f"
            }} title={`${s.source}: ${s.state}`} />
          ))}
        </div>
      </header>

      {/* ── KPI strip ── */}
      <div className="ops__kpi-strip">
        <div className="ops-kpi">
          <span className="ops-kpi__value">{displayFleetSummary.totalVehicles}</span>
          <span className="ops-kpi__label">Fleet</span>
        </div>
        <div className="ops-kpi">
          <span className="ops-kpi__value">{displayFleetSummary.movingCount}</span>
          <span className="ops-kpi__label">Moving</span>
        </div>
        <div className="ops-kpi">
          <span className="ops-kpi__value">
            {simRunning && investor
              ? `${investor.totals.addressableAirportCapturePct}%`
              : `${dashboard.demandSupply.arrivalCaptureOfAddressablePct}%`}
          </span>
          <span className="ops-kpi__label">Served</span>
        </div>
        <div className="ops-kpi ops-kpi--highlight">
          <span className="ops-kpi__value">
            {simRunning && investor
              ? investor.totals.peakAdditionalBusesNeeded
              : dashboard.demandSupply.additionalBusesNeededPeak}
          </span>
          <span className="ops-kpi__label">Gap</span>
        </div>
        {!simRunning ? (
          <button className="ops-kpi ops-kpi--sim" type="button" onClick={toggleReplay} disabled={simLoading}>
            <span className="ops-kpi__value">{simLoading ? "…" : "▶"}</span>
            <span className="ops-kpi__label">{simLoading ? "Loading" : "Simulate"}</span>
          </button>
        ) : (
          <button className="ops-kpi ops-kpi--sim-active" type="button" onClick={toggleReplay}>
            <span className="ops-kpi__value">{simSnapshot?.simTime ?? "06:00"}</span>
            <span className="ops-kpi__label">Stop</span>
          </button>
        )}
      </div>

      {/* ── Simulation progress strip ── */}
      {simRunning && investor ? (
        <div className="ops__sim-strip">
          <div className="ops__sim-bar">
            <div className="ops__sim-bar-fill" style={{ width: `${simProgress * 100}%` }} />
          </div>
          <div className="ops__sim-stats">
            <span>{simSnapshot?.simTime ?? "06:00"}</span>
            <span>Carried <strong>{((currentGap?.carriedArrivalDemand ?? 0) + (currentGap?.carriedDepartureDemand ?? 0)).toLocaleString()}</strong></span>
            <span>Unmet <strong>{((currentGap?.unmetArrivalDemand ?? 0) + (currentGap?.unmetDepartureDemand ?? 0)).toLocaleString()}</strong></span>
            <span>Revenue <strong>฿{investor.totals.dailyRevenueThb.toLocaleString()}</strong></span>
          </div>
        </div>
      ) : null}

      {/* ── Body: map + analytics ── */}
      <div className="ops__body">
        <div className="ops__map">
          <LiveMap
            lang="en"
            routes={routes}
            stops={[]}
            vehicles={displayVehicles}
            userLocation={null}
            selectedStop={null}
            mode="route"
            bounds={null}
            animationDurationMs={simRunning ? SIM_ANIMATION_MS : OPS_POLL_MS}
            overlayLayers={overlayLayers}
            overlayMarkers={overlayMarkers}
            onModeChange={() => {}}
          />
          <div className="ops__layers">
            {LAYER_DEFS.map((layer) => (
              <button
                key={layer.id}
                className={`ops__layer-btn ${activeLayers.has(layer.id) ? "is-active" : ""}`}
                type="button"
                onClick={() => toggleLayer(layer.id)}
                title={layer.description}
              >
                <span className="ops__layer-icon">{layer.icon}</span>
                <span className="ops__layer-label">{layer.label}</span>
              </button>
            ))}
          </div>
          <div className="ops__map-overlay">
            <span className="ops__map-stat ops__map-stat--primary">{displayFleetSummary.totalVehicles} vehicles</span>
            <span className="ops__map-stat">{displayFleetSummary.movingCount} moving</span>
          </div>
        </div>

        <div className="ops__analytics">
          {/* ── Fleet ── */}
          <section className="ops-card">
            <h2 className="ops-card__title">Fleet</h2>
            <div className="ops-card__grid">
              <div className="ops-metric">
                <span className="ops-metric__value">{displayFleetSummary.busCount}</span>
                <span className="ops-metric__label">Buses</span>
              </div>
              <div className="ops-metric">
                <span className="ops-metric__value">{displayFleetSummary.ferryCount}</span>
                <span className="ops-metric__label">Ferries</span>
              </div>
            </div>
            <div className="ops-card__routes">
              {routeSummary.map((route) => {
                const pressure = displayPressure.find((p) => p.routeId === route.id);
                return (
                  <div key={route.id} className="ops-route-row">
                    <span className="ops-route-row__dot" style={{ background: route.color }} />
                    <span className="ops-route-row__name">{route.shortName.en}</span>
                    <span className="ops-route-row__count">{route.vehicles}</span>
                    <span className="ops-route-row__tier" style={{ color: pressure ? colorForPressure(pressure.level) : "#999" }}>
                      {pressure ? pressure.level : route.tier}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── Airport Demand vs Supply ── */}
          <section className="ops-card">
            <h2 className="ops-card__title">Airport Demand vs Supply</h2>
            <div className="ops-card__grid">
              <div className="ops-metric">
                <span className="ops-metric__value">
                  {(currentGap?.rawArrivalPax ?? dashboard.demandSupply.rawAirportArrivalPaxNext2h).toLocaleString()}
                </span>
                <span className="ops-metric__label">{simRunning ? "Arrivals/hr" : "Arrivals/2h"}</span>
              </div>
              <div className="ops-metric">
                <span className="ops-metric__value">
                  {(currentGap?.rawDeparturePax ?? dashboard.demandSupply.rawAirportDeparturePaxNext2h).toLocaleString()}
                </span>
                <span className="ops-metric__label">{simRunning ? "Departures/hr" : "Departures/2h"}</span>
              </div>
              <div className="ops-metric">
                <span className="ops-metric__value">
                  {((currentGap?.arrivalSeatSupply ?? dashboard.demandSupply.arrivalSeatSupplyNext2h) +
                    (currentGap?.departureSeatSupply ?? dashboard.demandSupply.departureSeatSupplyNext2h)).toLocaleString()}
                </span>
                <span className="ops-metric__label">Seat Supply</span>
              </div>
              <div className={`ops-metric ${(simRunning && investor ? investor.totals.peakAdditionalBusesNeeded : dashboard.demandSupply.additionalBusesNeededPeak) > 0 ? "ops-metric--alert" : ""}`}>
                <span className="ops-metric__value">
                  {simRunning && investor
                    ? investor.totals.peakAdditionalBusesNeeded
                    : dashboard.demandSupply.additionalBusesNeededPeak}
                </span>
                <span className="ops-metric__label">Peak Gap</span>
              </div>
            </div>
            {investor ? (
              <>
                <DemandOverflow hourly={investor.hourly} currentHour={currentSimHour} />
                <CapacityGapChart hourly={investor.hourly} currentHour={currentSimHour} />
              </>
            ) : (
              <p className="ops-card__rec">
                Arrival capture {dashboard.demandSupply.arrivalCaptureOfAddressablePct}% · Departure capture {dashboard.demandSupply.departureCaptureOfAddressablePct}%. Run simulation for full-day analysis.
              </p>
            )}
          </section>

          {/* ── Weather ── */}
          <section className="ops-card">
            <h2 className="ops-card__title">Weather</h2>
            <div className="ops-card__grid">
              <div className="ops-metric">
                <span className="ops-metric__value">{dashboard.weather.intelligence.current.tempC}°</span>
                <span className="ops-metric__label">Temp</span>
              </div>
              <div className="ops-metric">
                <span className="ops-metric__value">{dashboard.weather.intelligence.current.rainProb}%</span>
                <span className="ops-metric__label">Rain</span>
              </div>
              <div className="ops-metric">
                <span className="ops-metric__value">{dashboard.weather.intelligence.current.windKph}</span>
                <span className="ops-metric__label">Wind km/h</span>
              </div>
              <div className={`ops-metric ${dashboard.weather.intelligence.current.aqi > 100 ? "ops-metric--alert" : ""}`}>
                <span className="ops-metric__value">{dashboard.weather.intelligence.current.aqi}</span>
                <span className="ops-metric__label">AQI</span>
              </div>
            </div>
            <div className={`ops-monsoon ${dashboard.weather.intelligence.monsoonSeason ? "is-active" : ""}`}>
              <span className="ops-monsoon__badge">
                {dashboard.weather.intelligence.monsoonSeason ? "MONSOON" : "DRY SEASON"}
              </span>
              <p className="ops-monsoon__note">{dashboard.weather.intelligence.monsoonNote}</p>
            </div>
            <WeatherBar forecast={dashboard.weather.intelligence.forecast} />
          </section>

          {/* ── Investor replay card ── */}
          {!simRunning && !investor ? (
            <section className="ops-card">
              <h2 className="ops-card__title">Investor Replay</h2>
              <p className="ops-card__rec">
                06:00–24:00 deterministic simulation. 25 seats/bus, ฿100 flat fare, 15% addressable demand.
              </p>
              <button
                style={{
                  marginTop: 12, width: "100%", padding: "10px 16px",
                  background: "#16b8b0", color: "#fff", border: 0, borderRadius: 8,
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                  opacity: simLoading ? 0.5 : 1
                }}
                type="button" onClick={toggleReplay} disabled={simLoading}
              >
                {simLoading ? "Loading…" : "Run Simulation"}
              </button>
            </section>
          ) : simRunning && investor ? (
            <section className="ops-card">
              <h2 className="ops-card__title">Simulation Results</h2>
              <div className="ops-card__grid">
                <div className="ops-metric">
                  <span className="ops-metric__value">{investor.totals.carriedArrivalDemand.toLocaleString()}</span>
                  <span className="ops-metric__label">Airport → City</span>
                </div>
                <div className="ops-metric">
                  <span className="ops-metric__value">{investor.totals.carriedDepartureDemand.toLocaleString()}</span>
                  <span className="ops-metric__label">City → Airport</span>
                </div>
                <div className="ops-metric ops-metric--highlight">
                  <span className="ops-metric__value">฿{investor.totals.dailyRevenueThb.toLocaleString()}</span>
                  <span className="ops-metric__label">Daily Revenue</span>
                </div>
                <div className="ops-metric ops-metric--alert">
                  <span className="ops-metric__value">฿{investor.totals.lostRevenueThb.toLocaleString()}</span>
                  <span className="ops-metric__label">Lost Revenue</span>
                </div>
              </div>
              <p className="ops-card__rec">{investor.opportunities.summary}</p>
              <button
                style={{
                  marginTop: 12, width: "100%", padding: "8px 16px",
                  background: "rgba(220,50,47,0.06)", color: "#dc322f", border: "1px solid rgba(220,50,47,0.2)",
                  borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer"
                }}
                type="button" onClick={toggleReplay}
              >
                Stop Simulation
              </button>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
