import { useState, useMemo } from "react";
import { computeRoi, formatTHB, formatPayback, ROI_CONSTANTS } from "../engine/roi";

/**
 * The "show me the money" page. Pitched at the buyer's CFO.
 * Three sliders → hard numbers. Every output traces to ROI_CONSTANTS,
 * every constant has a sourced comment in roi.ts.
 *
 * This page is the leave-behind. Show this to a finance person, walk away,
 * they can poke at it for 10 minutes and decide whether the deal pencils.
 */

const SOURCES = {
  pax: "Phuket airport arrivals 2024, weighted average peak/off-peak day.",
  opex: "PKSB 2024 statement + BMTA cost benchmarks: ฿340k fuel, ฿310k driver, ฿80k maintenance, ฿70k insurance.",
  capex: "GoSwift commercial transit telemetry quote 2024: ฿18k tracker + ฿42k tablet + ฿35k camera + ฿120k software seat (3yr) + ฿35k install.",
  co2: "APTA \"Public Transportation's Role in Responding to Climate Change\" 2018 update.",
  grab: "In-app Grab quotes Q3 2024, weighted across destination clusters."
};

export function RoiCalculator() {
  const [fleet, setFleet] = useState(20);
  const [captureRate, setCaptureRate] = useState(0.12);
  const [fare, setFare] = useState(100);

  const out = useMemo(() => computeRoi({
    fleetSize: fleet,
    captureRate,
    averageFareTHB: fare
  }), [fleet, captureRate, fare]);

  return (
    <div className="roi-page">
      <header className="roi-header">
        <div className="roi-header__eyebrow">PKSB Operations Platform · Financial Model</div>
        <h1 className="roi-header__title">Phuket Smart Bus — ROI</h1>
        <p className="roi-header__subtitle">
          Three knobs, hard numbers. Every assumption is sourced; tap{" "}
          <span className="roi-source-badge">SRC</span> to see where it comes from.
        </p>
      </header>

      <section className="roi-grid">
        {/* SLIDERS */}
        <div className="roi-inputs">
          <div className="roi-input">
            <label className="roi-input__label">
              <span>Fleet size</span>
              <span className="roi-input__value">{fleet} buses</span>
            </label>
            <input
              type="range"
              min={10}
              max={80}
              step={1}
              value={fleet}
              onChange={(e) => setFleet(Number(e.target.value))}
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
              <span className="roi-input__value">{Math.round(captureRate * 100)}%</span>
            </label>
            <input
              type="range"
              min={5}
              max={35}
              step={1}
              value={Math.round(captureRate * 100)}
              onChange={(e) => setCaptureRate(Number(e.target.value) / 100)}
              className="roi-input__slider"
            />
            <div className="roi-input__scale">
              <span>5% (today)</span>
              <span>12% (modeled)</span>
              <span>35% (Singapore-class)</span>
            </div>
          </div>

          <div className="roi-input">
            <label className="roi-input__label">
              <span>Average fare</span>
              <span className="roi-input__value">฿{fare}</span>
            </label>
            <input
              type="range"
              min={50}
              max={150}
              step={5}
              value={fare}
              onChange={(e) => setFare(Number(e.target.value))}
              className="roi-input__slider"
            />
            <div className="roi-input__scale">
              <span>฿50 (subsidized)</span>
              <span>฿100 (today)</span>
              <span>฿150 (premium)</span>
            </div>
          </div>
        </div>

        {/* HEADLINE OUTPUT */}
        <div className="roi-headline">
          <div className="roi-headline__row">
            <div className="roi-headline__cell roi-headline__cell--profit">
              <div className="roi-headline__label">ANNUAL PROFIT</div>
              <div className="roi-headline__value">{formatTHB(out.annualProfitTHB)}</div>
              <div className="roi-headline__sub">{out.profitMarginPct}% margin</div>
            </div>
            <div className="roi-headline__cell">
              <div className="roi-headline__label">PAYBACK</div>
              <div className="roi-headline__value">{formatPayback(out.paybackYears)}</div>
              <div className="roi-headline__sub">on {formatTHB(out.systemCapexTHB)} capex</div>
            </div>
            <div className="roi-headline__cell">
              <div className="roi-headline__label">CO₂ AVOIDED</div>
              <div className="roi-headline__value">{out.annualCO2AvoidedTons.toLocaleString()} t</div>
              <div className="roi-headline__sub">per year</div>
            </div>
          </div>
        </div>
      </section>

      {/* DETAIL TABLE */}
      <section className="roi-detail">
        <h2 className="roi-detail__title">The full picture</h2>
        <table className="roi-table">
          <tbody>
            <tr>
              <td>Annual riders</td>
              <td className="roi-table__num">{out.annualRiders.toLocaleString()}</td>
              <td className="roi-table__src" title={SOURCES.pax}>SRC</td>
            </tr>
            <tr>
              <td>Annual revenue</td>
              <td className="roi-table__num">{formatTHB(out.annualRevenueTHB)}</td>
              <td className="roi-table__src">—</td>
            </tr>
            <tr>
              <td>Annual operating cost</td>
              <td className="roi-table__num">{formatTHB(out.annualOperatingCostTHB)}</td>
              <td className="roi-table__src" title={SOURCES.opex}>SRC</td>
            </tr>
            <tr className="roi-table__strong">
              <td>Annual profit</td>
              <td className="roi-table__num">{formatTHB(out.annualProfitTHB)}</td>
              <td className="roi-table__src">—</td>
            </tr>
            <tr>
              <td>System capex (one-time)</td>
              <td className="roi-table__num">{formatTHB(out.systemCapexTHB)}</td>
              <td className="roi-table__src" title={SOURCES.capex}>SRC</td>
            </tr>
            <tr>
              <td>Tourist savings vs Grab</td>
              <td className="roi-table__num">{formatTHB(out.annualTouristSavingsTHB)}</td>
              <td className="roi-table__src" title={SOURCES.grab}>SRC</td>
            </tr>
            <tr>
              <td>CO₂ avoided</td>
              <td className="roi-table__num">{out.annualCO2AvoidedTons.toLocaleString()} t</td>
              <td className="roi-table__src" title={SOURCES.co2}>SRC</td>
            </tr>
          </tbody>
        </table>

        <div className="roi-footnote">
          <h3>Constants (visible)</h3>
          <ul>
            <li>Daily arriving pax: <strong>{ROI_CONSTANTS.avgArrivingPaxPerDay.toLocaleString()}</strong></li>
            <li>Operating cost / bus / year: <strong>{formatTHB(ROI_CONSTANTS.operatingCostPerBusYear)}</strong></li>
            <li>Capex / bus: <strong>{formatTHB(ROI_CONSTANTS.systemCapexPerBus)}</strong></li>
            <li>Avg trip: <strong>{ROI_CONSTANTS.avgTripKm} km</strong></li>
            <li>CO₂: car <strong>{ROI_CONSTANTS.co2KgPerPaxKmCar}</strong> kg/pax-km, bus <strong>{ROI_CONSTANTS.co2KgPerPaxKmBus}</strong> kg/pax-km</li>
            <li>Avg Grab markup over bus: <strong>{formatTHB(ROI_CONSTANTS.grabMarkupOverBus)}</strong></li>
          </ul>
        </div>
      </section>

      <section className="roi-cta" aria-label="Next step">
        <div className="roi-cta__copy">
          <div className="roi-cta__eyebrow">NEXT STEP</div>
          <div className="roi-cta__title">90-day pilot on the Airport corridor</div>
          <div className="roi-cta__body">
            5 buses, telemetry-only deployment, weekly KPI review with PKSB
            and the Phuket Smart City office. Exit clause at day 30 and 60.
            Capex during pilot: ฿1.25M (5 buses × ฿250k). Decision to scale
            informed by 90 days of real Phuket data.
          </div>
        </div>
        <div className="roi-cta__contact">
          <div className="roi-cta__contact-label">Contact</div>
          <div className="roi-cta__contact-name">Dr. Non Arkara</div>
          <div className="roi-cta__contact-line">PKSB Operations Platform</div>
          <a className="roi-cta__contact-mail" href="mailto:nonsmartcity@gmail.com">nonsmartcity@gmail.com</a>
        </div>
      </section>

      <footer className="roi-foot">
        <a href="/" className="roi-back">← Back to live demo</a>
        <span className="roi-foot__legal">
          Pro-forma model. Not a financial guarantee. PKSB and Phuket
          municipality data superseded by their own audited statements.
        </span>
      </footer>
    </div>
  );
}
