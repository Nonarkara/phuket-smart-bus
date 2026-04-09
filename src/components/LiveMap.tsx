import { divIcon } from "leaflet";
import { useEffect, useRef, useState } from "react";
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { Lang, LatLngTuple, Route, Stop, VehiclePosition } from "@shared/types";
import { pick, ui } from "@/lib/i18n";
import { getVehiclesNow } from "@/engine/dataProvider";

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
  // Direct engine rendering: compute fresh polyline-snapped positions every 250ms
  // instead of interpolating between poll snapshots (which takes straight-line shortcuts).
  const [animatedVehicles, setAnimatedVehicles] = useState(vehicles);

  useEffect(() => {
    const prefersReduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const interval = prefersReduced ? 2000 : 250; // 4fps normal, 0.5fps reduced motion

    const tick = () => { setAnimatedVehicles(getVehiclesNow()); };
    tick(); // immediate first frame
    const id = window.setInterval(tick, interval);
    return () => { window.clearInterval(id); };
  }, []); // no deps — runs once, ticks forever

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
          ? animatedVehicles
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
        {animatedVehicles.map((vehicle) => {
          const vehicleColor =
            routeColorById[vehicle.routeId] ??
            (vehicle.routeId === "dragon-line" ? "#db0000" : "#16b8b0");

          return (
            <Marker
              key={`${vehicle.routeId}-${vehicle.id}`}
              position={vehicle.coordinates}
              icon={buildVehicleIcon(vehicle, vehicleColor, highlightVehicleId === vehicle.vehicleId)}
            >
              <Tooltip>{vehicle.licensePlate}</Tooltip>
            </Marker>
          );
        })}
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
