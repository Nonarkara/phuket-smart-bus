import { SERVICE_DAY_START_H, serviceDayWindow, type ResearchFix } from "./research.js";

export type D1Read = {
  prepare(sql: string): { bind(...v: unknown[]): { all<T>(): Promise<{ results: T[] }> } };
};

export const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*" };

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
