/**
 * The research record: every distinct fix from both feeds, in D1, forever.
 * KV (gpsBatch.ts) is the 45-day working ledger; this is what a study
 * months from now reads. Schema: migrations/0001_fixes.sql.
 */
import type { LiveBus } from "./pksbFeed.js";
import { isOnPhuketIsland } from "./pksbFeed.js";

export type D1Like = {
  prepare(sql: string): { bind(...values: unknown[]): unknown };
  batch(statements: unknown[]): Promise<unknown[]>;
};

const INSERT = `INSERT OR IGNORE INTO fixes
  (plate, fix_ms, lat, lng, speed_kph, heading, odometer_m, online, route_id, destination,
   pax_on_board, pax_up, pax_down, feed, received_ms)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

const n = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const b = (v: boolean | null | undefined) => (v === true ? 1 : v === false ? 0 : null);

/** One row per bus with a real fix. A fix stamped after `receivedMs` is a clock bug — dropped, not stored. */
export function fixRows(buses: LiveBus[], receivedMs: number): unknown[][] {
  const rows: unknown[][] = [];
  for (const bus of buses) {
    const fixMs = Date.parse(bus.updatedAt);
    if (!bus.plate || !Number.isFinite(fixMs) || fixMs > receivedMs + 120_000) continue;
    if (!isOnPhuketIsland(bus.lat, bus.lng)) continue;
    rows.push([
      bus.plate, fixMs, bus.lat, bus.lng, n(bus.speedKph), n(bus.heading), n(bus.odometerM), b(bus.online),
      bus.routeId ?? null, bus.destination || null, n(bus.paxOnBoard), n(bus.paxUp), n(bus.paxDown),
      bus.feed ?? "keyless", receivedMs,
    ]);
  }
  return rows;
}

export async function storeFixes(db: D1Like, buses: LiveBus[], receivedMs: number): Promise<number> {
  const rows = fixRows(buses, receivedMs);
  if (rows.length === 0) return 0;
  const stmt = db.prepare(INSERT);
  await db.batch(rows.map((row) => (stmt as { bind(...v: unknown[]): unknown }).bind(...row)));
  return rows.length;
}
