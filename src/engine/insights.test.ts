import { describe, expect, it } from "vitest";
import { lineInsight, type SlimDay } from "../../shared/insights";
import period from "./__fixtures__/PBUS_2026-10-13_DATA_trips-11-days.json";

const days = period.days as SlimDay[];
// The OFFICIAL timetable's end-to-end times (130 min down, 147 up), not the 95-min
// comparison figure this test and the screens used to call "published".
const airport = { from: "Airport", to: "Rawai", loop: false, timetableMin: 135, timetableMinByDir: { fwd: 130, rev: 147 } };

describe("insights across real days (2026-10-02 → 10-12)", () => {
  const ins = lineInsight(days, "rawai-airport", airport)!;

  it("counts days and trips from the record", () => {
    expect(ins.days).toBe(11);
    expect(ins.trips).toBe(359);
  });

  it("most Airport-line trips run to the published time — each judged against its own direction (+10 min)", () => {
    // Against the 95-min comparison figure this read "only 12 of 359 (3%)": a
    // normal trip called 35–50 min late. Against the timetable it is 92%.
    expect(ins.onTimetable).toEqual({ made: 329, total: 359 });
    expect(ins.sentences[0]).toMatch(/329 of 359 \(92%\)/);
    expect(ins.sentences[0]).not.toMatch(/Only/);
    expect(ins.sentences[0]).toMatch(/2 h 10 one way and 2 h 27 the other/);
  });

  it("with a low share it says only, because then it is a verdict", () => {
    const strict = lineInsight(days, "rawai-airport", { ...airport, timetableMin: 60, timetableMinByDir: { fwd: 60, rev: 60 } })!;
    expect(strict.sentences[0]).toMatch(/Only \d+ of 359/);
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
