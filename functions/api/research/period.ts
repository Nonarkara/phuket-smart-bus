/**
 * GET /api/research/period — every finished service day in the research record,
 * slimmed to its trips (no traces, no stop crossings), for cross-day insight.
 *
 * Reads the per-day analyses /api/research/day caches in KV. A finished day
 * no one has opened yet is analysed and cached here — at most two per request,
 * so a cold call stays cheap; the response says which days are still pending.
 */
import { analyzeDay } from "../../../shared/research";
import { JSON_HEADERS, readFixes, serviceDateOf, toResearchFix, type D1Read } from "../../../shared/researchStore";
import { serviceDayWindow } from "../../../shared/research";

type Env = { FIXES?: D1Read; GPS_HISTORY?: { get(k: string): Promise<string | null>; put(k: string, v: string): Promise<void> } };
/** Same cache generation as day.ts — bump both together. */
const RULES = "v2";
/** First full service day of the two-fleet record (token feed wired 2026-10-01 late evening). */
const FIRST_DAY = "2026-10-02";
const MAX_DAYS = 45;
const COMPUTE_PER_REQUEST = 2;

type SlimTrip = { plate: string; dir: string; departMs: number; arriveMs: number; minutes: number };
type SlimDay = { date: string; lines: { routeId: string; trips: SlimTrip[] }[] };

function slim(day: { date: string; lines: { routeId: string; trips: SlimTrip[] }[] }): SlimDay {
  return {
    date: day.date,
    lines: day.lines.map((l) => ({
      routeId: l.routeId,
      trips: l.trips.map(({ plate, dir, departMs, arriveMs, minutes }) => ({ plate, dir, departMs, arriveMs, minutes })),
    })),
  };
}

export async function onRequestGet(context: { request: Request; env: Env }): Promise<Response> {
  const { env } = context;
  if (!env.FIXES || !env.GPS_HISTORY) {
    return new Response(JSON.stringify({ ok: false, error: "research bindings are not configured" }), { status: 503, headers: JSON_HEADERS });
  }
  const now = Date.now();
  const today = serviceDateOf(now);
  const dates: string[] = [];
  for (let ms = Date.parse(`${FIRST_DAY}T12:00:00Z`); dates.length < MAX_DAYS; ms += 86_400_000) {
    const d = new Date(ms).toISOString().slice(0, 10);
    if (d >= today) break; // today is still running: /api/research/day covers it
    dates.push(d);
  }

  const days: SlimDay[] = [];
  const pending: string[] = [];
  let computed = 0;
  for (const date of dates.slice(-MAX_DAYS)) {
    const key = `research:${RULES}:${date}`;
    const hit = await env.GPS_HISTORY.get(key);
    if (hit) { days.push(slim(JSON.parse(hit))); continue; }
    const window = serviceDayWindow(date);
    if (!window || computed >= COMPUTE_PER_REQUEST) { pending.push(date); continue; }
    const rows = await readFixes(env.FIXES, window);
    computed++;
    if (rows.length === 0) continue; // collector down that day: no record, not a zero day
    const analysed = { ok: true, rules: RULES, finished: true, computedAt: new Date(now).toISOString(), ...analyzeDay(date, rows.map(toResearchFix)) };
    const body = JSON.stringify(analysed);
    await env.GPS_HISTORY.put(key, body);
    days.push(slim(analysed));
  }

  return new Response(JSON.stringify({ ok: true, rules: RULES, firstDay: FIRST_DAY, through: dates[dates.length - 1] ?? null, days, pending }), {
    headers: { ...JSON_HEADERS, "cache-control": pending.length ? "public, max-age=60" : "public, max-age=1800" },
  });
}
