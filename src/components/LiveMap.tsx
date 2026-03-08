import { MapContainer, Polyline, CircleMarker, TileLayer, Tooltip, useMap } from "react-leaflet";
import { useEffect } from "react";
import type { Lang, LatLngTuple, Route, Stop, VehiclePosition } from "@shared/types";
import { pick, ui } from "@/lib/i18n";

type Props = {
  lang: Lang;
  routes: Route[];
  stops: Stop[];
  vehicles: VehiclePosition[];
  userLocation: LatLngTuple | null;
  selectedStop: Stop | null;
  mode: "route" | "stop";
  bounds: [LatLngTuple, LatLngTuple] | null;
  toolbarEyebrow: string;
  toolbarTitle: string;
  toolbarMeta: string;
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
    if (mode === "stop" && selectedStop) {
      map.flyTo(selectedStop.coordinates, 15, { animate: true, duration: 0.55 });
      return;
    }

    if (!bounds) {
      return;
    }

    map.fitBounds(bounds, { padding: [24, 24] });
  }, [bounds, map, mode, selectedStop]);

  return null;
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
  toolbarEyebrow,
  toolbarTitle,
  toolbarMeta,
  onModeChange
}: Props) {
  const center: LatLngTuple = selectedStop?.coordinates ?? routes[0]?.bounds?.[0] ?? [7.88, 98.39];
  const routeColorById = Object.fromEntries(routes.map((route) => [route.id, route.color]));

  return (
    <div className="map-frame">
      <div className="map-frame__toolbar">
        <div className="map-frame__copy">
          <span className="map-frame__eyebrow">{toolbarEyebrow}</span>
          <strong>{toolbarTitle}</strong>
          <small>{toolbarMeta}</small>
        </div>
        <div className="map-frame__toggle" aria-label={pick(ui.mapTitle, lang)}>
          <button
            className={mode === "route" ? "map-toggle is-active" : "map-toggle"}
            onClick={() => onModeChange("route")}
            type="button"
            aria-pressed={mode === "route"}
          >
            {pick(ui.mapModeRoute, lang)}
          </button>
          <button
            className={mode === "stop" ? "map-toggle is-active" : "map-toggle"}
            onClick={() => onModeChange("stop")}
            type="button"
            aria-pressed={mode === "stop"}
          >
            {pick(ui.mapModeStop, lang)}
          </button>
        </div>
      </div>
      <MapContainer center={center} zoom={12} scrollWheelZoom={false} className="map-canvas">
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
        {stops.map((stop) => (
          <CircleMarker
            key={stop.id}
            center={stop.coordinates}
            radius={stop.id === selectedStop?.id ? 9 : 6}
            pathOptions={{
              color: stop.id === selectedStop?.id ? "#ffffff" : "#d9f7ff",
              fillColor:
                stop.id === selectedStop?.id ? "#ff8a3d" : routeColorById[stop.routeId] ?? "#0d1b2a",
              fillOpacity: 1,
              weight: 2
            }}
          >
            <Tooltip>{pick(stop.name, lang)}</Tooltip>
          </CircleMarker>
        ))}
        {vehicles.map((vehicle) => (
          <CircleMarker
            key={vehicle.id}
            center={vehicle.coordinates}
            radius={10}
            pathOptions={{
              color: vehicle.routeId === "dragon-line" ? "#ffd6d1" : "#ffffff",
              fillColor:
                vehicle.routeId === "rawai-airport"
                  ? "#16b8b0"
                  : vehicle.routeId === "patong-old-bus-station"
                    ? "#ffcc33"
                    : "#db0000",
              fillOpacity: 1,
              weight: 3
            }}
          >
            <Tooltip>{vehicle.licensePlate}</Tooltip>
          </CircleMarker>
        ))}
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
