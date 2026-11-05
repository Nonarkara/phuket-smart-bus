/**
 * The preprint's figures, as SVG in POINTS: a figure drawn W wide renders at
 * exactly W pt in the PDF, so 6.5 in a figure is 6.5 pt on the page and the
 * figures share the paper's type. Recorded service is the PKSB livery red,
 * the published timetable is grey and dashed — the same two voices on every
 * figure, so a reader learns the code once.
 */
import { feature } from "topojson-client";
import land from "../../node_modules/world-atlas/land-10m.json" with { type: "json" };
import geometry from "../../shared/lineGeometry.json" with { type: "json" };
import { projectOnLine } from "../../shared/research";
import type { Results } from "./analysis";
import { PUBLISHED } from "./analysis";
import airportToRawai from "../../src/data/timetables/airport-to-rawai.json" with { type: "json" };
import rawaiToAirport from "../../src/data/timetables/rawai-to-airport.json" with { type: "json" };

export const COL_W = 239.5; // 84.5 mm
export const FULL_W = 498.9; // 176 mm

const INK = "#1a1a1a";
const MID = "#6b6b6b";
const RULE = "#c8c8c8";
const RED = "#a23a26";
const PUB = "#8a8a8a";
const FONT = "'Source Sans 3', 'IBM Plex Sans Thai', sans-serif";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const n2 = (v: number) => Math.round(v * 100) / 100;

