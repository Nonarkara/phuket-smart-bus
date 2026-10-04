/**
 * GET /api/research/day?date=YYYY-MM-DD — one service day (03:00→03:00 BKK)
 * of the research record, analysed: per line, each bus's time–distance trace,
 * every terminal-to-terminal trip, and the minute it passed each stop.
 * Rules: shared/research.ts. A finished day is computed once and kept in KV.
 */
import { analyzeDay } from "../../../shared/research";
import { JSON_HEADERS, parseDate, readFixes, toResearchFix, type D1Read } from "../../../shared/researchStore";

type Env = { FIXES?: D1Read; GPS_HISTORY?: { get(k: string): Promise<string | null>; put(k: string, v: string): Promise<void> } };
const RULES = "v2"; // v2 2026-10-04: real terminals, reverse loops, off-line detours, ground-speed trips

export async function onRequestGet(context: { request: Request; env: Env }): Promise<Response> {
  const { env } = context;
  if (!env.FIXES) return new Response(JSON.stringify({ ok: false, error: "D1 binding FIXES is not configured" }), { status: 503, headers: JSON_HEADERS });
  const now = Date.now();
  const parsed = parseDate(new URL(context.request.url).searchParams.get("date"), now);
  if (!parsed) return new Response(JSON.stringify({ ok: false, error: "date must be YYYY-MM-DD" }), { status: 400, headers: JSON_HEADERS });
  const { date, window } = parsed;
  const finished = now >= window[1] + 10 * 60_000;
  const cacheKey = `research:${RULES}:${date}`;

  if (finished && env.GPS_HISTORY) {
    const hit = await env.GPS_HISTORY.get(cacheKey);
    if (hit) return new Response(hit, { headers: { ...JSON_HEADERS, "cache-control": "public, max-age=3600", "x-research-cache": "hit" } });
  }
  if (now < window[0]) return new Response(JSON.stringify({ ok: false, error: `${date} has not started` }), { status: 404, headers: JSON_HEADERS });

  const rows = await readFixes(env.FIXES, window);
  const body = JSON.stringify({
    ok: true, rules: RULES, finished, computedAt: new Date(now).toISOString(),
    window: { from: new Date(window[0]).toISOString(), to: new Date(window[1]).toISOString() },
    ...analyzeDay(date, rows.map(toResearchFix)),
  });
  if (finished && env.GPS_HISTORY && rows.length > 0) await env.GPS_HISTORY.put(cacheKey, body);
  return new Response(body, { headers: { ...JSON_HEADERS, "cache-control": finished ? "public, max-age=3600" : "public, max-age=60" } });
}
