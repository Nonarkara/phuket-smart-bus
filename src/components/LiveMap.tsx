import L, { divIcon } from "leaflet";
import { useEffect, useRef } from "react";
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { Lang, LatLngTuple, Route, Stop, VehiclePosition } from "@shared/types";
import { pick, ui } from "@/lib/i18n";
import { getVehiclesNow } from "@/engine/dataProvider";
import { interpolateCoordinate, interpolateHeading } from "@/lib/vehicleAnimation";

/**
 * Imperative vehicle layer — creates/updates/removes raw Leaflet markers
 * without React re-rendering the marker DOM on every frame.
 */
function VehicleLayer({ routeColorById, routeColorSignature, highlightVehicleId, externalVehicles, animationDurationMs }: {
  routeColorById: Record<string, string>;
  routeColorSignature: string;
  highlightVehicleId: string | null;
  externalVehicles?: VehiclePosition[]; // if provided, use these instead of engine
  animationDurationMs: number;
}) {
  const map = useMap();
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const renderedVehiclesRef = useRef<Map<string, VehiclePosition>>(new Map());
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    function vehicleKey(vehicle: VehiclePosition) {
      return `${vehicle.routeId}-${vehicle.id}`;
    }

    function syncMarkerElement(
      marker: L.Marker,
      vehicle: VehiclePosition,
      color: string,
      highlighted: boolean,
      isFerry: boolean
    ) {
      marker.setLatLng(vehicle.coordinates);
      marker.setTooltipContent(vehicle.licensePlate);

      const element = marker.getElement();
      if (!element) return;

      if (isFerry) {
        const ferry = element.querySelector<HTMLElement>(".ferry-marker");
        const svg = element.querySelector<SVGElement>("svg");
        if (ferry) {
          ferry.classList.toggle("is-highlighted", highlighted);
          ferry.style.setProperty("--ferry-color", color);
          ferry.style.setProperty("--ferry-heading", `${vehicle.heading}deg`);
        }
        if (svg) {
          svg.style.transform = `rotate(${vehicle.heading}deg)`;
        }
        return;
      }

      const bus = element.querySelector<HTMLElement>(".bus-marker");
      if (bus) {
        bus.classList.toggle("is-highlighted", highlighted);
        bus.style.setProperty("--bus-color", color);
        bus.style.setProperty("--bus-heading", `${vehicle.heading}deg`);
      }
    }

    function ensureMarker(vehicle: VehiclePosition, color: string, highlighted: boolean, isFerry: boolean) {
      const key = vehicleKey(vehicle);
      const existing = markersRef.current.get(key);
      if (existing) return existing;

      const icon = isFerry
        ? buildFerryIcon(vehicle, color, highlighted)
        : buildVehicleIcon(vehicle, color, highlighted);
      const marker = L.marker(vehicle.coordinates, { icon }).addTo(map);
      marker.bindTooltip(vehicle.licensePlate);
      markersRef.current.set(key, marker);
      return marker;
    }

    function applyFrame(vehicles: VehiclePosition[]) {
      const rendered = new Map<string, VehiclePosition>();

      for (const v of vehicles) {
        const color = routeColorById[v.routeId] ?? (v.routeId === "dragon-line" ? "#db0000" : "#16b8b0");
        const isFerry = v.routeId.includes("phi-phi") || v.routeId.includes("ao-nang") || v.routeId.includes("koh-yao") || v.routeId.includes("racha");
        const marker = ensureMarker(v, color, highlightVehicleId === v.vehicleId, isFerry);
        syncMarkerElement(marker, v, color, highlightVehicleId === v.vehicleId, isFerry);
        rendered.set(vehicleKey(v), v);
      }

      for (const [key, marker] of markersRef.current) {
        if (!rendered.has(key)) {
          map.removeLayer(marker);
          markersRef.current.delete(key);
        }
      }

      renderedVehiclesRef.current = rendered;
    }

    function animateTo(vehicles: VehiclePosition[], durationMs: number) {
      const previous = renderedVehiclesRef.current;
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      if (previous.size === 0 || durationMs <= 0) {
        applyFrame(vehicles);
        return;
      }

      const startedAt = performance.now();
      const step = (now: number) => {
        const progress = Math.min(1, (now - startedAt) / durationMs);
        const frame = vehicles.map((vehicle) => {
          const current = previous.get(vehicleKey(vehicle));
          if (!current || current.routeId !== vehicle.routeId) {
            return vehicle;
          }

          return {
            ...vehicle,
            coordinates: interpolateCoordinate(current.coordinates, vehicle.coordinates, progress),
            heading: interpolateHeading(current.heading, vehicle.heading, progress)
          };
        });

        applyFrame(frame);

        if (progress < 1) {
          animationFrameRef.current = requestAnimationFrame(step);
        } else {
          animationFrameRef.current = null;
        }
      };

      animationFrameRef.current = requestAnimationFrame(step);
    }

    if (externalVehicles) {
      animateTo(externalVehicles, Math.max(0, animationDurationMs - 120));
      return;
    }

    animateTo(getVehiclesNow(), Math.min(animationDurationMs, 900));
    const id = setInterval(() => animateTo(getVehiclesNow(), Math.min(animationDurationMs, 900)), 1000);

    return () => {
      clearInterval(id);
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [map, routeColorSignature, highlightVehicleId, externalVehicles, animationDurationMs]);

  useEffect(() => () => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    for (const marker of markersRef.current.values()) map.removeLayer(marker);
    markersRef.current.clear();
    renderedVehiclesRef.current.clear();
  }, [map]);

  return null; // purely imperative — no React DOM output
}

