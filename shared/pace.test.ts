/**
 * The pace rules, in one place — the browser and the endpoint that serves the
 * pace both call this, so these tests are what keeps them from drifting.
 */
import { describe, expect, it } from "vitest";
import { bkkHourOf, buildPace, countTrips, minPerKm, paceFromJson, paceToJson, type PaceDay } from "./pace";

const HOUR = 3_600_000;
/** 2026-10-28 09:00 Bangkok = 02:00 UTC. */
const NINE_AM = Date.parse("2026-10-28T02:00:00Z");
const TEN_AM = NINE_AM + HOUR;

const day = (trips: { dir: string; departMs: number; minutes: number }[], lengthM = 54_252): PaceDay => ({
  lines: [{ routeId: "rawai-airport", loop: false, lengthM, trips }],
});

describe("buildPace", () => {
  it("measures minutes per kilometre, not minutes per trip", () => {
    // 130 minutes over 54.252 km is 2.4 min/km.
    const pace = buildPace([day([{ dir: "fwd", departMs: NINE_AM, minutes: 130 }])]);
    expect(pace.get("rawai-airport|fwd")).toBeCloseTo(130 / 54.252, 5);
    expect(pace.get("rawai-airport")).toBeCloseTo(130 / 54.252, 5);
  });

  it("trusts an hour's own median only with three trips or more", () => {
    const one = buildPace([day([{ dir: "fwd", departMs: NINE_AM, minutes: 100 }])]);
    // One trip at 09:00: the hour bucket is too thin to trust, so the 09:00
    // key is absent and the direction bucket answers instead.
    expect(one.has("rawai-airport|fwd|9")).toBe(false);
    expect(one.has("rawai-airport|fwd")).toBe(true);

    const three = buildPace([
      day([
        { dir: "fwd", departMs: NINE_AM, minutes: 100 },
        { dir: "fwd", departMs: NINE_AM + 600_000, minutes: 110 },
        { dir: "fwd", departMs: NINE_AM + 1_200_000, minutes: 120 },
      ]),
    ]);
    expect(three.has("rawai-airport|fwd|9")).toBe(true);
    expect(three.get("rawai-airport|fwd|9")).toBeCloseTo(110 / 54.252, 5);
  });

  it("keeps each direction and each hour apart", () => {
    const pace = buildPace([
      day([
        { dir: "fwd", departMs: NINE_AM, minutes: 130 },
        { dir: "fwd", departMs: NINE_AM + 600_000, minutes: 130 },
        { dir: "fwd", departMs: NINE_AM + 1_200_000, minutes: 130 },
        { dir: "rev", departMs: TEN_AM, minutes: 147 },
        { dir: "rev", departMs: TEN_AM + 600_000, minutes: 147 },
        { dir: "rev", departMs: TEN_AM + 1_200_000, minutes: 147 },
      ]),
    ]);
    expect(pace.get("rawai-airport|fwd|9")).toBeCloseTo(130 / 54.252, 5);
    expect(pace.get("rawai-airport|rev|10")).toBeCloseTo(147 / 54.252, 5);
    expect(pace.get("rawai-airport|fwd")).toBeCloseTo(130 / 54.252, 5);
    expect(pace.get("rawai-airport|rev")).toBeCloseTo(147 / 54.252, 5);
  });

  it("calls a loop's trips 'lap', whatever direction they were recorded in", () => {
    const pace = buildPace([
      { lines: [{ routeId: "dragon-line", loop: true, lengthM: 4_398, trips: [{ dir: "fwd", departMs: NINE_AM, minutes: 30 }] }] },
    ]);
    expect(pace.has("dragon-line|lap")).toBe(true);
    expect(pace.has("dragon-line|fwd")).toBe(false);
  });

  it("ignores a trip with no time and a line with no length", () => {
    const pace = buildPace([day([{ dir: "fwd", departMs: NINE_AM, minutes: 0 }])]);
    expect(pace.size).toBe(0);
    expect(buildPace([day([{ dir: "fwd", departMs: NINE_AM, minutes: 30 }], 0)]).size).toBe(0);
  });
});

describe("minPerKm — the fallback chain", () => {
  const pace = buildPace([
    day([
      { dir: "fwd", departMs: NINE_AM, minutes: 130 },
      { dir: "fwd", departMs: NINE_AM + 600_000, minutes: 130 },
      { dir: "fwd", departMs: NINE_AM + 1_200_000, minutes: 130 },
    ]),
  ]);

  it("answers the hour when it has one, the direction when it does not", () => {
    expect(minPerKm(pace, "rawai-airport", "fwd", 9)).toBeCloseTo(130 / 54.252, 5);
    expect(minPerKm(pace, "rawai-airport", "fwd", 22)).toBeCloseTo(130 / 54.252, 5);
  });

  it("answers null when the line has never been recorded", () => {
    expect(minPerKm(pace, "no-such-line", "fwd", 9)).toBeNull();
  });
});

describe("the wire", () => {
  it("round-trips through JSON", () => {
    const pace = buildPace([day([{ dir: "fwd", departMs: NINE_AM, minutes: 130 }])]);
    const back = paceFromJson(paceToJson(pace));
    expect(back.get("rawai-airport|fwd")).toBeCloseTo(pace.get("rawai-airport|fwd")!, 3);
  });

  it("drops what it cannot read rather than guessing at it", () => {
    const back = paceFromJson({ "a|fwd": 2.4, "b|fwd": "x", "c|fwd": -1, "d|fwd": null });
    expect([...back.keys()]).toEqual(["a|fwd"]);
    expect(paceFromJson(null).size).toBe(0);
    expect(paceFromJson("nonsense").size).toBe(0);
  });
});

describe("the record itself", () => {
  it("counts the trips the pace was built from", () => {
    expect(countTrips([day([{ dir: "fwd", departMs: NINE_AM, minutes: 130 }])])).toBe(1);
    expect(countTrips([])).toBe(0);
  });

  it("reads the departure hour in Bangkok, not in UTC", () => {
    // 2026-10-28 02:00 UTC is 09:00 in Bangkok.
    expect(bkkHourOf(NINE_AM)).toBe(9);
    // 2026-10-27 19:00 UTC is 02:00 the next day in Bangkok.
    expect(bkkHourOf(Date.parse("2026-10-27T19:00:00Z"))).toBe(2);
  });
});
