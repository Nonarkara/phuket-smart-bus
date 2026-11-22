import { describe, expect, it } from "vitest";
import geometry from "./lineGeometry.json";
import { analyzeDay, serviceDayWindow, type ResearchFix } from "./research";

// The case measured 2026-11-12 on bus 10-1204: it reaches the airport, parks
// 1.7 km out (past the 1.5 km confirm line), its tracker sleeps for 29 min, it
// comes back to the kerb, and only then leaves on its real run. One departure.
const line = geometry.find((l) => l.routeId === "rawai-airport")!;
const poly = line.poly as [number, number][];
const cum = [0];
for (let i = 1; i < poly.length; i++) {
  const [a, b] = poly[i - 1]!, [c, d] = poly[i]!;
  const rad = (x: number) => (x * Math.PI) / 180;
  cum.push(cum[i - 1]! + 6371000 * Math.hypot(rad(d - b) * Math.cos(rad((a + c) / 2)), rad(c - a)));
}
const at = (m: number) => poly[cum.findIndex((x) => x >= m)]!;

describe("terminal departures", () => {
  it("a layover past the confirm line, hidden by a tracker silence, is not a departure", () => {
    const day = "2026-11-12";
    const t0 = serviceDayWindow(day)![0] + 4 * 3_600_000; // 07:00
    const fix = (min: number, m: number): ResearchFix => {
      const [lat, lng] = at(m);
      return { plate: "10-1204", fixMs: t0 + min * 60_000, lat, lng, speedKph: 0, routeId: "rawai-airport", feed: "token" };
    };
    const rows = [
      fix(0, 100), fix(1, 100),
      fix(4, 1700), // parked past the confirm line
      fix(33, 100), // 29 min silence, then back at the kerb
      // the real run: one fix a minute out to 8 km
      ...Array.from({ length: 16 }, (_, i) => fix(60 + i, 500 * (i + 1))),
    ];
    const deps = analyzeDay(day, rows).lines.find((l) => l.routeId === "rawai-airport")!.departures;
    expect(deps.map((d) => d.dir)).toEqual(["fwd"]);
  });
});
