import { describe, expect, it } from "vitest";
import { fixRows, storeFixes } from "../../shared/fixStore";
import type { LiveBus } from "../../shared/pksbFeed";

const now = Date.parse("2026-10-02T09:00:00+07:00");
const bus = (over: Partial<LiveBus>): LiveBus => ({
  id: "10-1149", plate: "10-1149", vehicleId: "008800AD2F", lat: 7.890908, lng: 98.297613, heading: 205.7,
  speedKph: 17, routeId: "rawai-airport", destination: "Rawai", paxOnBoard: null,
  updatedAt: new Date(now - 181_000).toISOString(), online: true, feed: "token", ...over,
});

describe("research fix store", () => {
  it("keeps the device fix time and feed, drops off-island and future fixes", () => {
    const rows = fixRows([bus({}), bus({ plate: "10-9", lat: 0, lng: 0 }), bus({ plate: "10-8", updatedAt: new Date(now + 3_600_000).toISOString() })], now);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(["10-1149", now - 181_000, 7.890908, 98.297613, 17, 205.7, null, 1, "rawai-airport", "Rawai", null, null, null, "token", now]);
  });

  it("writes one batch of INSERT OR IGNORE — a re-served fix is the same primary key", async () => {
    const calls: unknown[][] = [];
    const db = {
      prepare: (sql: string) => ({ bind: (...v: unknown[]) => ({ sql, v }) }),
      batch: async (stmts: unknown[]) => { calls.push(stmts); return []; },
    };
    expect(await storeFixes(db, [bus({}), bus({ plate: "10-1150" })], now)).toBe(2);
    expect(calls).toHaveLength(1);
    expect((calls[0]![0] as { sql: string }).sql).toMatch(/INSERT OR IGNORE INTO fixes/);
  });
});
