/**
 * Reads the exported research record (scripts/paper/fetch-record.sh) one
 * service day at a time: paper/data/fixes/<date>.csv.gz, the columns of
 * migrations/0001_fixes.sql plus fix_bkk.
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { join } from "node:path";

export type RawFix = {
  plate: string;
  fixMs: number;
  lat: number;
  lng: number;
  speedKph: number | null;
  heading: number | null;
  odometerM: number | null;
  online: number | null;
  routeId: string | null;
  destination: string | null;
  paxOnBoard: number | null;
  feed: "keyless" | "token" | string;
  receivedMs: number;
};

/** RFC 4180 line splitter: quoted cells may hold commas and doubled quotes. */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

const num = (v: string | undefined): number | null => {
  if (v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export function parseFixesCsv(text: string): RawFix[] {
  const lines = text.split("\n").filter((l) => l.length > 0);
  if (lines.length < 2) return [];
  const header = splitCsvLine(lines[0]!);
  const col = (name: string) => header.indexOf(name);
  const c = {
    plate: col("plate"), fix: col("fix_ms"), lat: col("lat"), lng: col("lng"), speed: col("speed_kph"),
    heading: col("heading"), odo: col("odometer_m"), online: col("online"), route: col("route_id"),
    dest: col("destination"), pax: col("pax_on_board"), feed: col("feed"), recv: col("received_ms"),
  };
  if (c.plate < 0 || c.fix < 0 || c.lat < 0 || c.lng < 0) throw new Error("fixes CSV is missing required columns");
  const out: RawFix[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]!);
    const fixMs = num(cells[c.fix]);
    const lat = num(cells[c.lat]);
    const lng = num(cells[c.lng]);
    if (fixMs === null || lat === null || lng === null || !cells[c.plate]) continue;
    out.push({
      plate: cells[c.plate]!,
      fixMs,
      lat,
      lng,
      speedKph: num(cells[c.speed]),
      heading: num(cells[c.heading]),
      odometerM: num(cells[c.odo]),
      online: num(cells[c.online]),
      routeId: cells[c.route] || null,
      destination: cells[c.dest] || null,
      paxOnBoard: num(cells[c.pax]),
      feed: cells[c.feed] || "unknown",
      receivedMs: num(cells[c.recv]) ?? fixMs,
    });
  }
  return out;
}

export function listServiceDays(dataDir: string): string[] {
  const dir = join(dataDir, "fixes");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.csv\.gz$/.test(f))
    .map((f) => f.slice(0, 10))
    .sort();
}

export function readServiceDay(dataDir: string, date: string): RawFix[] {
  return parseFixesCsv(gunzipSync(readFileSync(join(dataDir, "fixes", `${date}.csv.gz`))).toString("utf8"));
}

export type WeekRow = {
  date: string;
  missing: boolean;
  totalTrackedVehicles: number | null;
  totalKmTracked: number | null;
  kmBasis: string | null;
  busesMoved: number | null;
  totalRuns: number | null;
  totalHoursMoving: number | null;
  busesReachedAirport: number | null;
  countersReporting: number | null;
  coverage: unknown;
};

/** Every stored study-archive day across the exported week reports, de-duplicated by date. */
export function readWeekRows(dataDir: string): WeekRow[] {
  const dir = join(dataDir, "week");
  if (!existsSync(dir)) return [];
  const byDate = new Map<string, WeekRow>();
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".json")).sort()) {
    const body = JSON.parse(readFileSync(join(dir, f), "utf8")) as { days?: WeekRow[] };
    for (const row of body.days ?? []) if (!row.missing) byDate.set(row.date, row);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