export type MapOverlay = {
  id: string;
  url: string;
  attribution?: string;
  opacity?: number;
};

export type MapMarkerOverlay = {
  id: string;
  lat: number;
  lng: number;
  color: string;
  radius: number;
  label: string;
  fillOpacity?: number;
};

type Props = {
  lang: Lang;
  routes: Route[];
  stops: Stop[];
  vehicles: VehiclePosition[];
  userLocation: LatLngTuple | null;
  selectedStop: Stop | null;
  mode: "route" | "stop";
  bounds: [LatLngTuple, LatLngTuple] | null;
  highlightStopIds?: string[];
  highlightVehicleId?: string | null;
  animationDurationMs?: number;
  testId?: string;
  overlayLayers?: MapOverlay[];
  overlayMarkers?: MapMarkerOverlay[];
  onModeChange: (mode: "route" | "stop") => void;
};

function SyncMapView({
  bounds,
  mode,
  selectedStop
}: {
  bounds: [LatLngTuple, LatLngTuple] | null;
  mode: "route" | "stop";
  selectedStop: Stop | null;
}) {
  const map = useMap();

  useEffect(() => {
    // Leaflet needs a size invalidation when the container starts at 0 height
    const timer = setTimeout(() => map.invalidateSize(), 100);
    return () => clearTimeout(timer);
  }, [map]);

  useEffect(() => {
    if (mode === "stop" && selectedStop) {
      map.flyTo(selectedStop.coordinates, 15, { animate: true, duration: 0.55 });
      return;
    }

    if (!bounds) {
      return;
    }

    map.fitBounds(bounds, { padding: [24, 24], maxZoom: 12 });
  }, [bounds, map, mode, selectedStop]);

  return null;
}

const FERRY_ROUTE_IDS = new Set(["rassada-phi-phi", "rassada-ao-nang", "bang-rong-koh-yao", "chalong-racha"]);

function buildVehicleIcon(vehicle: VehiclePosition, color: string, highlighted: boolean) {
  if (FERRY_ROUTE_IDS.has(vehicle.routeId)) {
    return buildFerryIcon(vehicle, color, highlighted);
  }
  return divIcon({
    className: "bus-marker-icon",
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    html: `
      <div class="bus-marker${highlighted ? " is-highlighted" : ""}" style="--bus-color: ${color}; --bus-heading: ${vehicle.heading}deg;">
        <span class="bus-marker__heading"></span>
        <span class="bus-marker__body"></span>
        <span class="bus-marker__windshield"></span>
      </div>
    `
  });
}

