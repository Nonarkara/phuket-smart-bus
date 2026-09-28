/**
 * Cloudflare Pages Function: POST /api/collect/gps
 *
 * The edge relay (`/api/live-buses`) is the writer. It already parsed
 * the tracker. This endpoint accepts the same batch shape for anything
 * else that has a normalised ping, and folds it into the same
 * Bangkok-day ledger. Keys sort newest-first (`gps:`), not oldest-first
 * (`batch:`), because KV list is lexicographic.
 *
 * GET returns the last N batches so the operator can see that fixes
 * are landing, plus the revenue rollup of those batches only.
 */

import { gpsBatchKey, gpsDayKey, GPS_HISTORY_TTL_S, applyBusesToDay, emptyGpsDay, type GpsBatch, type GpsDay } from "../../../shared/gpsBatch";
import { computeRevenueFromBatches } from "./revenue";

interface PagesEventContext {
  request: Request;
  env: Record<string, string> & {
    /** Cloudflare KV namespace bound as `GPS_HISTORY` in wrangler.toml.
     * Typed via `any` so this file compiles under both Pages' tsconfig
     * (which doesn't ship @cloudflare/workers-types) and Workers' tsconfig. */
    GPS_HISTORY?: any;
  };
}

interface CollectedBusPing {
  vehicleId: string;
  licensePlate?: string;
  coordinates: [number, number];
  speedKph: number;
  heading?: number;
  timestamp: string;
  routeId?: string;
  destinationHint?: string;
  satellites?: number;
  paxCount?: number;
}

interface CollectPayload {
  fetchedAt: number;
  source: string;
  buses: CollectedBusPing[];
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Accept, Content-Type",
  "Cache-Control": "no-store",
};

const MAX_BUSES_PER_BATCH = 200;
const MAX_BATCH_BYTES = 90_000; // stay well under KV's 25 MB hard cap
const RECENT_DEFAULT_LIMIT = 20;
const RECENT_MAX_LIMIT = 100;

/**
 * Reject obviously-bogus batches early so KV doesn't fill with
 * garbage from a misconfigured producer. Validates shape only —
 * domain correctness is the producer's job.
 */
function isCollectPayload(value: unknown): value is CollectPayload {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.fetchedAt !== "number" || !Number.isFinite(v.fetchedAt)) return false;
  if (typeof v.source !== "string" || v.source.length === 0 || v.source.length > 64) return false;
  if (!Array.isArray(v.buses)) return false;
  if (v.buses.length > MAX_BUSES_PER_BATCH) return false;
  for (const b of v.buses) {
    if (!b || typeof b !== "object") return false;
    const bus = b as Record<string, unknown>;
    if (typeof bus.vehicleId !== "string" || bus.vehicleId.length === 0) return false;
    if (!Array.isArray(bus.coordinates) || bus.coordinates.length !== 2) return false;
    const [lat, lon] = bus.coordinates;
    if (typeof lat !== "number" || typeof lon !== "number") return false;
    if (typeof bus.timestamp !== "string") return false;
  }
  return true;
}

