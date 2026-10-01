/**
 * Writes shared/lineGeometry.json — the official PKSB line polylines (one
 * direction each, ~1 point per 40 m) and every stop's distance along the
 * line. Server functions import this instead of the whole routes engine.
 * Rerun when src/data/upstream changes:  npx tsx scripts/build-line-geometry.ts
 */
import { writeFileSync } from "node:fs";
import { getDirectionPolyline, getStopsForRoute } from "../src/engine/routes";
import { haversineDistanceMeters } from "../src/engine/geo";

const LINES = [
  { routeId: "rawai-airport", name: "Airport ↔ Rawai", from: "Airport", to: "Rawai", firstStop: [8.108, 98.317], loop: false },
  { routeId: "patong-old-bus-station", name: "Old Town ↔ Patong", from: "Old Town", to: "Patong", firstStop: [7.884101493, 98.39575082], loop: false },
  { routeId: "dragon-line", name: "Dragon Line (Old Town loop)", from: "Old Town", to: "Old Town", firstStop: [7.885774, 98.39478], loop: true },
] as const;
const STEP_M = 40;

const out = LINES.map((line) => {
  const full = getDirectionPolyline(line.routeId, line.firstStop as unknown as [number, number]);
  const poly: [number, number][] = [full[0]!];
  let since = 0;
  for (let i = 1; i < full.length; i++) {
    since += haversineDistanceMeters(full[i - 1]!, full[i]!);
    if (since >= STEP_M || i === full.length - 1) { poly.push(full[i]!); since = 0; }
  }
  const cum = [0];
  for (let i = 1; i < poly.length; i++) cum.push(cum[i - 1]! + haversineDistanceMeters(poly[i - 1]!, poly[i]!));
  const along = (p: [number, number]) => {
    let best = Infinity, at = 0;
    poly.forEach((q, i) => { const d = haversineDistanceMeters(p, q); if (d < best) { best = d; at = cum[i]!; } });
    return { at, best };
  };
  const stops = getStopsForRoute(line.routeId).map((s) => {
    const a = along(s.coordinates as [number, number]);
    return { name: s.name.en, nameTh: s.name.th, lat: s.coordinates[0], lng: s.coordinates[1], alongM: Math.round(a.at), offM: Math.round(a.best) };
  }).filter((s) => s.offM <= 300).sort((a, b) => a.alongM - b.alongM)
    // Each stop exists once per side of the road; keep the first along the line.
    .filter((s, i, all) => all.findIndex((t) => t.name === s.name) === i);
  return {
    routeId: line.routeId, name: line.name, from: line.from, to: line.to, loop: line.loop,
    lengthM: Math.round(cum[cum.length - 1]!),
    poly: poly.map(([la, ln]) => [Math.round(la * 1e6) / 1e6, Math.round(ln * 1e6) / 1e6]),
    stops,
  };
});
writeFileSync("shared/lineGeometry.json", JSON.stringify(out));
for (const l of out) console.log(l.routeId, l.lengthM, "m,", l.poly.length, "pts,", l.stops.length, "stops:", l.stops.map((s) => s.name).join(" · ").slice(0, 300));
