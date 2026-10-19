import { describe, it, expect } from "vitest";
import {
  computeBankerCashFlow,
  computeMonthlyDebtService,
  DEFAULT_FUEL_INPUTS,
  DEFAULT_COMMERCIAL_INPUTS,
  DEFAULT_LOAN_INPUTS,
} from "./bankerCashFlow";

describe("bankerCashFlow Engine", () => {
  it("computes monthly loan debt service accurately with PMT formula", () => {
    // ฿17.5M principal at 5.0% over 7 years
    const payment = computeMonthlyDebtService(17_500_000, 5.0, 7);
    // Standard annuity: ~฿247,000 / month
    expect(payment).toBeGreaterThan(240_000);
    expect(payment).toBeLessThan(255_000);
  });

  it("calculates unit economics per km accurately based on diesel and maintenance", () => {
    const model = computeBankerCashFlow();
    // Fuel: 33 / 3.5 = 9.43 THB/km
    expect(model.unitEconomics.fuelCostPerKm).toBeCloseTo(9.43, 1);
    // Driver: 1200 / 150 = 8.00 THB/km
    expect(model.unitEconomics.driverCostPerKm).toBeCloseTo(8.0, 1);
    // Maintenance: 4.50 THB/km, Overhead: 3.50 THB/km
    // Total: ~25.43 THB/km
    expect(model.unitEconomics.totalOpexPerKm).toBeCloseTo(25.43, 1);

    // Revenue: 18 pax * 100 fare / 35 km = 51.43 THB/km
    expect(model.unitEconomics.revenuePerKm).toBeCloseTo(51.43, 1);
    // Net profit: ~26.00 THB/km (~50.6% margin)
    expect(model.unitEconomics.profitPerKm).toBeCloseTo(26.0, 1);
    expect(model.unitEconomics.operatingMarginPct).toBeGreaterThan(50);
  });

  it("calculates corridor trip breakeven passengers correctly", () => {
    const model = computeBankerCashFlow();
    // Trip cost for 35 km = 35 * 25.43 = ~890 THB
    expect(model.corridorTrip.tripTotalCostTHB).toBeGreaterThan(850);
    expect(model.corridorTrip.tripTotalCostTHB).toBeLessThan(950);

    // At ฿100/pax, 9 or 10 passengers break even
    expect(model.corridorTrip.breakevenPax).toBeLessThanOrEqual(10);
    expect(model.corridorTrip.breakevenPax).toBeGreaterThanOrEqual(9);

    // Check scenarios
    const breakevenScenario = model.corridorTrip.scenarios.find((s) => s.label.includes("Breakeven"));
    expect(breakevenScenario).toBeDefined();
    expect(breakevenScenario!.netProfitTHB).toBeGreaterThanOrEqual(0);

    const fullCapacityScenario = model.corridorTrip.scenarios.find((s) => s.label.includes("Full Capacity"));
    expect(fullCapacityScenario).toBeDefined();
    expect(fullCapacityScenario!.revenueTHB).toBe(2500);
    expect(fullCapacityScenario!.netProfitTHB).toBeGreaterThan(1500);
    expect(fullCapacityScenario!.marginPct).toBeGreaterThan(60);
  });

  it("evaluates banker loan solvency and Debt Service Coverage Ratio (DSCR)", () => {
    const model = computeBankerCashFlow();
    // Monthly EBITDA for 20 buses carrying 18 pax should be > ฿1.5M/month
    expect(model.monthlyStatement.ebitdaTHB).toBeGreaterThan(1_500_000);
    expect(model.monthlyStatement.ebitdaMarginPct).toBeGreaterThan(45);

    // DSCR against 5 new buses debt service (~฿247k/mo) should be > 4.0x
    expect(model.bankerSolvency.debtServiceCoverageRatio).toBeGreaterThan(4.0);
    expect(model.bankerSolvency.verdictLabel).toBe("EXCEPTIONALLY STRONG");
  });

  it("calculates fleet expansion payback period based on unmet airport peak demand", () => {
    const model = computeBankerCashFlow();
    // 5 new buses running 8 legs/day capturing 20 peak riders/trip
    expect(model.expansionThesis.incrementalTripsPerDay).toBe(40);
    expect(model.expansionThesis.incrementalRevenueMonthlyTHB).toBe(2_400_000); // 800 pax/day * ฿100 * 30 days
    expect(model.expansionThesis.paybackMonths).toBeLessThan(18); // Under 1.5 years payback
    expect(model.expansionThesis.paybackMonths).toBeGreaterThan(8);
  });

  it("adjusts dynamically when fuel/gas price changes", () => {
    // High diesel price scenario: ฿45/L (e.g. oil spike)
    const expensiveFuel = {
      ...DEFAULT_FUEL_INPUTS,
      fuelPricePerLiterTHB: 45.0,
    };
    const model = computeBankerCashFlow(expensiveFuel);
    // Fuel cost: 45 / 3.5 = 12.86 THB/km
    expect(model.unitEconomics.fuelCostPerKm).toBeCloseTo(12.86, 1);
    expect(model.unitEconomics.totalOpexPerKm).toBeCloseTo(28.86, 1);
    // Breakeven rises to 11 pax
    expect(model.corridorTrip.breakevenPax).toBe(11);
    // Still healthy profit margin at 18 pax (>40%)
    expect(model.unitEconomics.operatingMarginPct).toBeGreaterThan(40);
  });
});
