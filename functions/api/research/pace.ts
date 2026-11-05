/**
 * GET /api/research/pace — how fast the buses actually run, as the small
 * thing it is.
 *
 * WHY THIS EXISTS
 *   The rider's board shows "85 min" because it divides the road metres still
 *   to drive by the pace this line, this direction, this hour has been run.
 *   The pace is the median minutes per kilometre of recorded end-to-end
 *   trips. The browser used to compute it, which meant downloading 33
 *   service days — 210 kB of trip records — to derive about forty medians,
 *   and on a cold cache that was up to fifteen seconds of a rider's phone
 *   before the first ETA could be shown. A distance is not an ETA.
 *
 *   So the medians are computed where the record is and served as ~1 kB. The
 *   rules live in shared/pace.ts and the browser calls the same function, so
 *   the two answers cannot drift apart.
 *
 * WHAT IT READS
 *   The small per-day projection of the record (a day's trips and the line
 *   they ran on — about 6 kB), which both this endpoint and
 *   /api/research/period write. A full research day carries every bus's
 *   time–distance trace: 144 kB for one day, and 4.7 MB for the 33 days the
 *   pace is built from. The projection is the same trips without the traces.
 *
 *   A finished day nobody has opened is analysed and cached here, at most two
 *   per request, exactly as /api/research/period does — so a cold call stays
 *   cheap and the response says which days are still pending.
 *
 * THE ANSWER
 *   {
 *     ok: true, rules: "v2",
 *     from: "2026-10-02", through: "2026-11-04",
 *     trips: 2135,            // recorded trips the pace was built from
 *     days: 33,
 *     pace: { "rawai-airport|fwd|9": 2.41, ... },
 *     pending: []             // days not in the record yet
 *   }
 */
import { analyzeDay, serviceDayWindow } from "../../../shared/research";
import { JSON_HEADERS, readFixes, serviceDateOf, toResearchFix, type D1Read } from "../../../shared/researchStore";
import { buildPace, countTrips, paceToJson, slimDay, type CachedSlimDay, type PaceDay } from "../../../shared/pace";

type Env = {
  FIXES?: D1Read;
  GPS_HISTORY?: { get(k: string): Promise<string | null>; put(k: string, v: string): Promise<void> };
};

/** Same cache generation as day.ts and period.ts — bump them together. */
const RULES = "v2";
/** First full service day of the two-fleet record. */
const FIRST_DAY = "2026-10-02";
const MAX_DAYS = 45;
const COMPUTE_PER_REQUEST = 2;
/** The pace is a historical measure: it is rebuilt once a service day. */
const CACHE_KEY = (serviceDate: string) => `research:pace:${RULES}:${serviceDate}`;
/** The small per-day projection both this endpoint and period.ts read. */
const SLIM_KEY = (date: string) => `research:slim:${RULES}:${date}`;

/** The day's trips, read from a cache entry of either shape. */
function dayFromCache(raw: string): CachedSlimDay | null {
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

  // The pace for today, cached. It changes when a day is finished, so the key
  // carries the service date and yesterday's answer is not served today.
  const cacheKey = CACHE_KEY(today);
  const cached = await env.GPS_HISTORY.get(cacheKey);
  if (cached) {
    return new Response(cached, { headers: { ...JSON_HEADERS, "cache-control": "public, max-age=900", "x-research-cache": "hit" } });
  }

  const dates: string[] = [];
  for (let ms = Date.parse(`${FIRST_DAY}T12:00:00Z`); dates.length < MAX_DAYS; ms += 86_400_000) {
    const d = new Date(ms).toISOString().slice(0, 10);
    if (d >= today) break; // today is still running: it is not a finished day
    dates.push(d);
  }

  // The small projections first, all at once: thirty-three parallel reads of
  // six kilobytes beat thirty-three sequential reads of a hundred and forty.
  const slimHits = await Promise.all(dates.map((date) => env.GPS_HISTORY!.get(SLIM_KEY(date))));
  const days: PaceDay[] = [];
  const pending: string[] = [];
  let computed = 0;

  for (let i = 0; i < dates.length; i++) {
    const date = dates[i]!;
    const slim = slimHits[i] ? dayFromCache(slimHits[i]!) : null;
    if (slim) { days.push(slim); continue; }
    const full = await env.GPS_HISTORY.get(`research:${RULES}:${date}`);
    const fromFull = full ? dayFromCache(full) : null;
    if (fromFull) {
      days.push(fromFull);
      await env.GPS_HISTORY.put(SLIM_KEY(date), JSON.stringify(fromFull));
      continue;
    }
    const window = serviceDayWindow(date);
    if (!window || computed >= COMPUTE_PER_REQUEST) { pending.push(date); continue; }
    const rows = await readFixes(env.FIXES, window);
    computed++;
    if (rows.length === 0) continue; // the collector was down that day: no record, not a zero day
    const analysed = analyzeDay(date, rows.map(toResearchFix));
    await env.GPS_HISTORY.put(`research:${RULES}:${date}`, JSON.stringify({ ok: true, rules: RULES, finished: true, ...analysed }));
    const projection = slimDay(analysed);
    await env.GPS_HISTORY.put(SLIM_KEY(date), JSON.stringify(projection));
    days.push(projection);
  }

  const pace = buildPace(days);
  const body = JSON.stringify({
    ok: true,
    rules: RULES,
    from: dates[0] ?? null,
    through: dates[dates.length - 1] ?? null,
    days: days.length,
    trips: countTrips(days),
    pending,
    pace: paceToJson(pace),
  });
  await env.GPS_HISTORY.put(cacheKey, body);
  return new Response(body, { headers: { ...JSON_HEADERS, "cache-control": pending.length ? "public, max-age=60" : "public, max-age=900" } });
}
