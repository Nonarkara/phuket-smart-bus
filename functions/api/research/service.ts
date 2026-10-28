/**
 * GET /api/research/service?date=YYYY-MM-DD — one service day, as service.
 *
 * /api/research/day answers a research question and carries the answer for
 * every bus on every line: the time–distance trace that the Marey diagram is
 * drawn from. An operations wall asks a different question — which trips ran
 * today, when did each one leave, when did it arrive — and it asks it every
 * few minutes, on a day that is still running. Pulling a 26,000-fix day with
 * every trace in it to answer that is the wrong shape: the payload is 140 kB
 * of geometry the wall never draws.
 *
 * So this is the same analysis (shared/research.ts, rules v2), projected to
 * the trips: /api/research/service?date=2026-10-28 answers with the airport
 * line's 24 recorded trips, each with the minute it left and the minute it
 * arrived. Nothing is invented and nothing is dropped: a trip that the record
 * does not contain is a trip the record does not contain, and the projection
 * says which buses were on the line.
 *
 * The running day is re-analysed at most every two minutes. A finished day is
 * analysed once and never changes, so it is cached for good.
 *
 * Rules: shared/research.ts. Cached under research:service:v2:<date>.
 */
import { analyzeDay, serviceDayFrom, serviceDayWindow } from "../../../shared/research";
import { JSON_HEADERS, readFixes, toResearchFix, type D1Read } from "../../../shared/researchStore";
import { bangkokDate, summarizeGpsDay, type GpsDay } from "../../../shared/gpsBatch";

type Env = {
  FIXES?: D1Read;
  GPS_HISTORY?: {
    get(key: string): Promise<string | null>;
    get(key: string, type: "json"): Promise<unknown>;
    put(key: string, value: string): Promise<void>;
  };
};

/** Same cache generation as day.ts — bump both together. */
const RULES = "v2";
/** A day that is still running changes; it is re-analysed at most this often. */
const RUNNING_TTL_MS = 120_000;

function cacheKey(date: string): string {
  return `research:service:${RULES}:${date}`;
}

/** A cached running day is good until this long after it was computed. */
function isFresh(body: { finished?: boolean; computedAt?: string }, finished: boolean): boolean {
  if (finished) return true;
  const at = Date.parse(body.computedAt ?? "");
  return Number.isFinite(at) && Date.now() - at < RUNNING_TTL_MS;
}

export async function onRequestGet(context: { request: Request; env: Env }): Promise<Response> {
  const { env } = context;
  if (!env.FIXES) {
    return new Response(JSON.stringify({ ok: false, error: "D1 binding FIXES is not configured" }), {
      status: 503,
      headers: JSON_HEADERS,
    });
  }
  const now = Date.now();
  const requested = new URL(context.request.url).searchParams.get("date");
  const date = requested ?? new Date(now + 7 * 3_600_000 - 3 * 3_600_000).toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new Response(JSON.stringify({ ok: false, error: "date must be YYYY-MM-DD" }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }
  const window = serviceDayWindow(date);
  if (!window) {
    return new Response(JSON.stringify({ ok: false, error: "date must be YYYY-MM-DD" }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }
  // A service day ends at 03:00 the next morning; before it starts, there is
  // nothing to serve and saying "0 trips" would be a different claim.
  const finished = now >= window[1] + 10 * 60_000;
  if (now < window[0]) {
    return new Response(JSON.stringify({ ok: false, error: `${date} has not started` }), {
      status: 404,
      headers: JSON_HEADERS,
    });
  }

  const key = cacheKey(date);
  if (env.GPS_HISTORY) {
    const hit = await env.GPS_HISTORY.get(key);
    if (hit) {
      try {
        const body = JSON.parse(hit) as { finished?: boolean; computedAt?: string };
        if (isFresh(body, finished)) {
          return new Response(hit, {
            headers: { ...JSON_HEADERS, "cache-control": finished ? "public, max-age=3600" : "no-store", "x-research-cache": "hit" },
          });
        }
      } catch {
        // A corrupt cache entry is a miss, not a failure: fall through and
        // recompute rather than serving a broken body.
      }
    }
  }

  const rows = await readFixes(env.FIXES, window);
  const analysed = analyzeDay(date, rows.map(toResearchFix));
  const body = JSON.stringify({
    ok: true,
    rules: RULES,
    ...serviceDayFrom(analysed, finished, new Date(now).toISOString()),
    fleet: await fleetTotals(env, date, now),
  });
  if (env.GPS_HISTORY && rows.length > 0) await env.GPS_HISTORY.put(key, body);
  return new Response(body, {
    headers: { ...JSON_HEADERS, "cache-control": finished ? "public, max-age=3600" : "no-store" },
  });
}

/**
 * The collector's own day ledger: how far the fleet drove, how many runs it
 * made, how much of the service window was sampled.
 *
 * This is a DIFFERENT record from the one above — the research record counts
 * line trips from the fixes, the collector counts kilometres and runs from
 * the samples it took — and the wall wants both. They are read together here
 * so the screen asks the record once instead of twice, and so the two can
 * never be pulled from different moments in time.
 *
 * A missing ledger is null, not zero: a day the collector never sampled is a
 * day without a figure, and saying "0 km" would be a different claim.
 */
async function fleetTotals(env: Env, date: string, now: number): Promise<Record<string, unknown> | null> {
  if (!env.GPS_HISTORY) return null;
  const stored = (await env.GPS_HISTORY.get(`day:${date}`, "json")) as GpsDay | null;
  if (!stored?.vehicles) return null;
  const summary = summarizeGpsDay(stored, now);
  return {
    date: summary.date,
    vehicles: summary.totalTrackedVehicles,
    moved: summary.busesMoved,
    km: summary.totalKmTracked,
    kmBasis: summary.kmBasis,
    runs: summary.totalRuns,
    hoursMoving: summary.totalHoursMoving,
    reachedAirport: summary.busesReachedAirport,
    noFix: summary.busesNoFix,
    countersReporting: summary.countersReporting,
    coveragePct: summary.coverage?.coveragePct ?? null,
    updatedAt: stored.updatedAt ?? null,
  };
}
