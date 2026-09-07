import { describe, expect, it } from "vitest";
import { BUS_CAPACITY, FARE_THB, getDayModel } from "./demandSupplyEngine";
import { getDayDebrief, getHourlyBalance, DAILY_OPEX_PER_BUS_THB } from "./v2OpsPanel";

describe("end-of-day debrief", () => {
  it("collected + lost = could-have-collected, both directions, same as the day model", () => {
    const d = getDayDebrief();
    const m = getDayModel();
    expect(d.collectedPax).toBe(m.combined.boarded);
    expect(d.couldHavePax).toBe(m.combined.demand);
    expect(d.collectedPax + d.lostPax).toBe(d.couldHavePax);
    expect(d.earnedThb).toBe(m.combined.revenueThb);
    expect(d.missedThb).toBe(m.combined.lostRevenueThb);
  });

  it("prices ADD hours in whole buses from the same per-direction gaps as the balance rows", () => {
    const d = getDayDebrief();
    const rows = getHourlyBalance();
    let addSum = 0;
    for (const h of d.addHours) {
      const row = rows[h.hour];
      expect(h.buses).toBe(row.busesToAdd);
      expect(h.thb).toBe(row.missedThb);
      addSum += h.buses;
    }
    expect(d.busesToAdd).toBe(addSum);
    expect(d.shortHours).toBe(rows.filter((r) => r.busesToAdd > 0).length);
  });

  it("only counts a LIGHT hour when a whole 25-seat trip carried nobody", () => {
    const d = getDayDebrief();
    const rows = getHourlyBalance();
    for (const h of d.lightHours_) {
      const row = rows[h.hour];
      const expected = Math.floor(Math.max(0, -row.inGapPax) / BUS_CAPACITY)
        + Math.floor(Math.max(0, -row.outGapPax) / BUS_CAPACITY);
      expect(h.buses).toBe(expected);
      expect(expected).toBeGreaterThan(0);
    }
  });

  it("nets every fleet scenario against its own opex, and a best move must clear it", () => {
    const d = getDayDebrief();
    expect(d.fleet.map((f) => f.deltaBuses)).toEqual([-2, -1, 1, 2, 3, 5, 8]);
    for (const f of d.fleet) {
      expect(f.deltaOpexThb).toBe(f.deltaBuses * DAILY_OPEX_PER_BUS_THB);
      expect(f.netThb).toBe(f.deltaRevenueThb - f.deltaOpexThb);
      expect(f.deltaRevenueThb).toBe(f.deltaBoarded * FARE_THB);
    }
    if (d.bestFleet) expect(d.bestFleet.netThb).toBeGreaterThan(0);
  });
});
