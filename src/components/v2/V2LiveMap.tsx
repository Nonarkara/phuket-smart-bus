import React, { useCallback, useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Polyline, useMap, CircleMarker, Tooltip } from "react-leaflet";
import type { LatLngTuple } from "@shared/types";
import { getDirectionPolyline } from "../../engine/routes";
import type { SimState } from "../../engine/simulation";
import { getMapVehicles } from "../../engine/mapVehicleSnapshot";
import {
  ADSB_POLL_MS,
  fetchAdsbAroundHkt,
  buildScheduleFlightBeads,
  type AdsbAircraft,
  type ScheduleFlightBead,
} from "../../engine/adsbFlights";
import { getOpsFlightSchedule } from "../../engine/opsFlightSchedule";
import { getSimulatedMinutes } from "../../engine/fleetSimulator";
import { getEnvironmentSnapshot } from "../../engine/environmentSimulator";
import { getMaritimeOverview } from "../../engine/maritimeData";
import { isLiveGpsActive, getLiveTelemetryVehicles } from "../../engine/liveGpsReceiver";

/** Imperative handle: the parent's per-frame rAF loop calls syncNow() with the
 *  vehicles it sampled for THIS frame's minute. No prop-driven tweening — the
 *  engine already snaps every bus to the road polyline, so painting each
 *  frame's exact position traces the road at any speed with zero interpolation. */
export type V2MapHandle = { syncNow: (vehicles: SimState["vehicles"]) => void };

export type MapLayerId = "buses" | "flights" | "piers" | "rain" | "incidents";

/** Where the default frame lives. `corridor` is the Airport Line road at zoom
 *  12 (~38 m/px) — the only frame where a 30 km/h bus visibly travels. `island`
 *  is the old zoom-10 view that also fits the ferry lanes (~151 m/px, buses
 *  crawl at 0.5 px/s). Corridor is the default; island is one chip away. */
export type MapFrame = "corridor" | "island";

const FRAMES: Record<MapFrame, { center: [number, number]; zoom: number }> = {
  corridor: { center: [7.945, 98.335], zoom: 12 },
  island: { center: [7.88, 98.49], zoom: 10 },
};

type V2LiveMapProps = {
  layers?: Partial<Record<MapLayerId, boolean>>;
  onLayersChange?: (layers: Record<MapLayerId, boolean>) => void;
  /** Called with a vehicle id on hover/click, null on leave. The parent owns
   *  the plan panel; the map only reports focus. */
  onFocusVehicle?: (id: string | null, pinned: boolean) => void;
  focusedVehicleId?: string | null;
  onOpenTelemetryModal?: () => void;
  /** Embedded maps own their animation loop. The operations console leaves
   * this false because its single heartbeat drives map, money and clock. */
  autonomous?: boolean;
};

const DEFAULT_LAYERS: Record<MapLayerId, boolean> = {
  buses: true,
  flights: true,
  piers: true,
  rain: false,
  incidents: false,
};

const FERRY_ROUTES = new Set(["rassada-phi-phi", "rassada-ao-nang", "bang-rong-koh-yao", "chalong-racha"]);
const BUS_CAP = 25;

// ---------------------------------------------------------------------------
// Vehicle instrument — a bus you can read from across the room.
//
// The marker is a small vehicle silhouette. Its FILL height is the load
// (empty = hairline outline, full = solid). A wedge marks the front, rotated
// to heading. Amber is reserved for the bus that is at the curb loading right
// now (`isBoarding`) — every other bus is ink on the dark tile, so the one
// thing that deserves the eye is the only thing that gets the accent.
// No transition on the icon: the engine repaints per frame, so paint the
// truth per frame — a CSS ease on top of that is smear, not motion.
// ---------------------------------------------------------------------------
function buildBusMarkerIcon(vehicle: SimState["vehicles"][number]) {
  if (FERRY_ROUTES.has(vehicle.route)) {
    return L.divIcon({
      className: "v2-boat-icon",
      iconSize: [22, 22],
      iconAnchor: [11, 11],
      html: `<div class="v2-boat ${vehicle.status === "moving" ? "is-moving" : ""}" style="--heading:${vehicle.heading}deg">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 7 11H5l2.3 7h9.4l2.3-7h-2L12 2Zm-2.4 9L12 6l2.4 5H9.6Z"/></svg>
      </div>`,
    });
  }
  return L.divIcon({
    className: "v2-bus-icon",
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    html: `<div class="v2-bus" style="--heading:${vehicle.heading}deg;--fill:${Math.min(1, vehicle.pax / BUS_CAP)}">
      <span class="v2-bus__wedge" aria-hidden="true"></span>
      <span class="v2-bus__hull"><span class="v2-bus__load"></span></span>
    </div>`
  });
}

