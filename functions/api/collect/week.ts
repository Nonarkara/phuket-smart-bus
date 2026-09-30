/**
 * GET /api/collect/week?from=YYYY-MM-DD&days=7
 *
 * One row per Bangkok day already stored by /api/collect/tick.
 * Missing days are missing:true with nulls — not zeros, not estimates.
 * Each row says how much of the 05:00–24:00 window was sampled, where
 * its km came from, and how many buses' counters ever spoke. Riders and
 * fares are null unless a counter did. Default is the 7 days ending
 * today; a study week is `?from=2026-09-30&days=7`.
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
  const days = Number.isFinite(daysRaw) ? Math.max(1, Math.min(31, Math.floor(daysRaw))) : 7;
  const today = bangkokDate(Date.now());
  const requested = url.searchParams.get("from");
  let from = requested;
  if (!from) {
    const end = parseStudyDate(today);
    from = end === null ? today : bangkokDate(end - (days - 1) * 86_400_000);
  }
  // `?detail=vehicles` (or any non-empty value) attaches the per-bus array to
  // each day. Default keeps the response small for cron consumers and dashboards
  // that only need day totals. The Study screen always passes this.
  const includeVehicles = (url.searchParams.get("detail") ?? "").length > 0;
  const dates = studyDates(from, days);
  if (!dates) {
    return new Response(JSON.stringify({ ok: false, error: "from must be YYYY-MM-DD" }), { status: 400, headers: HEADERS });
  }

  const now = Date.now();
  const rows = [];
  for (const date of dates) {
    const stored = (await kv.get(`day:${date}`, "json")) as GpsDay | null;
    if (!stored?.vehicles) {
      rows.push({
        date, missing: true, future: date > today, updatedAt: null, coverage: null,
        totalTrackedVehicles: null, kmBasis: null, totalKmTracked: null, totalGpsTraceKm: null,
        countersReporting: null, totalPaxServed: null, totalRevenueThb: null,
        busesMoved: null, totalRuns: null, totalHoursMoving: null, busesReachedAirport: null, busesNoFix: null,
      });
      continue;
    }
    const summary = summarizeGpsDay(stored, now);
    rows.push({
      date,
      missing: false,
      future: false,
      updatedAt: stored.updatedAt,
      coverage: summary.coverage,
      totalTrackedVehicles: summary.totalTrackedVehicles,
      kmBasis: summary.kmBasis,
      totalKmTracked: summary.totalKmTracked,
      totalGpsTraceKm: summary.totalGpsTraceKm,
      countersReporting: summary.countersReporting,
      busesMoved: summary.busesMoved,
      totalRuns: summary.totalRuns,
      totalHoursMoving: summary.totalHoursMoving,
      busesReachedAirport: summary.busesReachedAirport,
      busesNoFix: summary.busesNoFix,
      totalPaxServed: summary.totalPaxServed,
      totalRevenueThb: summary.totalRevenueThb,
      // Per-bus drill-down. Capped at the day ledger's vehicle count, which
      // is bounded by the real fleet (≈24). Safe to include unconditionally
      // when the caller asks for it.
      ...(includeVehicles ? { vehicles: summary.vehicles } : {}),
    });
  }

  const present = rows.filter((row) => !row.missing);
  const counted = present.filter((row) => row.totalPaxServed !== null);
  const pastMissing = rows.filter((row) => row.missing && !row.future).map((row) => row.date);
  return new Response(
    JSON.stringify({
      ok: true,
      from: dates[0],
      through: dates[dates.length - 1],
      days: rows,
      daysPresent: present.length,
      daysMissing: pastMissing,
      totalKmTracked: Math.round(present.reduce((s, row) => s + (row.totalKmTracked ?? 0), 0) * 10) / 10,
      /** Riders over days a counter reported. Null when none did — unknown, not zero. */
      totalPaxServed: counted.length ? counted.reduce((s, row) => s + (row.totalPaxServed ?? 0), 0) : null,
      totalRevenueThb: counted.length ? counted.reduce((s, row) => s + (row.totalRevenueThb ?? 0), 0) : null,
      riderDays: counted.length,
      note: counted.length < present.length
        ? `Riders are measured only where a bus's passenger counter read above zero. ${present.length - counted.length} of ${present.length} recorded day(s) had no working counter, so riders and fares there are unknown, not zero.`
        : null,
    }),
    { status: 200, headers: HEADERS },
  );
}
