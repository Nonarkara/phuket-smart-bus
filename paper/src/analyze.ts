/**
 * npx tsx paper/src/analyze.ts [dataDir] [outDir]
 *
 * Reads the exported record (default paper/data), analyses it service day by
 * service day, and writes:
 *   results.json      every number the paper prints
 *   marey.json        the time–distance traces of the Marey day
 *   trips.csv         every complete terminal-to-terminal trip
 *   departures.csv    every terminal departure
 *   service-days.csv  the Airport line, published against recorded, per day and direction
 *   town-bus-days.csv the town fleet, one row per bus-day
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { aggregate, analyzeServiceDay, type DayResult } from "./analysis";
import { listServiceDays, readServiceDay, readWeekRows } from "./record";

const dataDir = resolve(process.argv[2] ?? "paper/data");
const outDir = resolve(process.argv[3] ?? "paper/build");
mkdirSync(outDir, { recursive: true });

const dates = listServiceDays(dataDir);
if (dates.length === 0) {
  console.error(`No service days under ${dataDir}/fixes. Run scripts/paper/fetch-record.sh first.`);
  process.exit(1);
}

const days: DayResult[] = [];
for (const date of dates) {
  const rows = readServiceDay(dataDir, date);
  if (rows.length === 0) continue;
  const day = analyzeServiceDay(date, rows);
  days.push(day);
  console.log(`${date}  ${String(rows.length).padStart(6)} fixes  ${String(day.trips.length).padStart(3)} trips  ${day.town.filter((b) => b.hoursMoving > 0).length} town buses moving`);
}

const periodPath = join(dataDir, "meta", "period.json");
const period = existsSync(periodPath) ? JSON.parse(readFileSync(periodPath, "utf8")) : null;
const results = aggregate(days, readWeekRows(dataDir), period);
writeFileSync(join(outDir, "results.json"), JSON.stringify(results, null, 2));

const marey = days.find((d) => d.date === results.mareyDay)?.research.lines.find((l) => l.routeId === "rawai-airport") ?? null;
writeFileSync(join(outDir, "marey.json"), JSON.stringify({ date: results.mareyDay, line: marey }));

const csv = (rows: Record<string, unknown>[]) => {
  if (rows.length === 0) return "";
  const cols = Object.keys(rows[0]!);
  const cell = (v: unknown) => (v === null || v === undefined ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  return [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n") + "\n";
};
writeFileSync(join(outDir, "trips.csv"), csv(days.flatMap((d) => d.trips)));
writeFileSync(join(outDir, "departures.csv"), csv(days.flatMap((d) => d.departures)));
writeFileSync(join(outDir, "service-days.csv"), csv(results.airport.days));
writeFileSync(join(outDir, "town-bus-days.csv"), csv(days.flatMap((d) => d.town.map(({ movingBins: _bins, ...row }) => row))));

console.log(`\n${results.record.serviceDays} service days, ${results.record.fixes.toLocaleString()} fixes → ${outDir}`);