function buildFerryIcon(vehicle: VehiclePosition, color: string, highlighted: boolean) {
  return divIcon({
    className: "ferry-marker-icon",
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    html: `
      <div class="ferry-marker${highlighted ? " is-highlighted" : ""}" style="--ferry-color: ${color}; --ferry-heading: ${vehicle.heading}deg;">
        <svg viewBox="0 0 24 24" width="22" height="22" style="transform: rotate(${vehicle.heading}deg);">
          <path d="M12 2L6 12h2l-2 6h12l-2-6h2L12 2z" fill="${color}" stroke="#fff" stroke-width="1.5"/>
        </svg>
      </div>
    `
  });
}

export function LiveMap({
  lang,
  routes,
  stops,
  vehicles,
  userLocation,
  selectedStop,
  mode,
  bounds,
  highlightStopIds = [],
  highlightVehicleId = null,
  animationDurationMs = 12_000,
  testId = "live-map",
  overlayLayers = [],
  overlayMarkers = [],
  onModeChange
}: Props) {
  const center: LatLngTuple = selectedStop?.coordinates ?? [7.88, 98.37];
  const routeColorById = Object.fromEntries(routes.map((route) => [route.id, route.color]));
  const routeColorSignature = routes.map((route) => `${route.id}:${route.color}`).join("|");

  return (
    <div className="map-frame" data-testid={testId}>
      <MapContainer center={center} zoom={11} scrollWheelZoom={false} className="map-canvas" minZoom={10} maxZoom={16}>
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {overlayLayers?.map(layer => (
          <TileLayer
            key={layer.id}
            url={layer.url}
            attribution={layer.attribution ?? ""}
            opacity={layer.opacity ?? 0.6}
          />
        ))}
        <SyncMapView bounds={bounds} mode={mode} selectedStop={selectedStop} />
        {routes.flatMap((route) =>
          route.pathSegments.map((segment, index) => (
            <Polyline
              key={`${route.id}-${index}`}
              positions={segment}
              pathOptions={{
                color: route.color,
                weight: FERRY_ROUTE_IDS.has(route.id) ? 3 : 5,
                opacity: 0.92,
                dashArray: FERRY_ROUTE_IDS.has(route.id) ? "8 6" : undefined
              }}
            />
          ))
        )}
        {stops.map((stop) => {
          const isHighlighted = stop.id === selectedStop?.id || highlightStopIds.includes(stop.id);

          return (
            <CircleMarker
              key={stop.id}
              center={stop.coordinates}
              radius={isHighlighted ? 10 : 6}
              pathOptions={{
                color: isHighlighted ? "#ffffff" : "#d9f7ff",
                fillColor: isHighlighted ? "#ff8a3d" : routeColorById[stop.routeId] ?? "#0d1b2a",
                fillOpacity: 1,
                weight: isHighlighted ? 3 : 2
              }}
            >
              <Tooltip>{pick(stop.name, lang)}</Tooltip>
            </CircleMarker>
          );
        })}
        {highlightVehicleId
          ? vehicles
              .filter((vehicle) => vehicle.vehicleId === highlightVehicleId)
              .map((vehicle) => (
                <CircleMarker
                  key={`${vehicle.id}-focus`}
                  center={vehicle.coordinates}
                  radius={16}
                  pathOptions={{
                    color: "rgba(22, 184, 176, 0.42)",
                    fillColor: "rgba(22, 184, 176, 0.14)",
                    fillOpacity: 0.3,
                    weight: 2
                  }}
                />
              ))
          : null}
        <VehicleLayer
          routeColorById={routeColorById}
          routeColorSignature={routeColorSignature}
          highlightVehicleId={highlightVehicleId}
          externalVehicles={vehicles}
          animationDurationMs={animationDurationMs}
        />
        {userLocation ? (
          <CircleMarker
            center={userLocation}
            radius={9}
            pathOptions={{
              color: "#101418",
              fillColor: "#ffffff",
              fillOpacity: 1,
              weight: 3
            }}
          >
            <Tooltip>{pick(ui.locationYouAreHere, lang)}</Tooltip>
          </CircleMarker>
        ) : null}
        {/* Overlay markers (IOC layers) */}
        {overlayMarkers.map(m => (
          <CircleMarker
            key={m.id}
            center={[m.lat, m.lng]}
            radius={m.radius}
            pathOptions={{
              color: m.color,
              fillColor: m.color,
              fillOpacity: m.fillOpacity ?? 0.3,
              weight: 2
            }}
          >
            <Tooltip>{m.label}</Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
