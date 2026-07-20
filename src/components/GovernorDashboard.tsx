import { useEffect, useRef, useState } from "react";
import { getHeadlineMetrics, type HeadlineMetrics } from "../engine/headlineMetrics";
import {
  THAIRSC_2026_FOREIGNERS,
  THAIRSC_POWERBI_URL,
  computeSafetyImpact,
  ECONOMIC_COST_PER_INJURY_THB
} from "../engine/safetyData";
import { computeRoi, formatTHB, formatPayback } from "../engine/roi";
import { appPath } from "../lib/paths";

// ---------------------------------------------------------------------------
// Live stat hook — single source of truth via getHeadlineMetrics()
// ---------------------------------------------------------------------------
function useLiveState() {
  const [headline, setHeadline] = useState<HeadlineMetrics>(() => getHeadlineMetrics());
  useEffect(() => {
    const id = setInterval(() => setHeadline(getHeadlineMetrics()), 2000);
    return () => clearInterval(id);
  }, []);

  const safety = computeSafetyImpact(headline.today.paxDelivered);
  const roi = computeRoi({ fleetSize: 20, captureRate: 0.12, averageFareTHB: 100 });
  return { headline, safety, roi };
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
  const { headline, safety, roi } = useLiveState();
  // Every fleet/revenue number on this page comes from the SSOT in
  // src/engine/headlineMetrics.ts, so this dashboard ALWAYS matches /ops,
  // /v2 and the tourist landing at the same simulated moment.
  const busCount = headline.fleet.totalBuses;
  const movingCount = headline.fleet.movingBuses;

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
            Ridership · Road Safety · Environment · Economy · {headline.clockLabel} BKK
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
            <BigNum value={headline.today.paxDelivered} />
          </div>
          <div className="governor__kpi-sub">Live · Phuket Smart Bus</div>
        </div>

        <div className="governor__kpi governor__kpi--teal">
          <div className="governor__kpi-label">REVENUE TODAY</div>
          <div className="governor__kpi-value">
            ฿<BigNum value={headline.today.revenueThb} />
          </div>
          <div className="governor__kpi-sub">฿{Math.round(headline.today.revenueThb / 1000)}k collected</div>
        </div>

        <div className="governor__kpi governor__kpi--amber">
          <div className="governor__kpi-label">TOURIST SAVINGS VS GRAB</div>
          <div className="governor__kpi-value">
            ฿<BigNum value={headline.today.savingsThb} />
          </div>
          <div className="governor__kpi-sub">
            {headline.today.paxDelivered} pax × avg ฿{Math.round(headline.today.savingsThb / Math.max(1, headline.today.paxDelivered))} saved
          </div>
        </div>

        <div className="governor__kpi governor__kpi--red">
          <div className="governor__kpi-label">INJURY RISK AVOIDED</div>
          <div className="governor__kpi-value">
            {safety.injuriesPreventedToday >= 1 ? (
              <BigNum value={Math.round(safety.injuriesPreventedToday)} />
            ) : (
              // Express fractional daily prevention as a frequency the
              // Governor's office can reason about: "1 injury every N days"
              <span>1<span style={{ fontSize: "0.5em", fontWeight: 400, color: "rgba(255,255,255,0.6)" }}> per {Math.max(1, Math.round(1 / Math.max(0.001, safety.injuriesPreventedToday)))} days</span></span>
            )}
          </div>
          <div className="governor__kpi-sub">
            ≈ ฿<BigNum value={safety.economicValueTodayThb} /> protected today
          </div>
        </div>

        <div className="governor__kpi">
          <div className="governor__kpi-label">CO₂ AVOIDED</div>
          <div className="governor__kpi-value">
            <BigNum value={headline.today.co2SavedKg} suffix=" kg" />
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
                {Math.round(roi.annualCO2AvoidedTons)}t
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
            <span className="governor__panel-source">20 buses · 12% growth case · ฿100 fare</span>
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
            <a className="governor__cta-link" href={appPath("/roi")}>Full financial model →</a>
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
        <a href={appPath("/ops")}>Ops Console</a>
        <span>·</span>
        <a href={appPath("/roi")}>ROI Calculator</a>
        <span>·</span>
        <a href={appPath("/")}>Rider App</a>
      </footer>
    </div>
  );
}
