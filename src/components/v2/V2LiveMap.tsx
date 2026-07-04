import React, { useEffect, useImperativeHandle, useRef, forwardRef } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Polyline, useMap } from "react-leaflet";
import type { LatLngTuple } from "@shared/types";
import { getDirectionPolyline } from "../../engine/routes";
import type { SimState } from "../../engine/simulation";

/** Imperative handle: the parent's per-frame rAF loop calls syncNow() with the
 *  vehicles it sampled for THIS frame's minute. No prop-driven tweening — the
 *  engine already snaps every bus to the road polyline, so painting each
 *  frame's exact position traces the road at any speed with zero interpolation. */
export type V2MapHandle = { syncNow: (vehicles: SimState["vehicles"]) => void };

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
// No interpolation: the parent samples the continuous clock every frame and
// each vehicle position is already road-snapped by the engine (posOnPolyline),
// so setLatLng() straight to it traces the road smoothly at ANY speed — the
// old 950ms glide + 500m snap guard were what teleported buses (and cut
// corners across water) at high speed. Gone.
// ---------------------------------------------------------------------------
const VehicleLayer = forwardRef<V2MapHandle>(function VehicleLayer(_props, ref) {
  const map = useMap();
  const markers = useRef<Map<string, L.Marker>>(new Map());

  useImperativeHandle(ref, () => ({
    syncNow(vehicles) {
      // Remove markers for vehicles no longer in service this frame.
      const seen = new Set(vehicles.map((v) => v.id));
      for (const [key, marker] of markers.current) {
        if (!seen.has(key)) {
          map.removeLayer(marker);
          markers.current.delete(key);
        }
      }
      // Ensure + move every current vehicle to its exact road position.
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
  }), [map]);

  useEffect(() => () => {
    markers.current.forEach((marker) => map.removeLayer(marker));
    markers.current.clear();
  }, [map]);

  return null;
});

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
// Memoized with empty props so 4Hz parent re-renders never rebuild the map;
// the marker layer is driven imperatively through the forwarded handle.
export const V2LiveMap = React.memo(forwardRef<V2MapHandle>(function V2LiveMap(_props, ref) {
  return (
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
      <RoutePolylines />
      <VehicleLayer ref={ref} />
      <SyncMapView />
    </MapContainer>
  );
}));
