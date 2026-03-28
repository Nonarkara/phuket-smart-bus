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
          setDashboard((current) => current);
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
        const frame = await getSimulationFrame(nextMinute);
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
      const investorPayload = investor ?? (await getInvestorSimulation());
      const firstMinute = investorPayload.assumptions.replayStartMinutes;
      const firstFrame = await getSimulationFrame(firstMinute);

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
          <span className="ops__health-dot" style={{ background: healthColor }} />
          <span style={{ color: healthColor, fontSize: 9 }}>
            {dashboard.weather.intelligence.current.tempC}° {dashboard.weather.intelligence.current.rainProb}%☂ AQI{" "}
            {dashboard.weather.intelligence.current.aqi}
          </span>
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
          <span className="ops-kpi__label">{simRunning ? "Airport Capture" : "Arrival Capture"}</span>
        </div>
        <div className="ops-kpi ops-kpi--highlight">
          <span className="ops-kpi__value">
            {simRunning && investor
              ? investor.totals.peakAdditionalBusesNeeded
              : dashboard.demandSupply.additionalBusesNeededPeak}
          </span>
          <span className="ops-kpi__label">Extra Buses</span>
        </div>
        <div className="ops-kpi">
          <span className="ops-kpi__value">{dashboard.weather.intelligence.current.rainProb}%</span>
          <span className="ops-kpi__label">Rain Risk</span>
        </div>
        <div className="ops-kpi">
          <span className="ops-kpi__value">
            {simRunning && investor
              ? `฿${Math.round(investor.totals.lostRevenueThb / 1000)}k`
              : dashboard.hotspots.totalRequests}
          </span>
          <span className="ops-kpi__label">{simRunning ? "Lost Revenue" : "Live Requests"}</span>
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
            <span>🕐 {simSnapshot?.simTime ?? "06:00"}</span>
            <span>✈→🏙 <strong>{currentGap?.carriedArrivalDemand.toLocaleString() ?? "0"}</strong> carried this hour</span>
            <span>🏙→✈ <strong>{currentGap?.carriedDepartureDemand.toLocaleString() ?? "0"}</strong> carried this hour</span>
            <span>💰 <strong>฿{investor.totals.dailyRevenueThb.toLocaleString()}</strong></span>
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

          <section className="ops-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <h2 className="ops-card__title">Transfer Hubs</h2>
              <ProvenanceBadge provenance={displayTransferHubs[0]?.provenance ?? "estimated"} />
            </div>
            <div className="ops-card__routes">
              {displayTransferHubs.map((hub) => (
                <div key={hub.id} className="ops-route-row" style={{ alignItems: "flex-start" }}>
                  <span className="ops-route-row__dot" style={{ background: colorForHubStatus(hub.status), marginTop: 6 }} />
                  <span className="ops-route-row__name" style={{ display: "grid", gap: 4 }}>
                    <strong>{hub.name.en}</strong>
                    <span style={{ color: "#8b949e", fontSize: 11 }}>
                      {hub.activeWindowLabel ?? `Next window ${hub.nextWindowStartLabel ?? "not scheduled"}`}
                    </span>
                    <span style={{ color: "#6e7681", fontSize: 11 }}>
                      Walk {hub.walkMinutes} min · Buffer {hub.transferBufferMinutes} min
                    </span>
                  </span>
                  <span className="ops-route-row__tier" style={{ color: colorForHubStatus(hub.status) }}>
                    {hub.status}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="ops-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <h2 className="ops-card__title">Demand Hotspots</h2>
              <ProvenanceBadge provenance={dashboard.hotspots.hotspots.some((item) => item.provenance === "live") ? "live" : "estimated"} />
            </div>
            <div className="ops-hotspots">
              {dashboard.hotspots.hotspots.slice(0, 5).map((hotspot) => (
                <div
                  key={hotspot.id}
                  className={`ops-hotspot ${hotspot.gap >= 6 ? "ops-hotspot--high" : hotspot.gap >= 3 ? "ops-hotspot--medium" : ""}`}
                >
                  <span className="ops-hotspot__zone">{hotspot.zone}</span>
                  <span className="ops-hotspot__count">
                    {hotspot.demand} demand · {hotspot.liveRequests} live
                  </span>
                  <div className="ops-hotspot__bar">
                    <div className="ops-hotspot__bar-fill" style={{ width: `${Math.min(100, hotspot.demand * 8)}%` }} />
                  </div>
                </div>
              ))}
              <p className="ops-hotspots__note">
                Last-hour app demand plus modeled street pressure from airport, beaches, and town.
              </p>
            </div>
          </section>

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
                    <span className="ops-sim-metric__label">Addressable Capture</span>
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

          {investor ? (
            <section className="ops-card">
              <h2 className="ops-card__title">Service Revenue Stack</h2>
              <div className="ops-flights__list">
                {investor.services.map((service) => (
                  <div key={`${service.routeId}-${service.directionLabel}`} className="ops-flight-row">
                    <span className="ops-flight-row__time">{service.departures} deps</span>
                    <span className="ops-flight-row__flight">{service.routeName.en}</span>
                    <span className="ops-flight-row__origin">{service.directionLabel}</span>
                    <span className="ops-flight-row__airline">{service.capturePct}% capture</span>
                    <span className="ops-flight-row__pax">฿{service.revenueThb.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="ops-card">
            <h2 className="ops-card__title">System Health</h2>
            <div className="ops-health-grid">
              {dashboard.sources.map((source) => (
                <div key={`${source.source}-${source.updatedAt}`} className={`ops-health-item is-${source.state}`}>
                  <span className="ops-health-item__name">{source.source}</span>
                  <span className="ops-health-item__state">{source.state}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
