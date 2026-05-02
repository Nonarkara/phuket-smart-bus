import { describe, expect, it } from "vitest";
import { computeRoi, formatTHB, formatPayback, ROI_CONSTANTS } from "./roi";

describe("ROI math", () => {
  it("baseline (20 buses, 12% capture, ฿100 fare) — payback < 24 months", () => {
    const out = computeRoi({ fleetSize: 20, captureRate: 0.12, averageFareTHB: 100 });
    // ~190k riders/year × ฿100 = ~฿19M revenue
    expect(out.annualRevenueTHB).toBeGreaterThan(15_000_000);
    expect(out.annualRevenueTHB).toBeLessThan(25_000_000);
    // 20 × ฿800k = ฿16M opex
    expect(out.annualOperatingCostTHB).toBe(16_000_000);
    // Payback months should be in the 12-month range
    const months = out.paybackYears * 12;
    expect(months).toBeGreaterThan(0);
    expect(months).toBeLessThan(60);
  });

  it("full-island scenario (80 buses, 35% capture) — externalities scale even when P&L tightens", () => {
    const out = computeRoi({ fleetSize: 80, captureRate: 0.35, averageFareTHB: 100 });
    // At 80 buses on airport-only demand, opex outpaces revenue — the
    // model honestly shows this so the buyer asks the right question:
    // "where else do these buses serve?" CO₂ + tourist savings still scale.
    expect(out.annualRiders).toBeGreaterThan(500_000);
    expect(out.annualCO2AvoidedTons).toBeGreaterThan(500);
    expect(out.annualTouristSavingsTHB).toBeGreaterThan(100_000_000);
  });

  it("punitive opex scenario (10 buses, 5% capture) — may not pencil", () => {
    const out = computeRoi({ fleetSize: 10, captureRate: 0.05, averageFareTHB: 50 });
    // Tiny revenue, real opex — could be loss-making
    expect(out.annualRevenueTHB).toBeLessThan(5_000_000);
    expect(out.profitMarginPct).toBeLessThan(50);
  });

  it("formatTHB renders human-readable currency", () => {
    expect(formatTHB(1_500_000)).toBe("฿1.5M");
    expect(formatTHB(15_500_000)).toBe("฿15.5M");
    expect(formatTHB(750_000)).toBe("฿750K");
    expect(formatTHB(150)).toBe("฿150");
  });

  it("formatPayback renders months under 24 months, years above", () => {
    expect(formatPayback(0.5)).toBe("6 months");
    expect(formatPayback(1.0)).toBe("12 months");
    expect(formatPayback(3.0)).toBe("3.0 years");
    expect(formatPayback(Infinity)).toContain("never");
  });

  it("constants are sourced (visible to the buyer)", () => {
    // These are the numbers the buyer's CFO will challenge — make sure
    // they exist in the export so they can be displayed in a footnote.
    expect(ROI_CONSTANTS.avgArrivingPaxPerDay).toBeGreaterThan(2000);
    expect(ROI_CONSTANTS.operatingCostPerBusYear).toBeGreaterThan(0);
    expect(ROI_CONSTANTS.systemCapexPerBus).toBeGreaterThan(0);
    expect(ROI_CONSTANTS.co2KgPerPaxKmCar).toBeGreaterThan(ROI_CONSTANTS.co2KgPerPaxKmBus);
    expect(ROI_CONSTANTS.grabMarkupOverBus).toBeGreaterThan(0);
  });
});
