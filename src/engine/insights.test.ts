import { describe, expect, it } from "vitest";
import { lineInsight, type SlimDay } from "../../shared/insights";
import period from "./__fixtures__/PBUS_2026-10-13_DATA_trips-11-days.json";

const days = period.days as SlimDay[];
const airport = { from: "Airport", to: "Rawai", loop: false, timetableMin: 95 };

describe("insights across real days (2026-10-02 → 10-12)", () => {
  const ins = lineInsight(days, "rawai-airport", airport)!;

  it("counts days and trips from the record", () => {
    expect(ins.days).toBe(11);
    expect(ins.trips).toBe(359);
  });

  it("almost no Airport-line trip makes the published 95-min running time (+10 min)", () => {
    expect(ins.onTimetable).toEqual({ made: 12, total: 359 });
    expect(ins.sentences[0]).toMatch(/Only 12 of 359 \(3%\)/);
  });

  it("the return leg to the Airport is the slow way", () => {
    expect(ins.medianByDir.rev!).toBeGreaterThan(ins.medianByDir.fwd! + 5);
    expect(ins.sentences.some((s) => s.startsWith("Rawai → Airport is the slow way"))).toBe(true);
  });

  it("long evening gaps leaving the Airport recur around 16:00 and 19:00", () => {
    const fwd = ins.gapHours.filter((g) => g.dir === "fwd");
    expect(fwd.find((g) => g.hour === 16)!.days).toBeGreaterThanOrEqual(7);
    expect(fwd.find((g) => g.hour === 19)!.days).toBeGreaterThanOrEqual(6);
  });

  it("hourly rows need 3+ trips and p85 ≥ median", () => {
    expect(ins.byHour.every((h) => h.n >= 3 && h.p85 >= h.median)).toBe(true);
  });

  it("a loop line speaks of laps, and a line with no trips returns null", () => {
    const dragon = lineInsight(days, "dragon-line", { from: "Old Town", to: "Old Town", loop: true, timetableMin: null })!;
    expect(dragon.dirs).toEqual(["lap"]);
    expect(dragon.sentences[0]).toMatch(/laps took a median/);
    expect(lineInsight(days, "no-such-line", airport)).toBeNull();
  });
});
