import { useEffect } from "react";
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { LatLngTuple, OperationalRouteId } from "@shared/types";
import { getDirectionPolyline, getStopsForRoute } from "../../engine/routes";

type RouteSpec = {
  id: OperationalRouteId;
  firstStop: LatLngTuple;
  label: string;
  color: string;
  marine?: boolean;
};

const ROUTES: RouteSpec[] = [
  { id: "rawai-airport", firstStop: [8.11317, 98.30662], label: "Airport ↔ Rawai", color: "#ef442f" },
  { id: "patong-old-bus-station", firstStop: [7.8841, 98.39575], label: "Old Town ↔ Patong", color: "#12304b" },
  { id: "dragon-line", firstStop: [7.88577, 98.39478], label: "Old Town loop", color: "#d0a500" },
  { id: "rassada-phi-phi", firstStop: [7.8557, 98.4013], label: "Rassada ↔ Phi Phi", color: "#497e9b", marine: true },
  { id: "rassada-ao-nang", firstStop: [7.8557, 98.4013], label: "Rassada ↔ Ao Nang", color: "#497e9b", marine: true },
  { id: "bang-rong-koh-yao", firstStop: [8.0133, 98.4186], label: "Bang Rong ↔ Koh Yao", color: "#497e9b", marine: true },
  { id: "chalong-racha", firstStop: [7.8281, 98.3613], label: "Chalong ↔ Racha", color: "#497e9b", marine: true }
];

const KEY_STOPS = [
  { name: "HKT Airport", coordinates: [8.11317, 98.30662] as LatLngTuple, kind: "airport" },
  { name: "Old Town", coordinates: [7.8841, 98.39575] as LatLngTuple, kind: "town" },
  { name: "Patong", coordinates: [7.8962, 98.2964] as LatLngTuple, kind: "beach" },
  { name: "Kata", coordinates: [7.8218, 98.3017] as LatLngTuple, kind: "beach" },
  { name: "Rawai", coordinates: [7.7798, 98.3254] as LatLngTuple, kind: "beach" }
];

function ActualRoutes() {
  return (
    <>
      {ROUTES.map((route) => {
        const points = getDirectionPolyline(route.id, route.firstStop);
        return (
          <Polyline
            key={route.id}
            positions={points}
            pathOptions={{
              color: route.color,
              weight: route.marine ? 2.5 : route.id === "rawai-airport" ? 5 : 3,
              opacity: route.marine ? 0.68 : 0.92,
              dashArray: route.marine ? "3 9" : undefined,
              lineCap: "round",
              lineJoin: "round"
            }}
          >
            <Tooltip sticky>{route.label} · published geometry</Tooltip>
          </Polyline>
        );
      })}
    </>
  );
}

function StopDots() {
  const corridorStops = getStopsForRoute("rawai-airport");
  return (
    <>
      {corridorStops.map((stop) => (
        <CircleMarker
          key={stop.id}
          center={stop.coordinates}
          radius={2.5}
          pathOptions={{ color: "#fff", fillColor: "#ef442f", fillOpacity: 1, weight: 1 }}
        >
          <Tooltip>{stop.name.en}</Tooltip>
        </CircleMarker>
      ))}
      {KEY_STOPS.map((stop) => (
        <CircleMarker
          key={stop.name}
          center={stop.coordinates}
          radius={stop.kind === "airport" ? 7 : 5}
          pathOptions={{ color: "#fff", fillColor: stop.kind === "airport" ? "#111820" : "#ef442f", fillOpacity: 1, weight: 2 }}
        >
          <Tooltip permanent direction="right" offset={[8, 0]}>{stop.name}</Tooltip>
        </CircleMarker>
      ))}
    </>
  );
}

function RepairMapSize() {
  const map = useMap();
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      map.invalidateSize();
      map.fitBounds([[7.74, 98.23], [8.15, 98.49]], { padding: [24, 24] });
    });
    return () => cancelAnimationFrame(frame);
  }, [map]);
  return null;
}

export function PhuketSystemMap() {
  return (
    <figure className="pc-system-map" id="system-map" aria-labelledby="pc-system-map-title">
      <figcaption className="pc-system-map__copy">
        <p className="tk-kicker">The geography of the operating case</p>
        <h3 id="pc-system-map-title">Not an island icon. The actual roads the buses use.</h3>
        <p>
          The red line is the 3,944-point airport corridor used by the simulator. Thin lines are local services.
          Dotted lines are boats, because a ferry should not drive across the Andaman Sea.
        </p>
        <ol className="pc-system-map__logic" aria-label="How to read the map">
          <li><span>01</span><div><strong>Flights make demand</strong><small>Arrivals become a passenger queue after customs.</small></div></li>
          <li><span>02</span><div><strong>The timetable makes supply</strong><small>Twenty-five seats leave roughly once an hour.</small></div></li>
          <li><span>03</span><div><strong>The gap makes a decision</strong><small>Add a bus only where a direction is genuinely short.</small></div></li>
        </ol>
        <a href="https://bus.nonarkara.org/ops">Run this geography live <span>↗</span></a>
      </figcaption>

      <div className="pc-system-map__stage">
        <MapContainer
          center={[7.945, 98.36]}
          zoom={10}
          minZoom={9}
          maxZoom={14}
          zoomControl={false}
          scrollWheelZoom={false}
          className="pc-system-map__canvas"
        >
          <TileLayer
            attribution="&copy; OpenStreetMap &copy; CARTO"
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />
          <ActualRoutes />
          <StopDots />
          <RepairMapSize />
        </MapContainer>
        <div className="pc-system-map__readout" aria-hidden="true">
          <span>PHUKET · 07°53′N 98°23′E</span>
          <strong>FLIGHT → CURB → BUS → BEACH</strong>
        </div>
        <div className="pc-system-map__legend" aria-label="Map legend">
          <span><i className="is-airport" /> airport corridor</span>
          <span><i className="is-local" /> local bus</span>
          <span><i className="is-water" /> boat connection</span>
        </div>
      </div>
    </figure>
  );
}
