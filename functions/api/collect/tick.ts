/**
 * GET /api/collect/tick — one real-fleet sample, written before the
 * response returns.
 *
 * The wall screen is not the archive. This route skips the 10 s edge
 * cache on `/api/live-buses` and awaits the KV write, so a cron that
 * reads the body has actually stored the fix. Callers:
 *
 *   workers/collect.ts          every minute, twice (about every 30 s)
 *   .github/workflows/collect-live-buses.yml   every 5 min, if the worker is down
 *
 * A second call inside RECORD_MIN_GAP_MS is a 200 with recorded:false.
 * It does not write again.
 */
import { buildLiveBusResponse, type LiveBusEnv } from "../live-buses";
import { liveBusesToPings, recordFleetSample, RECORD_MIN_GAP_MS } from "../../../shared/recordFleet";
import type { LiveBus } from "../../../shared/pksbFeed";

const FRESH_MS = 3 * 60_000;

const HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

type TickContext = {
  env: LiveBusEnv;
};

export async function collectTick(env: LiveBusEnv, fetchImpl: typeof fetch = fetch): Promise<Response> {
  const now = Date.now();
  const upstream = await buildLiveBusResponse(env, fetchImpl);
  const body = (await upstream.json()) as { status?: string; vehicles?: LiveBus[]; detail?: string; sources?: unknown };
  if (upstream.status !== 200 || body.status !== "live" || !Array.isArray(body.vehicles)) {
    return new Response(
      JSON.stringify({ ok: false, recorded: false, detail: body.detail ?? "tracker unreachable", serverTime: now }),
      { status: 502, headers: HEADERS },
    );
  }

  const fresh = body.vehicles.filter((v) => now - Date.parse(v.updatedAt) <= FRESH_MS).length;
  if (!env.GPS_HISTORY) {
    return new Response(
      JSON.stringify({ ok: false, recorded: false, reason: "no-kv", vehicles: body.vehicles.length, fresh, serverTime: now }),
      { status: 503, headers: HEADERS },
    );
  }

  const result = await recordFleetSample(env.GPS_HISTORY, liveBusesToPings(body.vehicles), now);
  return new Response(
    JSON.stringify({ ok: true, minGapMs: RECORD_MIN_GAP_MS, fresh, sources: body.sources ?? null, serverTime: now, ...result }),
    { status: 200, headers: HEADERS },
  );
}

export async function onRequestGet(context: TickContext): Promise<Response> {
  return collectTick(context.env);
}
