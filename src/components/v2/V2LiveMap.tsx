import React, { useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Polyline, useMap, CircleMarker, Tooltip } from "react-leaflet";
import type { LatLngTuple } from "@shared/types";
import { getDirectionPolyline } from "../../engine/routes";
import type { SimState } from "../../engine/simulation";
import {
  ADSB_POLL_MS,
  fetchAdsbAroundHkt,
  buildScheduleFlightBeads,
  type AdsbAircraft,
  type ScheduleFlightBead,
} from "../../engine/adsbFlights";
import { getOpsFlightSchedule } from "../../engine/opsFlightSchedule";
import { getSimulatedMinutes } from "../../engine/fleetSimulator";

/** Imperative handle: the parent's per-frame rAF loop calls syncNow() with the
 *  vehicles it sampled for THIS frame's minute. No prop-driven tweening — the
 *  engine already snaps every bus to the road polyline, so painting each
 *  frame's exact position traces the road at any speed with zero interpolation. */
export type V2MapHandle = { syncNow: (vehicles: SimState["vehicles"]) => void };

export type MapLayerId = "buses" | "flights" | "rain" | "incidents";

type V2LiveMapProps = {
  layers?: Partial<Record<MapLayerId, boolean>>;
  onLayersChange?: (layers: Record<MapLayerId, boolean>) => void;
};

const DEFAULT_LAYERS: Record<MapLayerId, boolean> = {
  buses: true,
  flights: true,
  rain: false,
  incidents: false,
};

// ---------------------------------------------------------------------------
// Bus Marker Icon Builder
// ---------------------------------------------------------------------------
function buildBusMarkerIcon(vehicle: SimState["vehicles"][number]) {
  return L.divIcon({
    className: "v2-bus-icon",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: `<div class="v2-bus ${vehicle.status === "moving" ? "is-moving" : ""}" style="--heading: ${vehicle.heading}deg">
      <div class="v2-bus__arrow"></div>
      <div class="v2-bus__body">${vehicle.pax}</div>
    </div>`
  });
}

function syncBusMarker(marker: L.Marker, vehicle: SimState["vehicles"][number]) {
  marker.setLatLng([vehicle.lat, vehicle.lng]);
  marker.setTooltipContent(`${vehicle.plate} · ${vehicle.pax}/25 pax · ${vehicle.route}`);

  const element = marker.getElement();
  if (!element) return;

  const bus = element.querySelector<HTMLElement>(".v2-bus");
  const body = element.querySelector<HTMLElement>(".v2-bus__body");
  if (bus) {
    bus.classList.toggle("is-moving", vehicle.status === "moving");
    bus.style.setProperty("--heading", `${vehicle.heading}deg`);
  }
  if (body) {
    body.textContent = String(vehicle.pax);
  }
}

// ---------------------------------------------------------------------------
// Vehicle Layer — imperative Leaflet markers, driven per frame via syncNow().
// ---------------------------------------------------------------------------
const VehicleLayer = forwardRef<V2MapHandle, { enabled: boolean }>(function VehicleLayer({ enabled }, ref) {
  const map = useMap();
  const markers = useRef<Map<string, L.Marker>>(new Map());

  useImperativeHandle(ref, () => ({
    syncNow(vehicles) {
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
          marker.bindTooltip(`${vehicle.plate} · ${vehicle.pax}/25 pax · ${vehicle.route}`, { direction: "top" });
          markers.current.set(vehicle.id, marker);
        }
        syncBusMarker(marker, vehicle);
      }
    },
  }), [map, enabled]);

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
        <path fill="${color}" d="M12 2 L14.5 10 H20 L15 13.5 L17 21 L12 17 L7 21 L9 13.5 L4 10 H9.5 Z"/>
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
  onStatus: (info: { count: number; status: "live" | "stale" | "empty" }) => void;
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
      onStatus({ count: 0, status: "empty" });
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
      if (!cancelled) syncSchedule(beads);

      const snap = await fetchAdsbAroundHkt(ctrl.signal);
      if (cancelled) return;
      syncLive(snap.aircraft);
      onStatus({ count: snap.aircraft.length + beads.length, status: snap.status });
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
const ROUTE_POLYLINES: { routeId: string; firstStop: LatLngTuple; color: string }[] = [
  { routeId: "rawai-airport", firstStop: [8.108, 98.317], color: "#16b8b0" },
  { routeId: "patong-old-bus-station", firstStop: [7.884101493, 98.39575082], color: "#ffcc33" },
  { routeId: "dragon-line", firstStop: [7.885774, 98.39478], color: "#db0000" },
];

