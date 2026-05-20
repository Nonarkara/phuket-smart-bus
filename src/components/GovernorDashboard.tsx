import { useEffect, useRef, useState } from "react";
import { computeSimState } from "../engine/simulation";
import { getImpactMetrics } from "../engine/impactSimulator";
import { getVehiclesNow } from "../engine/fleetSimulator";
import {
  THAIRSC_2026_FOREIGNERS,
  THAIRSC_POWERBI_URL,
  computeSafetyImpact,
  ECONOMIC_COST_PER_INJURY_THB
} from "../engine/safetyData";
import { computeRoi, ROI_CONSTANTS, formatTHB, formatPayback } from "../engine/roi";

// ---------------------------------------------------------------------------
// Live stat hook
// ---------------------------------------------------------------------------
function useLiveState() {
  const [state, setState] = useState(() => {
    const vehicles = getVehiclesNow();
    const impact = getImpactMetrics(vehicles.length);
    const sim = computeSimState();
    const safety = computeSafetyImpact(impact.ridersToday);
    const roi = computeRoi({ fleetSize: 20, captureRate: 0.12, averageFareTHB: 100 });
    return { vehicles, impact, sim, safety, roi };
  });

  useEffect(() => {
    const id = setInterval(() => {
      const vehicles = getVehiclesNow();
      const impact = getImpactMetrics(vehicles.length);
      const sim = computeSimState();
      const safety = computeSafetyImpact(impact.ridersToday);
      const roi = computeRoi({ fleetSize: 20, captureRate: 0.12, averageFareTHB: 100 });
      setState({ vehicles, impact, sim, safety, roi });
    }, 2000);
    return () => clearInterval(id);
  }, []);

  return state;
}

// ---------------------------------------------------------------------------
// Animated big number
// ---------------------------------------------------------------------------
function BigNum({ value, prefix = "", suffix = "", decimals = 0 }: {
  value: number; prefix?: string; suffix?: string; decimals?: number;
}) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    if (value === prev.current) return;
    const from = prev.current;
    prev.current = value;
    const diff = value - from;
    const t0 = performance.now();
    const tick = () => {
      const p = Math.min(1, (performance.now() - t0) / 1500);
      const e = 1 - Math.pow(1 - p, 3);
      setDisplay(from + diff * e);
      if (p < 1) setTimeout(tick, 33);
    };
    tick();
  }, [value]);
  const fmt = decimals > 0 ? display.toFixed(decimals) : Math.round(display).toLocaleString();
  return <>{prefix}{fmt}{suffix}</>;
}

