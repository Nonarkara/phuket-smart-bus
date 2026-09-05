import { useMemo } from "react";
import type { QueueTimelinePoint, HourlyBalance } from "../../engine/v2OpsPanel";

interface InsightsSummaryPanelProps {
  rows: HourlyBalance[];
  points: QueueTimelinePoint[];
  currentWaiting: number;
}

function fmtClock(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

/**
 * InsightsSummaryPanel — Executive Command Sidebar
 *
 * Provides a high-clarity bridge between research data and operational decisions:
 * 1. Priority Bottleneck Action (the single worst hour and how to fix it)
 * 2. Live Airport Curb Queue Monitor (instantaneous passengers at risk of abandoning)
 * 3. Daily Demand Capture vs Leakage Ledger (cumulative performance)
 * 4. Operational Law (the structural reason behind the mismatch)
 */
export function InsightsSummaryPanel({ rows, points, currentWaiting }: InsightsSummaryPanelProps) {
  const summary = useMemo(() => {
    const last = points.at(-1);
    const worst = [...rows].sort(
      (left, right) => right.missedThb - left.missedThb || right.gapPax - left.gapPax
    )[0];
    const capturePct = last && last.demandCum > 0
      ? Math.round((last.boardedCum / last.demandCum) * 100)
      : 100;

    return { last, worst, capturePct };
  }, [points, rows]);

  if (!summary.last || !summary.worst) return null;

  const demandAtWorst = summary.worst.busEligiblePax + summary.worst.outEligiblePax;
  const seatsAtWorst = summary.worst.busSeats + summary.worst.outSeats;
  const deficitAtWorst = Math.max(0, demandAtWorst - seatsAtWorst);
  const busesNeeded = Math.ceil(deficitAtWorst / 25);
  const curbSeverity = currentWaiting >= 100 ? "critical" : currentWaiting >= 35 ? "elevated" : "nominal";

  return (
    <aside className="v2-insights-rail" aria-label="Research to operations summary">
      <header className="v2-insights-rail__head">
        <span className="v2-insights-rail__eyebrow">Executive Briefing · Airport Corridor</span>
        <h2>What the Research Becomes</h2>
        <p>
          Minute-level flight waves compared against fixed timetables to expose missed revenue and direct operational interventions.
        </p>
      </header>

      {/* ── Priority Action Card ─────────────────────────────────────── */}
      <section className="v2-insights-card v2-insights-card--priority" aria-label="Priority operational decision">
        <div className="v2-insights-card__badge">
          <span className="v2-insights-card__tag">P1 BOTTLENECK</span>
          <span className="v2-insights-card__time">Protect {fmtClock(summary.worst.hour)}</span>
        </div>
        <div className="v2-insights-card__impact">
          <strong>฿{summary.worst.missedThb.toLocaleString()}</strong>
          <small>revenue lost to Grab in this hour</small>
        </div>
        <div className="v2-insights-card__metrics">
          <div>
            <span>Demand</span>
            <strong>{demandAtWorst.toLocaleString()} pax</strong>
          </div>
          <div>
            <span>Seats</span>
            <strong>{seatsAtWorst.toLocaleString()}</strong>
          </div>
          <div>
            <span>Deficit</span>
            <strong className="text-neg">-{deficitAtWorst.toLocaleString()} pax</strong>
          </div>
        </div>
        <div className="v2-insights-card__action">
          <span className="v2-insights-card__action-icon">↳</span>
          <p>
            <strong>Recommended Action:</strong> Stage <strong>+{busesNeeded} standby {busesNeeded === 1 ? "bus" : "buses"}</strong> at the airport curb before {fmtClock(summary.worst.hour)} to absorb the arrival bank.
          </p>
        </div>
      </section>

      {/* ── Real-Time Curb Queue Monitor ─────────────────────────────── */}
      <section className={`v2-insights-card v2-insights-card--curb v2-insights-card--${curbSeverity}`} aria-label="Current airport curb queue">
        <div className="v2-insights-card__badge">
          <span className="v2-insights-card__tag">AIRPORT CURB LIVE</span>
          <span className={`v2-curb-status v2-curb-status--${curbSeverity}`}>
            {curbSeverity === "critical" ? "Surge Underway" : curbSeverity === "elevated" ? "Queue Building" : "Nominal"}
          </span>
        </div>
        <div className="v2-insights-curb-stat">
          <strong className="v2-insights-curb-num">{currentWaiting.toLocaleString()}</strong>
          <div className="v2-insights-curb-desc">
            <span>passengers waiting</span>
            <small>Patience limit: 60 min before abandoning for taxis</small>
          </div>
        </div>
      </section>

      {/* ── Daily Conversion Ledger ──────────────────────────────────── */}
      <section className="v2-insights-card v2-insights-card--ledger" aria-label="Daily conversion ledger">
        <div className="v2-insights-card__badge">
          <span className="v2-insights-card__tag">DAILY REVENUE CONVERSION</span>
          <span className="v2-insights-card__pct">{summary.capturePct}% captured</span>
        </div>

        {/* Visual progress bar */}
        <div className="v2-conversion-bar" role="progressbar" aria-valuenow={summary.capturePct} aria-valuemin={0} aria-valuemax={100}>
          <div className="v2-conversion-bar__fill v2-conversion-bar__fill--captured" style={{ width: `${summary.capturePct}%` }} title={`Captured: ${summary.capturePct}%`} />
          <div className="v2-conversion-bar__fill v2-conversion-bar__fill--lost" style={{ width: `${100 - summary.capturePct}%` }} title={`Lost: ${100 - summary.capturePct}%`} />
        </div>

        <div className="v2-ledger-grid">
          <div className="v2-ledger-item v2-ledger-item--demand">
            <span>Total Demand</span>
            <strong>{summary.last.demandCum.toLocaleString()}</strong>
            <small>bus-eligible arrivals</small>
          </div>
          <div className="v2-ledger-item v2-ledger-item--boarded">
            <span>Boarded &amp; Won</span>
            <strong>{summary.last.boardedCum.toLocaleString()}</strong>
            <small>฿{(summary.last.boardedCum * 100).toLocaleString()}</small>
          </div>
          <div className="v2-ledger-item v2-ledger-item--lost">
            <span>Walked to Taxi</span>
            <strong>{summary.last.abandonedCum.toLocaleString()}</strong>
            <small>฿{(summary.last.abandonedCum * 100).toLocaleString()} lost</small>
          </div>
        </div>
      </section>

      {/* ── Operational Law ──────────────────────────────────────────── */}
      <footer className="v2-insights-doctrine">
        <span className="v2-insights-doctrine__eyebrow">The Core Operational Law</span>
        <p>
          <strong>Buses run on fixed intervals; flight arrivals arrive in bursts.</strong> When wide-body international flights touch down together, curb demand spikes 5× scheduled capacity. Without dynamic staging, 80%+ of riders leak to unmetered taxis.
        </p>
      </footer>
    </aside>
  );
}

