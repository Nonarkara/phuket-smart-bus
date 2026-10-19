/**
 * Schedule research from raw fixes: where each bus was along its line, minute
 * by minute, and every terminal-to-terminal trip it completed, with the time it
 * passed each stop. Pure — the caller reads D1 (`fixes`) and passes rows in.
 *
 * Rules (each one a knob, each one stated on the /research page):
 *   line        the token feed's line if it ever names one; else the line whose
 *               road ≥60% of the bus's moving fixes sit on (≤250 m); else none —
 *               a town bus, listed, not forced onto a line.
 *   on the line a fix ≤250 m from the polyline. Off-line fixes are left out of
 *               the time–distance trace, never snapped onto it.
 *   trip        leaving one terminal zone (≤1 km of the terminal stop — the
 *               line's end, or where its buses really wait, see TERMINAL_STOPS)
 *               and reaching the other. A bus may leave the drawn line on the
 *               way (detours, the other carriageway); the trip only breaks if
 *               the tracker goes silent >15 min or the bus physically jumps.
 *               Departure = last fix in the origin zone; arrival = first fix in
 *               the other.
 *   lap         (loop lines) the trace wrapping round, either direction; a lap
 *               with a 15-min+ stand is a layover, not a lap.
 *   jump        consecutive fixes farther apart on the ground than 120 km/h
 *               allows; a trip averaging outside 3–70 km/h is dropped.
 *   stop time   linear interpolation between the two fixes that bracket the
 *               stop, only when they are ≤5 min apart; else null.
 */
import geometry from "./lineGeometry.json" with { type: "json" };

export type ResearchFix = {
  plate: string;
  fixMs: number;
  lat: number;
  lng: number;
  speedKph: number | null;
  routeId: string | null;
  feed: string;
};

type Geometry = (typeof geometry)[number];
type Line = Geometry & { cum: number[] };

export const ON_LINE_M = 250;
const LINE_SHARE = 0.6;
const MIN_LINE_FIXES = 20;
const END_ZONE_M = 1000;
const MAX_TRIP_GAP_MS = 15 * 60_000;
const MAX_STOP_GAP_MS = 5 * 60_000;
const MOVING_KPH = 5;
/** Consecutive fixes farther apart on the ground than this speed allows are a GPS jump: the trip breaks there. */
const MAX_STEP_KPH = 120;
/** Terminal-to-terminal averages outside this are not a bus trip. */
const TRIP_KPH: [number, number] = [3, 70];
/** A service day runs 03:00 → 03:00 Bangkok, so a 00:30 last arrival stays with its day. */
export const SERVICE_DAY_START_H = 3;

const LINES: Line[] = (geometry as Geometry[]).map((g) => {
  const cum = [0];
  for (let i = 1; i < g.poly.length; i++) cum.push(cum[i - 1]! + segMeters(g.poly[i - 1]!, g.poly[i]!));
  return { ...g, cum };
});

function segMeters(a: number[], b: number[]): number {
  const kx = 111_320 * Math.cos((a[0]! * Math.PI) / 180);
  return Math.hypot((b[1]! - a[1]!) * kx, (b[0]! - a[0]!) * 110_540);
}

/** Distance along the line of the nearest point on it, and how far off the line the fix is. */
export function projectOnLine(line: Pick<Line, "poly" | "cum">, lat: number, lng: number): { alongM: number; offM: number } {
  const kx = 111_320 * Math.cos((lat * Math.PI) / 180);
  const ky = 110_540;
  let best = Infinity;
  let along = 0;
  for (let i = 1; i < line.poly.length; i++) {
    const ax = (line.poly[i - 1]![1]! - lng) * kx, ay = (line.poly[i - 1]![0]! - lat) * ky;
    const bx = (line.poly[i]![1]! - lng) * kx, by = (line.poly[i]![0]! - lat) * ky;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
    const d = Math.hypot(ax + t * dx, ay + t * dy);
    if (d < best) { best = d; along = line.cum[i - 1]! + t * Math.sqrt(len2); }
  }
  return { alongM: along, offM: best };
}

/** [start, end) epoch ms of a Bangkok service day. */
export function serviceDayWindow(date: string): [number, number] | null {
  const start = Date.parse(`${date}T${String(SERVICE_DAY_START_H).padStart(2, "0")}:00:00+07:00`);
  return Number.isFinite(start) ? [start, start + 86_400_000] : null;
}

/** Minutes since Bangkok midnight of the service day (past midnight runs on: 24.5 h = 00:30). */
function dayMinute(ms: number, dayStartMs: number): number {
  const midnight = dayStartMs - SERVICE_DAY_START_H * 3_600_000;
  return Math.round(((ms - midnight) / 60_000) * 10) / 10;
}