function busTooltip(vehicle: SimState["vehicles"][number]) {
  const isFerry = FERRY_ROUTES.has(vehicle.route);
  return isFerry ? `${vehicle.plate} · scheduled vessel` : `${vehicle.plate} · ${vehicle.pax}/${BUS_CAP}`;
}

function syncBusMarker(marker: L.Marker, vehicle: SimState["vehicles"][number], focused: boolean) {
  marker.setLatLng([vehicle.lat, vehicle.lng]);
  marker.setTooltipContent(busTooltip(vehicle));

  const element = marker.getElement();
  if (!element) return;

  const bus = element.querySelector<HTMLElement>(".v2-bus");
  const boat = element.querySelector<HTMLElement>(".v2-boat");
  if (bus) {
    bus.classList.toggle("is-moving", vehicle.status === "moving");
    bus.classList.toggle("is-boarding", Boolean(vehicle.isBoarding));
    bus.classList.toggle("is-focused", focused);
    bus.style.setProperty("--heading", `${vehicle.heading}deg`);
    bus.style.setProperty("--fill", String(Math.min(1, vehicle.pax / BUS_CAP)));
  }
  if (boat) {
    boat.classList.toggle("is-moving", vehicle.status === "moving");
    boat.style.setProperty("--heading", `${vehicle.heading}deg`);
  }
  marker.setZIndexOffset(focused ? 900 : vehicle.isBoarding ? 600 : 0);
}

// ---------------------------------------------------------------------------
// Vehicle Layer — imperative Leaflet markers, driven per frame via syncNow().
// ---------------------------------------------------------------------------
const VehicleLayer = forwardRef<
  V2MapHandle,
  { enabled: boolean; autonomous: boolean; focusedId: string | null; onFocus?: (id: string | null, pinned: boolean) => void }
>(function VehicleLayer({ enabled, autonomous, focusedId, onFocus }, ref) {
  const map = useMap();
  const markers = useRef<Map<string, L.Marker>>(new Map());
  const focusedRef = useRef<string | null>(focusedId);
  focusedRef.current = focusedId;
  const onFocusRef = useRef(onFocus);
  onFocusRef.current = onFocus;

  const syncVehicles = useCallback((vehicles: SimState["vehicles"]) => {
    if (!enabled) {
      for (const [, marker] of markers.current) map.removeLayer(marker);
      markers.current.clear();
      return;
    }
    const seen = new Set(vehicles.map((v) => v.id));
    for (const [key, marker] of markers.current) {
      if (!seen.has(key)) {
        map.removeLayer(marker);
        markers.current.delete(key);
      }
    }
    for (const vehicle of vehicles) {
      let marker = markers.current.get(vehicle.id);
      if (!marker) {
        marker = L.marker([vehicle.lat, vehicle.lng], { icon: buildBusMarkerIcon(vehicle) }).addTo(map);
        marker.bindTooltip(busTooltip(vehicle), { direction: "top", className: "v2-bus-tip" });
        if (!FERRY_ROUTES.has(vehicle.route)) {
          const id = vehicle.id;
          marker.on("mouseover", () => onFocusRef.current?.(id, false));
          marker.on("mouseout", () => onFocusRef.current?.(null, false));
          marker.on("click", () => onFocusRef.current?.(id, true));
        }
        markers.current.set(vehicle.id, marker);
      }
      syncBusMarker(marker, vehicle, focusedRef.current === vehicle.id);
    }
  }, [enabled, map]);

  useImperativeHandle(ref, () => ({
    syncNow(vehicles) {
      syncVehicles(vehicles);
    },
  }), [syncVehicles]);

  useEffect(() => {
    if (!enabled || !autonomous) return;

    let frame = 0;
    let lastPaint = -Infinity;
    let stopped = false;
    const paint = (timestamp: number) => {
      if (stopped) return;
      // 30fps is visually continuous at corridor scale and avoids asking the
      // demand engine for 60 identical snapshots on slower travel laptops.
      if (timestamp - lastPaint >= 33) {
        const minute = getSimulatedMinutes();
        syncVehicles(getMapVehicles(minute));
        lastPaint = timestamp;
      }
      frame = requestAnimationFrame(paint);
    };
    frame = requestAnimationFrame(paint);

    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
    };
  }, [autonomous, enabled, syncVehicles]);

  useEffect(() => {
    if (!enabled) {
      markers.current.forEach((marker) => map.removeLayer(marker));
      markers.current.clear();
    }
  }, [enabled, map]);

  useEffect(() => () => {
    markers.current.forEach((marker) => map.removeLayer(marker));
    markers.current.clear();
  }, [map]);

  return null;
});

