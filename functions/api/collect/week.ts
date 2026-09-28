/**
 * GET /api/collect/week?from=YYYY-MM-DD&days=7
 *
 * One row per Bangkok day already stored by /api/collect/tick.
 * Missing days are zeros with missing:true — they are not estimated.
 * Default is the 7 days ending today. A study that starts on a
 * chosen morning is `?from=2026-09-30&days=7`.
 */
import { bangkokDate, parseStudyDate, studyDates, summarizeGpsDay, type GpsDay } from "../../../shared/gpsBatch";

interface PagesEventContext {
  request: Request;
  env: { GPS_HISTORY?: { get(key: string, type: "json"): Promise<unknown> } };
}

const HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

export async function onRequestGet(context: PagesEventContext): Promise<Response> {
  const kv = context.env.GPS_HISTORY;
  if (!kv) {
    return new Response(JSON.stringify({ ok: false, error: "KV binding GPS_HISTORY is not configured" }), {
      status: 503,
      headers: HEADERS,
    });
  }

  const url = new URL(context.request.url);
  const daysRaw = Number(url.searchParams.get("days") ?? "7");
  const days = Number.isFinite(daysRaw) ? Math.max(1, Math.min(14, Math.floor(daysRaw))) : 7;
  const today = bangkokDate(Date.now());
  const requested = url.searchParams.get("from");
  let from = requested;
  if (!from) {
    const end = parseStudyDate(today);
    from = end === null ? today : bangkokDate(end - (days - 1) * 86_400_000);
  }
  const dates = studyDates(from, days);
  if (!dates) {
    return new Response(JSON.stringify({ ok: false, error: "from must be YYYY-MM-DD" }), { status: 400, headers: HEADERS });
  }

  const rows = [];
  for (const date of dates) {
    const stored = (await kv.get(`day:${date}`, "json")) as GpsDay | null;
    if (!stored?.vehicles) {
      rows.push({ date, missing: true, updatedAt: null, totalTrackedVehicles: 0, totalKmTracked: 0, totalPaxServed: 0, totalRevenueThb: 0 });
      continue;
    }
    const summary = summarizeGpsDay(stored);
    rows.push({
      date,
      missing: false,
      updatedAt: stored.updatedAt,
      totalTrackedVehicles: summary.totalTrackedVehicles,
      totalKmTracked: summary.totalKmTracked,
      totalPaxServed: summary.totalPaxServed,
      totalRevenueThb: summary.totalRevenueThb,
    });
  }

  const present = rows.filter((row) => !row.missing);
  return new Response(
    JSON.stringify({
      ok: true,
      from: dates[0],
      through: dates[dates.length - 1],
      days: rows,
      daysPresent: present.length,
      totalKmTracked: Math.round(present.reduce((s, row) => s + row.totalKmTracked, 0) * 10) / 10,
      totalPaxServed: present.reduce((s, row) => s + row.totalPaxServed, 0),
      totalRevenueThb: present.reduce((s, row) => s + row.totalRevenueThb, 0),
    }),
    { status: 200, headers: HEADERS },
  );
}
