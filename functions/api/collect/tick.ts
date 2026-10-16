/**
 * GET /api/collect/tick — one real-fleet sample, written before the
 * response returns.
 *
 * The wall screen is not the archive. This route skips the 10 s edge
 * cache on `/api/live-buses` and awaits the KV write, so a cron that
 * reads the body has actually stored the fix. Callers:
 *
 *   workers/collect.ts          every minute, twice (about every 30 s) — the real path
 *   .github/workflows/collect-live-buses.yml   best-effort backstop; GitHub runs it far less than its 5-min schedule
 *
 * A second call inside RECORD_MIN_GAP_MS is a 200 with recorded:false.
 * It does not write again.
 */
import { buildLiveBusResponse, type LiveBusEnv } from "../live-buses";
import { hasSecret } from "../../../shared/secret";
import { liveBusesToPings, recordFleetSample, RECORD_MIN_GAP_MS } from "../../../shared/recordFleet";
import type { LiveBus } from "../../../shared/pksbFeed";
import { storeFixes, type D1Like } from "../../../shared/fixStore";

const FRESH_MS = 3 * 60_000;

const HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

type TickEnv = LiveBusEnv & { FIXES?: D1Like; TICK_TOKEN?: string };
type TickContext = {
  env: TickEnv;
};

export async function collectTick(env: TickEnv, fetchImpl: typeof fetch = fetch): Promise<Response> {
  const now = Date.now();
  const upstream = await buildLiveBusResponse(env, fetchImpl);
  const body = (await upstream.json()) as { status?: string; vehicles?: LiveBus[]; detail?: string; sources?: unknown };
  if (upstream.status !== 200 || body.status !== "live" || !Array.isArray(body.vehicles)) {
    return new Response(
      JSON.stringify({ ok: false, recorded: false, detail: body.detail ?? "tracker unreachable", serverTime: now }),
      { status: 502, headers: HEADERS },
    );
  }

  const fresh = body.vehicles.filter((v) => {
    const age = now - Date.parse(v.updatedAt);
    return age >= -FRESH_MS && age <= FRESH_MS; // a fix from the future is a clock bug, not a fresh bus
  }).length;
  const online = body.vehicles.filter((v) => v.online === true).length;
  if (!env.GPS_HISTORY) {
    return new Response(
      JSON.stringify({ ok: false, recorded: false, reason: "no-kv", vehicles: body.vehicles.length, fresh, online, serverTime: now }),
      { status: 503, headers: HEADERS },
    );
  }

  const result = await recordFleetSample(env.GPS_HISTORY, liveBusesToPings(body.vehicles), now);
  // The research record is written only with a sample the ledger accepted, so
  // both see the same ticks. A D1 failure is reported, never allowed to lose the KV write.
  let research: { stored: number } | { error: string } | null = null;
  if (env.FIXES && result.recorded) {
    research = await storeFixes(env.FIXES, body.vehicles, now)
      .then((stored) => ({ stored }))
      .catch((e: Error) => ({ error: e.message }));
  }
  return new Response(
    JSON.stringify({ ok: true, minGapMs: RECORD_MIN_GAP_MS, fresh, online, sources: body.sources ?? null, research, serverTime: now, ...result }),
    { status: 200, headers: HEADERS },
  );
}

/**
 * Only the collector may tick: each call fetches both trackers (one with the
 * PKSB bearer token) and writes the study record. Without TICK_TOKEN set as a
 * Pages secret the route is closed — an anonymous caller could otherwise burn
 * our quota on PKSB's servers and race the day ledger from many edge locations.
 */
export async function onRequestGet(context: TickContext & { request: Request }): Promise<Response> {
  if (!hasSecret(context.request, context.env.TICK_TOKEN)) {
    return new Response(JSON.stringify({ ok: false, error: "tick is for the collector only" }), { status: 403, headers: HEADERS });
  }
  return collectTick(context.env);
}