function buildPlaneIcon(heading: number, live: boolean) {
  const color = live ? "#f59e0b" : "#94a3b8";
  return L.divIcon({
    className: "v2-plane-icon",
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    html: `<div class="v2-plane" style="--heading:${heading}deg;--plane-color:${color}" title="">
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path fill="${color}" d="M12 1.5c-.8 0-1.35.7-1.35 1.55v6.1L4 13v2l6.65-2.05v5.15l-2.05 1.45V21l3.4-.85 3.4.85v-1.45l-2.05-1.45v-5.15L20 15v-2l-6.65-3.85v-6.1C13.35 2.2 12.8 1.5 12 1.5Z"/>
      </svg>
    </div>`,
  });
}

/** Live ADS-B + schedule beads around HKT. Imperative markers (same lesson as buses). */
function AircraftLayer({
  enabled,
  onStatus,
}: {
  enabled: boolean;
  onStatus: (info: { liveCount: number; modelCount: number; status: "live" | "stale" | "empty" }) => void;
}) {
  const map = useMap();
  const liveMarkers = useRef<Map<string, L.Marker>>(new Map());
  const schedMarkers = useRef<Map<string, L.Marker>>(new Map());

  useEffect(() => {
    if (!enabled) {
      liveMarkers.current.forEach((m) => map.removeLayer(m));
      liveMarkers.current.clear();
      schedMarkers.current.forEach((m) => map.removeLayer(m));
      schedMarkers.current.clear();
      onStatus({ liveCount: 0, modelCount: 0, status: "empty" });
      return;
    }

    let cancelled = false;
    const ctrl = new AbortController();

    const syncLive = (list: AdsbAircraft[]) => {
      const seen = new Set(list.map((a) => a.hex));
      for (const [hex, marker] of liveMarkers.current) {
        if (!seen.has(hex)) {
          map.removeLayer(marker);
          liveMarkers.current.delete(hex);
        }
      }
      for (const ac of list) {
        let marker = liveMarkers.current.get(ac.hex);
        const alt = ac.altitudeFt == null ? "?" : `${Math.round(ac.altitudeFt)} ft`;
        const tip = `${ac.callsign} · ADS-B · ${alt}${ac.military ? " · MIL" : ""}`;
        if (!marker) {
          marker = L.marker([ac.lat, ac.lon], { icon: buildPlaneIcon(ac.heading, true), zIndexOffset: 400 }).addTo(map);
          marker.bindTooltip(tip, { direction: "top" });
          liveMarkers.current.set(ac.hex, marker);
        } else {
          marker.setLatLng([ac.lat, ac.lon]);
          marker.setIcon(buildPlaneIcon(ac.heading, true));
          marker.setTooltipContent(tip);
        }
      }
    };

    const syncSchedule = (beads: ScheduleFlightBead[]) => {
      const seen = new Set(beads.map((b) => b.id));
      for (const [id, marker] of schedMarkers.current) {
        if (!seen.has(id)) {
          map.removeLayer(marker);
          schedMarkers.current.delete(id);
        }
      }
      for (const b of beads) {
        let marker = schedMarkers.current.get(b.id);
        const tip = `${b.callsign} · ${b.kind === "arr" ? "ARR" : "DEP"} ${b.city} · schedule ${b.minutesToEvent >= 0 ? `in ${b.minutesToEvent}m` : `${-b.minutesToEvent}m ago`}`;
        if (!marker) {
          marker = L.marker([b.lat, b.lon], { icon: buildPlaneIcon(b.heading, false), zIndexOffset: 300 }).addTo(map);
          marker.bindTooltip(tip, { direction: "top" });
          schedMarkers.current.set(b.id, marker);
        } else {
          marker.setLatLng([b.lat, b.lon]);
          marker.setIcon(buildPlaneIcon(b.heading, false));
          marker.setTooltipContent(tip);
        }
      }
    };

    const tick = async () => {
      const nowMin = getSimulatedMinutes();
      const flights = getOpsFlightSchedule();
      const beads = buildScheduleFlightBeads(
        flights.map((f) => ({
          flightNo: f.flightNo,
          type: f.type,
          city: f.city,
          schedMin: f.schedMin,
          mode: f.mode,
        })),
        nowMin
      );
      if (!cancelled) {
        syncSchedule(beads);
        onStatus({ liveCount: 0, modelCount: beads.length, status: "empty" });
      }

      const snap = await fetchAdsbAroundHkt(ctrl.signal);
      if (cancelled) return;
      syncLive(snap.aircraft);
      onStatus({ liveCount: snap.aircraft.length, modelCount: beads.length, status: snap.status });
    };

    void tick();
    const id = window.setInterval(() => void tick(), ADSB_POLL_MS);
    const schedId = window.setInterval(() => {
      const nowMin = getSimulatedMinutes();
      const flights = getOpsFlightSchedule();
      syncSchedule(
        buildScheduleFlightBeads(
          flights.map((f) => ({
            flightNo: f.flightNo,
            type: f.type,
            city: f.city,
            schedMin: f.schedMin,
            mode: f.mode,
          })),
          nowMin
        )
      );
    }, 2000);

    return () => {
      cancelled = true;
      ctrl.abort();
      window.clearInterval(id);
      window.clearInterval(schedId);
      liveMarkers.current.forEach((m) => map.removeLayer(m));
      liveMarkers.current.clear();
      schedMarkers.current.forEach((m) => map.removeLayer(m));
      schedMarkers.current.clear();
    };
  }, [enabled, map, onStatus]);

  return null;
}

