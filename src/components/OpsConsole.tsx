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
  { id: "aqi", label: "AQI", icon: "AQI", description: "Air quality pressure" },
  { id: "hotspots", label: "Demand", icon: "◎", description: "Passenger pressure by zone" },
  { id: "transfer_hubs", label: "Hubs", icon: "⇄", description: "Bus-to-boat touchpoints" },
  { id: "route_pressure", label: "Pressure", icon: "▲", description: "Supply vs demand by route" }
];

function colorForPressure(level: RoutePressure["level"]) {
  return level === "strained" ? "#f85149" : level === "watch" ? "#d29922" : "#3fb950";
}

function colorForHubStatus(status: TransferHub["status"]) {
  return status === "ready" ? "#3fb950" : status === "watch" ? "#d29922" : "#6e7681";
}

function colorForProvenance(provenance: string) {
  return provenance === "live" ? "#3fb950" : provenance === "estimated" ? "#58a6ff" : "#d29922";
}

function fleetSummary(vehicles: VehiclePosition[]) {
  const busCount = vehicles.filter((vehicle) => !FERRY_ROUTE_IDS.has(vehicle.routeId)).length;
  const ferryCount = vehicles.filter((vehicle) => FERRY_ROUTE_IDS.has(vehicle.routeId)).length;
  const movingCount = vehicles.filter((vehicle) => vehicle.status === "moving").length;
  const dwellingCount = vehicles.filter((vehicle) => vehicle.status === "dwelling").length;

  return {
    totalVehicles: vehicles.length,
    busCount,
    ferryCount,
    movingCount,
    dwellingCount
  };
}

