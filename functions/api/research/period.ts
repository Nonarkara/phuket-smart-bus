/**
 * GET /api/research/period — every finished service day in the research record,
 * slimmed to its trips (no traces, no stop crossings), for cross-day insight.
 *
 * Reads the per-day analyses /api/research/day caches in KV, through the
 * SMALL projection /api/research/pace also writes: a day's trips and the line
 * they ran on, about 8 kB, where the full analysis is 144 kB because it
 * carries every bus's time–distance trace. Thirty-three days of the small
 * projection is a quarter of a megabyte; of the full analysis, 4.7 MB.
 *
 * A finished day no one has opened yet is analysed and cached here — at most
 * two per request, so a cold call stays cheap; the response says which days
 * are still pending.
 */
import { analyzeDay } from "../../../shared/research";
import { JSON_HEADERS, readFixes, serviceDateOf, toResearchFix, type D1Read } from "../../../shared/researchStore";
import { serviceDayWindow } from "../../../shared/research";
import { slimDay, type CachedSlimDay } from "../../../shared/pace";

type Env = { FIXES?: D1Read; GPS_HISTORY?: { get(k: string): Promise<string | null>; put(k: string, v: string): Promise<void> } };
/** Same cache generation as day.ts — bump both together. */
const RULES = "v2";
/** First full service day of the two-fleet record (token feed wired 2026-10-01 late evening). */
const FIRST_DAY = "2026-10-02";
const MAX_DAYS = 45;
const COMPUTE_PER_REQUEST = 2;
/** The small per-day projection both this endpoint and pace.ts read. */
const SLIM_KEY = (date: string) => `research:slim:${RULES}:${date}`;

type SlimTrip = { plate: string; dir: string; departMs: number; arriveMs: number; minutes: number };
type SlimDay = { date: string; lines: { routeId: string; trips: SlimTrip[] }[] };

function slim(day: CachedSlimDay): SlimDay {
  return {
    date: day.date,
    lines: day.lines.map((l) => ({
      routeId: l.routeId,
      trips: l.trips.map((t) => ({
        plate: t.plate ?? "",
        dir: t.dir,
        departMs: t.departMs,
        arriveMs: t.arriveMs ?? t.departMs,
        minutes: t.minutes,
      })),
    })),
  };
}

/** A cached day, from either the small projection or the full analysis. */
function readDay(raw: string): CachedSlimDay | null {
  try {
    const day = JSON.parse(raw) as CachedSlimDay;
    if (!day || !Array.isArray(day.lines)) return null;
    if (!day.lines.every((l) => typeof l.routeId === "string" && typeof l.lengthM === "number" && Array.isArray(l.trips))) return null;
    return { date: day.date, lines: day.lines };
  } catch {
    return null;
  }
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
  // The small projections first, all at once: thirty-four parallel reads of
  // eight kilobytes beat thirty-four sequential ones, and the operations wall
  // waits on this to put the day's real service in force.
  const slimHits = await Promise.all(dates.slice(-MAX_DAYS).map((date) => env.GPS_HISTORY!.get(SLIM_KEY(date))));
  for (let i = 0; i < dates.slice(-MAX_DAYS).length; i++) {
    const date = dates.slice(-MAX_DAYS)[i]!;
    const fromSlim = slimHits[i] ? readDay(slimHits[i]!) : null;
    if (fromSlim) { days.push(slim(fromSlim)); continue; }
    const key = `research:${RULES}:${date}`;
    const hit = await env.GPS_HISTORY.get(key);
    if (hit) {
      const day = readDay(hit);
      if (day) {
        days.push(slim(day));
        await env.GPS_HISTORY.put(SLIM_KEY(date), JSON.stringify(slimDay(day)));
        continue;
      }
    }
    const window = serviceDayWindow(date);
    if (!window || computed >= COMPUTE_PER_REQUEST) { pending.push(date); continue; }
    const rows = await readFixes(env.FIXES, window);
    computed++;
    if (rows.length === 0) continue; // collector down that day: no record, not a zero day
    const analysed = { ok: true, rules: RULES, finished: true, computedAt: new Date(now).toISOString(), ...analyzeDay(date, rows.map(toResearchFix)) };
    const body = JSON.stringify(analysed);
    await env.GPS_HISTORY.put(key, body);
    const projection = slimDay(analysed);
    await env.GPS_HISTORY.put(SLIM_KEY(date), JSON.stringify(projection));
    days.push(slim(projection));
  }

  return new Response(JSON.stringify({ ok: true, rules: RULES, firstDay: FIRST_DAY, through: dates[dates.length - 1] ?? null, days, pending }), {
    headers: { ...JSON_HEADERS, "cache-control": pending.length ? "public, max-age=60" : "public, max-age=1800" },
  });
}
