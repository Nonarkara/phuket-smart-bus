/**
 * GET /api/research/fixes?date=YYYY-MM-DD[&plate=10-1149][&format=csv]
 * The raw research record for one service day (03:00→03:00 BKK): every
 * distinct fix from both PKSB feeds, exactly as stored. Columns and units:
 * migrations/0001_fixes.sql. CSV adds fix_bkk (Bangkok wall time) for spreadsheets.
 */
import { JSON_HEADERS, parseDate, readFixes, type D1Read } from "../../../shared/researchStore";

const COLUMNS = ["plate", "fix_ms", "lat", "lng", "speed_kph", "heading", "odometer_m", "online", "route_id",
  "destination", "pax_on_board", "pax_up", "pax_down", "feed", "received_ms"] as const;

const cell = (v: unknown) => (v === null || v === undefined ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const bkk = (ms: number) => new Date(ms + 7 * 3_600_000).toISOString().slice(0, 19).replace("T", " ");

export async function onRequestGet(context: { request: Request; env: { FIXES?: D1Read } }): Promise<Response> {
  if (!context.env.FIXES) return new Response(JSON.stringify({ ok: false, error: "D1 binding FIXES is not configured" }), { status: 503, headers: JSON_HEADERS });
  const url = new URL(context.request.url);
  const parsed = parseDate(url.searchParams.get("date"), Date.now());
  if (!parsed) return new Response(JSON.stringify({ ok: false, error: "date must be YYYY-MM-DD" }), { status: 400, headers: JSON_HEADERS });
  const plate = url.searchParams.get("plate");
  const rows = (await readFixes(context.env.FIXES, parsed.window)).filter((r) => !plate || r.plate === plate);

  if (url.searchParams.get("format") === "csv") {
    const lines = [["fix_bkk", ...COLUMNS].join(",")];
    for (const r of rows) lines.push([bkk(r.fix_ms), ...COLUMNS.map((c) => cell(r[c]))].join(","));
    return new Response(lines.join("\n") + "\n", {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="PBUS_${parsed.date}_DATA_fixes${plate ? `-${plate}` : ""}.csv"`,
        "access-control-allow-origin": "*",
        "cache-control": "public, max-age=60",
      },
    });
  }
  return new Response(JSON.stringify({ ok: true, date: parsed.date, columns: COLUMNS, count: rows.length, rows }), {
    headers: { ...JSON_HEADERS, "cache-control": "public, max-age=60" },
  });
}
