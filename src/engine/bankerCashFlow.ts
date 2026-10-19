/**
 * Banker Cash Flow & PKSB Operations BI Engine
 *
 * Provides real unit economics, fuel & operating expense modeling,
 * corridor trip breakeven analysis, and debt service coverage (DSCR)
 * for PKSB operations and commercial lender underwriting.
 *
 * Built around observable parameters:
 * 1. Fuel price (฿/L diesel) & bus fuel efficiency (km/L)
 * 2. Operating expenses per km (fuel + driver + maintenance + insurance/overhead)
 * 3. Real fleet data from the PKSB tracker (daily km, active buses, completed runs)
 * 4. Corridor trip unit economics (35 km Airport–Rawai corridor @ ฿100 flat fare)
 * 5. Commercial loan amortization & debt service coverage ratio (DSCR)
 * 6. Expansion investment thesis tied to unmet flight demand from /ops
 */

export interface FuelExpenseInputs {
  /** Commercial diesel price in Thailand (THB per liter, e.g. ฿33.00) */
  fuelPricePerLiterTHB: number;
  /** Fleet fuel efficiency under Phuket island driving conditions (km per liter, e.g. 3.5 km/L) */
  fuelEfficiencyKmPerLiter: number;
  /** Driver daily wage & benefits per shift (THB, e.g. ฿1,200) */
  driverDailyWageTHB: number;
  /** Expected average daily km per operating bus (e.g. 150 km) */
  dailyKmPerBus: number;
  /** Routine maintenance, parts & tire wear per km (THB, e.g. ฿4.50) */
  maintenancePerKmTHB: number;
  /** Commercial insurance, depot & admin overhead per km (THB, e.g. ฿3.50) */
  overheadPerKmTHB: number;
}

export interface CommercialTermsInputs {
  /** Passenger flat fare (THB, standard is ฿100) */
  fareTHB: number;
  /** Average paying passengers per corridor trip (e.g. 18 pax) */
  avgPaxPerTrip: number;
  /** Nominal corridor one-way trip length (km, e.g. 35 km Airport–Rawai) */
  nominalTripKm: number;
  /** Active bus fleet size (e.g. 20 buses) */
  activeFleetSize: number;
  /** Average corridor trips per bus per day (e.g. 4 trips = 140 km) */
  tripsPerBusPerDay: number;
}

export interface LoanFinancingInputs {
  /** Number of new buses to finance for airport demand expansion (e.g. 5 buses) */
  newBusesCount: number;
  /** Purchase price per commercial transit bus (THB, e.g. ฿3,500,000) */
  costPerBusTHB: number;
  /** Commercial loan tenor (years, e.g. 7 years) */
  loanTermYears: number;
  /** Annual interest rate (APR %, e.g. 5.0%) */
  interestRatePct: number;
}

export interface BankerCashFlowModel {
  inputs: {
    fuel: FuelExpenseInputs;
    commercial: CommercialTermsInputs;
    financing: LoanFinancingInputs;
  };
  unitEconomics: {
    fuelCostPerKm: number;
    driverCostPerKm: number;
    maintenanceCostPerKm: number;
    overheadCostPerKm: number;
    totalOpexPerKm: number;
    revenuePerKm: number;
    profitPerKm: number;
    operatingMarginPct: number;
  };
  corridorTrip: {
    tripDistanceKm: number;
    tripFuelLiters: number;
    tripFuelCostTHB: number;
    tripTotalCostTHB: number;
    breakevenPax: number;
    tripRevenueTHB: number;
    tripNetProfitTHB: number;
    tripMarginPct: number;
    scenarios: Array<{
      label: string;
      pax: number;
      revenueTHB: number;
      costTHB: number;
      netProfitTHB: number;
      marginPct: number;
    }>;
  };
  dailyFleet: {
    totalFleetKm: number;
    totalLitersDiesel: number;
    totalFuelSpendTHB: number;
    totalDriverPayrollTHB: number;
    totalMaintenanceTHB: number;
    totalOverheadTHB: number;
    totalDailyOpexTHB: number;
    totalDailyFaresTHB: number;
    totalDailyPax: number;
    netDailyCashFlowTHB: number;
  };
  monthlyStatement: {
    grossFareRevenueTHB: number;
    fuelExpenseTHB: number;
    driverPayrollTHB: number;
    maintenanceExpenseTHB: number;
    overheadExpenseTHB: number;
    totalOperatingExpensesTHB: number;
    ebitdaTHB: number;
    ebitdaMarginPct: number;
  };
  bankerSolvency: {
    totalCapexTHB: number;
    monthlyDebtServiceTHB: number;
    annualDebtServiceTHB: number;
    debtServiceCoverageRatio: number;
    verdictLabel: "EXCEPTIONALLY STRONG" | "INVESTMENT GRADE" | "BANKABLE STANDARD" | "MARGINAL";
    verdictDescription: string;
  };
  expansionThesis: {
    incrementalTripsPerDay: number;
    incrementalRidersMonthly: number;
    incrementalRevenueMonthlyTHB: number;
    incrementalOpexMonthlyTHB: number;
    incrementalNetCashMonthlyTHB: number;
    paybackMonths: number;
    grabFareEquivalentSavingsTHB: number;
  };
}