function HktMarker() {
  return (
    <CircleMarker
      center={[7.8804, 98.3923]}
      radius={6}
      pathOptions={{ color: "#f59e0b", fillColor: "#f59e0b", fillOpacity: 0.85, weight: 1 }}
    >
      <Tooltip direction="top" offset={[0, -4]} permanent={false}>
        HKT · Phuket Airport
      </Tooltip>
    </CircleMarker>
  );
}

// ---------------------------------------------------------------------------
// Route polyline
// ---------------------------------------------------------------------------
// On the dark tile the road geometry is context, not data (design.md §VII:
// "active data in amber, context geometry in hairline"). The Airport Line is
// the hero corridor and gets a heavier ink line; local lines and ferry lanes
// are lighter/dashed. Vehicles carry the accent, the roads don't compete.
const ROUTE_POLYLINES: { routeId: string; firstStop: LatLngTuple; color: string; weight: number; marine?: boolean }[] = [
  { routeId: "rawai-airport", firstStop: [8.108, 98.317], color: "#c8d1db", weight: 3.5 },
  { routeId: "patong-old-bus-station", firstStop: [7.884101493, 98.39575082], color: "#8b97a4", weight: 2 },
  { routeId: "dragon-line", firstStop: [7.885774, 98.39478], color: "#8b97a4", weight: 2 },
  { routeId: "rassada-phi-phi", firstStop: [7.8557, 98.4013], color: "#5f7d95", weight: 1.5, marine: true },
  { routeId: "rassada-ao-nang", firstStop: [7.8557, 98.4013], color: "#5f7d95", weight: 1.5, marine: true },
  { routeId: "bang-rong-koh-yao", firstStop: [8.0133, 98.4186], color: "#5f7d95", weight: 1.5, marine: true },
  { routeId: "chalong-racha", firstStop: [7.8281, 98.3613], color: "#5f7d95", weight: 1.5, marine: true },
];

function RoutePolylines({ maritimeFlag }: { maritimeFlag?: string }) {
  const polylines: { poly: LatLngTuple[]; color: string; weight: number; marine?: boolean; routeId: string }[] = [];
  for (const cfg of ROUTE_POLYLINES) {
    try {
      const poly = getDirectionPolyline(cfg.routeId as never, cfg.firstStop);
      if (poly.length >= 2) {
        const isRestrictedMarine = cfg.marine && maritimeFlag === "red";
        const color = isRestrictedMarine ? "#ff7875" : cfg.color;
        polylines.push({
          poly,
          color,
          weight: cfg.weight,
          marine: cfg.marine,
          routeId: cfg.routeId,
        });
      }
    } catch { /* */ }
  }

  return (
    <>
      {polylines.map(({ poly, color, weight, marine, routeId }) => {
        const isRedFlag = marine && maritimeFlag === "red";
        return (
          <Polyline
            key={routeId}
            positions={poly}
            pathOptions={{
              color,
              weight,
              opacity: marine ? 0.75 : 0.9,
              dashArray: isRedFlag ? "4 6" : marine ? "3 8" : undefined,
              lineCap: "round",
            }}
          />
        );
      })}
    </>
  );
}

