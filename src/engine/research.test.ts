import { describe, expect, it } from "vitest";
import geometry from "../../shared/lineGeometry.json";
import { analyzeDay, projectOnLine, serviceDayWindow, type ResearchFix } from "../../shared/research";
import realDay from "./__fixtures__/PBUS_2026-10-04_DATA_real-fixes-3-buses.json";

const airport = geometry.find((l) => l.routeId === "rawai-airport")!;
const dragon = geometry.find((l) => l.routeId === "dragon-line")!;
const [dayStart] = serviceDayWindow("2026-10-02")!;
const at = (h: number, m = 0) => dayStart + ((h - 3) * 60 + m) * 60_000;

/** A bus driving the polyline at a constant pace, one fix every 30 s. */
function drive(plate: string, poly: number[][], startMs: number, minutes: number, reverse = false, routeId: string | null = "rawai-airport"): ResearchFix[] {
  const pts = reverse ? [...poly].reverse() : poly;
  const n = minutes * 2;
  return Array.from({ length: n + 1 }, (_, i) => {
    const p = pts[Math.round((i / n) * (pts.length - 1))]!;
    return { plate, fixMs: startMs + i * 30_000, lat: p[0]!, lng: p[1]!, speedKph: 35, routeId, feed: "token" };
  });
}
const dwell = (plate: string, p: number[], startMs: number, minutes: number): ResearchFix[] =>
  Array.from({ length: minutes * 2 }, (_, i) => ({ plate, fixMs: startMs + i * 30_000, lat: p[0]!, lng: p[1]!, speedKph: 0, routeId: "rawai-airport", feed: "token" }));

describe("schedule research", () => {
  it("projects a polyline vertex onto its own line at ~0 m off", () => {
    const p = airport.poly[500]!;
    expect(projectOnLine({ poly: airport.poly, cum: [] as number[] } as never, p[0]!, p[1]!).offM).toBeLessThan(1);
  });

  it("finds an outbound and a return trip, times every stop in order, and keeps the dwell out of the trip", () => {
    const rows = [
      ...dwell("10-1149", airport.poly[0]!, at(7), 20),
      ...drive("10-1149", airport.poly, at(7, 20), 100),
      ...dwell("10-1149", airport.poly[airport.poly.length - 1]!, at(9, 1), 30),
      ...drive("10-1149", airport.poly, at(9, 31), 110, true),
    ];
    const day = analyzeDay("2026-10-02", rows);
    const line = day.lines.find((l) => l.routeId === "rawai-airport")!;
    expect(line.trips.map((t) => t.dir)).toEqual(["fwd", "rev"]);
    const [out, back] = line.trips;
    expect(out!.minutes).toBeGreaterThan(90);
    expect(out!.minutes).toBeLessThan(105);
    expect(back!.minutes).toBeGreaterThan(100);
    const times = out!.stopMin.filter((m): m is number => m !== null);
    expect(times.length).toBeGreaterThan(line.stops.length * 0.8);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(times[0]).toBeGreaterThanOrEqual(7 * 60 + 19); // passes the airport stop after the 07:20 departure
  });

  it("a tracker gap over 15 min breaks the trip — no trip invented across it", () => {
    const run = drive("10-1150", airport.poly, at(8), 100);
    const rows = [...run.slice(0, 80), ...run.slice(130).map((f) => ({ ...f, fixMs: f.fixMs + 20 * 60_000 }))];
    expect(analyzeDay("2026-10-02", rows).lines[0]!.trips).toHaveLength(0);
  });

  it("a loop line counts laps between wraps — 4 driven laps, 3 wraps, 2 bounded laps", () => {
    const rows = [0, 1, 2, 3].flatMap((k) => drive("10-1207", dragon.poly, at(10, k * 25), 24, false, "dragon-line"));
    const line = analyzeDay("2026-10-02", rows).lines.find((l) => l.routeId === "dragon-line")!;
    expect(line.trips.filter((t) => t.dir === "lap")).toHaveLength(2);
  });

  it("a town bus off every line is listed, not forced onto one", () => {
    const rows = Array.from({ length: 60 }, (_, i) => ({ plate: "10-1236", fixMs: at(9) + i * 30_000, lat: 7.82 + i * 0.001, lng: 98.343, speedKph: 30, routeId: null, feed: "keyless" }));
    const day = analyzeDay("2026-10-02", rows);
    expect(day.unassigned.map((u) => u.plate)).toEqual(["10-1236"]);
    expect(day.lines.every((l) => l.buses.length === 0)).toBe(true);
  });

  it("a GPS jump from one terminal to the other is not a trip", () => {
    const end = airport.poly[airport.poly.length - 1]!;
    const rows = [...dwell("10-1151", airport.poly[0]!, at(8), 5), ...dwell("10-1151", end, at(8, 5), 5)];
    expect(analyzeDay("2026-10-02", rows).lines[0]!.trips).toHaveLength(0);
  });

  it("a loop run backwards counts laps too (Dragon runs its loop in reverse)", () => {
    const rows = [0, 1, 2, 3].flatMap((k) => drive("10-1265", dragon.poly, at(10, k * 25), 24, true, "dragon-line"));
    const line = analyzeDay("2026-10-02", rows).lines.find((l) => l.routeId === "dragon-line")!;
    expect(line.trips.filter((t) => t.dir === "lap")).toHaveLength(2);
  });

  it("real day (2026-10-04): Patong trips from Bus Terminal 1, Dragon laps run backwards, airport return trips that leave the drawn line", () => {
    const rows = (realDay.rows as [string, number, number, number, number | null, string | null][])
      .map(([plate, fixMs, lat, lng, speedKph, routeId]) => ({ plate, fixMs, lat, lng, speedKph, routeId, feed: "token" }));
    const day = analyzeDay("2026-10-04", rows);
    const trips = (id: string, plate: string) => day.lines.find((l) => l.routeId === id)!.trips.filter((t) => t.plate === plate);
    const patong = trips("patong-old-bus-station", "10-1220");
    const dragon = trips("dragon-line", "10-1265");
    const airport = trips("rawai-airport", "10-1204");
    // 10-1220 drove Terminal 1 → Patong → Terminal 1 three times before 16:30 (seen in the trace).
    expect(patong.length).toBeGreaterThanOrEqual(5);
    expect(patong.every((t) => t.minutes > 25 && t.minutes < 70 && t.avgKph < 45)).toBe(true);
    // 10-1265 laps the Old Town loop backwards in ~26–30 min; the hour it stood at PKCD parking is no lap.
    expect(dragon.length).toBeGreaterThanOrEqual(4);
    expect(dragon.every((t) => t.minutes < 40)).toBe(true);
    // 10-1204 ran Airport → Rawai and back; the return leg leaves the drawn line near Kata yet still counts.
    expect(airport.map((t) => t.dir)).toContain("fwd");
    expect(airport.map((t) => t.dir)).toContain("rev");
  });
});
