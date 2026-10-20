/**
 * PolicyConcessionSandbox — interactive deal and financing simulator.
 *
 * Plugs directly into the Build & Finance tab of the Toolkit.
 * Designed for municipal leaders, DLT officials, concessionaires, and bankers.
 * Lets the user test the financial viability of a bus concession under
 * varying fleet sizes, fares, subsidies, and dedicated lane policies.
 */

import { useMemo, useState } from "react";

export function PolicyConcessionSandbox() {
  const [concessionYears, setConcessionYears] = useState<number>(10);
  const [fleetSize, setFleetSize] = useState<number>(16);
  const [fareThb, setFareThb] = useState<number>(100);
  const [annualSubsidyMThb, setAnnualSubsidyMThb] = useState<number>(12);
  const [hasDedicatedLane, setHasDedicatedLane] = useState<boolean>(true);

  // Financial and operating modeling
  const financials = useMemo(() => {
    // Capex per bus: ~฿4.5M (modern air-conditioned EV bus + charging share)
    const busUnitCostM = 4.5;
    const initialCapexM = fleetSize * busUnitCostM + 15; // +฿15M depot & charging infrastructure

    // Cycle time: 52km one way. Without dedicated lane: 95m (speed ~26km/h).
    // With dedicated lane: 65m (speed ~38km/h)
    const cycleTimeMin = hasDedicatedLane ? 150 : 210; // full round trip + layover
    const dailyTripsPerBus = Math.floor((16.5 * 60) / cycleTimeMin);
    const totalDailyFleetTrips = fleetSize * dailyTripsPerBus;

    // Daily seats offered: trips × 25 seats
    const dailySeatsOffered = totalDailyFleetTrips * 25;

    // Daily ridership capture based on fare, frequency (fleet size), and speed (bus lane)
    const baseDemand = 3600; // daily corridor demand pool
    const fareElasticity = fareThb === 50 ? 1.35 : fareThb === 100 ? 1.0 : 0.72;
    const speedBoost = hasDedicatedLane ? 1.25 : 1.0;
    const availabilityRate = Math.min(1.0, dailySeatsOffered / 3000);
    const dailyRiders = Math.min(
      dailySeatsOffered,
      Math.round(baseDemand * availabilityRate * fareElasticity * speedBoost)
    );

    // Annual Farebox Revenue in Million THB
    const annualFareboxRevenueM = (dailyRiders * fareThb * 365) / 1_000_000;
    const totalAnnualRevenueM = annualFareboxRevenueM + annualSubsidyMThb;

    // Annual Operating Cost (Opex):
    // Driver wages, maintenance, electricity/fuel, insurance, depot operations ~ ฿32/km (EV) vs ฿42/km
    const kmPerTrip = 52;
    const totalAnnualKmM = (totalDailyFleetTrips * kmPerTrip * 365) / 1_000_000;
    const costPerKmM = 34 / 1_000_000; // ฿34 per km
    const annualOpexM = totalAnnualKmM * 34 + (fleetSize * 0.45); // +fixed admin/fleet overhead

    // EBITDA
    const annualEbitdaM = totalAnnualRevenueM - annualOpexM;
    const ebitdaMarginPct = totalAnnualRevenueM > 0 ? Math.round((annualEbitdaM / totalAnnualRevenueM) * 100) : 0;

    // Simple payback & estimated IRR
    const simplePaybackYears = annualEbitdaM > 0 ? initialCapexM / annualEbitdaM : Infinity;
    const isFinanciallyViable = simplePaybackYears <= concessionYears;

    // Estimated 10-yr IRR approximation
    const estimatedIrrPct = annualEbitdaM <= 0
      ? 0
      : Math.min(35, Math.max(0, Math.round(((annualEbitdaM / initialCapexM) - (1 / concessionYears)) * 100)));

    // Modal shift: private car trips replaced
    const carsDivertedDaily = Math.round(dailyRiders * 0.68);
    const co2SavedAnnualTons = Math.round((dailyRiders * 28 * 0.15 * 365) / 1000);

    return {
      initialCapexM,
      totalDailyFleetTrips,
      dailySeatsOffered,
      dailyRiders,
      annualFareboxRevenueM,
      totalAnnualRevenueM,
      annualOpexM,
      annualEbitdaM,
      ebitdaMarginPct,
      simplePaybackYears,
      isFinanciallyViable,
      estimatedIrrPct,
      carsDivertedDaily,
      co2SavedAnnualTons
    };
  }, [concessionYears, fleetSize, fareThb, annualSubsidyMThb, hasDedicatedLane]);

  return (
    <section className="pcs-sandbox" aria-labelledby="pcs-title">
      <header className="pcs-head">
        <span className="tk-kicker">Interactive Policy & Financing Sandbox · Build & Finance</span>
        <h3 id="pcs-title">Transit Concession Viability & Deal Simulator</h3>
        <p className="pcs-subtitle">
          Can a private bus operator in Phuket survive on farebox revenue alone? Test different concession models,
          subsidy structures, fleet investments, and dedicated transit lanes to see the resulting IRR and citywide impact.
        </p>
      </header>

      {/* Control Levers */}
      <div className="pcs-controls">
        {/* Fleet Size */}
        <div className="pcs-control">
          <label className="pcs-control__label">
            <span>Fleet Size</span>
            <strong>{fleetSize} Buses (Initial Capex: ฿{financials.initialCapexM.toFixed(1)}M)</strong>
          </label>
          <div className="pcs-pill-group">
            {[10, 16, 24, 32].map((f) => (
              <button
                key={f}
                type="button"
                className={`pcs-pill ${fleetSize === f ? "is-active" : ""}`}
                onClick={() => setFleetSize(f)}
              >
                {f} Buses
              </button>
            ))}
          </div>
        </div>

        {/* Fare Structure */}
        <div className="pcs-control">
          <label className="pcs-control__label">
            <span>Fare Policy</span>
            <strong>฿{fareThb} Flat Rate</strong>
          </label>
          <div className="pcs-pill-group">
            {[
              { fare: 50, label: "฿50 (Mass Adoption)" },
              { fare: 100, label: "฿100 (Current Operator Fare)" },
              { fare: 150, label: "฿150 (Premium Tourist)" }
            ].map((p) => (
              <button
                key={p.fare}
                type="button"
                className={`pcs-pill ${fareThb === p.fare ? "is-active" : ""}`}
                onClick={() => setFareThb(p.fare)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dedicated Bus Lane Toggle */}
        <div className="pcs-control">
          <label className="pcs-control__label">
            <span>Transit Priority (Dedicated Bus Lane)</span>
            <strong>{hasDedicatedLane ? "Active (Bypasses Patong Hill Congestion)" : "None (Stuck in Mixed Traffic)"}</strong>
          </label>
          <div className="pcs-pill-group">
            <button
              type="button"
              className={`pcs-pill ${hasDedicatedLane ? "is-active" : ""}`}
              onClick={() => setHasDedicatedLane(true)}
            >
              Dedicated Bus Lane (+28% Speed)
            </button>
            <button
              type="button"
              className={`pcs-pill ${!hasDedicatedLane ? "is-active" : ""}`}
              onClick={() => setHasDedicatedLane(false)}
            >
              Mixed Traffic (Standard)
            </button>
          </div>
        </div>

        {/* Municipal Support / Public Subsidy */}
        <div className="pcs-control">
          <label className="pcs-control__label">
            <span>Municipal Service Contract Subsidy</span>
            <strong>฿{annualSubsidyMThb}M / year</strong>
          </label>
          <div className="pcs-pill-group">
            {[
              { sub: 0, label: "฿0M (Pure Farebox)" },
              { sub: 12, label: "฿12M/yr (Depa / Smart City)" },
              { sub: 24, label: "฿24M/yr (Full Public Support)" }
            ].map((s) => (
              <button
                key={s.sub}
                type="button"
                className={`pcs-pill ${annualSubsidyMThb === s.sub ? "is-active" : ""}`}
                onClick={() => setAnnualSubsidyMThb(s.sub)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Outcome Cards */}
      <div className="pcs-results">
        <div className="pcs-card">
          <span className="pcs-card__label">Annual Operator EBITDA</span>
          <strong className={`pcs-card__value ${financials.annualEbitdaM >= 0 ? "is-gain" : "is-loss"}`}>
            ฿{financials.annualEbitdaM.toFixed(1)}M
          </strong>
          <small className="pcs-card__sub">
            {financials.annualEbitdaM >= 0
              ? `${financials.ebitdaMarginPct}% EBITDA margin`
              : "Operating at a deficit"}
          </small>
        </div>

        <div className="pcs-card">
          <span className="pcs-card__label">Project Payback & IRR</span>
          <strong className={`pcs-card__value ${financials.isFinanciallyViable ? "is-gain" : "is-warn"}`}>
            {financials.isFinanciallyViable
              ? `${financials.simplePaybackYears.toFixed(1)} yrs · ~${financials.estimatedIrrPct}% IRR`
              : "Unviable without Subsidy"}
          </strong>
          <small className="pcs-card__sub">
            {financials.isFinanciallyViable
              ? `Fully repaid within ${concessionYears}-year concession`
              : "Concession period too short to repay capital"}
          </small>
        </div>

        <div className="pcs-card">
          <span className="pcs-card__label">Daily Riders Captured</span>
          <strong className="pcs-card__value">
            {financials.dailyRiders.toLocaleString()} pax/day
          </strong>
          <small className="pcs-card__sub">
            {financials.carsDivertedDaily.toLocaleString()} private cars eliminated/day
          </small>
        </div>

        <div className="pcs-card">
          <span className="pcs-card__label">Annual CO₂ Avoided</span>
          <strong className="pcs-card__value is-gain">
            {financials.co2SavedAnnualTons.toLocaleString()} tons
          </strong>
          <small className="pcs-card__sub">
            APTA 0.15 kg/pax-km modal displacement
          </small>
        </div>
      </div>

      {/* Banker / Minister Bottomline */}
      <div className="pcs-summary">
        <strong>The Deal Takeaway:</strong> {financials.isFinanciallyViable ? (
          <span>
            With {fleetSize} buses and {hasDedicatedLane ? "a dedicated transit lane" : "mixed traffic"}, this concession is <strong>bankable</strong>.
            The operator repays initial capital in {financials.simplePaybackYears.toFixed(1)} years with a healthy ~{financials.estimatedIrrPct}% IRR,
            diverting {financials.carsDivertedDaily.toLocaleString()} vehicle trips off Phuket's roads every day.
          </span>
        ) : (
          <span>
            At current fare and traffic levels without municipal support, the operator cannot repay the ฿{financials.initialCapexM.toFixed(1)}M initial capex.
            <strong>Solution:</strong> Introduce a dedicated transit lane or a ฿12M/yr municipal performance subsidy to achieve financial closure.
          </span>
        )}
      </div>
    </section>
  );
}