/** Pier markers showing Marine Department flag status and small boat clearance */
function PiersLayer({ enabled }: { enabled: boolean }) {
  if (!enabled) return null;
  const env = getEnvironmentSnapshot();
  const marine = getMaritimeOverview(env.waveHeightM, env.windKph);

  return (
    <>
      {marine.piers.map((pier) => {
        const flagColor = pier.flag === "red" ? "#ff4d4f" : pier.flag === "yellow" ? "#faad14" : "#52c41a";
        return (
          <CircleMarker
            key={pier.pierId}
            center={pier.coordinates}
            radius={7}
            pathOptions={{
              color: flagColor,
              fillColor: flagColor,
              fillOpacity: 0.9,
              weight: 2,
            }}
          >
            <Tooltip direction="top" offset={[0, -6]}>
              <div className="v2-pier-tip">
                <strong>{pier.nameEn} ({pier.nameTh})</strong>
                <span className={`v2-pier-flag-badge is-${pier.flag}`}>
                  {pier.flag.toUpperCase()} FLAG · {pier.smallBoatsAllowed ? "DEPARTURES PERMITTED" : "SMALL BOATS PROHIBITED"}
                </span>
                <span className="v2-pier-stat">Waves: {pier.waveHeightM}m · Wind: {pier.windSpeedKph} km/h</span>
                <span className="v2-pier-dests">Destinations: {pier.destinations.join(", ")}</span>
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </>
  );
}

function SyncMapView({ frame }: { frame: MapFrame }) {
  const map = useMap();
  useEffect(() => {
    let raf = 0;
    const fix = () => {
      map.invalidateSize();
      const { center, zoom } = FRAMES[frame];
      map.setView(center, zoom, { animate: false });
    };
    raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(fix);
    });
    return () => cancelAnimationFrame(raf);
  }, [map, frame]);
  return null;
}

function RainOverlay({ enabled }: { enabled: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("https://api.rainviewer.com/public/weather-maps.json");
        if (!res.ok) return;
        const data = (await res.json()) as { radar?: { past?: { path: string }[] } };
        const past = data.radar?.past;
        const last = past?.[past.length - 1];
        if (!cancelled && last?.path) {
          setUrl(`https://tilecache.rainviewer.com${last.path}/256/{z}/{x}/{y}/2/1_1.png`);
        }
      } catch {
        /* keep clear */
      }
    })();
    return () => { cancelled = true; };
  }, [enabled]);
  if (!enabled || !url) return null;
  return <TileLayer url={url} opacity={0.55} attribution="RainViewer" />;
}

function IncidentOverlay({ enabled }: { enabled: boolean }) {
  if (!enabled) return null;
  const key = import.meta.env.VITE_GISTDA_API_KEY ?? "";
  if (!key) return null;
  return (
    <TileLayer
      url={`https://api-gateway.gistda.or.th/api/2.0/resources/tiles/basemap_incident/{z}/{x}/{y}?api_key=${key}`}
      opacity={0.7}
      attribution="GISTDA"
    />
  );
}