// ---------------------------------------------------------------------------
// Main dashboard
// ---------------------------------------------------------------------------
export function GovernorDashboard() {
  const { vehicles, impact, sim, safety, roi } = useLiveState();
  const busCount = vehicles.filter(v => !v.vehicleId.startsWith("ferry-")).length;
  const movingCount = vehicles.filter(v => v.status === "moving").length;

  // Phuket district data for the accident table
  const phuketDistricts = THAIRSC_2026_FOREIGNERS.phuket.districts;
  const topNations = THAIRSC_2026_FOREIGNERS.byNation.filter(n => n.code !== "XX").slice(0, 8);
  const annualSafetyValueM = Math.round(roi.annualRiders * 0.6 * 0.00143 * ECONOMIC_COST_PER_INJURY_THB / 1_000_000);

  return (
    <div className="governor">
      {/* ── Header ── */}
      <header className="governor__header">
        <div className="governor__header-left">
          <div className="governor__eyebrow">PHUKET GOVERNOR'S OFFICE · SMART MOBILITY</div>
          <h1 className="governor__title">Phuket Smart Bus — Impact Dashboard</h1>
          <div className="governor__subtitle">
            Ridership · Road Safety · Environment · Economy · {sim.clockLabel} BKK
          </div>
        </div>
        <div className="governor__header-right">
          <div className="governor__live-badge">
            <span className="governor__live-dot" />
            LIVE SIMULATION
          </div>
          <div className="governor__fleet-badge">
            {busCount} buses · {movingCount} moving
          </div>
        </div>
      </header>

      {/* ── Top KPI row ── */}
      <div className="governor__kpis">
        <div className="governor__kpi governor__kpi--green">
          <div className="governor__kpi-label">RIDERS TODAY</div>
          <div className="governor__kpi-value">
            <BigNum value={impact.ridersToday} />
          </div>
          <div className="governor__kpi-sub">{impact.seasonLabel}</div>
        </div>

        <div className="governor__kpi governor__kpi--teal">
          <div className="governor__kpi-label">REVENUE TODAY</div>
          <div className="governor__kpi-value">
            ฿<BigNum value={impact.revenueThb} />
          </div>
          <div className="governor__kpi-sub">฿{impact.revenueFormatted} collected</div>
        </div>

        <div className="governor__kpi governor__kpi--amber">
          <div className="governor__kpi-label">TOURIST SAVINGS VS GRAB</div>
          <div className="governor__kpi-value">
            ฿<BigNum value={sim.savingsThb} />
          </div>
          <div className="governor__kpi-sub">
            {sim.paxDelivered} pax × avg ฿{Math.round(sim.savingsThb / Math.max(1, sim.paxDelivered))} saved
          </div>
        </div>

        <div className="governor__kpi governor__kpi--red">
          <div className="governor__kpi-label">ACCIDENTS PREVENTED</div>
          <div className="governor__kpi-value">
            <BigNum value={safety.injuriesPreventedToday} decimals={2} />
          </div>
          <div className="governor__kpi-sub">
            ≈ ฿<BigNum value={safety.economicValueTodayThb} /> protected
          </div>
        </div>

        <div className="governor__kpi">
          <div className="governor__kpi-label">CO₂ AVOIDED</div>
          <div className="governor__kpi-value">
            <BigNum value={impact.co2SavedKg} suffix=" kg" />
          </div>
          <div className="governor__kpi-sub">vs same trips by car</div>
        </div>
      </div>

      {/* ── Main grid ── */}
      <div className="governor__grid">

        {/* LEFT: Road safety breakdown */}
        <section className="governor__panel">
          <h2 className="governor__panel-title">
            Road Safety Context
            <span className="governor__panel-source">Source: ThaiRSC · thairsc.com · 2026 YTD</span>
          </h2>

          <div className="governor__safety-headline">
            <div className="governor__safety-stat">
              <div className="governor__safety-num">{THAIRSC_2026_FOREIGNERS.deaths}</div>
              <div className="governor__safety-label">FOREIGN TOURIST DEATHS</div>
            </div>
            <div className="governor__safety-stat governor__safety-stat--warn">
              <div className="governor__safety-num">{THAIRSC_2026_FOREIGNERS.injured.toLocaleString()}</div>
              <div className="governor__safety-label">FOREIGN TOURISTS INJURED</div>
            </div>
            <div className="governor__safety-stat">
              <div className="governor__safety-num">{THAIRSC_2026_FOREIGNERS.byVehicle.motorcyclePct}%</div>
              <div className="governor__safety-label">INVOLVING MOTORCYCLES</div>
            </div>
          </div>

          <div className="governor__section-title">Phuket District Breakdown</div>
          <table className="governor__table">
            <thead>
              <tr>
                <th>District</th>
                <th className="governor__table-num">Deaths</th>
                <th className="governor__table-num">Injured</th>
              </tr>
            </thead>
            <tbody>
              {phuketDistricts.map(d => (
                <tr key={d.name}>
                  <td>{d.name}</td>
                  <td className="governor__table-num governor__table-num--deaths">{d.deaths}</td>
                  <td className="governor__table-num governor__table-num--injured">{d.injured.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="governor__section-title" style={{ marginTop: 16 }}>Injured by Nationality (top 8)</div>
          <div className="governor__nation-bars">
            {topNations.map((n, i) => {
              const max = topNations[0].injured;
              const pct = Math.round((n.injured / max) * 100);
              return (
                <div key={n.code} className="governor__nation-row">
                  <div className="governor__nation-name">{n.nation}</div>
                  <div className="governor__nation-bar-wrap">
                    <div className="governor__nation-bar" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="governor__nation-count">{n.injured}</div>
                </div>
              );
            })}
          </div>
        </section>

        {/* CENTRE: Safety impact + annual projection */}
        <section className="governor__panel governor__panel--dark">
          <h2 className="governor__panel-title">Smart Bus Safety Impact</h2>

          <div className="governor__impact-hero">
            <div className="governor__impact-value">
              <BigNum value={safety.injuriesPreventedToday} decimals={2} />
            </div>
            <div className="governor__impact-label">INJURIES PREVENTED TODAY</div>
            <div className="governor__impact-sub">
              {safety.riderShiftedToday.toLocaleString()} riders shifted from personal vehicles
            </div>
          </div>

          <div className="governor__impact-row">
            <div className="governor__impact-cell">
              <div className="governor__impact-cell-val">
                <BigNum value={safety.motorcycleTripsAvoided} />
              </div>
              <div className="governor__impact-cell-lbl">Motorcycle trips avoided</div>
            </div>
            <div className="governor__impact-cell">
              <div className="governor__impact-cell-val">
                ฿<BigNum value={Math.round(safety.economicValueTodayThb / 1000)} />k
              </div>
              <div className="governor__impact-cell-lbl">Economic protection today</div>
            </div>
          </div>

          <div className="governor__divider" />
          <div className="governor__section-title">Annual Projections (at current pace)</div>

          <div className="governor__impact-row">
            <div className="governor__impact-cell">
              <div className="governor__impact-cell-val">
                <BigNum value={safety.injuriesPreventedAnnual} decimals={1} />
              </div>
              <div className="governor__impact-cell-lbl">Injuries prevented / year</div>
            </div>
            <div className="governor__impact-cell governor__impact-cell--highlight">
              <div className="governor__impact-cell-val">฿{annualSafetyValueM}M</div>
              <div className="governor__impact-cell-lbl">Annual economic protection</div>
            </div>
          </div>

          <div className="governor__impact-row" style={{ marginTop: 8 }}>
            <div className="governor__impact-cell">
              <div className="governor__impact-cell-val">
                {Math.round(impact.co2AnnualProjectionTonnes)}t
              </div>
              <div className="governor__impact-cell-lbl">CO₂ avoided / year</div>
            </div>
            <div className="governor__impact-cell">
              <div className="governor__impact-cell-val">
                {formatPayback(roi.paybackYears)}
              </div>
              <div className="governor__impact-cell-lbl">System payback</div>
            </div>
          </div>

          <div className="governor__divider" />
          <div className="governor__section-title">Accident Cost Basis</div>
          <div className="governor__footnote">
            Per injury: ฿45k hospital + ฿85k tourism disruption + ฿170k economic multiplier
            = ฿{(ECONOMIC_COST_PER_INJURY_THB / 1000).toFixed(0)}k.
            Modal shift: {Math.round(60)}% of riders estimated to otherwise use personal vehicle.
            Rate: {(0.00143 * 100).toFixed(3)}% per trip (ThaiRSC Phuket 2024 + WHO tourist-risk adjustment).
          </div>
        </section>

        {/* RIGHT: ROI summary */}
        <section className="governor__panel">
          <h2 className="governor__panel-title">
            Financial Model
            <span className="governor__panel-source">20 buses · 12% capture · ฿100 fare</span>
          </h2>

          <div className="governor__roi-row">
            <span>Annual riders</span>
            <strong>{roi.annualRiders.toLocaleString()}</strong>
          </div>
          <div className="governor__roi-row">
            <span>Annual revenue</span>
            <strong>{formatTHB(roi.annualRevenueTHB)}</strong>
          </div>
          <div className="governor__roi-row">
            <span>Operating cost</span>
            <strong>{formatTHB(roi.annualOperatingCostTHB)}</strong>
          </div>
          <div className="governor__roi-row governor__roi-row--total">
            <span>Annual profit</span>
            <strong className="governor__roi-profit">{formatTHB(roi.annualProfitTHB)}</strong>
          </div>
          <div className="governor__roi-row">
            <span>System capex</span>
            <strong>{formatTHB(roi.systemCapexTHB)}</strong>
          </div>
          <div className="governor__roi-row">
            <span>Payback</span>
            <strong className={roi.paybackYears < 2 ? "governor__roi-good" : ""}>{formatPayback(roi.paybackYears)}</strong>
          </div>
          <div className="governor__roi-row">
            <span>Tourist savings vs Grab</span>
            <strong>{formatTHB(roi.annualTouristSavingsTHB)}</strong>
          </div>
          <div className="governor__roi-row">
            <span>CO₂ avoided / year</span>
            <strong>{roi.annualCO2AvoidedTons.toLocaleString()} t</strong>
          </div>

          <div className="governor__cta">
            <div className="governor__cta-label">90-DAY PILOT</div>
            <div className="governor__cta-body">
              5 buses · Airport corridor · ฿1.25M capex · Exit clauses at day 30 + 60
            </div>
            <a className="governor__cta-link" href="/roi">Full financial model →</a>
          </div>
        </section>
      </div>

      {/* ── ThaiRSC Power BI embed ── */}
      <section className="governor__powerbi">
        <div className="governor__powerbi-header">
          <h2 className="governor__powerbi-title">National Road Safety Intelligence</h2>
          <div className="governor__powerbi-sub">
            Official ThaiRSC dashboard · Foreigner Injured by Province ·{" "}
            <a href="https://www.thairsc.com" target="_blank" rel="noopener">thairsc.com</a>
          </div>
        </div>
        <div className="governor__powerbi-frame-wrap">
          <iframe
            title="ThaiRSC Road Safety Dashboard"
            className="governor__powerbi-frame"
            src={THAIRSC_POWERBI_URL}
            allowFullScreen
          />
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="governor__footer">
        <span>Phuket Smart Bus Operations Platform</span>
        <span>·</span>
        <span>Data: ThaiRSC (road safety) · PTAT (arrivals) · PKSB (operations) · APTA (CO₂)</span>
        <span>·</span>
        <a href="/ops">Ops Console</a>
        <span>·</span>
        <a href="/roi">ROI Calculator</a>
        <span>·</span>
        <a href="/">Rider App</a>
      </footer>
    </div>
  );
}
