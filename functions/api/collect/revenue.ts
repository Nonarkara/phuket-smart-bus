/**
 * Cloudflare Pages Function: GET /api/collect/revenue
 *
 * Reads the Bangkok-day ledger the edge relay updates
 * (`day:YYYY-MM-DD` in shared/gpsBatch.ts). Passengers are APC
 * rises only. Kilometres are real fixes. Nobody is invented from
 * a 35 km corridor.
 *
 * If today's key is missing (first minute after a deploy), fold the
 * newest `gps:` snapshots so the endpoint is not an empty 503.
 * `?date=YYYY-MM-DD` reads that Bangkok day and does not fall back
 * onto another day's batches. A missing day is zeros.
 */

import { bangkokDate, emptyGpsDay, foldBatches, gpsDayKey, parseStudyDate, summarizeGpsDay, type GpsBatch, type GpsDay } from "../../../shared/gpsBatch";

interface PagesEventContext {
  request: Request;
  env: Record<string, string> & {
    GPS_HISTORY?: any;
  };
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Accept, Content-Type",
  "Cache-Control": "public, max-age=10, s-maxage=20",
};

export function computeRevenueFromBatches(batches: GpsBatch[]) {
  return summarizeGpsDay(foldBatches(batches));
}

export async function onRequestGet(context: PagesEventContext): Promise<Response> {
  const kv = context.env.GPS_HISTORY;
  if (!kv) {
    return new Response(
      JSON.stringify({ error: "KV binding GPS_HISTORY is not configured on this Pages project" }),
      { status: 503, headers: { "Content-Type": "application/json", ...CORS } }
    );
  }

  try {
    const now = Date.now();
    const requested = new URL(context.request.url).searchParams.get("date");
    if (requested && parseStudyDate(requested) === null) {
      return new Response(JSON.stringify({ ok: false, error: "date must be YYYY-MM-DD" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }
    const dayMs = requested ? parseStudyDate(requested)! : now;
    const dayKey = gpsDayKey(dayMs);
    const stored = (await kv.get(dayKey, "json")) as GpsDay | null;
    let day = stored?.vehicles ? stored : null;
    let source: "day-ledger" | "recent-batches" | "missing" = "day-ledger";

    if (!day && !requested) {
      const listed = await kv.list({ prefix: "gps:", limit: 100 });
      const batches: GpsBatch[] = [];
      for (const entry of listed.keys) {
        const val = (await kv.get(entry.name, "json")) as GpsBatch | null;
        if (val && Array.isArray(val.buses)) batches.push(val);
      }
      day = batches.length > 0 ? foldBatches(batches) : emptyGpsDay(now);
      source = batches.length > 0 ? "recent-batches" : "missing";
    } else if (!day) {
      day = emptyGpsDay(dayMs);
      source = "missing";
    }
    // A requested date must not be relabelled by foldBatches' first sample.
    if (requested && day.date !== requested) day = { ...day, date: bangkokDate(dayMs) };

    return new Response(
      JSON.stringify({
        ok: true,
        source,
        ...summarizeGpsDay(day),
        serverTime: now,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...CORS } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: "Failed to compute revenue from KV batches",
        details: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: { "Content-Type": "application/json", ...CORS } }
    );
  }
}

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Accept, Content-Type",
      "Access-Control-Max-Age": "600",
    },
  });
}
