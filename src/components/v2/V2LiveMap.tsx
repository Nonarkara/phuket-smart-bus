import React, { useEffect, useRef } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Polyline, useMap } from "react-leaflet";
import type { LatLngTuple } from "@shared/types";
import { getDirectionPolyline } from "../../engine/routes";
import { interpolateCoordinate, interpolateHeading } from "../../lib/vehicleAnimation";
import { haversineDistanceMeters } from "../../lib/geo";
import type { SimState } from "../../engine/simulation";

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

const V2_MARKER_GLIDE_MS = 950;

function interpolateBusVehicle(
  from: SimState["vehicles"][number],
  to: SimState["vehicles"][number],
  progress: number
) {
  const dist = haversineDistanceMeters([from.lat, from.lng], [to.lat, to.lng]);
  if (dist > 500) {
    return to;
  }

  const [lat, lng] = interpolateCoordinate([from.lat, from.lng], [to.lat, to.lng], progress);

  return {
    ...to,
    lat,
    lng,
    heading: interpolateHeading(from.heading, to.heading, progress),
  };
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
// Vehicle Layer — imperative Leaflet markers
// ---------------------------------------------------------------------------
function VehicleLayer({ vehicles }: { vehicles: SimState["vehicles"] }) {
  const map = useMap();
  const markers = useRef<Map<string, L.Marker>>(new Map());
  const renderedVehicles = useRef<Map<string, SimState["vehicles"][number]>>(new Map());
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const ensureMarker = (vehicle: SimState["vehicles"][number]) => {
      const existing = markers.current.get(vehicle.id);
      if (existing) return existing;

      const marker = L.marker([vehicle.lat, vehicle.lng], { icon: buildBusMarkerIcon(vehicle) }).addTo(map);
      marker.bindTooltip(`${vehicle.plate} · ${vehicle.pax}/25 pax · ${vehicle.route}`, { direction: "top" });
      markers.current.set(vehicle.id, marker);
      return marker;
    };

    const applyFrame = (frameVehicles: SimState["vehicles"]) => {
      const nextRendered = new Map<string, SimState["vehicles"][number]>();

      for (const vehicle of frameVehicles) {
        const marker = ensureMarker(vehicle);
        syncBusMarker(marker, vehicle);
        nextRendered.set(vehicle.id, vehicle);
      }

      renderedVehicles.current = nextRendered;
    };

    const seen = new Set(vehicles.map((vehicle) => vehicle.id));
    for (const [key, marker] of markers.current) {
      if (!seen.has(key)) {
        map.removeLayer(marker);
        markers.current.delete(key);
      }
    }

    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    const previous = renderedVehicles.current;
    const frameDuration = previous.size > 0 ? V2_MARKER_GLIDE_MS : 0;
    if (frameDuration === 0) {
      applyFrame(vehicles);
      return;
    }

    const startedAt = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / frameDuration);
      const frame = vehicles.map((vehicle) => {
        const current = previous.get(vehicle.id);
        return current ? interpolateBusVehicle(current, vehicle, progress) : vehicle;
      });

      applyFrame(frame);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(step);
      } else {
        animationRef.current = null;
      }
    };

    animationRef.current = requestAnimationFrame(step);
  }, [map, vehicles]);

  useEffect(() => () => {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
    }
    markers.current.forEach((marker) => map.removeLayer(marker));
    markers.current.clear();
    renderedVehicles.current.clear();
  }, [map]);

  return null;
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

// ---------------------------------------------------------------------------
// Sync Map View
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// V2LiveMap (Memoized)
// ---------------------------------------------------------------------------
interface V2LiveMapProps {
  vehicles: SimState["vehicles"];
}

export const V2LiveMap = React.memo(function V2LiveMap({ vehicles }: V2LiveMapProps) {
  return (
    <MapContainer
      center={[7.88, 98.37]}
      zoom={11}
      className="v2-map__canvas"
      zoomControl={false}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution="&copy; OSM"
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />
      <RoutePolylines />
      <VehicleLayer vehicles={vehicles} />
      <SyncMapView />
    </MapContainer>
  );
});
