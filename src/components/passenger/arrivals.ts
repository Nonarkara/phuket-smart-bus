/**
 * When will a real bus reach my stop? — pure, from the live tracker plus the
 * trips the research record has already measured.
 *
 *   minutes = road metres still to drive ÷ the pace this line actually ran
 *
 * Pace is the median of recorded end-to-end trips (minutes per km) for the
 * line, direction and hour of day — measured, not the timetable. With no
 * recorded trips there is no pace, and the rider sees the distance only:
 * a minute figure we cannot back is not shown.
 *
 * ponytail: straight-line pace along the route; ignores dwell at stops and a
 * bus that will turn at the terminal and come back. Upgrade path: per-stop
 * medians from `Trip.stopMin`, and add the turnaround leg.
 */
import type { LiveBus } from "@shared/pksbFeed";
import type { SlimDay } from "@shared/insights";
import { quantile } from "@shared/insights";
import { projectOnLine } from "@shared/research";
import { LINES, ON_LINE_M, stateOf, type Line, type State } from "../v2/fleetRows";

export type Dir = "fwd" | "rev";
export type Stop = Line["stops"][number];
export type StopRef = { routeId: string; index: number };

/** A bus this close to the stop is "at the stop now". */
export const AT_STOP_M = 150;
/** Along-line movement between two polls that counts as a direction. */
export const MOVE_M = 40;

const bkkHour = (ms: number) => Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", hour12: false }).format(new Date(ms))) % 24;

// ── pace from recorded trips ───────────────────────────────────────────────
export type Pace = Map<string, number>; // key → median minutes per km

export function buildPace(days: SlimDay[]): Pace {
  const buckets = new Map<string, number[]>();
  const push = (k: string, v: number) => { const b = buckets.get(k); if (b) b.push(v); else buckets.set(k, [v]); };
  for (const day of days) {
    for (const l of day.lines) {
      const line = LINES.find((x) => x.routeId === l.routeId);
      if (!line) continue;
      for (const t of l.trips) {
        if (!(t.minutes > 0)) continue;
        const perKm = t.minutes / (line.lengthM / 1000);
        push(`${l.routeId}|${t.dir}|${bkkHour(t.departMs)}`, perKm);
        push(`${l.routeId}|${t.dir}`, perKm);
        push(l.routeId, perKm);
      }
    }
  }
  const pace: Pace = new Map();
  // An hour needs 3 trips before its own median is trusted, like /research.
  for (const [k, v] of buckets) if (k.split("|").length < 3 || v.length >= 3) pace.set(k, quantile(v, 0.5)!);
  return pace;
}

export function minPerKm(pace: Pace, routeId: string, dir: Dir, hour: number): number | null {
  const d = LINES.find((l) => l.routeId === routeId)?.loop ? "lap" : dir;
  return pace.get(`${routeId}|${d}|${hour}`) ?? pace.get(`${routeId}|${d}`) ?? pace.get(routeId) ?? null;
}

// ── which way a bus is going ───────────────────────────────────────────────
/** Tracker text first, then movement since the last poll, then the last terminal it left. */
export function directionOf(bus: LiveBus, line: Line, alongM: number, prevAlongM: number | undefined, lastTerminal: string | null | undefined): Dir | null {
  const dest = (bus.destination || "").toLowerCase();
  if (!line.loop && dest) {
    if (dest.includes(line.to.toLowerCase())) return "fwd";
    if (dest.includes(line.from.toLowerCase())) return "rev";
  }
  if (prevAlongM !== undefined) {
    let d = alongM - prevAlongM;
    if (line.loop && Math.abs(d) > line.lengthM / 2) d -= Math.sign(d) * line.lengthM; // wrapped the loop
    if (d > MOVE_M) return "fwd";
    if (d < -MOVE_M) return "rev";
  }
  if (!line.loop && lastTerminal) {
    if (lastTerminal === line.from) return "fwd";
    if (lastTerminal === line.to) return "rev";
  }
  return null;
}

// ── arrivals ───────────────────────────────────────────────────────────────
export type Arrival = {
  plate: string;
  dir: Dir;
  /** Road metres between the bus and the stop. */
  awayM: number;
  /** Null when no trip on this line has been recorded yet. */
  etaMin: number | null;
  state: State;
  fixMs: number;
};

export type BusOnLine = { bus: LiveBus; line: Line; alongM: number; dir: Dir | null };

/** Every bus reporting in the last 15 min that sits on a line (within ON_LINE_M of it). */
export function placeBuses(
  buses: readonly LiveBus[],
  nowMs: number,
  routeOf: (b: LiveBus) => string | null,
  prevAlong: ReadonlyMap<string, number>,
  lastTerminalOf: (plate: string) => string | null | undefined,
): BusOnLine[] {
  const out: BusOnLine[] = [];
  for (const bus of buses) {
    const state = stateOf(bus, nowMs);
    if (state === "quiet" || state === "off") continue;
    const line = LINES.find((l) => l.routeId === routeOf(bus));
    if (!line) continue;
    const p = projectOnLine(line, bus.lat, bus.lng);
    if (p.offM > ON_LINE_M) continue;
    out.push({ bus, line, alongM: p.alongM, dir: directionOf(bus, line, p.alongM, prevAlong.get(bus.plate), lastTerminalOf(bus.plate)) });
  }
  return out;
}

export function arrivalsAt(placed: BusOnLine[], ref: StopRef, pace: Pace, nowMs: number): Record<Dir, Arrival[]> {
  const line = LINES.find((l) => l.routeId === ref.routeId);
  const out: Record<Dir, Arrival[]> = { fwd: [], rev: [] };
  const stop = line?.stops[ref.index];
  if (!line || !stop) return out;
  const hour = bkkHour(nowMs);
  for (const p of placed) {
    if (p.line.routeId !== line.routeId || !p.dir) continue;
    let away = p.dir === "fwd" ? stop.alongM - p.alongM : p.alongM - stop.alongM;
    if (line.loop) away = ((away % line.lengthM) + line.lengthM) % line.lengthM;
    if (away < -AT_STOP_M) continue; // already past the stop
    away = Math.max(0, away);
    const perKm = minPerKm(pace, line.routeId, p.dir, hour);
    out[p.dir].push({
      plate: p.bus.plate,
      dir: p.dir,
      awayM: away,
      etaMin: away <= AT_STOP_M ? 0 : perKm === null ? null : (away / 1000) * perKm,
      state: stateOf(p.bus, nowMs),
      fixMs: Date.parse(p.bus.updatedAt),
    });
  }
  for (const d of ["fwd", "rev"] as const) out[d].sort((a, b) => a.awayM - b.awayM);
  return out;
}

/** "Toward Rawai" / "Toward Airport"; the loop has one direction word per way round. */
export function towardLabel(line: Line, dir: Dir): string {
  if (line.loop) return dir === "fwd" ? "Loop, one way" : "Loop, other way";
  return `Toward ${dir === "fwd" ? line.to : line.from}`;
}

export function nearestStop(lat: number, lng: number): StopRef & { km: number } {
  let best = { routeId: LINES[0]!.routeId, index: 0, km: Infinity };
  for (const l of LINES) {
    l.stops.forEach((s, index) => {
      const kx = 111.32 * Math.cos((lat * Math.PI) / 180);
      const d = Math.hypot((s.lng - lng) * kx, (s.lat - lat) * 110.54);
      if (d < best.km) best = { routeId: l.routeId, index, km: d };
    });
  }
  return best;
}
