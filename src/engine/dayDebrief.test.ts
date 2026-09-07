import { afterEach, describe, expect, it } from "vitest";
import { BUS_CAPACITY, FARE_THB, getDayModel, getDayModelFor } from "./demandSupplyEngine";
import { getDayDebrief, getHourlyBalance, DAILY_OPEX_PER_BUS_THB } from "./v2OpsPanel";
import { getAirportDepartures, DAY_TARGET_END, SERVICE_END } from "./fleetSimulator";
import { getLiveTotals } from "./simulation";
import { getSimulationDay, setSimulationDay } from "./opsFlightSchedule";

const originalDay = getSimulationDay();
afterEach(() => setSimulationDay(originalDay));

describe("end-of-day debrief", () => {
  it("collected + lost + waiting = could-have-collected on every day of the week", () => {
    for (let dow = 0; dow < 7; dow++) {
      setSimulationDay(dow);
      const d = getDayDebrief();
      const m = getDayModel();
      expect(d.collectedPax, `dow ${dow} collected`).toBe(m.combined.boarded);
      expect(d.couldHavePax, `dow ${dow} couldHave`).toBe(m.combined.demand);
      expect(d.lostPax, `dow ${dow} lost`).toBe(m.combined.lost);
      // Midnight tail, pinned to the engine — not "couldHave − collected − lost"
      // computed in the debrief, which would hide a sourcing bug.
      expect(d.waitingPax, `dow ${dow} waiting`).toBe(m.waiting[SERVICE_END] ?? 0);
      expect(d.waitingPax).toBeGreaterThanOrEqual(0);
      expect(d.collectedPax + d.lostPax + d.waitingPax, `dow ${dow} 3-term`).toBe(d.couldHavePax);
      expect(d.earnedThb).toBe(m.combined.revenueThb);
      expect(d.missedThb).toBe(m.combined.lostRevenueThb);
    }
  });

  it("the midnight tail is not the 22:30 curb queue — last buses and patience still run", () => {
    // MiniMax's first write-up claimed the 10-pax gap was "still waiting at
    // 22:30". It isn't. 22:40 and 23:30 still depart, and 60-min patience
    // drains the earlier queue. Mixing the two clocks breaks conservation
    // against the live cards.
    const lateDeps = getAirportDepartures().filter((d) => d > 1350);
    expect(lateDeps.length).toBeGreaterThan(0);
    expect(DAY_TARGET_END).toBe(SERVICE_END);
    for (let dow = 0; dow < 7; dow++) {
      const m = getDayModelFor(dow);
      expect(m.waiting[1350], `dow ${dow} 22:30 queue`).toBeGreaterThan(m.waiting[SERVICE_END] ?? 0);
    }
  });

  it("DAY·60s freeze lands on the same conservation numbers the debrief prints", () => {
    for (let dow = 0; dow < 7; dow++) {
      setSimulationDay(dow);
      const d = getDayDebrief();
      const live = getLiveTotals(DAY_TARGET_END);
      expect(live.waiting, `dow ${dow} live waiting`).toBe(d.waitingPax);
      expect(live.paxBoarded, `dow ${dow} live boarded`).toBe(d.collectedPax);
      expect(live.paxAbandoned, `dow ${dow} live lost`).toBe(d.lostPax);
      expect(live.paxWantBus, `dow ${dow} live want`).toBe(d.couldHavePax);
      expect(live.paxBoarded + live.paxAbandoned + live.waiting).toBe(live.paxWantBus);
    }
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
    for (const h of d.lightHoursList) {
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
