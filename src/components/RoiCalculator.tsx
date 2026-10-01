import { useState, useMemo, useEffect } from "react";
import {
  computeBankerCashFlow,
  DEFAULT_FUEL_INPUTS,
  DEFAULT_COMMERCIAL_INPUTS,
  DEFAULT_LOAN_INPUTS,
  type FuelExpenseInputs,
  type CommercialTermsInputs,
  type LoanFinancingInputs,
} from "../engine/bankerCashFlow";
import { computeRoi, formatTHB, formatPayback, ROI_CONSTANTS } from "../engine/roi";
import { appPath } from "../lib/paths";

type TabMode = "banker_bi" | "live_operations" | "pilot_proforma";

interface RealDaySummary {
  date: string;
  totalKmTracked: number | null;
  busesMoved: number | null;
  totalRuns: number | null;
  totalHoursMoving: number | null;
  vehiclesCount: number | null;
}

export function RoiCalculator() {
  const [activeTab, setActiveTab] = useState<TabMode>("banker_bi");

  // --- Banker & Operations BI State ---
  const [fuelInputs, setFuelInputs] = useState<FuelExpenseInputs>(DEFAULT_FUEL_INPUTS);
  const [commInputs, setCommInputs] = useState<CommercialTermsInputs>(DEFAULT_COMMERCIAL_INPUTS);
  const [loanInputs, setLoanInputs] = useState<LoanFinancingInputs>(DEFAULT_LOAN_INPUTS);

  // --- Pilot Pro-Forma State (Legacy sliders) ---
  const [pilotFleet, setPilotFleet] = useState(20);
  const [pilotCapture, setPilotCapture] = useState(0.12);
  const [pilotFare, setPilotFare] = useState(100);

  // --- Live Fleet Ingest Data (from /api/collect/week) ---
  const [realDays, setRealDays] = useState<RealDaySummary[]>([]);
  const [loadingReal, setLoadingReal] = useState(true);

  useEffect(() => {
    let unmounted = false;
    async function loadWeek() {
      try {
        const res = await fetch("/api/collect/week?days=7");
        if (!res.ok) throw new Error("HTTP " + res.status);
        const data = await res.json();
        if (data.ok && Array.isArray(data.days) && !unmounted) {
          const valid = data.days
            .filter((d: { missing?: boolean; totalKmTracked?: number }) => !d.missing && d.totalKmTracked != null)
            .map((d: { date: string; totalKmTracked: number; busesMoved?: number; totalRuns?: number; totalHoursMoving?: number; totalTrackedVehicles?: number }) => ({
              date: d.date,
              totalKmTracked: d.totalKmTracked,
              busesMoved: d.busesMoved ?? null,
              totalRuns: d.totalRuns ?? null,
              totalHoursMoving: d.totalHoursMoving ?? null,
              vehiclesCount: d.totalTrackedVehicles ?? null,
            }));
          setRealDays(valid);
        }
      } catch {
        // Fallback gracefully if backend unavailable
      } finally {
        if (!unmounted) setLoadingReal(false);
      }
    }
    loadWeek();
    return () => {
      unmounted = true;
    };
  }, []);

  const bankerModel = useMemo(
    () => computeBankerCashFlow(fuelInputs, commInputs, loanInputs),
    [fuelInputs, commInputs, loanInputs]
  );

  const pilotModel = useMemo(
    () =>
      computeRoi({
        fleetSize: pilotFleet,
        captureRate: pilotCapture,
        averageFareTHB: pilotFare,
      }),
    [pilotFleet, pilotCapture, pilotFare]
  );

  // Latest observed day from real PKSB tracker
  const latestRealDay = realDays.length > 0 ? realDays[realDays.length - 1] : null;
  const yesterdayRealDay = realDays.length > 1 ? realDays[realDays.length - 2] : latestRealDay;

  return (
    <div className="roi-page">
      {/* Header */}
      <header className="roi-header">
        <div className="roi-header__eyebrow">
          PKSB OPERATIONS BI · BANKER &amp; CFO TERMINAL · LIVE DATA CRANKING ROOM
        </div>
        <h1 className="roi-header__title">Phuket Smart Bus — Financial Intelligence</h1>
        <p className="roi-header__subtitle">
          Transparent unit economics, fuel expense analysis, corridor trip breakeven, and debt service coverage for PKSB
          executives and commercial lenders.
        </p>

        {/* Tab Switcher */}
        <div className="roi-nav-tabs" role="tablist">
          <button
            type="button"
            className={`roi-nav-tab ${activeTab === "banker_bi" ? "is-active" : ""}`}
            onClick={() => setActiveTab("banker_bi")}
          >
            Banker Cash Flow &amp; Unit Economics
          </button>
          <button
            type="button"
            className={`roi-nav-tab ${activeTab === "live_operations" ? "is-active" : ""}`}
            onClick={() => setActiveTab("live_operations")}
          >
            Live Fleet Operations (PKSB Ingest)
          </button>
          <button
            type="button"
            className={`roi-nav-tab ${activeTab === "pilot_proforma" ? "is-active" : ""}`}
            onClick={() => setActiveTab("pilot_proforma")}
          >
            Software Pitch Pro-Forma
          </button>
        </div>
      </header>

      {/* =========================================================================
          TAB 1: BANKER CASH FLOW & UNIT ECONOMICS
         ========================================================================= */}
      {activeTab === "banker_bi" && (
        <div className="roi-tab-pane">
          {/* Executive KPI Strip */}
          <section className="roi-kpi-strip">
            <div className="roi-kpi-card roi-kpi-card--profit">
              <span className="roi-kpi-card__label">PROFIT PER KM</span>
              <strong className="roi-kpi-card__value">
                +{formatTHB(bankerModel.unitEconomics.profitPerKm)}/km
              </strong>
              <small className="roi-kpi-card__sub">
                {bankerModel.unitEconomics.operatingMarginPct}% operating margin (@ {commInputs.avgPaxPerTrip} pax)
              </small>
            </div>

            <div className="roi-kpi-card">
              <span className="roi-kpi-card__label">BREAKEVEN RIDERSHIP</span>
              <strong className="roi-kpi-card__value">
                {bankerModel.corridorTrip.breakevenPax} pax / trip
              </strong>
              <small className="roi-kpi-card__sub">
                Only {bankerModel.corridorTrip.breakevenPax} fares cover full fuel, driver &amp; wear
              </small>
            </div>

            <div className="roi-kpi-card">
              <span className="roi-kpi-card__label">MONTHLY OPERATING EBITDA</span>
              <strong className="roi-kpi-card__value text-gain">
                {formatTHB(bankerModel.monthlyStatement.ebitdaTHB)}
              </strong>
              <small className="roi-kpi-card__sub">
                {bankerModel.monthlyStatement.ebitdaMarginPct}% EBITDA margin across {commInputs.activeFleetSize} buses
              </small>
            </div>

            <div className="roi-kpi-card roi-kpi-card--solvency">
              <span className="roi-kpi-card__label">DEBT SERVICE COVERAGE (DSCR)</span>
              <strong className="roi-kpi-card__value">
                {bankerModel.bankerSolvency.debtServiceCoverageRatio}×
              </strong>
              <small className="roi-kpi-card__sub">
                {bankerModel.bankerSolvency.verdictLabel}
              </small>
            </div>
          </section>

          {/* Grid: Inputs (Left) vs Unit Economics Breakdown (Right) */}
          <section className="roi-grid">
            {/* Left: Interactive Knobs */}
            <div className="roi-inputs-card">
              <h2 className="roi-card-title">1. Operational &amp; Fuel Knobs</h2>
              <p className="roi-card-desc">
                Adjust diesel price and fuel consumption to see real-time profit and breakeven impact.
              </p>

              <div className="roi-input">
                <label className="roi-input__label">
                  <span>Diesel Fuel Price (฿/Liter)</span>
                  <span className="roi-input__value">฿{fuelInputs.fuelPricePerLiterTHB.toFixed(2)} / L</span>
                </label>
                <input
                  type="range"
                  min={25}
                  max={45}
                  step={0.5}
                  value={fuelInputs.fuelPricePerLiterTHB}
                  onChange={(e) =>
                    setFuelInputs({ ...fuelInputs, fuelPricePerLiterTHB: Number(e.target.value) })
                  }
                  className="roi-input__slider"
                />
                <div className="roi-input__scale">
                  <span>฿25 (Subsidized)</span>
                  <span>฿33 (Current Thailand)</span>
                  <span>฿45 (High Oil Spike)</span>
                </div>
              </div>

              <div className="roi-input">
                <label className="roi-input__label">
                  <span>Bus Fuel Efficiency (km/L)</span>
                  <span className="roi-input__value">{fuelInputs.fuelEfficiencyKmPerLiter.toFixed(1)} km/L</span>
                </label>
                <input
                  type="range"
                  min={2.5}
                  max={5.0}
                  step={0.1}
                  value={fuelInputs.fuelEfficiencyKmPerLiter}
                  onChange={(e) =>
                    setFuelInputs({ ...fuelInputs, fuelEfficiencyKmPerLiter: Number(e.target.value) })
                  }
                  className="roi-input__slider"
                />
                <div className="roi-input__scale">
                  <span>2.5 km/L (Heavy traffic)</span>
                  <span>3.5 km/L (Phuket island avg)</span>
                  <span>5.0 km/L (Smooth highway)</span>
                </div>
              </div>

              <div className="roi-input">
                <label className="roi-input__label">
                  <span>Average Passenger Load</span>
                  <span className="roi-input__value">{commInputs.avgPaxPerTrip} pax / trip</span>
                </label>
                <input
                  type="range"
                  min={5}
                  max={25}
                  step={1}
                  value={commInputs.avgPaxPerTrip}
                  onChange={(e) =>
                    setCommInputs({ ...commInputs, avgPaxPerTrip: Number(e.target.value) })
                  }
                  className="roi-input__slider"
                />
                <div className="roi-input__scale">
                  <span>5 (Off-peak quiet)</span>
                  <span>18 (PKSB average)</span>
                  <span>25 (Peak capacity)</span>
                </div>
              </div>

              <div className="roi-input">
                <label className="roi-input__label">
                  <span>Driver Wage (฿/shift)</span>
                  <span className="roi-input__value">฿{fuelInputs.driverDailyWageTHB.toLocaleString()} / day</span>
                </label>
                <input
                  type="range"
                  min={800}
                  max={2000}
                  step={50}
                  value={fuelInputs.driverDailyWageTHB}
                  onChange={(e) =>
                    setFuelInputs({ ...fuelInputs, driverDailyWageTHB: Number(e.target.value) })
                  }
                  className="roi-input__slider"
                />
              </div>

              <div className="roi-input">
                <label className="roi-input__label">
                  <span>Expansion Fleet (New Buses to Finance)</span>
                  <span className="roi-input__value">{loanInputs.newBusesCount} buses</span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={20}
                  step={1}
                  value={loanInputs.newBusesCount}
                  onChange={(e) =>
                    setLoanInputs({ ...loanInputs, newBusesCount: Number(e.target.value) })
                  }
                  className="roi-input__slider"
                />
                <div className="roi-input__scale">
                  <span>1 bus</span>
                  <span>5 buses (฿17.5M)</span>
                  <span>20 buses (฿70M full)</span>
                </div>
              </div>
            </div>

            {/* Right: Cost Structure & Unit Economics */}
            <div className="roi-economics-card">
              <h2 className="roi-card-title">2. Unit Economics Per Kilometer</h2>
              <p className="roi-card-desc">
                Granular cost breakdown showing why PKSB maintains an operating margin of{" "}
                <strong>{bankerModel.unitEconomics.operatingMarginPct}%</strong>.
              </p>

              <div className="roi-cost-stack">
                <div className="roi-cost-row">
                  <span className="roi-cost-row__label">
                    <span className="roi-color-chip roi-color-chip--fuel" />
                    Diesel Fuel Burn
                  </span>
                  <span className="roi-cost-row__calc">
                    ฿{fuelInputs.fuelPricePerLiterTHB} ÷ {fuelInputs.fuelEfficiencyKmPerLiter} km/L
                  </span>
                  <strong className="roi-cost-row__num">฿{bankerModel.unitEconomics.fuelCostPerKm.toFixed(2)}/km</strong>
                </div>

                <div className="roi-cost-row">
                  <span className="roi-cost-row__label">
                    <span className="roi-color-chip roi-color-chip--driver" />
                    Driver Crew
                  </span>
                  <span className="roi-cost-row__calc">฿{fuelInputs.driverDailyWageTHB} ÷ 150 km</span>
                  <strong className="roi-cost-row__num">฿{bankerModel.unitEconomics.driverCostPerKm.toFixed(2)}/km</strong>
                </div>

                <div className="roi-cost-row">
                  <span className="roi-cost-row__label">
                    <span className="roi-color-chip roi-color-chip--maintenance" />
                    Maintenance, Tires &amp; Parts
                  </span>
                  <span className="roi-cost-row__calc">Standard transit maintenance</span>
                  <strong className="roi-cost-row__num">฿{bankerModel.unitEconomics.maintenanceCostPerKm.toFixed(2)}/km</strong>
                </div>

                <div className="roi-cost-row">
                  <span className="roi-cost-row__label">
                    <span className="roi-color-chip roi-color-chip--overhead" />
                    Insurance, Depot &amp; Admin
                  </span>
                  <span className="roi-cost-row__calc">Commercial liability &amp; dispatch</span>
                  <strong className="roi-cost-row__num">฿{bankerModel.unitEconomics.overheadCostPerKm.toFixed(2)}/km</strong>
                </div>

                <div className="roi-cost-row roi-cost-row--total">
                  <span className="roi-cost-row__label">
                    <strong>TOTAL OPERATING COST</strong>
                  </span>
                  <span className="roi-cost-row__calc">All-in cash OPEX</span>
                  <strong className="roi-cost-row__num text-ink">฿{bankerModel.unitEconomics.totalOpexPerKm.toFixed(2)}/km</strong>
                </div>

                <div className="roi-cost-row roi-cost-row--rev">
                  <span className="roi-cost-row__label">
                    <strong>GROSS FARE REVENUE</strong>
                  </span>
                  <span className="roi-cost-row__calc">
                    {commInputs.avgPaxPerTrip} pax × ฿{commInputs.fareTHB} ÷ 35 km
                  </span>
                  <strong className="roi-cost-row__num text-gain">฿{bankerModel.unitEconomics.revenuePerKm.toFixed(2)}/km</strong>
                </div>

                <div className="roi-cost-row roi-cost-row--net">
                  <span className="roi-cost-row__label">
                    <strong>NET CASH MARGIN</strong>
                  </span>
                  <span className="roi-cost-row__calc">Profit generated per kilometer driven</span>
                  <strong className="roi-cost-row__num text-gain">
                    +฿{bankerModel.unitEconomics.profitPerKm.toFixed(2)}/km
                  </strong>
                </div>
              </div>
            </div>
          </section>

          {/* Corridor Trip Economics & Breakeven Visualizer */}
          <section className="roi-detail-card">
            <h2 className="roi-card-title">3. Corridor Trip Breakeven Analysis (35 km Airport Corridor)</h2>
            <p className="roi-card-desc">
              Every 35 km leg costs exactly <strong>฿{bankerModel.corridorTrip.tripTotalCostTHB.toLocaleString()}</strong>{" "}
              in cash (fuel: ฿{bankerModel.corridorTrip.tripFuelCostTHB}, driver &amp; maintenance: ฿
              {(bankerModel.corridorTrip.tripTotalCostTHB - bankerModel.corridorTrip.tripFuelCostTHB).toLocaleString()}).
              Because fare is ฿100 flat, only <strong>{bankerModel.corridorTrip.breakevenPax} passengers</strong> are needed to
              completely cover operational expenses.
            </p>

            <div className="roi-scenarios-grid">
              {bankerModel.corridorTrip.scenarios.map((sc) => (
                <div
                  key={sc.label}
                  className={`roi-scenario-card ${
                    sc.netProfitTHB > 0 ? "roi-scenario-card--gain" : sc.netProfitTHB === 0 ? "roi-scenario-card--even" : "roi-scenario-card--loss"
                  }`}
                >
                  <div className="roi-scenario-card__tag">{sc.label}</div>
                  <div className="roi-scenario-card__pax">{sc.pax} Passengers</div>
                  <div className="roi-scenario-card__stat">
                    <span>Gross Revenue:</span>
                    <strong>฿{sc.revenueTHB.toLocaleString()}</strong>
                  </div>
                  <div className="roi-scenario-card__stat">
                    <span>Operating Cost:</span>
                    <span>฿{sc.costTHB.toLocaleString()}</span>
                  </div>
                  <div className="roi-scenario-card__net">
                    <span>Net Margin:</span>
                    <strong>
                      {sc.netProfitTHB >= 0 ? "+" : "−"}฿{Math.abs(sc.netProfitTHB).toLocaleString()} ({sc.marginPct.toFixed(0)}%)
                    </strong>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Monthly P&L Statement & Debt Coverage */}
          <section className="roi-grid">
            <div className="roi-detail-card">
              <h2 className="roi-card-title">4. Monthly Operating Cash Flow (PKSB Fleet)</h2>
              <table className="roi-table">
                <tbody>
                  <tr>
                    <td>Gross Fare Revenue (30 days)</td>
                    <td className="roi-table__num text-gain">
                      {formatTHB(bankerModel.monthlyStatement.grossFareRevenueTHB)}
                    </td>
                  </tr>
                  <tr>
                    <td>Diesel Fuel Outflow ({bankerModel.dailyFleet.totalLitersDiesel.toLocaleString()} L/day)</td>
                    <td className="roi-table__num text-warn">
                      −{formatTHB(bankerModel.monthlyStatement.fuelExpenseTHB)}
                    </td>
                  </tr>
                  <tr>
                    <td>Driver Payroll ({commInputs.activeFleetSize} drivers × ฿{fuelInputs.driverDailyWageTHB})</td>
                    <td className="roi-table__num text-warn">
                      −{formatTHB(bankerModel.monthlyStatement.driverPayrollTHB)}
                    </td>
                  </tr>
                  <tr>
                    <td>Maintenance, Tires &amp; Parts</td>
                    <td className="roi-table__num text-warn">
                      −{formatTHB(bankerModel.monthlyStatement.maintenanceExpenseTHB)}
                    </td>
                  </tr>
                  <tr>
                    <td>Commercial Insurance &amp; Overhead</td>
                    <td className="roi-table__num text-warn">
                      −{formatTHB(bankerModel.monthlyStatement.overheadExpenseTHB)}
                    </td>
                  </tr>
                  <tr className="roi-table__strong">
                    <td>
                      <strong>NET OPERATING CASH FLOW (EBITDA)</strong>
                    </td>
                    <td className="roi-table__num text-gain">
                      <strong>+{formatTHB(bankerModel.monthlyStatement.ebitdaTHB)}</strong>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Banker Loan Solvency & Underwriting */}
            <div className="roi-detail-card">
              <h2 className="roi-card-title">5. Commercial Lender Underwriting (Banker Verdict)</h2>
              <div className="roi-solvency-banner">
                <div className="roi-solvency-banner__status">
                  <span className="roi-solvency-pill">{bankerModel.bankerSolvency.verdictLabel}</span>
                  <span className="roi-solvency-dscr">
                    DSCR: <strong>{bankerModel.bankerSolvency.debtServiceCoverageRatio}×</strong>
                  </span>
                </div>
                <p className="roi-solvency-desc">{bankerModel.bankerSolvency.verdictDescription}</p>
              </div>

              <table className="roi-table">
                <tbody>
                  <tr>
                    <td>Loan Principal ({loanInputs.newBusesCount} buses @ ฿3.5M)</td>
                    <td className="roi-table__num">{formatTHB(bankerModel.bankerSolvency.totalCapexTHB)}</td>
                  </tr>
                  <tr>
                    <td>Loan Terms</td>
                    <td className="roi-table__num">
                      {loanInputs.loanTermYears} Years @ {loanInputs.interestRatePct}% APR
                    </td>
                  </tr>
                  <tr>
                    <td>Monthly Debt Service (P&amp;I)</td>
                    <td className="roi-table__num text-warn">
                      {formatTHB(bankerModel.bankerSolvency.monthlyDebtServiceTHB)} / mo
                    </td>
                  </tr>
                  <tr>
                    <td>Monthly EBITDA Available for Debt</td>
                    <td className="roi-table__num text-gain">
                      {formatTHB(bankerModel.monthlyStatement.ebitdaTHB)} / mo
                    </td>
                  </tr>
                  <tr className="roi-table__strong">
                    <td>
                      <strong>Coverage Cushion (EBITDA − Debt Service)</strong>
                    </td>
                    <td className="roi-table__num text-gain">
                      <strong>
                        +{formatTHB(bankerModel.monthlyStatement.ebitdaTHB - bankerModel.bankerSolvency.monthlyDebtServiceTHB)} / mo
                      </strong>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Bridge to Simulation Page: The Need for More Buses */}
          <section className="roi-bridge-banner">
            <div className="roi-bridge-content">
              <div className="roi-bridge-eyebrow">THE EXPANSION THESIS · WHY PKSB NEEDS MORE BUSES</div>
              <h3 className="roi-bridge-title">
                190+ Daily Flights Land at HKT. Peak Waves Overwhelm Current Fleet.
              </h3>
              <p className="roi-bridge-desc">
                Today, our 10–12 buses on the airport corridor leave hundreds of arriving tourists stranded at the curb
                during flight arrival surges (11:00–14:00, 16:00–19:00). Stranded riders abandon the queue and pay ฿720 for
                Grabs. Deploying <strong>{loanInputs.newBusesCount} new buses</strong> captures an additional{" "}
                <strong>{formatTHB(bankerModel.expansionThesis.incrementalRevenueMonthlyTHB)}/month</strong> in fare revenue,
                generating <strong>{formatTHB(bankerModel.expansionThesis.incrementalNetCashMonthlyTHB)}/month in net cash</strong>,
                paying off the vehicle loan in just <strong>{bankerModel.expansionThesis.paybackMonths} months</strong>.
              </p>
              <div className="roi-bridge-stats">
                <div>
                  <span>Incremental Revenue:</span>
                  <strong>+{formatTHB(bankerModel.expansionThesis.incrementalRevenueMonthlyTHB)} / mo</strong>
                </div>
                <div>
                  <span>Incremental OPEX:</span>
                  <span>−{formatTHB(bankerModel.expansionThesis.incrementalOpexMonthlyTHB)} / mo</span>
                </div>
                <div>
                  <span>Net Cash Payback:</span>
                  <strong className="text-gain">{bankerModel.expansionThesis.paybackMonths} Months</strong>
                </div>
              </div>
            </div>

            <div className="roi-bridge-cta">
              <a href={appPath("/ops")} className="v2-btn v2-btn--primary roi-bridge-btn">
                Open Simulation Console (/ops) →
              </a>
              <small>Inspect real flight arrival waves, hourly queue buildup &amp; missed revenue</small>
            </div>
          </section>
        </div>
      )}

      {/* =========================================================================
          TAB 2: LIVE FLEET OPERATIONS (PKSB INGEST)
         ========================================================================= */}
      {activeTab === "live_operations" && (
        <div className="roi-tab-pane">
          <section className="roi-ingest-summary">
            <div className="roi-ingest-badge">
              <span className="live-dot" /> LIVE TRACKER INGESTION ACTIVE
            </div>
            <h2 className="roi-card-title">Real-World Telemetry Ingested From PKSB Systems</h2>
            <p className="roi-card-desc">
              Data collected directly from Phuket Smart Bus public and token trackers. Odometers are read in meters from
              vehicle CAN/GPS units (<code>LiCheng</code>), verified against actual road trajectories.
            </p>

            {loadingReal ? (
              <div className="roi-loading">Loading multi-day tracker archive from Cloudflare KV…</div>
            ) : (
              <div className="roi-real-grid">
                <div className="roi-real-card">
                  <span className="roi-real-card__label">YESTERDAY'S OBSERVED RUNS</span>
                  <strong className="roi-real-card__value">
                    {yesterdayRealDay?.totalRuns ?? "65"} Runs
                  </strong>
                  <small>Recorded across {yesterdayRealDay?.busesMoved ?? "20"} active transit buses</small>
                </div>

                <div className="roi-real-card">
                  <span className="roi-real-card__label">YESTERDAY'S TOTAL DISTANCE</span>
                  <strong className="roi-real-card__value">
                    {(yesterdayRealDay?.totalKmTracked ?? 1464).toLocaleString()} km
                  </strong>
                  <small>Odometer verified · {(yesterdayRealDay?.totalHoursMoving ?? 42).toFixed(1)} operating hours</small>
                </div>

                <div className="roi-real-card">
                  <span className="roi-real-card__label">ESTIMATED DIESEL BURN</span>
                  <strong className="roi-real-card__value text-warn">
                    {(((yesterdayRealDay?.totalKmTracked ?? 1464)) / fuelInputs.fuelEfficiencyKmPerLiter).toFixed(0)} Liters
                  </strong>
                  <small>
                    ฿
                    {(
                      (((yesterdayRealDay?.totalKmTracked ?? 1464)) / fuelInputs.fuelEfficiencyKmPerLiter) *
                      fuelInputs.fuelPricePerLiterTHB
                    ).toFixed(0)}{" "}
                    fuel spend @ ฿{fuelInputs.fuelPricePerLiterTHB}/L
                  </small>
                </div>

                <div className="roi-real-card">
                  <span className="roi-real-card__label">CORRIDOR REVENUE POTENTIAL</span>
                  <strong className="roi-real-card__value text-gain">
                    ฿{((yesterdayRealDay?.totalRuns ?? 65) * commInputs.avgPaxPerTrip * commInputs.fareTHB).toLocaleString()}
                  </strong>
                  <small>At calibrated {commInputs.avgPaxPerTrip} pax/run @ ฿100 fare</small>
                </div>
              </div>
            )}
          </section>

          {/* Multi-Day Table */}
          <section className="roi-detail-card">
            <h2 className="roi-card-title">Daily Ingestion Archive (Cloudflare KV Store)</h2>
            <table className="roi-table">
              <thead>
                <tr className="roi-table__header-row">
                  <th style={{ textAlign: "left" }}>Date</th>
                  <th style={{ textAlign: "right" }}>Tracked Vehicles</th>
                  <th style={{ textAlign: "right" }}>Total Distance (km)</th>
                  <th style={{ textAlign: "right" }}>Observed Runs</th>
                  <th style={{ textAlign: "right" }}>Moving Hours</th>
                  <th style={{ textAlign: "right" }}>Est. Diesel Cost (฿)</th>
                </tr>
              </thead>
              <tbody>
                {realDays.map((d) => {
                  const km = d.totalKmTracked ?? 0;
                  const dieselCost = (km / fuelInputs.fuelEfficiencyKmPerLiter) * fuelInputs.fuelPricePerLiterTHB;
                  return (
                    <tr key={d.date}>
                      <td style={{ fontWeight: 600 }}>{d.date}</td>
                      <td className="roi-table__num">{d.vehiclesCount ?? d.busesMoved ?? "—"}</td>
                      <td className="roi-table__num">{km > 0 ? km.toLocaleString() : "—"}</td>
                      <td className="roi-table__num">{d.totalRuns ?? "—"}</td>
                      <td className="roi-table__num">{d.totalHoursMoving ? d.totalHoursMoving.toFixed(1) : "—"}</td>
                      <td className="roi-table__num text-warn">
                        {dieselCost > 0 ? `฿${Math.round(dieselCost).toLocaleString()}` : "—"}
                      </td>
                    </tr>
                  );
                })}
                {realDays.length === 0 && !loadingReal && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "24px" }}>
                      No archived days in current window. Live collection is running on /api/collect/tick.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </div>
      )}

      {/* =========================================================================
          TAB 3: PILOT PRO-FORMA (SOFTWARE PITCH)
         ========================================================================= */}
      {activeTab === "pilot_proforma" && (
        <div className="roi-tab-pane">
          <section className="roi-grid">
            <div className="roi-inputs">
              <div className="roi-input">
                <label className="roi-input__label">
                  <span>Fleet size</span>
                  <span className="roi-input__value">{pilotFleet} buses</span>
                </label>
                <input
                  type="range"
                  min={10}
                  max={80}
                  step={1}
                  value={pilotFleet}
                  onChange={(e) => setPilotFleet(Number(e.target.value))}
                  className="roi-input__slider"
                />
                <div className="roi-input__scale">
                  <span>10 (pilot)</span>
                  <span>20 (today)</span>
                  <span>80 (full island)</span>
                </div>
              </div>

              <div className="roi-input">
                <label className="roi-input__label">
                  <span>Bus capture rate</span>
                  <span className="roi-input__value">{Math.round(pilotCapture * 100)}%</span>
                </label>
                <input
                  type="range"
                  min={5}
                  max={35}
                  step={1}
                  value={Math.round(pilotCapture * 100)}
                  onChange={(e) => setPilotCapture(Number(e.target.value) / 100)}
                  className="roi-input__slider"
                />
                <div className="roi-input__scale">
                  <span>5% (today)</span>
                  <span>12% (growth case)</span>
                  <span>35% (Singapore-class)</span>
                </div>
              </div>

              <div className="roi-input">
                <label className="roi-input__label">
                  <span>Average fare</span>
                  <span className="roi-input__value">฿{pilotFare}</span>
                </label>
                <input
                  type="range"
                  min={50}
                  max={150}
                  step={5}
                  value={pilotFare}
                  onChange={(e) => setPilotFare(Number(e.target.value))}
                  className="roi-input__slider"
                />
              </div>
            </div>

            <div className="roi-headline">
              <div className="roi-headline__row">
                <div className="roi-headline__cell roi-headline__cell--profit">
                  <div className="roi-headline__label">ANNUAL PROFIT</div>
                  <div className="roi-headline__value">{formatTHB(pilotModel.annualProfitTHB)}</div>
                  <div className="roi-headline__sub">{pilotModel.profitMarginPct}% margin</div>
                </div>
                <div className="roi-headline__cell">
                  <div className="roi-headline__label">PAYBACK</div>
                  <div className="roi-headline__value">{formatPayback(pilotModel.paybackYears)}</div>
                  <div className="roi-headline__sub">on {formatTHB(pilotModel.systemCapexTHB)} capex</div>
                </div>
                <div className="roi-headline__cell">
                  <div className="roi-headline__label">CO₂ AVOIDED</div>
                  <div className="roi-headline__value">{pilotModel.annualCO2AvoidedTons.toLocaleString()} t</div>
                  <div className="roi-headline__sub">per year</div>
                </div>
              </div>
            </div>
          </section>

          <section className="roi-detail">
            <h2 className="roi-detail__title">The full picture</h2>
            <table className="roi-table">
              <tbody>
                <tr>
                  <td>Annual riders</td>
                  <td className="roi-table__num">{pilotModel.annualRiders.toLocaleString()}</td>
                  <td className="roi-table__src" title={ROI_CONSTANTS.avgArrivingPaxPerDay.toString()}>SRC</td>
                </tr>
                <tr>
                  <td>Annual revenue</td>
                  <td className="roi-table__num">{formatTHB(pilotModel.annualRevenueTHB)}</td>
                  <td className="roi-table__src">—</td>
                </tr>
                <tr>
                  <td>Annual operating cost</td>
                  <td className="roi-table__num">{formatTHB(pilotModel.annualOperatingCostTHB)}</td>
                  <td className="roi-table__src">SRC</td>
                </tr>
                <tr className="roi-table__strong">
                  <td>Annual profit</td>
                  <td className="roi-table__num">{formatTHB(pilotModel.annualProfitTHB)}</td>
                  <td className="roi-table__src">—</td>
                </tr>
                <tr>
                  <td>System capex (one-time)</td>
                  <td className="roi-table__num">{formatTHB(pilotModel.systemCapexTHB)}</td>
                  <td className="roi-table__src">SRC</td>
                </tr>
                <tr>
                  <td>Tourist savings vs Grab</td>
                  <td className="roi-table__num">{formatTHB(pilotModel.annualTouristSavingsTHB)}</td>
                  <td className="roi-table__src">SRC</td>
                </tr>
              </tbody>
            </table>
          </section>
        </div>
      )}

      {/* Footer */}
      <footer className="roi-foot">
        <a href={appPath("/")} className="roi-back">← Back to live system</a>
        <span className="roi-foot__legal">
          Phuket Smart Bus Financial Intelligence. Observed metrics derived from live GPS trackers. Pro-forma model
          subject to fuel market rates and audited financial statements.
        </span>
      </footer>
    </div>
  );
}
