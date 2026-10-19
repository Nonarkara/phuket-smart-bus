/**
 * Where the real buses are, for a rider: every line, the rider's stop, and
 * every bus that reported in the last 15 minutes. Buses on the rider's line
 * are drawn in ink with their heading; the rest are grey.
 */
import { useEffect, useRef } from "react";
import L from "leaflet";
import type { LiveBus } from "@shared/pksbFeed";
import { LINES, stateOf, type Line } from "../v2/fleetRows";
import type { Stop } from "./arrivals";

export function RiderMap({ buses, onLine, line, stop, now }: {
  buses: readonly LiveBus[];
  /** Plates placed on the rider's line. */
  onLine: ReadonlySet<string>;
  line: Line;
  stop: Stop;
  now: number;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const routes = useRef<Map<string, L.Polyline>>(new Map());
  const stopMarker = useRef<L.Marker | null>(null);
  const busLayer = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { center: [7.93, 98.33], zoom: 11, minZoom: 9, maxZoom: 18, zoomSnap: 0.25, worldCopyJump: false });
    // Same tile layer as the operations wall, and the same `v2-basemap-tile`
    // class — without it the phone rendered raw light OpenStreetMap while
    // /ops rendered the dark treatment. The rider looked like a different
    // product on the screen where the product is actually used.
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors", maxZoom: 19, className: "v2-basemap-tile",
    }).addTo(m);
    for (const l of LINES) {
      routes.current.set(l.routeId, L.polyline(l.poly.map((p) => [p[0]!, p[1]!] as [number, number]), { color: "#8a9198", weight: 3, opacity: 0.55, interactive: false }).addTo(m));
    }
    busLayer.current = L.layerGroup().addTo(m);
    map.current = m;
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(el.current);
    return () => { ro.disconnect(); m.remove(); map.current = null; routes.current.clear(); stopMarker.current = null; };
  }, []);

  // The rider's line and stop: highlight, and frame line + stop.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    for (const [id, pl] of routes.current) {
      const mine = id === line.routeId;
      pl.setStyle(mine ? { color: "#111820", weight: 5, opacity: 1 } : { color: "#8a9198", weight: 3, opacity: 0.55 });
      if (mine) pl.bringToFront();
    }
    stopMarker.current?.remove();
    stopMarker.current = L.marker([stop.lat, stop.lng], {
      keyboard: false, zIndexOffset: 2000,
      icon: L.divIcon({ className: "pa-map__stop", html: `<span></span>`, iconSize: [0, 0] }),
    }).bindTooltip(stop.name, { permanent: true, direction: "top", offset: [0, -12], className: "pa-map__tip" }).addTo(m);
    m.invalidateSize();
    // The stop's name tooltip is anchored above the pin (-12px), so equal
    // padding clipped it against the top edge — "Phuket Airport" rendered
    // with its head cut off. The top needs room for the label, the sides
    // and bottom do not.
    m.fitBounds(routes.current.get(line.routeId)!.getBounds().extend([stop.lat, stop.lng]), {
      paddingTopLeft: [30, 64],
      paddingBottomRight: [30, 30],
    });
  }, [line, stop]);

  useEffect(() => {
    const g = busLayer.current;
    if (!g) return;
    g.clearLayers();
    for (const b of buses) {
      const s = stateOf(b, now);
      if (s === "quiet" || s === "off") continue;
      const mine = onLine.has(b.plate);
      const html = s === "driving"
        ? `<span class="pa-map__arrow" style="transform:rotate(${Math.round(b.heading)}deg)"></span>`
        : `<span class="pa-map__dot"></span>`;
      L.marker([b.lat, b.lng], {
        keyboard: false, zIndexOffset: mine ? 1000 : 0,
        icon: L.divIcon({ className: `pa-map__bus${mine ? " is-mine" : ""}${s === "late" ? " is-late" : ""}`, html, iconSize: [0, 0] }),
      }).bindTooltip(`${b.plate}${s === "late" ? " · late signal" : s === "standing" ? " · standing" : ""}`, { direction: "top", offset: [0, -10] }).addTo(g);
    }
  }, [buses, onLine, now]);

  return <div ref={el} className="pa-map" role="application" aria-label="Map of the buses reporting now" />;
}