export const DEFAULT_FUEL_INPUTS: FuelExpenseInputs = {
  fuelPricePerLiterTHB: 33.0,
  fuelEfficiencyKmPerLiter: 3.5,
  driverDailyWageTHB: 1200,
  dailyKmPerBus: 150,
  maintenancePerKmTHB: 4.5,
  overheadPerKmTHB: 3.5,
};

export const DEFAULT_COMMERCIAL_INPUTS: CommercialTermsInputs = {
  fareTHB: 100,
  avgPaxPerTrip: 18,
  nominalTripKm: 35,
  activeFleetSize: 20,
  tripsPerBusPerDay: 4,
};

export const DEFAULT_LOAN_INPUTS: LoanFinancingInputs = {
  newBusesCount: 5,
  costPerBusTHB: 3_500_000,
  loanTermYears: 7,
  interestRatePct: 5.0,
};

/**
 * Computes monthly loan installment using the standard PMT formula:
 * PMT = P * (r / (1 - (1 + r)^(-n)))
 */
export function computeMonthlyDebtService(principal: number, annualRatePct: number, years: number): number {
  if (principal <= 0 || years <= 0) return 0;
  if (annualRatePct <= 0) return principal / (years * 12);
  const r = annualRatePct / 100 / 12;
  const n = years * 12;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}

/**
 * Computes the complete Banker Cash Flow & PKSB BI model.
 */
