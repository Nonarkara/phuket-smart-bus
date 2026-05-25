/**
 * Lock the SSOT contract so cross-surface drift can never come back.
 *
 * Every surface that surfaces a "bus count", "pax", "revenue", "CO₂" reads
 * from getHeadlineMetrics(). If anyone re-introduces a local filter or a
 * different aggregation, these tests fail.
 */

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { getHeadlineMetrics } from "./headlineMetrics";
import { setClockOverride } from "./fleetSimulator";
import { computeSimState } from "./simulation";

const SIM_OPEN_MIN = 540; // 09:00 — first scheduled departure already gone

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false });
});

afterEach(() => {
  setClockOverride(null);
  vi.useRealTimers();
});

describe("HeadlineMetrics — single source of truth", () => {
  it("returns the same numbers across two adjacent calls at the same sim minute", () => {
    setClockOverride(() => 720); // 12:00
    const a = getHeadlineMetrics();
    const b = getHeadlineMetrics();
    // Fleet must be stable within the same sim tick.
    expect(a.fleet).toEqual(b.fleet);
    expect(a.today).toEqual(b.today);
    expect(a.now).toEqual(b.now);
  });

  it("bus counts match what computeSimState reports for the same moment", () => {
    setClockOverride(() => 720);
    const headline = getHeadlineMetrics();
    const state = computeSimState();
    // The cumulative day numbers must agree EXACTLY between the SSOT
    // and the underlying simulation. If these diverge, /v2 (which uses
    // computeSimState directly) will disagree with /ops (which uses
    // getHeadlineMetrics) — that's the bug we just spent hours fixing.
    expect(headline.today.paxDelivered).toBe(state.paxDelivered);
    expect(headline.today.paxBoarded).toBe(state.paxBoarded);
    expect(headline.today.revenueThb).toBe(state.revenueThb);
    expect(headline.today.co2SavedKg).toBe(state.co2SavedKg);
    expect(headline.today.tripsCompleted).toBe(state.tripsCompleted);
    expect(headline.today.kmDriven).toBe(state.kmDriven);
  });

  it("monotonic across sim time — totals never decrease as the day progresses", () => {
    setClockOverride(() => SIM_OPEN_MIN); // 09:00
    const morning = getHeadlineMetrics();
    setClockOverride(() => 900); // 15:00
    const afternoon = getHeadlineMetrics();
    setClockOverride(() => 1200); // 20:00
    const evening = getHeadlineMetrics();

    expect(afternoon.today.paxDelivered).toBeGreaterThanOrEqual(morning.today.paxDelivered);
    expect(afternoon.today.revenueThb).toBeGreaterThanOrEqual(morning.today.revenueThb);
    expect(afternoon.today.co2SavedKg).toBeGreaterThanOrEqual(morning.today.co2SavedKg);
    expect(afternoon.today.kmDriven).toBeGreaterThanOrEqual(morning.today.kmDriven);

    expect(evening.today.paxDelivered).toBeGreaterThanOrEqual(afternoon.today.paxDelivered);
    expect(evening.today.revenueThb).toBeGreaterThanOrEqual(afternoon.today.revenueThb);
  });

  it("ferries + buses + orange sum to total vehicles", () => {
    setClockOverride(() => 720);
    const h = getHeadlineMetrics();
    expect(h.fleet.totalBuses + h.fleet.ferries + h.fleet.orange).toBe(h.fleet.totalVehicles);
  });

  it("moving + dwelling = total buses (no off-by-one)", () => {
    setClockOverride(() => 720);
    const h = getHeadlineMetrics();
    expect(h.fleet.movingBuses + h.fleet.dwellingBuses).toBe(h.fleet.totalBuses);
  });

  it("paxOnboard = paxBoarded - paxDelivered (always non-negative)", () => {
    setClockOverride(() => 720);
    const h = getHeadlineMetrics();
    expect(h.now.paxOnboard).toBe(Math.max(0, h.today.paxBoarded - h.today.paxDelivered));
    expect(h.now.paxOnboard).toBeGreaterThanOrEqual(0);
  });

  it("avgLoadPct ∈ [0, 100] and never NaN/Infinity", () => {
    for (const min of [540, 720, 900, 1080, 1320]) {
      setClockOverride(() => min);
      const h = getHeadlineMetrics();
      expect(Number.isFinite(h.now.avgLoadPct)).toBe(true);
      expect(h.now.avgLoadPct).toBeGreaterThanOrEqual(0);
      expect(h.now.avgLoadPct).toBeLessThanOrEqual(100);
    }
  });

  it("revenue = paxDelivered × 100 (฿100 flat fare)", () => {
    setClockOverride(() => 720);
    const h = getHeadlineMetrics();
    expect(h.today.revenueThb).toBe(h.today.paxDelivered * 100);
  });

  it("onTimePct ∈ [70, 99] (defaults to 97 when no buses active)", () => {
    setClockOverride(() => 720);
    const h = getHeadlineMetrics();
    expect(h.onTimePct).toBeGreaterThanOrEqual(70);
    expect(h.onTimePct).toBeLessThanOrEqual(99);
  });
});
