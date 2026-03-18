import { divIcon } from "leaflet";
import { useEffect, useRef, useState } from "react";
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { Lang, LatLngTuple, Route, Stop, VehiclePosition } from "@shared/types";
import { pick, ui } from "@/lib/i18n";
import { buildAnimatedVehicleFrame, shouldAnimateVehicleFrame } from "@/lib/vehicleAnimation";

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

function buildVehicleIcon(vehicle: VehiclePosition, color: string, highlighted: boolean) {
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
  onModeChange
}: Props) {
  const center: LatLngTuple = selectedStop?.coordinates ?? [7.88, 98.37];
  const routeColorById = Object.fromEntries(routes.map((route) => [route.id, route.color]));
  const [animatedVehicles, setAnimatedVehicles] = useState(vehicles);
  const renderedVehiclesRef = useRef(vehicles);

  useEffect(() => {
    renderedVehiclesRef.current = animatedVehicles;
  }, [animatedVehicles]);

  useEffect(() => {
    if (renderedVehiclesRef.current.length === 0 || !shouldAnimateVehicleFrame(renderedVehiclesRef.current, vehicles)) {
      setAnimatedVehicles(vehicles);
      return;
    }

    let frameId = 0;
    const fromVehicles = renderedVehiclesRef.current;
    const startedAt = performance.now();

    const animate = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / animationDurationMs);
      setAnimatedVehicles(buildAnimatedVehicleFrame(fromVehicles, vehicles, progress));

      if (progress < 1) {
        frameId = window.requestAnimationFrame(animate);
      }
    };

    frameId = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [animationDurationMs, vehicles]);

  return (
    <div className="map-frame" data-testid={testId}>
      <MapContainer center={center} zoom={11} scrollWheelZoom={false} className="map-canvas" minZoom={10} maxZoom={16}>
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <SyncMapView bounds={bounds} mode={mode} selectedStop={selectedStop} />
        {routes.flatMap((route) =>
          route.pathSegments.map((segment, index) => (
            <Polyline
              key={`${route.id}-${index}`}
              positions={segment}
              pathOptions={{ color: route.color, weight: 5, opacity: 0.92 }}
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
              key={vehicle.id}
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
      </MapContainer>
    </div>
  );
}
