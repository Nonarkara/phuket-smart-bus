// Generate dense ferry polylines between piers along realistic open-water paths.
// Each route is defined as a sequence of [lon, lat] waypoints; we then linearly
// interpolate between adjacent waypoints at ~500m density so vehicles don't
// "fly" diagonally across landmasses.
//
// Endpoints are taken from src/data/upstream/ferry_stops.json so the path
// terminates exactly at each pier coordinate (avoiding the "boats don't reach
// the other side" symptom).

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPSTREAM = join(__dirname, "..", "src", "data", "upstream");

// Haversine distance in km between [lon, lat] points
function distKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Linear interpolation in lon/lat space (good enough at this latitude/scale)
function densify(waypoints, stepKm = 0.5) {
  const out = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    const segKm = distKm(a, b);
    const steps = Math.max(2, Math.ceil(segKm / stepKm));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  // Always include exact final point
  out.push(waypoints[waypoints.length - 1]);
  // Round to 5 decimals (~1m precision) for compact JSON
  return out.map(([lon, lat]) => [
    Math.round(lon * 100000) / 100000,
    Math.round(lat * 100000) / 100000
  ]);
}

// Each ferry route: ordered waypoints from origin pier through open-water
// "via" points to destination pier. Via points were chosen by inspecting the
// Andaman Sea bathymetry around Phuket so the route stays in deep water.
const ROUTES = {
  rassada_phi_phi: {
    file: "rassada_phi_phi_line.json",
    waypoints: [
      [98.4013, 7.8557], // Rassada Pier
      [98.4350, 7.8420], // out of Rassada Bay (east)
      [98.4900, 7.8200], // SE into Andaman Sea
      [98.5600, 7.7950], // open water — south of Koh Maithon
      [98.6400, 7.7700], // approaching Phi Phi
      [98.7300, 7.7430], // approach to Phi Phi
      [98.7684, 7.7407]  // Phi Phi Tonsai Pier
    ]
  },
  rassada_ao_nang: {
    file: "rassada_ao_nang_line.json",
    waypoints: [
      [98.4013, 7.8557], // Rassada Pier
      [98.4400, 7.8500], // east out of Rassada Bay
      [98.5100, 7.8650], // ENE through Phang Nga Bay channel
      [98.6000, 7.9100], // NE clear of Koh Yao Yai
      [98.7000, 7.9500], // NE in open water
      [98.7700, 7.9900], // approach to Krabi coast
      [98.8180, 8.0437]  // Noppharat Thara Pier (Ao Nang)
    ]
  },
  bang_rong_koh_yao: {
    file: "bang_rong_koh_yao_line.json",
    waypoints: [
      [98.4186, 8.0133], // Bang Rong Pier
      [98.4500, 8.0250], // east out of Bang Rong inlet
      [98.5000, 8.0500], // ENE into Phang Nga Bay
      [98.5500, 8.0850], // NE through bay
      [98.6000, 8.1122]  // Koh Yao Noi Pier
    ]
  },
  chalong_racha: {
    file: "chalong_racha_line.json",
    waypoints: [
      [98.3613, 7.8281], // Chalong Pier
      [98.3580, 7.7900], // south out of Chalong Bay
      [98.3580, 7.7400], // straight south, open ocean
      [98.3600, 7.6800], // continuing south
      [98.3630, 7.6300], // approaching Racha
      [98.3647, 7.6061]  // Racha Yai Island
    ]
  }
};

let totalPoints = 0;
for (const [routeId, def] of Object.entries(ROUTES)) {
  const dense = densify(def.waypoints, 0.5);
  totalPoints += dense.length;
  const geo = {
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      properties: { route: routeId },
      geometry: {
        type: "LineString",
        coordinates: dense
      }
    }]
  };
  const outPath = join(UPSTREAM, def.file);
  writeFileSync(outPath, JSON.stringify(geo, null, 2) + "\n");
  console.log(`[ferry] ${routeId}: ${def.waypoints.length} waypoints → ${dense.length} dense points`);
}
console.log(`[ferry] total: ${totalPoints} points across 4 routes`);
