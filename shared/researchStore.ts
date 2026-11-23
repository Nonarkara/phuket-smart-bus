import { SERVICE_DAY_START_H, serviceDayWindow, type ResearchFix } from "./research.js";

export type D1Read = {
  prepare(sql: string): { bind(...v: unknown[]): { all<T>(): Promise<{ results: T[] }> } };
};

export const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*" };

/**
 * Single cache-generation token shared by day.ts, service.ts, period.ts, and pace.ts.
 * Bump here so every research endpoint invalidates and shares the same KV keys together:
 * - v2 (2026-10-04): real terminals, reverse loops, off-line detours, ground-speed trips.
 * - v3 (2026-11-22): a departure the bus returns from within 2 h is withdrawn (excursion).
 */
export const RESEARCH_RULES = "v3";

/** First full service day of the two-fleet record (token feed wired 2026-10-01 late evening). */
export const RESEARCH_FIRST_DAY = "2026-10-02";

/**
 * Most recent finished service dates before `today` (exclusive), starting no
 * earlier than `firstDay` and capped to the latest `maxDays` days so rolling
 * endpoints never freeze at `firstDay + maxDays`.
 */
export function finishedServiceDates(
  today: string,
  firstDay = RESEARCH_FIRST_DAY,
  maxDays = 45
): string[] {
  const startMs = Date.parse(`${firstDay}T12:00:00Z`);
  const endMs = Date.parse(`${today}T12:00:00Z`);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs || maxDays <= 0) return [];
  const all: string[] = [];
  for (let ms = startMs; ms < endMs; ms += 86_400_000) {
    all.push(new Date(ms).toISOString().slice(0, 10));
  }
  return all.slice(-maxDays);
}

/** The service day a Bangkok clock reading belongs to (before 03:00 = the previous day). */
export function serviceDateOf(ms: number): string {
  return new Date(ms + 7 * 3_600_000 - SERVICE_DAY_START_H * 3_600_000).toISOString().slice(0, 10);
}

export function parseDate(raw: string | null, nowMs: number): { date: string; window: [number, number] } | null {
  const date = raw ?? serviceDateOf(nowMs);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const window = serviceDayWindow(date);
  return window ? { date, window } : null;
}

type Row = {
  plate: string; fix_ms: number; lat: number; lng: number; speed_kph: number | null; heading: number | null;
  odometer_m: number | null; online: number | null; route_id: string | null; destination: string | null;
  pax_on_board: number | null; pax_up: number | null; pax_down: number | null; feed: string; received_ms: number;
};

export async function readFixes(db: D1Read, [from, to]: [number, number]): Promise<Row[]> {
  const { results } = await db
    .prepare("SELECT * FROM fixes WHERE fix_ms >= ? AND fix_ms < ? ORDER BY plate, fix_ms")
    .bind(from, to)
    .all<Row>();
  return results;
}

export const toResearchFix = (r: Row): ResearchFix => ({
  plate: r.plate, fixMs: r.fix_ms, lat: r.lat, lng: r.lng, speedKph: r.speed_kph, routeId: r.route_id, feed: r.feed,
});
