/**
 * What each real bus is doing, in words — shared by /fleet (the console) and
 * /fleet/raw (every bus, every detail) so both say the same thing.
 *
 * States, by age of the bus's last GPS fix: driving / standing (fresh, ≤3 min),
 * late signal (3–15 min), no signal (15 min–12 h), not out today (>12 h).
 */
import type { LiveBus } from "@shared/pksbFeed";
import geometry from "@shared/lineGeometry.json";
import { projectOnLine } from "@shared/research";
import { appPath } from "../../lib/paths";

// ── what a bus is doing ────────────────────────────────────────────────────
export type State = "driving" | "standing" | "late" | "quiet" | "off";
export const FRESH_MS = 3 * 60_000;
export const QUIET_MS = 15 * 60_000;
export const OFF_MS = 12 * 3_600_000;
export const MOVING_KPH = 4;
export const ON_LINE_M = 300;
export const BUNCH_M = 1_200;
export const TERMINAL_ZONE_M = 1_000;
/** Where each fleet sleeps (from the parked positions in the feed). */
export const DEPOTS: [number, number][] = [[7.8814, 98.4093], [7.8930, 98.3622]];
/** Published PKSB end-to-end running time (timetable effective 18 Jan 2025). Only the Airport line is published. */
export const TIMETABLE_MIN: Record<string, number> = { "rawai-airport": 95 };

export const STATE_WORD: Record<State, string> = {
  driving: "Driving", standing: "Standing", late: "Late signal", quiet: "No signal", off: "Not out today",
};

export function stateOf(bus: LiveBus, now: number): State {
  const age = now - Date.parse(bus.updatedAt);
  if (age > OFF_MS) return "off";
  if (age > QUIET_MS) return "quiet";
  if (age > FRESH_MS) return "late";
  return bus.speedKph > MOVING_KPH ? "driving" : "standing";
}

export type Line = (typeof geometry)[number] & { cum: number[] };
export const LINES: Line[] = geometry.map((g) => {
  const cum = [0];
  for (let i = 1; i < g.poly.length; i++) {
    const [a, b] = [g.poly[i - 1]!, g.poly[i]!];
    const kx = 111_320 * Math.cos((a[0]! * Math.PI) / 180);
    cum.push(cum[i - 1]! + Math.hypot((b[1]! - a[1]!) * kx, (b[0]! - a[0]!) * 110_540));
  }
  return { ...g, cum };
});
export const ALL_STOPS = LINES.flatMap((l) => l.stops);

export function km(a: [number, number], b: [number, number]) {
  const kx = 111.32 * Math.cos((a[0] * Math.PI) / 180);
  return Math.hypot((b[1] - a[1]) * kx, (b[0] - a[0]) * 110.54);
}
export const ago = (ms: number, now: number) => {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86_400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86_400)} days ago`;
};
export const bkkClock = (ms: number) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(ms));
export const duration = (min: number) => (min < 60 ? `${Math.round(min)} min` : `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, "0")}`);

export type Row = {
  bus: LiveBus;
  state: State;
  fixMs: number;
  line: Line | null;
  alongM: number | null;
  /** "to" = toward the line's second terminal, "from" = toward the first, "lap" on a loop. */
  dir: "to" | "from" | "lap" | null;
  near: string | null;
  atDepot: boolean;
};

export function readRow(bus: LiveBus, now: number): Row {
  const state = stateOf(bus, now);
  const line = LINES.find((l) => l.routeId === bus.routeId) ?? null;
  let alongM: number | null = null;
  if (line) {
    const p = projectOnLine(line, bus.lat, bus.lng);
    if (p.offM <= ON_LINE_M) alongM = p.alongM;
  }
  const nearest = ALL_STOPS.reduce<{ name: string; d: number } | null>((best, s) => {
    const d = km([bus.lat, bus.lng], [s.lat, s.lng]);
    return !best || d < best.d ? { name: s.name, d } : best;
  }, null);
  const dest = (bus.destination || "").toLowerCase();
  const dir: Row["dir"] = !line ? null : line.loop ? "lap" : !dest ? null : dest.includes(line.to.toLowerCase()) ? "to" : "from";
  return {
    bus, state, fixMs: Date.parse(bus.updatedAt), line, alongM, dir,
    near: nearest && nearest.d <= 0.6 ? nearest.name : null,
    atDepot: DEPOTS.some((d) => km([bus.lat, bus.lng], d) <= 0.5),
  };
}
export const isOut = (r: Row) => r.state === "driving" || r.state === "standing" || r.state === "late";

// ── the server's all-day record ────────────────────────────────────────────
export type Today = {
  perBus: Record<string, { trips: number; km: number | null }>;
  line: Record<string, { trips: number; medianMin: number | null }>;
};

export async function loadToday(): Promise<Today | null> {
  try {
    const [day, week] = await Promise.all([
      fetch(appPath("/api/research/day"), { cache: "no-store" }).then((r) => r.json()),
      fetch(`${appPath("/api/collect/week")}?days=1&detail=vehicles`, { cache: "no-store" }).then((r) => r.json()),
    ]);
    const perBus: Today["perBus"] = {};
    const line: Today["line"] = {};
    for (const l of day?.lines ?? []) {
      const mins = (l.trips as { minutes: number }[]).map((t) => t.minutes).sort((a, b) => a - b);
      line[l.routeId] = { trips: mins.length, medianMin: mins.length ? mins[Math.floor(mins.length / 2)]! : null };
      for (const t of l.trips as { plate: string }[]) (perBus[t.plate] ??= { trips: 0, km: null }).trips += 1;
    }
    for (const v of week?.days?.[0]?.vehicles ?? []) (perBus[v.licensePlate] ??= { trips: 0, km: null }).km = v.totalDistanceKm ?? null;
    return { perBus, line };
  } catch {
    return null;
  }
}

export function service(r: Row): string {
  if (!r.line) return r.bus.feed === "keyless" ? "Town route" : "No line given";
  if (r.line.loop) return "Dragon loop";
  return `${r.line.from} ↔ ${r.line.to}${r.bus.destination ? `, to ${r.bus.destination}` : ""}`;
}