export async function onRequestPost(context: PagesEventContext): Promise<Response> {
  const kv = context.env.GPS_HISTORY;
  if (!kv) {
    return new Response(
      JSON.stringify({ error: "KV binding GPS_HISTORY is not configured on this Pages project" }),
      { status: 503, headers: { "Content-Type": "application/json", ...CORS } }
    );
  }

  let body: unknown;
  try {
    const raw = await context.request.text();
    if (raw.length > MAX_BATCH_BYTES) {
      return new Response(
        JSON.stringify({ error: `Batch too large (${raw.length} > ${MAX_BATCH_BYTES} bytes)` }),
        { status: 413, headers: { "Content-Type": "application/json", ...CORS } }
      );
    }
    body = JSON.parse(raw);
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body", details: err instanceof Error ? err.message : String(err) }),
      { status: 400, headers: { "Content-Type": "application/json", ...CORS } }
    );
  }

  if (!isCollectPayload(body)) {
    return new Response(
      JSON.stringify({
        error: "Payload shape invalid",
        expected: {
          fetchedAt: "number (ms since epoch)",
          source: "string",
          buses: "array of {vehicleId, coordinates:[lat,lon], speedKph, timestamp}",
        },
      }),
      { status: 422, headers: { "Content-Type": "application/json", ...CORS } }
    );
  }

  const payload: CollectPayload = body;
  const storedAt = Date.now();
  const record: GpsBatch = { ...payload, storedAt };
  const key = gpsBatchKey(payload.fetchedAt, payload.source);
  try {
    await kv.put(key, JSON.stringify(record), { expirationTtl: GPS_HISTORY_TTL_S });
    const dayKey = gpsDayKey(payload.fetchedAt);
    const prev = (await kv.get(dayKey, "json")) as GpsDay | null;
    const next = applyBusesToDay(prev?.vehicles ? prev : emptyGpsDay(payload.fetchedAt), payload.buses, payload.fetchedAt);
    await kv.put(dayKey, JSON.stringify(next), { expirationTtl: GPS_HISTORY_TTL_S });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "KV write failed", details: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { "Content-Type": "application/json", ...CORS } }
    );
  }

  // Track per-source ingest count for the dashboard "DEVICES → telemetry console"
  const counterKey = `counter:${payload.source}`;
  try {
    const prior = await kv.get(counterKey, "json");
    const next = { count: (prior?.count ?? 0) + 1, lastBatchAt: payload.fetchedAt };
    await kv.put(counterKey, JSON.stringify(next), { expirationTtl: 60 * 60 * 24 * 30 });
  } catch {
    // Counter is best-effort; ingest already succeeded.
  }

  return new Response(
    JSON.stringify({
      ok: true,
      key,
      buses: payload.buses.length,
      storedAt,
    }),
    { status: 200, headers: { "Content-Type": "application/json", ...CORS } }
  );
}

/**
 * GET /api/collect/gps?limit=20
 *
 * Returns the last N batches (most-recent first by storedAt). Uses
 * KV's `list` prefix scan + the optional `limit` to bound the work.
 */
export async function onRequestGet(context: PagesEventContext): Promise<Response> {
  const kv = context.env.GPS_HISTORY;
  if (!kv) {
    return new Response(
      JSON.stringify({ error: "KV binding GPS_HISTORY is not configured on this Pages project" }),
      { status: 503, headers: { "Content-Type": "application/json", ...CORS } }
    );
  }

  const url = new URL(context.request.url);
  const requestedLimit = Number.parseInt(url.searchParams.get("limit") ?? "", 10);
  const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
    ? Math.min(requestedLimit, RECENT_MAX_LIMIT)
    : RECENT_DEFAULT_LIMIT;
  const sourceFilter = url.searchParams.get("source")?.trim() || null;

  try {
    const listed = await kv.list({
      prefix: "gps:",
      limit: Math.min(limit * 4, RECENT_MAX_LIMIT * 4),
    });

    const records: Array<{ key: string; value: CollectPayload & { storedAt: number } }> = [];
    for (const entry of listed.keys) {
      const value = await kv.get(entry.name, "json");
      if (!value) continue;
      if (sourceFilter && value.source !== sourceFilter) continue;
      records.push({ key: entry.name, value });
      if (records.length >= limit) break;
    }

    // Sort by storedAt descending (newest first)
    records.sort((a, b) => b.value.storedAt - a.value.storedAt);

    // Also surface the per-source counter so the operator can see ingest is flowing
    const counters = await kv.list({ prefix: "counter:" });
    const counterSummary: Record<string, { count: number; lastBatchAt: number | null }> = {};
    for (const entry of counters.keys) {
      const v = await kv.get(entry.name, "json");
      if (v) counterSummary[entry.name.replace(/^counter:/, "")] = v;
    }

    const revenue = computeRevenueFromBatches(records.map((r) => r.value));

    return new Response(
      JSON.stringify({
        ok: true,
        count: records.length,
        limit,
        sourceFilter,
        revenue,
        batches: records.map((r) => ({ key: r.key, ...r.value })),
        counters: counterSummary,
        serverTime: Date.now(),
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...CORS } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "KV read failed", details: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { "Content-Type": "application/json", ...CORS } }
    );
  }
}

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Accept, Content-Type",
      "Access-Control-Max-Age": "600",
    },
  });
}
