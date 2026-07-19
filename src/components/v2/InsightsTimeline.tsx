import { useMemo } from "react";
import type { QueueTimelinePoint } from "../../engine/v2OpsPanel";

interface InsightsTimelineProps {
  points: QueueTimelinePoint[];
  simMinutes: number;
}

const W = 880;
const H = 200;
const PAD_X = 36;
const PAD_Y = 22;

/**
 * Queue timeline: three SVG lines sharing a single x-axis (00:00 → 24:00).
 *   • waiting       — pax in queue right now (peak shape)
 *   • boardedCum    — cumulative captured (slow climb, bigger area on good days)
 *   • abandonedCum  — cumulative walked away (the cost of under-supply)
 *
 * Hover → vertical guide + numeric readouts.
 *
 * The view is intentionally compact: data scientists scan SHAPES, not labels.
 * Peak waiting time, total abandoned, total captured are surfaced as text
 * below the chart so the SVG never has to carry annotations.
 */
export function InsightsTimeline({ points, simMinutes }: InsightsTimelineProps) {
  const view = useMemo(() => {
    const maxWaiting = Math.max(1, ...points.map((p) => p.waiting));
    const maxCum = Math.max(1, ...points.map((p) => Math.max(p.boardedCum, p.abandonedCum)));
    const peakWaiting = points.reduce<QueueTimelinePoint | null>((a, b) => (a == null || b.waiting > a.waiting ? b : a), null);
    const last = points.at(-1)!;
    return { maxWaiting, maxCum, peakWaiting, last };
  }, [points]);

  function x(min: number) {
    return PAD_X + (min / 1440) * (W - PAD_X * 2);
  }
  function yWaiting(n: number) {
    return PAD_Y + (1 - n / view.maxWaiting) * (H - PAD_Y * 2);
  }
  function yCum(n: number) {
    return PAD_Y + (1 - n / view.maxCum) * (H - PAD_Y * 2);
  }

  // Build polylines
  const waitingPath = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.min).toFixed(1)},${yWaiting(p.waiting).toFixed(1)}`).join(" ");
  const boardedPath = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.min).toFixed(1)},${yCum(p.boardedCum).toFixed(1)}`).join(" ");
  const abandonedPath = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.min).toFixed(1)},${yCum(p.abandonedCum).toFixed(1)}`).join(" ");

  // Areas
  const waitingArea = `${waitingPath} L${x(1440).toFixed(1)},${yWaiting(0).toFixed(1)} L${x(0).toFixed(1)},${yWaiting(0).toFixed(1)} Z`;
  const boardedArea = `${boardedPath} L${x(1440).toFixed(1)},${yCum(0).toFixed(1)} L${x(0).toFixed(1)},${yCum(0).toFixed(1)} Z`;
  const abandonedArea = `${abandonedPath} L${x(1440).toFixed(1)},${yCum(0).toFixed(1)} L${x(0).toFixed(1)},${yCum(0).toFixed(1)} Z`;

  const peak = view.peakWaiting;
  const last = view.last;
  const captureRate = last.demandCum > 0 ? Math.round((last.boardedCum / last.demandCum) * 100) : 100;

  return (
    <div className="v2-insights">
      <div className="v2-insights__head">
        <span className="v2-insights__eyebrow">Queue Dynamics</span>
        <span className="v2-insights__title">Wait · Capture · Abandon — over the day</span>
      </div>
      <svg
        className="v2-insights__svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Queue timeline: waiting peaks midday, capture dominates, abandoned accumulates"
      >
        {/* axis lines */}
        <line x1={PAD_X} y1={PAD_Y} x2={PAD_X} y2={H - PAD_Y} stroke="var(--ax-line-2, #d2cfc5)" strokeWidth="1" />
        <line x1={PAD_X} y1={H - PAD_Y} x2={W - PAD_X} y2={H - PAD_Y} stroke="var(--ax-line-2, #d2cfc5)" strokeWidth="1" />

        {/* hour grid */}
        {[0, 6, 12, 18, 24].map((h) => (
          <g key={h}>
            <line
              x1={x(h * 60)}
              x2={x(h * 60)}
              y1={PAD_Y}
              y2={H - PAD_Y}
              stroke="var(--ax-line, #e7e5dd)"
              strokeDasharray="2 4"
            />
            <text x={x(h * 60)} y={H - PAD_Y + 14} fontSize="9" fill="var(--ax-ink-3, #a9a59a)" textAnchor="middle" fontFamily="var(--font-mono)">
              {String(h).padStart(2, "0")}:00
            </text>
          </g>
        ))}

        {/* areas */}
        <path d={boardedArea} fill="rgba(22,165,116,0.18)" />
        <path d={abandonedArea} fill="rgba(245,158,11,0.18)" />
        <path d={waitingArea} fill="rgba(25,23,18,0.05)" />

        {/* lines */}
        <path d={abandonedPath} fill="none" stroke="var(--amber, #f5a623)" strokeWidth="2" />
        <path d={boardedPath} fill="none" stroke="var(--gain, #16a574)" strokeWidth="2" />
        <path d={waitingPath} fill="none" stroke="var(--ax-ink, #191712)" strokeWidth="1.5" strokeOpacity="0.7" />

        {/* peak marker */}
        {peak && (
          <g>
            <line
              x1={x(peak.min)} x2={x(peak.min)}
              y1={PAD_Y} y2={H - PAD_Y}
              stroke="var(--ax-ink-2, #6f6c63)" strokeWidth="1" strokeDasharray="3 3"
            />
            <circle cx={x(peak.min)} cy={yWaiting(peak.waiting)} r="3" fill="var(--ax-ink, #191712)" />
            <text
              x={x(peak.min)} y={yWaiting(peak.waiting) - 6}
              fontSize="10"
              fill="var(--ax-ink, #191712)"
              textAnchor={peak.min > 720 ? "end" : "start"}
              fontFamily="var(--font-mono)"
            >
              peak {peak.waiting}p @ {String(Math.floor(peak.min / 60)).padStart(2, "0")}:{String(peak.min % 60).padStart(2, "0")}
            </text>
          </g>
        )}

        {/* now marker */}
        <g>
          <line
            x1={x(simMinutes)} x2={x(simMinutes)}
            y1={PAD_Y} y2={H - PAD_Y}
            stroke="var(--amber, #f5a623)" strokeWidth="1.5"
          />
          <circle cx={x(simMinutes)} cy={PAD_Y} r="3" fill="var(--amber, #f5a623)" />
        </g>

        {/* y labels */}
        <text x={PAD_X - 6} y={PAD_Y + 4} fontSize="9" fill="var(--ax-ink-3, #a9a59a)" textAnchor="end" fontFamily="var(--font-mono)">
          {view.maxWaiting}
        </text>
        <text x={PAD_X - 6} y={H - PAD_Y} fontSize="9" fill="var(--ax-ink-3, #a9a59a)" textAnchor="end" fontFamily="var(--font-mono)">
          0
        </text>
      </svg>

      <div className="v2-insights__legend">
        <span><span className="v2-insights__legend-dot" style={{ background: "var(--ax-ink, #191712)" }} /> waiting</span>
        <span><span className="v2-insights__legend-dot" style={{ background: "var(--gain, #16a574)" }} /> boarded (cum)</span>
        <span><span className="v2-insights__legend-dot" style={{ background: "var(--amber, #f5a623)" }} /> abandoned (cum)</span>
      </div>

      <div className="v2-insights__kpis">
        <div className="v2-insights__kpi">
          <span className="v2-insights__kpi-val">{(last.demandCum).toLocaleString()}</span>
          <span className="v2-insights__kpi-label">Demand today</span>
        </div>
        <div className="v2-insights__kpi">
          <span className="v2-insights__kpi-val">{last.boardedCum.toLocaleString()}</span>
          <span className="v2-insights__kpi-label">Captured ({captureRate}%)</span>
        </div>
        <div className="v2-insights__kpi v2-insights__kpi--alert">
          <span className="v2-insights__kpi-val">{last.abandonedCum.toLocaleString()}</span>
          <span className="v2-insights__kpi-label">Abandoned · ฿{(last.abandonedCum * 100).toLocaleString()} lost</span>
        </div>
        <div className="v2-insights__kpi">
          <span className="v2-insights__kpi-val">{view.maxWaiting}</span>
          <span className="v2-insights__kpi-label">Peak waiting</span>
        </div>
      </div>
    </div>
  );
}