function pickLine(fixes: ResearchFix[]): Line | null {
  const named = new Map<string, number>();
  for (const f of fixes) if (f.routeId) named.set(f.routeId, (named.get(f.routeId) ?? 0) + 1);
  const top = [...named.entries()].sort((a, b) => b[1] - a[1])[0];
  if (top) return LINES.find((l) => l.routeId === top[0]) ?? null;

  const moving = fixes.filter((f) => (f.speedKph ?? 0) > MOVING_KPH);
  if (moving.length < MIN_LINE_FIXES) return null;
  let best: Line | null = null;
  let bestShare = 0;
  for (const line of LINES) {
    const on = moving.filter((f) => projectOnLine(line, f.lat, f.lng).offM <= ON_LINE_M).length;
    if (on / moving.length > bestShare) { bestShare = on / moving.length; best = line; }
  }
  return bestShare >= LINE_SHARE ? best : null;
}

export type Trip = {
  plate: string;
  /** "fwd" = line.from → line.to; "rev" the other way; "lap" on a loop. */
  dir: "fwd" | "rev" | "lap";
  departMs: number;
  arriveMs: number;
  minutes: number;
  avgKph: number;
  /** Minute of the service day the bus passed each stop (line order), null if not bracketed. */
  stopMin: (number | null)[];
};

/** One fix the bus sent. `along` is null while it is off the drawn line (a detour, the other carriageway). */
type Pt = { ms: number; lat: number; lng: number; along: number | null };
type OnPt = Pt & { along: number };

function crossingMs(a: OnPt, b: OnPt, at: number): number | null {
  if (b.ms - a.ms > MAX_STOP_GAP_MS || a.along === b.along) return null;
  const t = (at - a.along) / (b.along - a.along);
  return t >= 0 && t <= 1 ? a.ms + t * (b.ms - a.ms) : null;
}

function physicalKm(a: Pt, b: Pt): number {
  const kx = 111.32 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot((b.lng - a.lng) * kx, (b.lat - a.lat) * 110.54);
}

/**
 * No trip continues across this step: the tracker went silent, or the bus
 * physically jumped. Measured on the ground, not along the drawn line — the
 * official polylines take detours the buses skip (Patong) and follow one
 * carriageway only (Airport line), so along-line distance can leap legitimately.
 */
function broken(a: Pt, b: Pt): boolean {
  const dt = b.ms - a.ms;
  return dt > MAX_TRIP_GAP_MS || (dt > 0 && physicalKm(a, b) / (dt / 3_600_000) > MAX_STEP_KPH);
}

/** Longest spell, in ms, the bus stood within 50 m of one spot. */
function longestStillMs(seg: Pt[]): number {
  let best = 0, from = 0;
  for (let i = 1; i < seg.length; i++) {
    while (physicalKm(seg[from]!, seg[i]!) > 0.05) from++;
    best = Math.max(best, seg[i]!.ms - seg[from]!.ms);
  }
  return best;
}
const MAX_LAP_STILL_MS = 15 * 60_000;

/**
 * Where buses actually turn round, when it isn't the end of the polyline.
 * Verified 2026-10-04: Patong-line buses wait at Phuket Bus Terminal 1,
 * 1.44 km along the line, so a zone at the polyline's start never held them.
 */
const TERMINAL_STOPS: Record<string, [string, string]> = {
  "patong-old-bus-station": ["Phuket Bus Terminal 1", "Patong"],
};

function terminalAlong(line: Line): [number, number] {
  const names = TERMINAL_STOPS[line.routeId];
  const at = (name: string | undefined, fallback: number) => line.stops.find((s) => s.name === name)?.alongM ?? fallback;
  return [at(names?.[0], 0), at(names?.[1], line.lengthM)];
}

