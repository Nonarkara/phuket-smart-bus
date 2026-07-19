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
 * The short bridge between the research and the operating decision.
 *
 * INSIGHTS used to reuse the entire DemandPanel, including all flights and all
 * 24 hourly rows. That made the replay drive a nested, auto-scrolling sidebar.
 * This rail deliberately exposes one decision and one auditable evidence chain;
 * the detailed schedule stays in OPS where it belongs.
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

  return (
    <aside className="v2-insights-rail" aria-label="Research to operations summary">
      <header className="v2-insights-rail__head">
        <span className="v2-insights-rail__eyebrow">Research → Operations</span>
        <h2>What the toolkit becomes</h2>
        <p>
          Flight demand + timetable become a minute-level queue and a decision
          the operator can test.
        </p>
      </header>

      <section className="v2-insights-decision" aria-label="Priority decision">
        <span className="v2-insights-decision__label">Decision first</span>
        <strong>Protect {fmtClock(summary.worst.hour)}</strong>
        <span>
          {demandAtWorst.toLocaleString()} likely riders meet {seatsAtWorst.toLocaleString()} scheduled seats.
          {summary.worst.missedThb > 0 && ` ฿${summary.worst.missedThb.toLocaleString()} is missed in this hour.`}
        </span>
      </section>

      <section className="v2-insights-now" aria-label="Current queue">
        <span>Queue now</span>
        <strong>{currentWaiting.toLocaleString()}</strong>
        <span>people at the airport curb</span>
      </section>

      <ol className="v2-evidence-chain" aria-label="Arrival demand evidence chain">
        <li>
          <span>Likely riders</span>
          <strong>{summary.last.demandCum.toLocaleString()}</strong>
        </li>
        <li>
          <span>Boarded</span>
          <strong>{summary.last.boardedCum.toLocaleString()}</strong>
        </li>
        <li>
          <span>Walked away</span>
          <strong>{summary.last.abandonedCum.toLocaleString()}</strong>
        </li>
        <li>
          <span>Captured</span>
          <strong>{summary.capturePct}%</strong>
        </li>
      </ol>

      <div className="v2-insights-proof">
        <span>Toolkit finding</span>
        <p>Buses run on intervals; travelers do not.</p>
        <span>Software instrument</span>
        <p>FIFO demand, passenger conservation, and revenue by hour.</p>
      </div>
    </aside>
  );
}