function RoutePolylines() {
  const polylines: { poly: LatLngTuple[]; color: string }[] = [];
  for (const cfg of ROUTE_POLYLINES) {
    try {
      const poly = getDirectionPolyline(cfg.routeId as never, cfg.firstStop);
      if (poly.length >= 2) polylines.push({ poly, color: cfg.color });
    } catch { /* */ }
  }

  return (
    <>
      {polylines.map(({ poly, color }, i) => (
        <Polyline
          key={i}
          positions={poly}
          pathOptions={{ color, weight: 4, opacity: 0.85 }}
        />
      ))}
    </>
  );
}

function SyncMapView() {
  const map = useMap();
  useEffect(() => {
    let raf = 0;
    const fix = () => {
      map.invalidateSize();
      map.setView([7.88, 98.37], 11);
    };
    raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(fix);
    });
    return () => cancelAnimationFrame(raf);
  }, [map]);
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
}: {
  layers: Record<MapLayerId, boolean>;
  onChange: (next: Record<MapLayerId, boolean>) => void;
}) {
  const items: { id: MapLayerId; label: string }[] = [
    { id: "buses", label: "Buses" },
    { id: "flights", label: "Flights" },
    { id: "rain", label: "Rain" },
    { id: "incidents", label: "Incidents" },
  ];
  return (
    <div className="v2-map__layers" role="toolbar" aria-label="Map layers">
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
  { layers: layersProp, onLayersChange },
  ref
) {
  const [layers, setLayers] = useState<Record<MapLayerId, boolean>>(() => ({
    ...DEFAULT_LAYERS,
    ...layersProp,
  }));
  const [flightInfo, setFlightInfo] = useState<{ count: number; status: "live" | "stale" | "empty" }>({
    count: 0,
    status: "empty",
  });

  useEffect(() => {
    if (layersProp) setLayers((prev) => ({ ...prev, ...layersProp }));
  }, [layersProp]);

  const setAndNotify = (next: Record<MapLayerId, boolean>) => {
    setLayers(next);
    onLayersChange?.(next);
  };

  return (
    <div className="v2-map__frame">
      <LayerToggles layers={layers} onChange={setAndNotify} />
      {layers.flights && (
        <div className="v2-map__flight-badge" aria-live="polite">
          {flightInfo.count} aircraft ·{" "}
          {flightInfo.status === "live" ? "ADS-B live" : flightInfo.status === "stale" ? "ADS-B stale" : "schedule"}
        </div>
      )}
      <MapContainer
        center={[7.88, 98.37]}
        zoom={11}
        minZoom={6}
        className="v2-map__canvas"
        zoomControl={false}
        scrollWheelZoom={true}
        worldCopyJump={false}
      >
        <TileLayer
          attribution="&copy; OSM"
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        <RainOverlay enabled={layers.rain} />
        <IncidentOverlay enabled={layers.incidents} />
        <RoutePolylines />
        <HktMarker />
        <VehicleLayer ref={ref} enabled={layers.buses} />
        <AircraftLayer enabled={layers.flights} onStatus={setFlightInfo} />
        <SyncMapView />
      </MapContainer>
    </div>
  );
}));