function tripsFor(plate: string, line: Line, pts: Pt[], dayStartMs: number): Trip[] {
  const trips: Trip[] = [];
  const L = line.lengthM;
  const make = (dir: Trip["dir"], seg: Pt[]): Trip => {
    const on = seg.filter((p): p is OnPt => p.along !== null);
    // Speed over the ground the bus actually drove, not the drawn line (which may detour). Jitter under 15 m ignored.
    let dist = 0;
    for (let i = 1; i < seg.length; i++) { const d = physicalKm(seg[i - 1]!, seg[i]!); if (d >= 0.015) dist += d * 1000; }
    const departMs = seg[0]!.ms, arriveMs = seg[seg.length - 1]!.ms;
    const stopMin = line.stops.map((s) => {
      for (let i = 1; i < on.length; i++) {
        const lo = Math.min(on[i - 1]!.along, on[i]!.along), hi = Math.max(on[i - 1]!.along, on[i]!.along);
        if (s.alongM >= lo && s.alongM <= hi) {
          const ms = crossingMs(on[i - 1]!, on[i]!, s.alongM);
          return ms === null ? null : dayMinute(ms, dayStartMs);
        }
      }
      return null;
    });
    const minutes = (arriveMs - departMs) / 60_000;
    return { plate, dir, departMs, arriveMs, minutes: Math.round(minutes * 10) / 10, avgKph: minutes > 0 ? Math.round((dist / 1000 / (minutes / 60)) * 10) / 10 : 0, stopMin };
  };
  const plausible = (t: Trip) => t.avgKph >= TRIP_KPH[0] && t.avgKph <= TRIP_KPH[1];

  if (line.loop) {
    let lapStart = -1;
    let prevOn: OnPt | null = null;
    for (let i = 0; i < pts.length; i++) {
      if (i > 0 && broken(pts[i - 1]!, pts[i]!)) { lapStart = -1; prevOn = null; }
      const p = pts[i]!;
      if (p.along === null) continue;
      // Buses may run the loop either way round (Dragon runs it backwards): a wrap is either crossing.
      if (prevOn) {
        const [a, b] = [prevOn.along, p.along];
        if ((a > 0.8 * L && b < 0.2 * L) || (a < 0.2 * L && b > 0.8 * L)) {
          if (lapStart >= 0) {
            const seg = pts.slice(lapStart, i);
            if (longestStillMs(seg) < MAX_LAP_STILL_MS) trips.push(make("lap", seg)); // parked mid-loop: not a lap
          }
          lapStart = i;
        }
      }
      prevOn = p as OnPt;
    }
    return trips.filter(plausible);
  }

  const [fromM, toM] = terminalAlong(line);
  let zone: "from" | "to" | null = null;
  let leftAt = -1; // index of the last fix in the origin zone
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    if (i > 0 && broken(pts[i - 1]!, p)) { zone = null; leftAt = -1; }
    if (p.along === null) continue; // off the drawn line: the trip carries on
    const here = Math.abs(p.along - fromM) <= END_ZONE_M ? "from" : Math.abs(p.along - toM) <= END_ZONE_M ? "to" : null;
    if (here === null) continue;
    if (zone !== null && here !== zone && leftAt >= 0) {
      trips.push(make(zone === "from" ? "fwd" : "rev", pts.slice(leftAt, i + 1)));
    }
    zone = here;
    leftAt = i;
  }
  return trips.filter(plausible);
}

export type LineDay = {
  routeId: string;
  name: string;
  from: string;
  to: string;
  loop: boolean;
  lengthM: number;
  stops: { name: string; nameTh: string; alongM: number }[];
  /** Per bus: [minute of service day, km along the line] for each on-line fix. */
  buses: { plate: string; feed: string; points: [number, number][] }[];
  trips: Trip[];
};

export type ResearchDay = {
  date: string;
  fixes: number;
  lines: LineDay[];
  /** Buses on no PKSB line (the town fleet): reported, never forced onto one. */
  unassigned: { plate: string; feed: string; fixes: number; movingFixes: number }[];
};

export function analyzeDay(date: string, rows: ResearchFix[]): ResearchDay {
  const window = serviceDayWindow(date);
  const dayStartMs = window?.[0] ?? 0;
  const byPlate = new Map<string, ResearchFix[]>();
  for (const r of rows) {
    const list = byPlate.get(r.plate) ?? [];
    list.push(r);
    byPlate.set(r.plate, list);
  }

  const lines = new Map<string, LineDay>(LINES.map((l) => [l.routeId, {
    routeId: l.routeId, name: l.name, from: l.from, to: l.to, loop: l.loop, lengthM: l.lengthM,
    stops: l.stops.map((s) => ({ name: s.name, nameTh: s.nameTh, alongM: s.alongM })),
    buses: [], trips: [],
  }]));
  const unassigned: ResearchDay["unassigned"] = [];

  for (const [plate, list] of byPlate) {
    list.sort((a, b) => a.fixMs - b.fixMs);
    const line = pickLine(list);
    const feed = list[0]!.feed;
    if (!line) {
      unassigned.push({ plate, feed, fixes: list.length, movingFixes: list.filter((f) => (f.speedKph ?? 0) > MOVING_KPH).length });
      continue;
    }
    const pts: Pt[] = list.map((f) => {
      const p = projectOnLine(line, f.lat, f.lng);
      return { ms: f.fixMs, lat: f.lat, lng: f.lng, along: p.offM <= ON_LINE_M ? p.alongM : null };
    });
    const day = lines.get(line.routeId)!;
    day.buses.push({ plate, feed, points: pts.filter((p): p is OnPt => p.along !== null).map((p) => [dayMinute(p.ms, dayStartMs), Math.round(p.along / 10) / 100]) });
    day.trips.push(...tripsFor(plate, line, pts, dayStartMs));
  }

  for (const day of lines.values()) {
    day.buses.sort((a, b) => a.plate.localeCompare(b.plate));
    day.trips.sort((a, b) => a.departMs - b.departMs);
  }
  return { date, fixes: rows.length, lines: [...lines.values()], unassigned: unassigned.sort((a, b) => a.plate.localeCompare(b.plate)) };
}