function svg(w: number, h: number, body: string, label: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}pt" height="${h}pt" role="img" aria-label="${esc(label)}" font-family="${FONT}" font-size="6.5" fill="${INK}">${body}</svg>`;
}
const text = (x: number, y: number, s: string, attrs = "") => `<text x="${n2(x)}" y="${n2(y)}" ${attrs}>${esc(s)}</text>`;
const line = (x1: number, y1: number, x2: number, y2: number, attrs: string) => `<line x1="${n2(x1)}" y1="${n2(y1)}" x2="${n2(x2)}" y2="${n2(y2)}" ${attrs}/>`;
const hhmm = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(Math.round(min % 60)).padStart(2, "0")}`;

type Scale = (v: number) => number;
const linear = (d0: number, d1: number, r0: number, r1: number): Scale => (v) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);

/** Horizontal hairline grid + left axis labels. */
function yAxis(y: Scale, ticks: number[], x0: number, x1: number, fmt: (v: number) => string = String): string {
  return ticks.map((t) => line(x0, y(t), x1, y(t), `stroke="${RULE}" stroke-width="0.4"`) + text(x0 - 3, y(t) + 2.2, fmt(t), `text-anchor="end" fill="${MID}"`)).join("");
}
function xAxis(x: Scale, ticks: number[], y0: number, fmt: (v: number) => string = String): string {
  return ticks.map((t) => line(x(t), y0, x(t), y0 + 2.5, `stroke="${MID}" stroke-width="0.5"`) + text(x(t), y0 + 9, fmt(t), `text-anchor="middle" fill="${MID}"`)).join("") ;
}
const legendItem = (x: number, y: number, label: string, style: "rec" | "pub" | "box", fill = RED) => {
  const mark = style === "rec" ? line(x, y - 2, x + 10, y - 2, `stroke="${fill}" stroke-width="1.4"`)
    : style === "pub" ? line(x, y - 2, x + 10, y - 2, `stroke="${PUB}" stroke-width="0.9" stroke-dasharray="2.2 1.6"`)
    : `<rect x="${x}" y="${y - 5}" width="7" height="5" fill="${fill}"/>`;
  return mark + text(x + 13, y, label);
};

// ── Fig. 1 — study area ────────────────────────────────────────────────────
type LineGeo = { routeId: string; poly: number[][]; stops: { name: string; lat: number; lng: number; alongM: number }[]; lengthM: number; loop: boolean };
const LINES = geometry as unknown as LineGeo[];

export function figStudyArea(r: Results): string {
  const W = COL_W, H = 330;
  const bbox = { w: 98.215, e: 98.485, s: 7.745, n: 8.215 };
  const kx = Math.cos((7.98 * Math.PI) / 180);
  const sx = (W - 16) / ((bbox.e - bbox.w) * kx);
  const sy = (H - 16) / (bbox.n - bbox.s);
  const s = Math.min(sx, sy);
  const ox = (W - (bbox.e - bbox.w) * kx * s) / 2;
  const X = (lng: number) => ox + (lng - bbox.w) * kx * s;
  const Y = (lat: number) => 8 + (bbox.n - lat) * s;

  const topo = land as unknown as Parameters<typeof feature>[0];
  const f = feature(topo, (land as any).objects.land) as any;
  const geoms = f.features ? f.features.map((x: any) => x.geometry) : [f.geometry];
  let landPath = "";
  for (const g of geoms) {
    const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
    for (const poly of polys) for (const ring of poly) {
      if (!ring.some(([lng, lat]: number[]) => lng > bbox.w - 0.3 && lng < bbox.e + 0.3 && lat > bbox.s - 0.3 && lat < bbox.n + 0.3)) continue;
      landPath += "M" + ring.map(([lng, lat]: number[]) => `${n2(X(lng))},${n2(Y(lat))}`).join("L") + "Z";
    }
  }

  const maxN = Math.max(1, ...r.town.density.map((c) => c[2]));
  const cellPx = 0.0025 * s;
  const cells = r.town.density
    .filter(([lat, lng]) => lng > bbox.w && lng < bbox.e && lat > bbox.s && lat < bbox.n)
    .map(([lat, lng, n]) => `<rect x="${n2(X(lng) - cellPx / 2)}" y="${n2(Y(lat) - cellPx / 2)}" width="${n2(cellPx)}" height="${n2(cellPx)}" fill="${INK}" fill-opacity="${n2(0.18 + 0.62 * Math.log1p(n) / Math.log1p(maxN))}"/>`)
    .join("");

  const route = (id: string, attrs: string) => {
    const l = LINES.find((x) => x.routeId === id);
    return l ? `<path d="M${l.poly.map(([lat, lng]) => `${n2(X(lng!))},${n2(Y(lat!))}`).join("L")}" fill="none" ${attrs}/>` : "";
  };
  const place = (lat: number, lng: number, label: string, anchor = "start", dx = 4) =>
    `<circle cx="${n2(X(lng))}" cy="${n2(Y(lat))}" r="1.6" fill="${INK}"/>` + text(X(lng) + dx, Y(lat) + 2.2, label, `text-anchor="${anchor}" font-size="7"`);

  const km5 = 5 / (111.32 * kx) * kx * s; // 5 km in points along a parallel
  const body =
    `<defs><clipPath id="f1clip"><rect x="0" y="0" width="${W}" height="${H}"/></clipPath></defs>` +
    `<rect x="0" y="0" width="${W}" height="${H}" fill="#f4f4f1"/>` +
    `<g clip-path="url(#f1clip)"><path d="${landPath}" fill="#ffffff" stroke="${RULE}" stroke-width="0.6"/>` +
    cells +
    route("rawai-airport", `stroke="${RED}" stroke-width="1.6" stroke-linejoin="round"`) +
    route("patong-old-bus-station", `stroke="${RED}" stroke-width="0.9" stroke-dasharray="3 1.6"`) +
    route("dragon-line", `stroke="${RED}" stroke-width="1.2"`) +
    place(8.108, 98.3168, "HKT airport") +
    place(7.8961, 98.2966, "Patong", "end", -4) +
    place(7.8846, 98.3923, "Phuket Town") +
    place(7.7790, 98.3255, "Rawai", "end", -4) +
    `</g>` +
    line(10, H - 14, 10 + km5, H - 14, `stroke="${INK}" stroke-width="1"`) + text(10, H - 18, "5 km") +
    text(W - 10, 18, "N", `text-anchor="middle" font-weight="600" font-size="8"`) + line(W - 10, 21, W - 10, 32, `stroke="${INK}" stroke-width="0.8"`) +
    legendItem(W - 116, H - 30, "Airport–Rawai line", "rec") +
    legendItem(W - 116, H - 21, "Old Town–Patong line", "rec") +
    `<rect x="${W - 116}" y="${H - 17}" width="10" height="5" fill="${INK}" fill-opacity="0.5"/>` + text(W - 103, H - 12, "town buses, moving fixes");
  return svg(W, H, body, "Study area: the three PKSB lines and where the tracked town buses drove");
}

// ── Fig. 2 — Marey diagram ─────────────────────────────────────────────────
type MareyLine = { stops: { name: string; alongM: number }[]; lengthM: number; buses: { plate: string; points: [number, number][] }[] } | null;

export function figMarey(marey: { date: string | null; line: MareyLine }): string {
  const W = FULL_W, H = 250;
  const L = { l: 44, r: 8, t: 10, b: 24 };
  const x = linear(300, 1440, L.l, W - L.r);
  const lenKm = (marey.line?.lengthM ?? 54252) / 1000;
  const y = linear(0, lenKm, L.t, H - L.b);
  const airport = LINES.find((l) => l.routeId === "rawai-airport")!;
  const cum = [0];
  for (let i = 1; i < airport.poly.length; i++) {
    const a = airport.poly[i - 1]!, b = airport.poly[i]!;
    cum.push(cum[i - 1]! + Math.hypot((b[1]! - a[1]!) * 111_320 * Math.cos((a[0]! * Math.PI) / 180), (b[0]! - a[0]!) * 110_540));
  }
  const geo = { poly: airport.poly as [number, number][], cum };

  // Published runs: every timetabled stop time, placed at that stop's distance along the line.
  let pub = "";
  for (const dir of ["fwd", "rev"] as const) {
    const tt = dir === "fwd" ? "airport-to-rawai" : "rawai-to-airport";
    const file = PUBLISHED_RAW[tt];
    for (const dep of file.departures) {
      const pts: string[] = [];
      dep.times.forEach((t, i) => {
        if (!t) return;
        const stop = file.stops[i]!;
        const along = projectOnLine(geo, stop.lat, stop.lng).alongM / 1000;
        let m = Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
        if (m < 180) m += 1440;
        pts.push(`${n2(x(m))},${n2(y(along))}`);
      });
      if (pts.length > 1) pub += `<polyline points="${pts.join(" ")}" fill="none" stroke="${PUB}" stroke-width="0.6" stroke-dasharray="2.2 1.6"/>`;
    }
  }

  // Recorded traces, broken where the tracker went quiet for 15 min.
  let rec = "";
  for (const bus of marey.line?.buses ?? []) {
    let seg: string[] = [];
    let prev: [number, number] | null = null;
    const flush = () => { if (seg.length > 1) rec += `<polyline points="${seg.join(" ")}" fill="none" stroke="${RED}" stroke-width="0.9" stroke-linejoin="round"/>`; seg = []; };
    for (const p of bus.points) {
      if (prev && (p[0] - prev[0] > 15 || Math.abs(p[1] - prev[1]) > 8)) flush();
      if (p[0] >= 300 && p[0] <= 1440) seg.push(`${n2(x(p[0]))},${n2(y(p[1]))}`);
      prev = p;
    }
    flush();
  }

  const named = ["Phuket Airport", "Surin Beach", "Kamala", "Patong", "Karon", "Kata", "Rawai Beach"];
  const stops = (marey.line?.stops ?? airport.stops).filter((s) => named.some((n) => s.name.startsWith(n)));
  const seen = new Set<string>();
  const label = (k: string) => k.replace("Phuket ", "").replace(" Beach", "");
  const stopAxis = stops
    .map((s) => ({ s, k: named.find((n) => s.name.startsWith(n))! }))
    .filter(({ k }) => (seen.has(k) ? false : (seen.add(k), true)))
    .map(({ s, k }) => line(L.l, y(s.alongM / 1000), W - L.r, y(s.alongM / 1000), `stroke="${RULE}" stroke-width="0.35"`) + text(L.l - 3, y(s.alongM / 1000) + 2.2, label(k), `text-anchor="end" fill="${MID}"`))
    .join("");
  const hours = [360, 480, 600, 720, 840, 960, 1080, 1200, 1320, 1440];
  const body = stopAxis + pub + rec +
    line(L.l, H - L.b, W - L.r, H - L.b, `stroke="${MID}" stroke-width="0.5"`) + xAxis(x, hours, H - L.b, hhmm) +
    legendItem(W - 200, 8, "recorded bus (GPS)", "rec") + legendItem(W - 110, 8, "published timetable", "pub");
  return svg(W, H, body, `Marey diagram of the Airport–Rawai line on ${marey.date}`);
}

// Raw timetable files for the Marey's published runs (stop by stop).
type TT = { stops: { name: string; lat: number; lng: number }[]; departures: { times: (string | null)[] }[] };
const PUBLISHED_RAW: Record<string, TT> = { "airport-to-rawai": airportToRawai as TT, "rawai-to-airport": rawaiToAirport as TT };

// ── Fig. 3 — departures per day against the timetable ──────────────────────
export function figDailyDepartures(r: Results): string {
  const W = COL_W, H = 170;
  const L = { l: 22, r: 6, t: 14, b: 18 };
  const dates = [...new Set(r.airport.days.map((d) => d.date))].sort();
  const panelH = (H - L.t - L.b - 12) / 2;
  const x = (i: number) => L.l + (i + 0.5) * ((W - L.l - L.r) / dates.length);
  const bw = Math.max(1.2, ((W - L.l - L.r) / dates.length) * 0.7);
  const top = Math.max(22, ...r.airport.days.map((d) => d.recordedDepartures));
  let body = "";
  (["fwd", "rev"] as const).forEach((dir, k) => {
    const y0 = L.t + k * (panelH + 12);
    const y = linear(0, top, y0 + panelH, y0);
    body += text(L.l, y0 - 3, dir === "fwd" ? "Airport to Rawai" : "Rawai to Airport", `font-weight="600"`);
    body += yAxis(y, [0, 10, 20], L.l, W - L.r);
    dates.forEach((date, i) => {
      const d = r.airport.days.find((x) => x.date === date && x.dir === dir)!;
      const fill = d.busesOnLine === 0 ? "none" : RED;
      body += `<rect x="${n2(x(i) - bw / 2)}" y="${n2(y(d.recordedDepartures))}" width="${n2(bw)}" height="${n2(y(0) - y(d.recordedDepartures))}" fill="${fill}"/>`;
      if (d.busesOnLine === 0) body += text(x(i), y(0) - 2, "·", `text-anchor="middle" fill="${MID}"`);
    });
    const pubN = PUBLISHED[dir].trips.length;
    body += line(L.l, y(pubN), W - L.r, y(pubN), `stroke="${PUB}" stroke-width="0.9" stroke-dasharray="2.2 1.6"`);
  });
  const ticks = dates.map((d, i) => ({ d, i })).filter(({ d }) => d.endsWith("-01") || d.endsWith("-08") || d.endsWith("-15") || d.endsWith("-22"));
  body += ticks.map(({ d, i }) => text(x(i), H - 6, d.slice(5).replace("-", "/"), `text-anchor="middle" fill="${MID}"`)).join("");
  body += legendItem(W - 120, 8, "published", "pub") + legendItem(W - 62, 8, "recorded", "box");
  return svg(W, H, body, "Recorded terminal departures per day against the published timetable");
}

// ── Fig. 4 — running time, recorded against published ──────────────────────
export function figRunningTimes(r: Results, trips: { dir: string; minutes: number; routeId: string }[]): string {
  const W = COL_W, H = 130;
  const L = { l: 64, r: 8, t: 14, b: 22 };
  const all = trips.filter((t) => t.routeId === "rawai-airport" && t.dir !== "lap");
  const max = Math.max(200, ...all.map((t) => t.minutes));
  const x = linear(60, Math.ceil(max / 20) * 20, L.l, W - L.r);
  let body = "";
  let seed = 11;
  const jitter = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5);
  (["fwd", "rev"] as const).forEach((dir, k) => {
    const cy = L.t + 18 + k * 44;
    body += text(L.l - 4, cy + 2, dir === "fwd" ? "Airport to Rawai" : "Rawai to Airport", `text-anchor="end" font-weight="600"`);
    for (const t of all.filter((t) => t.dir === dir)) body += `<circle cx="${n2(x(t.minutes))}" cy="${n2(cy + jitter() * 18)}" r="1.1" fill="${RED}" fill-opacity="0.45"/>`;
    const rec = r.airport.running[dir].recorded;
    if (rec.p50 !== null) body += line(x(rec.p50), cy - 12, x(rec.p50), cy + 12, `stroke="${RED}" stroke-width="1.6"`);
    const pub = r.airport.running[dir].published;
    if (pub.min !== null && pub.max !== null) body += line(x(pub.min), cy + 15, x(pub.max), cy + 15, `stroke="${PUB}" stroke-width="0.9"`);
    if (pub.p50 !== null) body += line(x(pub.p50), cy - 12, x(pub.p50), cy + 15, `stroke="${PUB}" stroke-width="0.9" stroke-dasharray="2.2 1.6"`);
  });
  const ticks: number[] = [];
  for (let v = 60; v <= Math.ceil(max / 20) * 20; v += 20) ticks.push(v);
  body += line(L.l, H - L.b, W - L.r, H - L.b, `stroke="${MID}" stroke-width="0.5"`) + xAxis(x, ticks, H - L.b) + text((L.l + W - L.r) / 2, H - 3, "end-to-end minutes", `text-anchor="middle" fill="${MID}"`);
  body += legendItem(L.l, 8, "recorded median", "rec") + legendItem(L.l + 82, 8, "published median and range", "pub");
  return svg(W, H, body, "Recorded end-to-end running times against the published timetable");
}

// ── Fig. 5 — running time by hour of departure ─────────────────────────────
export function figRunningByHour(r: Results): string {
  const W = COL_W, H = 150;
  const L = { l: 22, r: 12, t: 16, b: 20 };
  const vals = r.airport.runningByHour.flatMap((h) => [h.p50 ?? 0, h.p85 ?? 0]);
  const top = Math.max(180, Math.ceil(Math.max(...vals, 0) / 20) * 20);
  const x = linear(5, 24, L.l, W - L.r);
  const panelW = W;
  const y = linear(80, top, H - L.b, L.t);
  let body = yAxis(y, [80, 120, 160, ...(top > 200 ? [200] : [])].filter((t) => t <= top), L.l, panelW - L.r);
  (["fwd", "rev"] as const).forEach((dir) => {
    const rows = r.airport.runningByHour.filter((h) => h.dir === dir && h.p50 !== null);
    const dash = dir === "rev" ? `stroke-dasharray="4 1.5"` : "";
    const path = (key: "p50" | "p85") => rows.map((h, i) => `${i ? "L" : "M"}${n2(x(h.hour + 0.5))},${n2(y(h[key]!))}`).join("");
    body += `<path d="${path("p85")}" fill="none" stroke="${RED}" stroke-opacity="0.4" stroke-width="0.9" ${dash}/>`;
    body += `<path d="${path("p50")}" fill="none" stroke="${RED}" stroke-width="1.4" ${dash}/>`;
    body += line(L.l, y(r.published[dir].endToEnd.p50 ?? 0), W - L.r, y(r.published[dir].endToEnd.p50 ?? 0), `stroke="${PUB}" stroke-width="0.8" stroke-dasharray="2.2 1.6"`);
  });
  body += line(L.l, H - L.b, W - L.r, H - L.b, `stroke="${MID}" stroke-width="0.5"`) + xAxis(x, [6, 9, 12, 15, 18, 21, 24], H - L.b, (h) => `${String(h % 24).padStart(2, "0")}:00`);
  body += text(L.l - 3, 9, "min", `text-anchor="end" fill="${MID}"`) +
    `<path d="M${W - 168},7 h10" stroke="${RED}" stroke-width="1.4"/>` + text(W - 155, 9, "to Rawai") +
    `<path d="M${W - 118},7 h10" stroke="${RED}" stroke-width="1.4" stroke-dasharray="4 1.5"/>` + text(W - 105, 9, "to Airport") +
    `<path d="M${W - 68},7 h10" stroke="${RED}" stroke-opacity="0.4" stroke-width="0.9"/>` + text(W - 55, 9, "85th pct.");
  return svg(W, H, body, "Median and 85th-percentile running time by hour of departure");
}

// ── Fig. 6 — departure deviation from the matched published time ───────────
export function figDeviation(deviations: Record<"fwd" | "rev", number[]>): string {
  const W = COL_W, H = 130;
  const L = { l: 22, r: 12, t: 16, b: 22 };
  const bins: number[] = [];
  for (let b = -30; b < 30; b += 2) bins.push(b);
  const counts = (dir: "fwd" | "rev") => bins.map((b) => deviations[dir].filter((d) => d >= b && d < b + 2).length);
  const cf = counts("fwd"), cr = counts("rev");
  const top = Math.max(4, ...cf.map((c, i) => c + cr[i]!));
  const x = linear(-30, 30, L.l, W - L.r);
  const y = linear(0, top, H - L.b, L.t);
  let body = `<rect x="${n2(x(-1))}" y="${L.t}" width="${n2(x(5) - x(-1))}" height="${n2(H - L.b - L.t)}" fill="#ece8e0"/>`;
  bins.forEach((b, i) => {
    const w = x(b + 2) - x(b) - 0.6;
    body += `<rect x="${n2(x(b) + 0.3)}" y="${n2(y(cf[i]!))}" width="${n2(w)}" height="${n2(y(0) - y(cf[i]!))}" fill="${RED}"/>`;
    body += `<rect x="${n2(x(b) + 0.3)}" y="${n2(y(cf[i]! + cr[i]!))}" width="${n2(w)}" height="${n2(y(cf[i]!) - y(cf[i]! + cr[i]!))}" fill="${RED}" fill-opacity="0.4"/>`;
  });
  body += line(L.l, H - L.b, W - L.r, H - L.b, `stroke="${MID}" stroke-width="0.5"`) + xAxis(x, [-30, -20, -10, 0, 10, 20, 30], H - L.b, (v) => (v > 0 ? `+${v}` : String(v)));
  body += text((L.l + W - L.r) / 2, H - 3, "minutes after the matched published departure", `text-anchor="middle" fill="${MID}"`);
  body += legendItem(L.l, 8, "to Rawai", "box") + legendItem(L.l + 46, 8, "to Airport", "box", "rgba(162,58,38,0.4)") + text(x(2), L.t - 2.5, "on time", `text-anchor="middle" fill="${MID}"`);
  return svg(W, H, body, "Recorded departure minus matched published departure");
}

// ── Fig. 7 — when the town fleet moves ─────────────────────────────────────
export function figTownActivity(r: Results): string {
  const W = COL_W, H = 120;
  const L = { l: 22, r: 12, t: 14, b: 20 };
  const act = r.town.activity;
  const top = Math.max(4, ...act.map((a) => a.max));
  const x = linear(0, 96, L.l, W - L.r);
  const y = linear(0, top, H - L.b, L.t);
  const area = (key: "median" | "max") => `M${n2(x(0))},${n2(y(0))}` + act.map((a) => `L${n2(x(a.bin))},${n2(y(a[key]))}L${n2(x(a.bin + 1))},${n2(y(a[key]))}`).join("") + `L${n2(x(96))},${n2(y(0))}Z`;
  const ticks = [0, Math.round(top / 2), top];
  const body = yAxis(y, ticks, L.l, W - L.r) +
    `<path d="${area("max")}" fill="${RED}" fill-opacity="0.18"/>` + `<path d="${area("median")}" fill="${RED}"/>` +
    line(L.l, H - L.b, W - L.r, H - L.b, `stroke="${MID}" stroke-width="0.5"`) + xAxis((b) => x(b * 4), [0, 6, 12, 18, 24], H - L.b, (h) => `${String(h).padStart(2, "0")}:00`) +
    legendItem(L.l, 8, "median day", "box") + legendItem(L.l + 52, 8, "busiest day", "box", "rgba(162,58,38,0.18)") + text(W - L.r, 8, "town buses moving", `text-anchor="end" fill="${MID}"`);
  return svg(W, H, body, "Town buses moving, by quarter-hour");
}
