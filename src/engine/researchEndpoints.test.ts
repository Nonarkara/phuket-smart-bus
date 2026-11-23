import { afterEach, describe, expect, it, vi } from "vitest";
import { finishedServiceDates, RESEARCH_FIRST_DAY, RESEARCH_RULES, type D1Read } from "../../shared/researchStore";
import { onRequestGet as getPace } from "../../functions/api/research/pace";
import { onRequestGet as getPeriod } from "../../functions/api/research/period";

function makeKv(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    store,
    get: vi.fn(async (k: string) => store.get(k) ?? null),
    put: vi.fn(async (k: string, v: string) => { store.set(k, v); }),
  };
}

function makeEmptyD1(): D1Read {
  return {
    prepare: () => ({
      bind: () => ({
        all: async <T>() => ({ results: [] as T[] }),
      }),
    }),
  };
}

function slimEntry(date: string) {
  return JSON.stringify({
    date,
    lines: [
      {
        routeId: "rawai-airport",
        lengthM: 54252,
        trips: [
          { plate: "10-1204", dir: "fwd", departMs: Date.parse(`${date}T01:30:00Z`), arriveMs: Date.parse(`${date}T03:40:00Z`), minutes: 130 },
        ],
      },
    ],
  });
}

describe("finishedServiceDates", () => {
  it("rolls forward past FIRST_DAY + 45 days instead of freezing at 2026-11-15", () => {
    const dates = finishedServiceDates("2026-11-23", RESEARCH_FIRST_DAY, 45);
    expect(dates).toHaveLength(45);
    expect(dates[0]).toBe("2026-10-09");
    expect(dates[dates.length - 1]).toBe("2026-11-22");
    expect(dates).not.toContain("2026-11-23");
  });

  it("returns all finished days when fewer than maxDays have elapsed", () => {
    const dates = finishedServiceDates("2026-10-05", RESEARCH_FIRST_DAY, 45);
    expect(dates).toEqual(["2026-10-02", "2026-10-03", "2026-10-04"]);
  });
});

describe("research rolling endpoints (pace & period)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("pace does not cache incomplete responses in KV while pending days remain, and caches once complete", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-23T06:00:00Z")); // 13:00 BKK -> service date 2026-11-23

    const dates = finishedServiceDates("2026-11-23", RESEARCH_FIRST_DAY, 45);
    const seed: Record<string, string> = {};
    // Leave the last 4 days uncached so COMPUTE_PER_REQUEST=2 leaves 2 pending
    for (const d of dates.slice(0, -4)) {
      seed[`research:slim:${RESEARCH_RULES}:${d}`] = slimEntry(d);
    }

    const kv = makeKv(seed);
    const env = { FIXES: makeEmptyD1(), GPS_HISTORY: kv };

    const firstRes = await getPace({ request: new Request("https://bus.nonarkara.org/api/research/pace"), env });
    const first = (await firstRes.json()) as {
      ok: boolean; rules: string; from: string; through: string; pending: string[];
    };
    expect(first.ok).toBe(true);
    expect(first.rules).toBe(RESEARCH_RULES);
    expect(first.from).toBe("2026-10-09");
    expect(first.through).toBe("2026-11-22");
    expect(first.pending).toHaveLength(2);
    expect(kv.store.has(`research:pace:${RESEARCH_RULES}:2026-11-23`)).toBe(false);

    // Populate the remaining 4 days and call again -> pending is empty and KV caches the rollup
    for (const d of dates.slice(-4)) {
      kv.store.set(`research:slim:${RESEARCH_RULES}:${d}`, slimEntry(d));
    }
    const secondRes = await getPace({ request: new Request("https://bus.nonarkara.org/api/research/pace"), env });
    const second = (await secondRes.json()) as { ok: boolean; days: number; pending: string[] };
    expect(second.ok).toBe(true);
    expect(second.days).toBe(45);
    expect(second.pending).toEqual([]);
    expect(kv.store.has(`research:pace:${RESEARCH_RULES}:2026-11-23`)).toBe(true);
  });

  it("period uses shared RESEARCH_RULES and rolls through yesterday", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-23T06:00:00Z"));

    const dates = finishedServiceDates("2026-11-23", RESEARCH_FIRST_DAY, 45);
    const seed: Record<string, string> = {};
    for (const d of dates) {
      seed[`research:slim:${RESEARCH_RULES}:${d}`] = slimEntry(d);
    }
    const kv = makeKv(seed);
    const env = { FIXES: makeEmptyD1(), GPS_HISTORY: kv };

    const res = await getPeriod({ request: new Request("https://bus.nonarkara.org/api/research/period"), env });
    const body = (await res.json()) as {
      ok: boolean; rules: string; firstDay: string; through: string; days: { date: string }[]; pending: string[];
    };
    expect(body.ok).toBe(true);
    expect(body.rules).toBe(RESEARCH_RULES);
    expect(body.firstDay).toBe("2026-10-09");
    expect(body.through).toBe("2026-11-22");
    expect(body.days).toHaveLength(45);
    expect(body.pending).toEqual([]);
  });
});