function LayerToggles({
  layers,
  onChange,
  frame,
  onFrame,
}: {
  layers: Record<MapLayerId, boolean>;
  onChange: (next: Record<MapLayerId, boolean>) => void;
  frame: MapFrame;
  onFrame: (next: MapFrame) => void;
}) {
  const items: { id: MapLayerId; label: string }[] = [
    { id: "buses", label: "Buses" },
    { id: "flights", label: "Flights" },
    { id: "piers", label: "Piers & Sea" },
    { id: "rain", label: "Rain" },
    { id: "incidents", label: "Incidents" },
  ];
  return (
    <div className="v2-map__layers" role="toolbar" aria-label="Map layers and frame">
      <button
        type="button"
        className={`v2-map__layer-btn v2-map__layer-btn--frame ${frame === "corridor" ? "is-active" : ""}`}
        aria-pressed={frame === "corridor"}
        onClick={() => onFrame("corridor")}
        title="Frame the Airport Line corridor"
      >
        Corridor
      </button>
      <button
        type="button"
        className={`v2-map__layer-btn v2-map__layer-btn--frame ${frame === "island" ? "is-active" : ""}`}
        aria-pressed={frame === "island"}
        onClick={() => onFrame("island")}
        title="Frame the whole island + ferry lanes"
      >
        Island
      </button>
      <span className="v2-map__layer-rule" aria-hidden="true" />
      {items.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          className={`v2-map__layer-btn ${layers[id] ? "is-active" : ""}`}
          aria-pressed={layers[id]}
          onClick={() => onChange({ ...layers, [id]: !layers[id] })}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// V2LiveMap
// ---------------------------------------------------------------------------
export const V2LiveMap = React.memo(forwardRef<V2MapHandle, V2LiveMapProps>(function V2LiveMap(
  { layers: layersProp, onLayersChange, onFocusVehicle, focusedVehicleId = null, onOpenTelemetryModal, autonomous = false },
  ref
) {
  const [layers, setLayers] = useState<Record<MapLayerId, boolean>>(() => ({
    ...DEFAULT_LAYERS,
    ...layersProp,
  }));
  const [frame, setFrame] = useState<MapFrame>("corridor");
  const [flightInfo, setFlightInfo] = useState<{ liveCount: number; modelCount: number; status: "live" | "stale" | "empty" }>({
    liveCount: 0,
    modelCount: 0,
    status: "empty",
  });

  const [isGpsActive, setIsGpsActive] = useState(() => isLiveGpsActive());
  const [liveGpsCount, setLiveGpsCount] = useState(0);

  useEffect(() => {
    const check = () => {
      setIsGpsActive(isLiveGpsActive());
      setLiveGpsCount(getLiveTelemetryVehicles().size);
    };
    check();
    const interval = setInterval(check, 1500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (layersProp) setLayers((prev) => ({ ...prev, ...layersProp }));
  }, [layersProp]);

  const setAndNotify = (next: Record<MapLayerId, boolean>) => {
    setLayers(next);
    onLayersChange?.(next);
  };

  const env = getEnvironmentSnapshot();

  return (
    <div className={`v2-map__frame ${autonomous ? "v2-map__frame--autonomous" : ""}`}>
      <div className="v2-map__top-controls">
        <LayerToggles layers={layers} onChange={setAndNotify} frame={frame} onFrame={setFrame} />
        {onOpenTelemetryModal && (
          <button
            type="button"
            className={`v2-map__telemetry-badge ${isGpsActive ? "is-live" : "is-sim"}`}
            onClick={onOpenTelemetryModal}
            title="Click to view Live GPS Telemetry Console & Ingestion Settings"
          >
            <span className="v2-telemetry-dot" />
            {isGpsActive ? `LIVE GPS (${liveGpsCount} BUSES)` : "TIMETABLE SIMULATION"}
          </button>
        )}
      </div>

      {layers.flights && (
        <div className="v2-map__flight-badge" aria-live="polite">
          {flightInfo.liveCount} live aircraft · {flightInfo.modelCount} timetable ·{" "}
          {flightInfo.status === "live" ? "ADS-B current" : flightInfo.status === "stale" ? "ADS-B last seen" : "model only"}
        </div>
      )}

      {env.maritimeFlag === "red" && (
        <div className="v2-map__maritime-banner is-red" role="alert">
          <strong>RED FLAG ALERT:</strong> Waves {env.waveHeightM}m — Small boats strictly prohibited from leaving shore (ห้ามเรือเล็กออกจากฝั่ง)
        </div>
      )}

      <div className="v2-map__legend" aria-label="Map key">
        <span><i className="is-bus-empty" /> empty</span>
        <span><i className="is-bus-full" /> full</span>
        <span><i className="is-bus-boarding" /> boarding now</span>
        <span><i className="is-road" /> bus route</span>
        <span><i className="is-ferry" /> ferry lane</span>
        <span><i className="is-pier" /> pier/harbor</span>
        <span><i className="is-live-plane" /> live aircraft</span>
      </div>
      <MapContainer
        center={FRAMES.corridor.center}
        zoom={FRAMES.corridor.zoom}
        minZoom={6}
        className="v2-map__canvas"
        zoomControl={false}
        scrollWheelZoom={true}
        worldCopyJump={false}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          className="v2-basemap-tile"
        />
        <RainOverlay enabled={layers.rain} />
        <IncidentOverlay enabled={layers.incidents} />
        <RoutePolylines maritimeFlag={env.maritimeFlag} />
        <PiersLayer enabled={layers.piers} />
        <HktMarker />
        <VehicleLayer ref={ref} enabled={layers.buses} autonomous={autonomous} focusedId={focusedVehicleId} onFocus={onFocusVehicle} />
        <AircraftLayer enabled={layers.flights} onStatus={setFlightInfo} />
        <SyncMapView frame={frame} />
      </MapContainer>
    </div>
  );
}));
