import { gaps, headwayCv, matchToSchedule, mean, median, quantile, sd, summarize } from "./stats";

describe("preprint statistics", () => {
  it("quantiles interpolate linearly (type 7)", () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(quantile([10, 20, 30, 40, 50], 0.85)).toBeCloseTo(44, 6);
    expect(median([7])).toBe(7);
    expect(quantile([], 0.5)).toBeNull();
  });

  it("mean and sample sd", () => {
    expect(mean([2, 4, 6])).toBe(4);
    expect(sd([2, 4, 6])).toBeCloseTo(2, 6);
    expect(sd([5])).toBeNull();
  });

  it("headway cv is sd/mean, null below three headways", () => {
    expect(headwayCv([30, 30, 30])).toBe(0);
    expect(headwayCv([10, 50, 30])).toBeCloseTo(20 / 30, 6);
    expect(headwayCv([10, 50])).toBeNull();
    expect(gaps([30, 0, 75])).toEqual([30, 45]);
  });

  it("summarize carries n and the spread", () => {
    expect(summarize([1, 2, 3, 4, 5])).toMatchObject({ n: 5, min: 1, p50: 3, max: 5, mean: 3 });
    expect(summarize([])).toMatchObject({ n: 0, p50: null });
  });

  it("matches observed to scheduled one-to-one, closest pairs first, inside the window", () => {
    // Schedule 600, 660, 720. Observed 605 (→600), 640 (→660, since 600 is taken by the closer 605), 800 (nothing within 30).
    const m = matchToSchedule([640, 605, 800], [600, 660, 720], 30);
    expect(m.pairs).toEqual([
      { observed: 605, scheduled: 600, deviation: 5 },
      { observed: 640, scheduled: 660, deviation: -20 },
    ]);
    expect(m.unmatchedObserved).toEqual([800]);
    expect(m.unmatchedScheduled).toEqual([720]);
  });
});