function CapacityGapChart({ hourly, currentHour }: { hourly: HourlyCapacityGap[]; currentHour: string | null }) {
  if (hourly.length === 0) {
    return null;
  }

  const points = hourly.map((point) => ({
    hour: point.hour,
    demand: point.addressableArrivalDemand + point.addressableDepartureDemand,
    supply: point.arrivalSeatSupply + point.departureSeatSupply
  }));
  const maxVal = Math.max(...points.map((point) => Math.max(point.demand, point.supply)), 1);

  return (
    <div className="ops-chart">
      <div className="ops-chart__legend">
        <span className="ops-chart__legend-item">
          <span className="ops-chart__dot" style={{ background: "#58a6ff" }} /> Addressable demand
        </span>
        <span className="ops-chart__legend-item">
          <span className="ops-chart__dot" style={{ background: "rgba(255,255,255,0.15)" }} /> Seat supply
        </span>
      </div>
      <svg viewBox={`0 0 ${points.length * 44} 120`} className="ops-chart__svg">
        {points.map((point, index) => {
          const x = index * 44;
          const demandHeight = (point.demand / maxVal) * 90;
          const supplyHeight = (point.supply / maxVal) * 90;
          const isCurrent = point.hour === currentHour;
          return (
            <g key={point.hour}>
              <rect
                x={x + 4}
                y={100 - supplyHeight}
                width={15}
                height={supplyHeight}
                rx={2}
                fill="rgba(255,255,255,0.12)"
              />
              <rect
                x={x + 23}
                y={100 - demandHeight}
                width={15}
                height={demandHeight}
                rx={2}
                fill={point.demand > point.supply ? "#f85149" : "#58a6ff"}
                opacity={isCurrent ? 1 : 0.7}
              />
              <text
                x={x + 22}
                y={115}
                textAnchor="middle"
                fontSize="8"
                fill={isCurrent ? "#e6edf3" : "#6e7681"}
                fontWeight={isCurrent ? "600" : "400"}
              >
                {point.hour.slice(0, 2)}
              </text>
              {isCurrent ? (
                <line
                  x1={x}
                  y1={0}
                  x2={x}
                  y2={100}
                  stroke="#58a6ff"
                  strokeWidth="0.5"
                  strokeDasharray="2 2"
                />
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function WeatherBar({ forecast }: { forecast: OpsDashboardPayload["weather"]["intelligence"]["forecast"] }) {
  if (forecast.length === 0) {
    return null;
  }

  return (
    <div className="ops-weather-bar">
      {forecast.slice(0, 8).map((hour) => (
        <div key={hour.hour} className="ops-weather-bar__hour">
          <span className="ops-weather-bar__time">{hour.hour.slice(0, 2)}</span>
          <div
            className="ops-weather-bar__rain"
            style={{
              height: `${Math.max(4, hour.rainProb * 0.4)}px`,
              background:
                hour.rainProb > 60
                  ? "#58a6ff"
                  : hour.rainProb > 30
                    ? "rgba(88,166,255,0.4)"
                    : "rgba(88,166,255,0.15)"
            }}
          />
          <span className="ops-weather-bar__temp">{hour.tempC}°</span>
          <span className="ops-weather-bar__prob">{hour.rainProb}%</span>
        </div>
      ))}
    </div>
  );
}

function ProvenanceBadge({ provenance }: { provenance: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 8px",
        borderRadius: 999,
        fontSize: 10,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        background: "rgba(255,255,255,0.06)",
        color: colorForProvenance(provenance)
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: colorForProvenance(provenance)
        }}
      />
      {provenance}
    </span>
  );
}

function buildReplayMarkers(
  baseMarkers: OpsMapOverlayMarker[],
  routePressure: RoutePressure[],
  transferHubs: TransferHub[]
) {
  const staticMarkers = baseMarkers.filter(
    (marker) => marker.layerId !== "route_pressure" && marker.layerId !== "transfer_hubs"
  );
  const pressureMarkers: OpsMapOverlayMarker[] = routePressure.map((pressure) => {
    const coordinates = ROUTE_MARKER_COORDINATES[pressure.routeId];
    return {
      id: `pressure-${pressure.routeId}`,
      layerId: "route_pressure",
      lat: coordinates[0],
      lng: coordinates[1],
      color: colorForPressure(pressure.level),
      radius: pressure.level === "strained" ? 16 : 11,
      label: `${pressure.routeId}: ${pressure.demand} demand / ${pressure.seatSupply} seats`,
      fillOpacity: 0.24
    };
  });
  const hubMarkers: OpsMapOverlayMarker[] = transferHubs.map((hub) => ({
    id: `hub-${hub.id}`,
    layerId: "transfer_hubs",
    lat: hub.coordinates[0],
    lng: hub.coordinates[1],
    color: colorForHubStatus(hub.status),
    radius: hub.status === "ready" ? 16 : 12,
    label: `${hub.name.en}: ${hub.nextWindowStartLabel ?? "no window"}`,
    fillOpacity: 0.25
  }));

  return [...staticMarkers, ...pressureMarkers, ...hubMarkers];
}

/* ── Client-side fallback when /api/ops/dashboard is unreachable ── */
function buildFallbackDashboard(): OpsDashboardPayload {
  const now = new Date();
  const bangkokHour = Number(now.toLocaleTimeString("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", hour12: false }));
  const bangkokMinute = bangkokHour * 60 + now.getMinutes();

  // Activity scale: 0-1 based on time of day
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

  // Generate vehicles along routes
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
        id: `fb-${rd.id}-${i}`,
        routeId: rd.id as any,
        licensePlate: `PKT-${String(1000 + vehicles.length)}`,
        vehicleId: `v-${rd.id}-${i}`,
        deviceId: null,
        coordinates: [lat, lng],
        heading: i % 2 === 0 ? 0 : 180,
        speedKph: activity > 0 ? 25 + Math.random() * 15 : 0,
        destination: { en: rd.shortName, th: rd.shortName, zh: rd.shortName, de: rd.shortName, fr: rd.shortName, es: rd.shortName },
        updatedAt: now.toISOString(),
        telemetrySource: "schedule_mock",
        freshness: "fresh",
        status: Math.random() > 0.3 ? "moving" : "dwelling",
        distanceToDestinationMeters: null,
        stopsAway: null,
      });
    }
  }

  const busCount = vehicles.filter(v => !FERRY_ROUTE_IDS.has(v.routeId)).length;
  const ferryCount = vehicles.filter(v => FERRY_ROUTE_IDS.has(v.routeId)).length;
  const movingCount = vehicles.filter(v => v.status === "moving").length;

  // Demand based on hour
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
    id: rd.id as any,
    name: lt(rd.shortName),
    shortName: lt(rd.shortName),
    overview: lt(`${rd.shortName} route`),
    axis: rd.isFerry ? "marine" as const : "north_south" as const,
    axisLabel: lt(rd.isFerry ? "Marine" : "Land"),
    tier: rd.tier as any,
    color: rd.color,
    accentColor: rd.color,
    bounds: [rd.waypoints[0], rd.waypoints[rd.waypoints.length - 1]] as any,
    pathSegments: [rd.waypoints] as any,
    stopCount: rd.waypoints.length,
    defaultStopId: `${rd.id}-stop-1`,
    activeVehicles: vehicles.filter(v => v.routeId === rd.id).length,
    status: lt("Fallback data"),
    sourceStatus: { source: "bus" as const, state: "fallback" as const, updatedAt: now.toISOString(), detail: lt("Client-side fallback — backend not yet deployed") },
  }));

  const routePressure: RoutePressure[] = ROUTE_DEFS.map(rd => {
    const demand = rd.id === "rawai-airport" ? Math.round(addressableArr * 0.6) : rd.isFerry ? 12 : 8;
    const supply = vehicles.filter(v => v.routeId === rd.id).length * 25;
    const ratio = supply > 0 ? Math.min(1, supply / demand) : 0;
    return {
      routeId: rd.id as any,
      level: ratio >= 1 ? "balanced" as const : ratio >= 0.7 ? "watch" as const : "strained" as const,
      demand, seatSupply: supply, gap: Math.max(0, demand - supply),
      coverageRatio: ratio, delayRiskMinutes: 0, provenance: "fallback" as const,
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
    return {
      id: h.id, zone: h.zone, lat: h.lat, lng: h.lng,
      demand, liveRequests: 0, modeledDemand: demand,
      coverageRatio: demand > 8 ? 0.45 : 0.7,
      gap: Math.max(0, Math.round(demand * 0.4)),
      provenance: "fallback" as const,
    };
  });

  const transferHubs: TransferHub[] = [
    { id: "rassada", name: lt("Rassada Feeder Hub"), coordinates: [7.8557, 98.4013], feederRouteIds: ["dragon-line", "patong-old-bus-station"] as any, ferryRouteIds: ["rassada-phi-phi", "rassada-ao-nang"] as any, walkMinutes: 12, transferBufferMinutes: 20 },
    { id: "chalong", name: lt("Chalong Feeder Hub"), coordinates: [7.8216, 98.3613], feederRouteIds: ["rawai-airport"] as any, ferryRouteIds: ["chalong-racha"] as any, walkMinutes: 15, transferBufferMinutes: 20 },
    { id: "bang-rong", name: lt("Bang Rong Feeder Hub"), coordinates: [8.0317, 98.4192], feederRouteIds: ["rawai-airport"] as any, ferryRouteIds: ["bang-rong-koh-yao"] as any, walkMinutes: 18, transferBufferMinutes: 25 },
  ].map(h => ({
    ...h,
    provenance: "fallback" as const,
    status: "inactive" as const,
    rationale: lt("Fallback data — backend unavailable"),
    activeWindowLabel: null,
    nextWindowStartLabel: null,
    activeConnections: [],
  }));

  const markers: OpsMapOverlayMarker[] = [
    ...hotspots.map(h => ({
      id: `hotspot-${h.id}`, layerId: "hotspots" as OverlayLayerId,
      lat: h.lat, lng: h.lng, color: h.gap >= 4 ? "#f85149" : "#d29922",
      radius: h.demand > 8 ? 14 : 10, label: `${h.zone}: ${h.demand} demand`, fillOpacity: 0.2,
    })),
    ...transferHubs.map(h => ({
      id: `hub-${h.id}`, layerId: "transfer_hubs" as OverlayLayerId,
      lat: h.coordinates[0], lng: h.coordinates[1], color: "#6e7681",
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
    routes,
    demandSupply: {
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
        monsoonNote: isMonsoon ? "Monsoon season — expect afternoon showers 14:00–18:00" : "Dry season — low rain risk, good operating conditions",
        driverAlerts: [],
      },
      provenance: "fallback" as const,
    },
    traffic: {
      severity: "info" as const,
      advisories: [
        { id: "fb-1", routeId: "all" as any, source: "operations" as const, severity: "info" as const, title: lt("Normal Traffic"), message: lt("No incidents reported across all routes"), recommendation: lt("Standard schedules apply"), updatedAt: now.toISOString(), active: true, tags: [] },
      ],
      provenance: "fallback" as const,
      sourceStatuses: [],
    },
    hotspots: { hotspots, totalRequests: 0 },
    transferHubs,
    history: { recentEvents: [], vehicleHistoryCount: 0 },
    mapOverlays: { tileLayers: [], markers },
    sources: [
      { source: "bus" as const, state: "fallback" as const, updatedAt: now.toISOString(), detail: lt("Client-side fallback — backend unavailable") },
      { source: "traffic" as const, state: "fallback" as const, updatedAt: now.toISOString(), detail: lt("Client-side fallback") },
      { source: "weather" as const, state: "fallback" as const, updatedAt: now.toISOString(), detail: lt("Client-side fallback") },
    ],
  };
}

/* ── Client-side investor simulation fallback ── */
function buildFallbackInvestorPayload(): InvestorSimulationPayload {
  const lt = (s: string) => ({ en: s, th: s, zh: s, de: s, fr: s, es: s });
  // Realistic HKT flight hourly arrival pattern
  const HOURLY_ARRIVALS = [0,0,0,0,0,0,180,320,450,380,520,600,680,750,700,580,500,420,380,300,250,150,80,0];
  const HOURLY_DEPARTURES = [0,0,0,0,0,50,120,250,350,300,400,480,520,580,550,450,380,320,280,200,150,100,50,0];
  const SHARE = 0.15;
  const FARE = 100;
  const SEAT = 25;

  // Bus departures per hour from schedule (airport route = 4/hr peak, 2/hr off-peak)
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

  const services: InvestorSimulationPayload["services"] = [
    { routeId: "rawai-airport" as any, routeName: lt("Airport Line"), directionLabel: "Airport → City", tier: "core" as any, departures: 52, seatSupply: 1300, estimatedDemand: totalAddrArr, carriedRiders: totalCarriedArr, unmetRiders: totalUnmetArr, revenueThb: totalCarriedArr * FARE, capturePct: totalAddrArr > 0 ? Math.round(totalCarriedArr / totalAddrArr * 100) : 0, provenance: "fallback" as any, strategicValue: lt("Primary airport connector") },
    { routeId: "rawai-airport" as any, routeName: lt("Airport Line"), directionLabel: "City → Airport", tier: "core" as any, departures: 52, seatSupply: 1300, estimatedDemand: totalAddrDep, carriedRiders: totalCarriedDep, unmetRiders: totalUnmetDep, revenueThb: totalCarriedDep * FARE, capturePct: totalAddrDep > 0 ? Math.round(totalCarriedDep / totalAddrDep * 100) : 0, provenance: "fallback" as any, strategicValue: null },
    { routeId: "patong-old-bus-station" as any, routeName: lt("Patong Line"), directionLabel: "Both", tier: "core" as any, departures: 36, seatSupply: 900, estimatedDemand: 320, carriedRiders: 280, unmetRiders: 40, revenueThb: 28000, capturePct: 88, provenance: "fallback" as any, strategicValue: lt("Highest beach demand") },
    { routeId: "dragon-line" as any, routeName: lt("Dragon Line"), directionLabel: "Loop", tier: "auxiliary" as any, departures: 24, seatSupply: 600, estimatedDemand: 180, carriedRiders: 180, unmetRiders: 0, revenueThb: 18000, capturePct: 100, provenance: "fallback" as any, strategicValue: null },
  ];

  const peakGapHour = hourly.reduce((best, h) => h.unmetArrivalDemand > (best?.unmetArrivalDemand ?? 0) ? h : best, hourly[0]);

  return {
    generatedAt: new Date().toISOString(),
    assumptions: { seatCapacityPerBus: SEAT, flatFareThb: FARE, addressableDemandShare: SHARE, replayStepMinutes: 3, replayStartMinutes: 360, replayEndMinutes: 1440 },
    hourly, services, touchpoints: [],
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
      summary: `Peak gap at ${peakGapHour.hour} — ${peakGapHour.unmetArrivalDemand + peakGapHour.unmetDepartureDemand} unmet pax. Adding ${peakBuses} buses at peak could capture ฿${lostRevenue.toLocaleString()} in lost revenue.`,
      peakArrivalGapHour: peakGapHour.hour, peakDepartureGapHour: peakGapHour.hour,
      strongestRevenueServiceRouteId: "rawai-airport" as any,
    },
  };
}

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

      vehicles.push({
        id: `sim-${routeId}-${dep}`, routeId: routeId as any,
        licensePlate: `SIM-${vehicles.length}`, vehicleId: `sv-${routeId}-${dep}`, deviceId: null,
        coordinates: [lat, lng], heading: reverse ? 180 : 0, speedKph: 30,
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
    simMinutes, simTime: `${hh}:${mm}`,
    vehicles,
    routePressure: fallbackDashboard.fleet.routePressure,
    transferHubs: fallbackDashboard.transferHubs,
  };
}

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

  useEffect(() => {
    const id = window.setInterval(() => {
      setClock(new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Bangkok" }));
    }, 1000);

    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let alive = true;

    const loadDashboard = async () => {
      try {
        const payload = await getOpsDashboard();
        if (alive) {
          setDashboard(payload);
        }
      } catch {
        if (alive) {
          setDashboard((current) => current ?? buildFallbackDashboard());
        }
      }
    };

    void loadDashboard();
    const id = window.setInterval(() => {
      void loadDashboard();
    }, OPS_POLL_MS);

    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!simRunning || !investor) {
      return;
    }

    let cancelled = false;
    replayAbortRef.current = false;

    const tick = async () => {
      const nextMinute = nextReplayMinuteRef.current;
      if (cancelled || replayAbortRef.current || nextMinute === null) {
        return;
      }

      if (nextMinute > investor.assumptions.replayEndMinutes) {
        setSimRunning(false);
        nextReplayMinuteRef.current = null;
        return;
      }

      try {
        let frame: SimulationSnapshot;
        try {
          frame = await getSimulationFrame(nextMinute);
        } catch {
          frame = buildFallbackSimFrame(nextMinute, dashboard!);
        }
        if (cancelled || replayAbortRef.current) {
          return;
        }

        setSimSnapshot(frame);
        nextReplayMinuteRef.current = nextMinute + investor.assumptions.replayStepMinutes;
        window.setTimeout(() => {
          void tick();
        }, 90);
      } catch {
        setSimRunning(false);
        nextReplayMinuteRef.current = null;
      }
    };

    window.setTimeout(() => {
      void tick();
    }, 90);

    return () => {
      cancelled = true;
    };
  }, [investor, simRunning]);

  const routes = dashboard?.routes ?? [];
  const liveFleet = dashboard?.fleet.vehicles ?? [];
  const displayVehicles = simRunning && simSnapshot ? simSnapshot.vehicles : liveFleet;
  const displayFleetSummary = useMemo(() => fleetSummary(displayVehicles), [displayVehicles]);
  const displayPressure = simRunning && simSnapshot ? simSnapshot.routePressure : dashboard?.fleet.routePressure ?? [];
  const displayTransferHubs =
    simRunning && simSnapshot ? simSnapshot.transferHubs : dashboard?.transferHubs ?? [];
  const currentMarkers = useMemo(() => {
    if (!dashboard) {
      return [];
    }

    return simRunning && simSnapshot
      ? buildReplayMarkers(dashboard.mapOverlays.markers, simSnapshot.routePressure, simSnapshot.transferHubs)
      : dashboard.mapOverlays.markers;
  }, [dashboard, simRunning, simSnapshot]);
  const overlayLayers = useMemo<MapOverlay[]>(() => {
    return (dashboard?.mapOverlays.tileLayers ?? [])
      .filter((layer) => activeLayers.has(layer.layerId))
      .map((layer) => ({
        id: layer.id,
        url: layer.url,
        attribution: layer.attribution,
        opacity: layer.opacity
      }));
  }, [activeLayers, dashboard]);
  const overlayMarkers = useMemo<MapMarkerOverlay[]>(() => {
    return currentMarkers
      .filter((marker) => activeLayers.has(marker.layerId))
      .map((marker) => ({
        id: marker.id,
        lat: marker.lat,
        lng: marker.lng,
        color: marker.color,
        radius: marker.radius,
        label: marker.label,
        fillOpacity: marker.fillOpacity
      }));
  }, [activeLayers, currentMarkers]);
  const liveHealthState =
    dashboard?.sources.every((source) => source.state === "live") === true ? "ok" : "degraded";
  const healthColor = liveHealthState === "ok" ? "#3fb950" : "#d29922";
  const currentGap = useMemo(() => {
    if (!investor || !simSnapshot) {
      return null;
    }

    const currentHour = `${String(Math.floor(simSnapshot.simMinutes / 60)).padStart(2, "0")}:00`;
    return investor.hourly.find((item) => item.hour === currentHour) ?? null;
  }, [investor, simSnapshot]);
  const simProgress =
    investor && simSnapshot
      ? Math.max(
          0,
          Math.min(
            1,
            (simSnapshot.simMinutes - investor.assumptions.replayStartMinutes) /
              (investor.assumptions.replayEndMinutes - investor.assumptions.replayStartMinutes)
          )
        )
      : 0;
  const routeSummary = routes.map((route) => ({
    ...route,
    vehicles: displayVehicles.filter((vehicle) => vehicle.routeId === route.id).length
  }));

  function toggleLayer(layerId: OverlayLayerId) {
    setActiveLayers((current) => {
      const next = new Set(current);
      if (next.has(layerId)) {
        next.delete(layerId);
      } else {
        next.add(layerId);
      }
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
      try {
        investorPayload = investor ?? (await getInvestorSimulation());
      } catch {
        investorPayload = investor ?? buildFallbackInvestorPayload();
      }
      const firstMinute = investorPayload.assumptions.replayStartMinutes;
      let firstFrame: SimulationSnapshot;
      try {
        firstFrame = await getSimulationFrame(firstMinute);
      } catch {
        firstFrame = buildFallbackSimFrame(firstMinute, dashboard!);
      }

      setInvestor(investorPayload);
      setSimSnapshot(firstFrame);
      nextReplayMinuteRef.current = firstMinute + investorPayload.assumptions.replayStepMinutes;
      setSimRunning(true);
    } finally {
      setSimLoading(false);
    }
  }

  if (!dashboard) {
    return (
      <div className="ops">
        <header className="ops__header">
          <div className="ops__brand">
            {onToggle ? (
              <button className="ops__back" type="button" onClick={onToggle} title="Switch to passenger view">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
            ) : null}
            <h1>PKSB IOC</h1>
          </div>
        </header>
        <div className="ops__body">
          <div className="ops__analytics" style={{ gridColumn: "1 / -1" }}>
            <section className="ops-card">
              <h2 className="ops-card__title">Loading Operations Layer</h2>
              <p className="ops-card__rec">Pulling fleet, demand, weather, traffic, and transfer-hub state from the backend.</p>
            </section>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ops">
      <header className="ops__header">
        <div className="ops__brand">
          {onToggle ? (
            <button className="ops__back" type="button" onClick={onToggle} title="Switch to passenger view">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          ) : null}
          <h1>PKSB IOC</h1>
        </div>

        <div className="ops__flight-ticker">
          <span className="ops__ticker-label">✈ HKT</span>
          <span className="ops__ticker-arrivals">
            ↓ {dashboard.demandSupply.rawAirportArrivalPaxNext2h.toLocaleString()} pax next 2h
          </span>
          <span className="ops__ticker-sep">|</span>
          <span className="ops__ticker-departures">
            ↑ {dashboard.demandSupply.rawAirportDeparturePaxNext2h.toLocaleString()} pax next 2h
          </span>
          <span className="ops__ticker-sep">|</span>
          <span
            className="ops__ticker-demand"
            style={{
              color:
                dashboard.demandSupply.additionalBusesNeededPeak > 0 ? "#f85149" : "#3fb950"
            }}
          >
            {simRunning && investor
              ? `฿${investor.totals.dailyRevenueThb.toLocaleString()} modeled revenue`
              : `${dashboard.demandSupply.additionalBusesNeededPeak} extra buses at peak`}
          </span>
        </div>

        <div className="ops__status-bar">
          <span className="ops__clock">{clock}</span>
          <span style={{ color: "#888", fontSize: 10 }}>
            {dashboard.weather.intelligence.current.tempC}° · {dashboard.weather.intelligence.current.rainProb}% rain
          </span>
          {dashboard.sources.map((s) => (
            <span
              key={s.source}
              className="ops__health-dot"
              style={{ background: s.state === "live" ? "#5ec26a" : s.state === "fallback" ? "#d4a04a" : "#e05555" }}
              title={`${s.source}: ${s.state}`}
            />
          ))}
        </div>
      </header>

      <div className="ops__kpi-strip">
        <div className="ops-kpi">
          <span className="ops-kpi__value">{displayFleetSummary.totalVehicles}</span>
          <span className="ops-kpi__label">Fleet Online</span>
        </div>
        <div className="ops-kpi">
          <span className="ops-kpi__value">{displayFleetSummary.movingCount}</span>
          <span className="ops-kpi__label">In Transit</span>
        </div>
        <div className="ops-kpi">
          <span className="ops-kpi__value">
            {simRunning && investor
              ? `${investor.totals.addressableAirportCapturePct}%`
              : `${dashboard.demandSupply.arrivalCaptureOfAddressablePct}%`}
          </span>
          <span className="ops-kpi__label">Riders Served %</span>
        </div>
        <div className="ops-kpi ops-kpi--highlight">
          <span className="ops-kpi__value">
            {simRunning && investor
              ? investor.totals.peakAdditionalBusesNeeded
              : dashboard.demandSupply.additionalBusesNeededPeak}
          </span>
          <span className="ops-kpi__label">Extra Buses Needed</span>
        </div>
        <div className="ops-kpi">
          <span className="ops-kpi__value">{dashboard.weather.intelligence.current.rainProb}%</span>
          <span className="ops-kpi__label">Rain Risk</span>
        </div>
        <div className="ops-kpi">
          <span className="ops-kpi__value">{dashboard.weather.intelligence.current.aqi}</span>
          <span className="ops-kpi__label">AQI</span>
        </div>
        {!simRunning ? (
          <button className="ops-kpi ops-kpi--sim" type="button" onClick={toggleReplay} disabled={simLoading}>
            <span className="ops-kpi__value">{simLoading ? "…" : "▶"}</span>
            <span className="ops-kpi__label">{simLoading ? "Loading" : "Investor Replay"}</span>
          </button>
        ) : (
          <button className="ops-kpi ops-kpi--sim-active" type="button" onClick={toggleReplay}>
            <span className="ops-kpi__value">{simSnapshot?.simTime ?? "06:00"}</span>
            <span className="ops-kpi__label">■ Stop Replay</span>
          </button>
        )}
      </div>

      {simRunning && investor ? (
        <div className="ops__sim-strip">
          <div className="ops__sim-bar">
            <div className="ops__sim-bar-fill" style={{ width: `${simProgress * 100}%` }} />
          </div>
          <div className="ops__sim-stats">
            <span>{simSnapshot?.simTime ?? "06:00"}</span>
            <span>Airport to City <strong>{currentGap?.carriedArrivalDemand.toLocaleString() ?? "0"}</strong> riders</span>
            <span>City to Airport <strong>{currentGap?.carriedDepartureDemand.toLocaleString() ?? "0"}</strong> riders</span>
            <span>Revenue <strong>฿{investor.totals.dailyRevenueThb.toLocaleString()}</strong></span>
            <span>Gap <strong>{(currentGap?.unmetArrivalDemand ?? 0) + (currentGap?.unmetDepartureDemand ?? 0)}</strong> pax</span>
          </div>
        </div>
      ) : null}

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
            animationDurationMs={simRunning ? 90 : OPS_POLL_MS}
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
            <span className="ops__map-stat">{displayTransferHubs.filter((hub) => hub.status === "ready").length} hubs ready</span>
          </div>
        </div>

        <div className="ops__analytics">
          <section className="ops-card">
            <h2 className="ops-card__title">Fleet Command</h2>
            <div className="ops-card__grid">
              <div className="ops-metric">
                <span className="ops-metric__value">{displayFleetSummary.busCount}</span>
                <span className="ops-metric__label">Buses</span>
              </div>
              <div className="ops-metric">
                <span className="ops-metric__value">{displayFleetSummary.ferryCount}</span>
                <span className="ops-metric__label">Ferries</span>
              </div>
              <div className="ops-metric">
                <span className="ops-metric__value">{displayFleetSummary.movingCount}</span>
                <span className="ops-metric__label">Moving</span>
              </div>
              <div className="ops-metric">
                <span className="ops-metric__value">{displayFleetSummary.dwellingCount}</span>
                <span className="ops-metric__label">Dwelling</span>
              </div>
            </div>
            <div className="ops-card__routes">
              {routeSummary.map((route) => {
                const pressure = displayPressure.find((item) => item.routeId === route.id);
                return (
                  <div key={route.id} className="ops-route-row">
                    <span className="ops-route-row__dot" style={{ background: route.color }} />
                    <span className="ops-route-row__name">{route.shortName.en}</span>
                    <span className="ops-route-row__count">{route.vehicles}</span>
                    <span className="ops-route-row__tier" style={{ color: pressure ? colorForPressure(pressure.level) : "#8b949e" }}>
                      {pressure ? pressure.level : route.tier}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="ops-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <h2 className="ops-card__title">Airport Supply vs Demand</h2>
              <ProvenanceBadge provenance={dashboard.demandSupply.provenance} />
            </div>
            <div className="ops-card__grid">
              <div className="ops-metric">
                <span className="ops-metric__value">
                  {(currentGap?.rawArrivalPax ?? dashboard.demandSupply.rawAirportArrivalPaxNext2h).toLocaleString()}
                </span>
                <span className="ops-metric__label">{simRunning ? "Arrivals / hour" : "Arrivals / 2h"}</span>
              </div>
              <div className="ops-metric">
                <span className="ops-metric__value">
                  {(currentGap?.rawDeparturePax ?? dashboard.demandSupply.rawAirportDeparturePaxNext2h).toLocaleString()}
                </span>
                <span className="ops-metric__label">{simRunning ? "Departures / hour" : "Departures / 2h"}</span>
              </div>
              <div className="ops-metric">
                <span className="ops-metric__value">
                  {(
                    (currentGap?.arrivalSeatSupply ?? dashboard.demandSupply.arrivalSeatSupplyNext2h) +
                    (currentGap?.departureSeatSupply ?? dashboard.demandSupply.departureSeatSupplyNext2h)
                  ).toLocaleString()}
                </span>
                <span className="ops-metric__label">Seat Supply</span>
              </div>
              <div className="ops-metric ops-metric--highlight">
                <span className="ops-metric__value">
                  {simRunning && investor
                    ? investor.totals.peakAdditionalBusesNeeded
                    : dashboard.demandSupply.additionalBusesNeededPeak}
                </span>
                <span className="ops-metric__label">Peak Fleet Gap</span>
              </div>
            </div>
            <p className="ops-card__rec">
              {simRunning && investor
                ? investor.opportunities.summary
                : `Arrival capture is ${dashboard.demandSupply.arrivalCaptureOfAddressablePct}% and departure capture is ${dashboard.demandSupply.departureCaptureOfAddressablePct}%.`}
            </p>
            {investor ? (
              <CapacityGapChart
                hourly={investor.hourly}
                currentHour={simRunning && simSnapshot ? `${String(Math.floor(simSnapshot.simMinutes / 60)).padStart(2, "0")}:00` : null}
              />
            ) : null}
          </section>

          <section className="ops-card ops-card--weather">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <h2 className="ops-card__title">Weather and Traffic</h2>
              <ProvenanceBadge provenance={dashboard.weather.provenance} />
            </div>
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
                {dashboard.weather.intelligence.monsoonSeason ? "MONSOON PRESSURE" : "DRY-SEASON WINDOW"}
              </span>
              <p className="ops-monsoon__note">{dashboard.weather.intelligence.monsoonNote}</p>
            </div>
            <WeatherBar forecast={dashboard.weather.intelligence.forecast} />
            <div className="ops-incidents">
              {dashboard.traffic.advisories.slice(0, 3).map((advisory) => (
                <div
                  key={advisory.id}
                  className={`ops-incident ${advisory.severity === "warning" ? "ops-incident--warning" : "ops-incident--info"}`}
                >
                  <span className="ops-incident__icon">{advisory.severity === "warning" ? "⚠️" : "🛣️"}</span>
                  <div>
                    <strong>{advisory.title.en}</strong>
                    <p>{advisory.message.en}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Transfer Hubs + Demand Hotspots visible via map layer toggles */}

          <section className="ops-card ops-card--sim">
            <h2 className="ops-card__title">Investor Replay</h2>
            {!simRunning ? (
              <div className="ops-sim-card">
                <p className="ops-sim-card__desc">
                  Run a deterministic 06:00-24:00 replay with 25 seats per bus and flat 100 THB fare to see capture, gaps, and daily revenue.
                </p>
                <button className="ops-sim-card__btn" type="button" onClick={toggleReplay} disabled={simLoading}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5,3 19,12 5,21" />
                  </svg>
                  {simLoading ? "Loading Replay" : "Run Investor Replay"}
                </button>
              </div>
            ) : investor ? (
              <div className="ops-sim-card">
                <div className="ops__sim-clock">{simSnapshot?.simTime ?? "06:00"}</div>
                <div className="ops__sim-bar">
                  <div className="ops__sim-bar-fill" style={{ width: `${simProgress * 100}%` }} />
                </div>
                <div className="ops-sim-card__metrics">
                  <div className="ops-sim-metric">
                    <span className="ops-sim-metric__value">
                      {investor.totals.carriedArrivalDemand.toLocaleString()}
                    </span>
                    <span className="ops-sim-metric__label">Airport → City</span>
                  </div>
                  <div className="ops-sim-metric">
                    <span className="ops-sim-metric__value">
                      {investor.totals.carriedDepartureDemand.toLocaleString()}
                    </span>
                    <span className="ops-sim-metric__label">City → Airport</span>
                  </div>
                  <div className="ops-sim-metric ops-sim-metric--green">
                    <span className="ops-sim-metric__value">
                      {investor.totals.addressableAirportCapturePct}%
                    </span>
                    <span className="ops-sim-metric__label">Riders Served</span>
                  </div>
                  <div className="ops-sim-metric ops-sim-metric--blue">
                    <span className="ops-sim-metric__value">฿{investor.totals.dailyRevenueThb.toLocaleString()}</span>
                    <span className="ops-sim-metric__label">Daily Revenue</span>
                  </div>
                </div>
                <button className="ops-sim-card__stop" type="button" onClick={toggleReplay}>
                  Stop Replay
                </button>
              </div>
            ) : null}
          </section>

          {/* Service Revenue visible during sim in the sim card */}
          {/* System Health moved to header dots */}
        </div>
      </div>
    </div>
  );
}