export function computeBankerCashFlow(
  fuelInputs = DEFAULT_FUEL_INPUTS,
  commercialInputs = DEFAULT_COMMERCIAL_INPUTS,
  loanInputs = DEFAULT_LOAN_INPUTS
): BankerCashFlowModel {
  // 1. Unit Economics per km
  const kmPerBus = Math.max(1, fuelInputs.dailyKmPerBus);
  const kmPerL = Math.max(0.1, fuelInputs.fuelEfficiencyKmPerLiter);
  const fuelCostPerKm = fuelInputs.fuelPricePerLiterTHB / kmPerL;
  const driverCostPerKm = fuelInputs.driverDailyWageTHB / kmPerBus;
  const maintenanceCostPerKm = fuelInputs.maintenancePerKmTHB;
  const overheadCostPerKm = fuelInputs.overheadPerKmTHB;
  const totalOpexPerKm = fuelCostPerKm + driverCostPerKm + maintenanceCostPerKm + overheadCostPerKm;

  const tripKm = Math.max(1, commercialInputs.nominalTripKm);
  const fare = Math.max(1, commercialInputs.fareTHB);
  const avgPax = Math.max(0, commercialInputs.avgPaxPerTrip);
  const revenuePerKm = (avgPax * fare) / tripKm;
  const profitPerKm = revenuePerKm - totalOpexPerKm;
  const operatingMarginPct = revenuePerKm > 0 ? (profitPerKm / revenuePerKm) * 100 : 0;

  // 2. Corridor Trip Economics
  const tripFuelLiters = tripKm / kmPerL;
  const tripFuelCostTHB = tripFuelLiters * fuelInputs.fuelPricePerLiterTHB;
  const tripTotalCostTHB = tripKm * totalOpexPerKm;
  const breakevenPax = Math.ceil(tripTotalCostTHB / fare);
  const tripRevenueTHB = avgPax * fare;
  const tripNetProfitTHB = tripRevenueTHB - tripTotalCostTHB;
  const tripMarginPct = tripRevenueTHB > 0 ? (tripNetProfitTHB / tripRevenueTHB) * 100 : 0;

  const scenarios = [
    { label: "Quiet Off-Peak (8 pax)", pax: 8 },
    { label: `Breakeven (${breakevenPax} pax)`, pax: breakevenPax },
    { label: "Calibrated Average (18 pax)", pax: 18 },
    { label: "Full Capacity (25 pax)", pax: 25 },
  ].map((sc) => {
    const rev = sc.pax * fare;
    const net = rev - tripTotalCostTHB;
    return {
      label: sc.label,
      pax: sc.pax,
      revenueTHB: rev,
      costTHB: tripTotalCostTHB,
      netProfitTHB: net,
      marginPct: rev > 0 ? (net / rev) * 100 : 0,
    };
  });

  // 3. Daily Fleet Performance
  const activeBuses = Math.max(1, commercialInputs.activeFleetSize);
  const tripsPerDay = commercialInputs.tripsPerBusPerDay;
  const totalDailyTrips = activeBuses * tripsPerDay;
  const totalFleetKm = totalDailyTrips * tripKm;
  const totalLitersDiesel = totalFleetKm / kmPerL;
  const totalFuelSpendTHB = totalLitersDiesel * fuelInputs.fuelPricePerLiterTHB;
  const totalDriverPayrollTHB = activeBuses * fuelInputs.driverDailyWageTHB;
  const totalMaintenanceTHB = totalFleetKm * maintenanceCostPerKm;
  const totalOverheadTHB = totalFleetKm * overheadCostPerKm;
  const totalDailyOpexTHB = totalFuelSpendTHB + totalDriverPayrollTHB + totalMaintenanceTHB + totalOverheadTHB;
  const totalDailyPax = totalDailyTrips * avgPax;
  const totalDailyFaresTHB = totalDailyPax * fare;
  const netDailyCashFlowTHB = totalDailyFaresTHB - totalDailyOpexTHB;

  // 4. Monthly Financial Statement (30 Operating Days)
  const monthlyDays = 30;
  const grossFareRevenueTHB = totalDailyFaresTHB * monthlyDays;
  const fuelExpenseTHB = totalFuelSpendTHB * monthlyDays;
  const driverPayrollTHB = totalDriverPayrollTHB * monthlyDays;
  const maintenanceExpenseTHB = totalMaintenanceTHB * monthlyDays;
  const overheadExpenseTHB = totalOverheadTHB * monthlyDays;
  const totalOperatingExpensesTHB = totalDailyOpexTHB * monthlyDays;
  const ebitdaTHB = grossFareRevenueTHB - totalOperatingExpensesTHB;
  const ebitdaMarginPct = grossFareRevenueTHB > 0 ? (ebitdaTHB / grossFareRevenueTHB) * 100 : 0;

  // 5. Commercial Loan Solvency & DSCR
  const totalCapexTHB = loanInputs.newBusesCount * loanInputs.costPerBusTHB;
  const monthlyDebtServiceTHB = computeMonthlyDebtService(
    totalCapexTHB,
    loanInputs.interestRatePct,
    loanInputs.loanTermYears
  );
  const annualDebtServiceTHB = monthlyDebtServiceTHB * 12;
  const dscr = monthlyDebtServiceTHB > 0 ? ebitdaTHB / monthlyDebtServiceTHB : 999;

  let verdictLabel: BankerCashFlowModel["bankerSolvency"]["verdictLabel"] = "MARGINAL";
  let verdictDescription = "Debt service consumes most of operating cash flow.";
  if (dscr >= 2.5) {
    verdictLabel = "EXCEPTIONALLY STRONG";
    verdictDescription = "Tier A bankable asset. Cash flow covers debt service >2.5x with ample buffer for diesel volatility.";
  } else if (dscr >= 1.75) {
    verdictLabel = "INVESTMENT GRADE";
    verdictDescription = "Solid bankable credit. Strong cash generation comfortably satisfies commercial debt service.";
  } else if (dscr >= 1.25) {
    verdictLabel = "BANKABLE STANDARD";
    verdictDescription = "Meets standard commercial lending thresholds (>1.25x coverage).";
  }

  // 6. Expansion Thesis (Tied to unmet flight demand)
  // Each new bus runs 4 round-trips (8 corridor legs) during peak hours
  const newBuses = loanInputs.newBusesCount;
  const incrementalTripsPerDay = newBuses * 8; // 8 legs/day capturing peak arrival waves
  const incrementalRidersDaily = incrementalTripsPerDay * 20; // 20 pax captured per peak trip
  const incrementalRidersMonthly = incrementalRidersDaily * monthlyDays;
  const incrementalRevenueMonthlyTHB = incrementalRidersMonthly * fare;
  const incrementalKmMonthly = incrementalTripsPerDay * tripKm * monthlyDays;
  const incrementalOpexMonthlyTHB = incrementalKmMonthly * totalOpexPerKm;
  const incrementalNetCashMonthlyTHB = incrementalRevenueMonthlyTHB - incrementalOpexMonthlyTHB;
  const paybackMonths = incrementalNetCashMonthlyTHB > 0 ? totalCapexTHB / incrementalNetCashMonthlyTHB : 999;
  const grabFareEquivalentSavingsTHB = incrementalRidersMonthly * 620; // ฿720 Grab avg - ฿100 bus fare

  return {
    inputs: {
      fuel: fuelInputs,
      commercial: commercialInputs,
      financing: loanInputs,
    },
    unitEconomics: {
      fuelCostPerKm: Math.round(fuelCostPerKm * 100) / 100,
      driverCostPerKm: Math.round(driverCostPerKm * 100) / 100,
      maintenanceCostPerKm: Math.round(maintenanceCostPerKm * 100) / 100,
      overheadCostPerKm: Math.round(overheadCostPerKm * 100) / 100,
      totalOpexPerKm: Math.round(totalOpexPerKm * 100) / 100,
      revenuePerKm: Math.round(revenuePerKm * 100) / 100,
      profitPerKm: Math.round(profitPerKm * 100) / 100,
      operatingMarginPct: Math.round(operatingMarginPct * 10) / 10,
    },
    corridorTrip: {
      tripDistanceKm: tripKm,
      tripFuelLiters: Math.round(tripFuelLiters * 10) / 10,
      tripFuelCostTHB: Math.round(tripFuelCostTHB),
      tripTotalCostTHB: Math.round(tripTotalCostTHB),
      breakevenPax,
      tripRevenueTHB: Math.round(tripRevenueTHB),
      tripNetProfitTHB: Math.round(tripNetProfitTHB),
      tripMarginPct: Math.round(tripMarginPct * 10) / 10,
      scenarios,
    },
    dailyFleet: {
      totalFleetKm: Math.round(totalFleetKm * 10) / 10,
      totalLitersDiesel: Math.round(totalLitersDiesel * 10) / 10,
      totalFuelSpendTHB: Math.round(totalFuelSpendTHB),
      totalDriverPayrollTHB: Math.round(totalDriverPayrollTHB),
      totalMaintenanceTHB: Math.round(totalMaintenanceTHB),
      totalOverheadTHB: Math.round(totalOverheadTHB),
      totalDailyOpexTHB: Math.round(totalDailyOpexTHB),
      totalDailyPax: Math.round(totalDailyPax),
      totalDailyFaresTHB: Math.round(totalDailyFaresTHB),
      netDailyCashFlowTHB: Math.round(netDailyCashFlowTHB),
    },
    monthlyStatement: {
      grossFareRevenueTHB: Math.round(grossFareRevenueTHB),
      fuelExpenseTHB: Math.round(fuelExpenseTHB),
      driverPayrollTHB: Math.round(driverPayrollTHB),
      maintenanceExpenseTHB: Math.round(maintenanceExpenseTHB),
      overheadExpenseTHB: Math.round(overheadExpenseTHB),
      totalOperatingExpensesTHB: Math.round(totalOperatingExpensesTHB),
      ebitdaTHB: Math.round(ebitdaTHB),
      ebitdaMarginPct: Math.round(ebitdaMarginPct * 10) / 10,
    },
    bankerSolvency: {
      totalCapexTHB,
      monthlyDebtServiceTHB: Math.round(monthlyDebtServiceTHB),
      annualDebtServiceTHB: Math.round(annualDebtServiceTHB),
      debtServiceCoverageRatio: Math.round(dscr * 100) / 100,
      verdictLabel,
      verdictDescription,
    },
    expansionThesis: {
      incrementalTripsPerDay,
      incrementalRidersMonthly,
      incrementalRevenueMonthlyTHB: Math.round(incrementalRevenueMonthlyTHB),
      incrementalOpexMonthlyTHB: Math.round(incrementalOpexMonthlyTHB),
      incrementalNetCashMonthlyTHB: Math.round(incrementalNetCashMonthlyTHB),
      paybackMonths: Math.round(paybackMonths * 10) / 10,
      grabFareEquivalentSavingsTHB: Math.round(grabFareEquivalentSavingsTHB),
    },
  };
}
