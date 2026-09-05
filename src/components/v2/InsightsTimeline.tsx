import { useMemo } from "react";
import type { QueueTimelinePoint } from "../../engine/v2OpsPanel";

interface InsightsTimelineProps {
  points: QueueTimelinePoint[];
  simMinutes: number;
}

const W = 880;
const H_QUEUE = 130;
const H_CUM = 130;
const PAD_X = 54;
const PAD_TOP = 20;
const PAD_BOTTOM = 22;

/**
 * InsightsTimeline — Dual-Tier Synchronized Queue & Revenue Dynamics
 *
 * Resolves the mathematical ambiguity of plotting instantaneous queue depth
 * against cumulative passenger volume on the same uncalibrated scale:
 *
 * Tier 1: Real-Time Airport Curb Surge (0 → Peak Pax Waiting)
 *   • Shows exact physical queue building at the curb
 *   • Benchmarked against scheduled hourly capacity threshold (75 seats)
 *   • Synchronized simulation time indicator
 *
 * Tier 2: Cumulative Day Outcomes (0 → Total Bus Demand)
 *   • Green area: Boarded & Delivered (Revenue Won)
 *   • Amber area: Walked Away to Grab (Revenue Leaked)
 */
export function InsightsTimeline({ points, simMinutes }: InsightsTimelineProps) {
  const view = useMemo(() => {
    const maxWaiting = Math.max(75, ...points.map((p) => p.waiting));
    const maxCum = Math.max(1, ...points.map((p) => Math.max(p.boardedCum, p.abandonedCum)));
    const peakWaiting = points.reduce<QueueTimelinePoint | null>((a, b) => (a == null || b.waiting > a.waiting ? b : a), null);
    const last = points.at(-1) ?? { min: 1440, waiting: 0, boardedCum: 0, abandonedCum: 0, demandCum: 0 };
    return { maxWaiting, maxCum, peakWaiting, last };
  }, [points]);

  function x(min: number) {
    return PAD_X + (min / 1440) * (W - PAD_X * 2);
  }
  function yQueue(n: number) {
    const usableH = H_QUEUE - PAD_TOP - PAD_BOTTOM;
    return PAD_TOP + (1 - n / view.maxWaiting) * usableH;
  }
  function yCum(n: number) {
    const usableH = H_CUM - PAD_TOP - PAD_BOTTOM;
    return PAD_TOP + (1 - n / view.maxCum) * usableH;
  }

  // Build polylines
  const waitingPath = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.min).toFixed(1)},${yQueue(p.waiting).toFixed(1)}`).join(" ");
  const boardedPath = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.min).toFixed(1)},${yCum(p.boardedCum).toFixed(1)}`).join(" ");
  const abandonedPath = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.min).toFixed(1)},${yCum(p.abandonedCum).toFixed(1)}`).join(" ");

  // Areas
  const waitingArea = `${waitingPath} L${x(1440).toFixed(1)},${yQueue(0).toFixed(1)} L${x(0).toFixed(1)},${yQueue(0).toFixed(1)} Z`;
  const boardedArea = `${boardedPath} L${x(1440).toFixed(1)},${yCum(0).toFixed(1)} L${x(0).toFixed(1)},${yCum(0).toFixed(1)} Z`;
  const abandonedArea = `${abandonedPath} L${x(1440).toFixed(1)},${yCum(0).toFixed(1)} L${x(0).toFixed(1)},${yCum(0).toFixed(1)} Z`;

  const peak = view.peakWaiting;
  const last = view.last;
  const captureRate = last.demandCum > 0 ? Math.round((last.boardedCum / last.demandCum) * 100) : 100;
  const lostThb = last.abandonedCum * 100;
  const wonThb = last.boardedCum * 100;

  const hours = [0, 4, 8, 12, 16, 20, 24];

  return (
    <div className="v2-insights">
      <header className="v2-insights__head">
        <div>
          <span className="v2-insights__eyebrow">Queue Dynamics &amp; Revenue Conversion</span>
          <h3 className="v2-insights__title">Physical Curb Demand vs. Day Cumulative Outcome</h3>
        </div>
        <div className="v2-insights__legend">
          <span className="v2-legend-tag v2-legend-tag--waiting">
            <i style={{ background: "var(--ax-ink, #191712)" }} /> Instant Queue (Curb)
          </span>
          <span className="v2-legend-tag v2-legend-tag--boarded">
            <i style={{ background: "var(--gain, #16a574)" }} /> Boarded (Captured)
          </span>
          <span className="v2-legend-tag v2-legend-tag--abandoned">
            <i style={{ background: "var(--amber, #f5a623)" }} /> Walked Away (Grab)
          </span>
        </div>
      </header>

      {/* ── TIER 1: Instantaneous Queue Surge at Airport Curb ─────────── */}
      <div className="v2-insights-tier">
        <div className="v2-insights-tier__label">
          <span>Tier 1 · Instantaneous Surge</span>
          <strong>Airport Curb Queue (Pax Waiting)</strong>
          <small>Spikes above 75 seats indicate departure deficits</small>
        </div>

        <svg
          className="v2-insights__svg"
          viewBox={`0 0 ${W} ${H_QUEUE}`}
          role="img"
          aria-label="Queue surge over time"
        >
          {/* Grid lines */}
          {hours.map((h) => (
            <line
              key={h}
              x1={x(h * 60)}
              x2={x(h * 60)}
              y1={PAD_TOP}
              y2={H_QUEUE - PAD_BOTTOM}
              stroke="var(--ax-line, rgba(255,255,255,0.08))"
              strokeDasharray="2 3"
            />
          ))}

          {/* 75-seat scheduled hourly capacity benchmark */}
          {75 <= view.maxWaiting && (
            <g>
              <line
                x1={PAD_X}
                x2={W - PAD_X}
                y1={yQueue(75)}
                y2={yQueue(75)}
                stroke="var(--ax-warn, #e0a243)"
                strokeDasharray="3 3"
                strokeWidth="1"
              />
              <text
                x={W - PAD_X - 4}
                y={yQueue(75) - 4}
                fontSize="9"
                fill="var(--ax-warn, #e0a243)"
                textAnchor="end"
                fontFamily="var(--font-mono)"
              >
                75 seats / hr standard capacity
              </text>
            </g>
          )}

          {/* Queue Area & Stroke */}
          <path d={waitingArea} fill="rgba(224, 162, 67, 0.15)" />
          <path d={waitingPath} fill="none" stroke="var(--ax-ink, #f3f6f8)" strokeWidth="2" />

          {/* Peak Marker */}
          {peak && (
            <g>
              <line
                x1={x(peak.min)}
                x2={x(peak.min)}
                y1={PAD_TOP}
                y2={H_QUEUE - PAD_BOTTOM}
                stroke="var(--ax-ink-3, #929eaa)"
                strokeDasharray="2 2"
              />
              <circle cx={x(peak.min)} cy={yQueue(peak.waiting)} r="4" fill="var(--ax-warn, #e0a243)" />
              <text
                x={x(peak.min) + (peak.min > 720 ? -8 : 8)}
                y={Math.max(PAD_TOP + 10, yQueue(peak.waiting) - 6)}
                fontSize="10"
                fontWeight="700"
                fill="var(--ax-ink, #f3f6f8)"
                textAnchor={peak.min > 720 ? "end" : "start"}
                fontFamily="var(--font-mono)"
              >
                Peak: {peak.waiting} pax waiting @ {String(Math.floor(peak.min / 60)).padStart(2, "0")}:{String(peak.min % 60).padStart(2, "0")}
              </text>
            </g>
          )}

          {/* Live Sim Time Cursor */}
          <g>
            <line
              x1={x(simMinutes)}
              x2={x(simMinutes)}
              y1={PAD_TOP}
              y2={H_QUEUE - PAD_BOTTOM}
              stroke="var(--ax-accent, #46b986)"
              strokeWidth="1.5"
            />
            <circle cx={x(simMinutes)} cy={PAD_TOP} r="3" fill="var(--ax-accent, #46b986)" />
          </g>

          {/* Y Axis Labels */}
          <text x={PAD_X - 6} y={PAD_TOP + 4} fontSize="9" fill="var(--ax-ink-3, #929eaa)" textAnchor="end" fontFamily="var(--font-mono)">
            {view.maxWaiting}p
          </text>
          <text x={PAD_X - 6} y={H_QUEUE - PAD_BOTTOM} fontSize="9" fill="var(--ax-ink-3, #929eaa)" textAnchor="end" fontFamily="var(--font-mono)">
            0p
          </text>
        </svg>
      </div>

      {/* ── TIER 2: Cumulative Ridership & Revenue Flow ───────────────── */}
      <div className="v2-insights-tier">
        <div className="v2-insights-tier__label">
          <span>Tier 2 · Cumulative Ledger</span>
          <strong>Boarded vs. Walked Away (0 → {view.maxCum.toLocaleString()} Pax)</strong>
          <small>Green area is captured revenue; Amber area is revenue leaked to Grab/taxis</small>
        </div>

        <svg
          className="v2-insights__svg"
          viewBox={`0 0 ${W} ${H_CUM}`}
          role="img"
          aria-label="Cumulative boarded vs abandoned flow"
        >
          {/* Hour grid & labels */}
          {hours.map((h) => (
            <g key={h}>
              <line
                x1={x(h * 60)}
                x2={x(h * 60)}
                y1={PAD_TOP}
                y2={H_CUM - PAD_BOTTOM}
                stroke="var(--ax-line, rgba(255,255,255,0.08))"
                strokeDasharray="2 3"
              />
              <text
                x={x(h * 60)}
                y={H_CUM - PAD_BOTTOM + 14}
                fontSize="9"
                fill="var(--ax-ink-3, #929eaa)"
                textAnchor="middle"
                fontFamily="var(--font-mono)"
              >
                {String(h).padStart(2, "0")}:00
              </text>
            </g>
          ))}

          {/* Cumulative Areas */}
          <path d={abandonedArea} fill="rgba(245, 158, 11, 0.22)" />
          <path d={boardedArea} fill="rgba(70, 185, 134, 0.25)" />

          {/* Strokes */}
          <path d={abandonedPath} fill="none" stroke="var(--amber, #f5a623)" strokeWidth="2" />
          <path d={boardedPath} fill="none" stroke="var(--gain, #16a574)" strokeWidth="2.5" />

          {/* Live Sim Time Cursor */}
          <line
            x1={x(simMinutes)}
            x2={x(simMinutes)}
            y1={PAD_TOP}
            y2={H_CUM - PAD_BOTTOM}
            stroke="var(--ax-accent, #46b986)"
            strokeWidth="1.5"
          />

          {/* Y Axis Labels */}
          <text x={PAD_X - 6} y={PAD_TOP + 4} fontSize="9" fill="var(--ax-ink-3, #929eaa)" textAnchor="end" fontFamily="var(--font-mono)">
            {view.maxCum.toLocaleString()}
          </text>
          <text x={PAD_X - 6} y={H_CUM - PAD_BOTTOM} fontSize="9" fill="var(--ax-ink-3, #929eaa)" textAnchor="end" fontFamily="var(--font-mono)">
            0
          </text>
        </svg>
      </div>

      {/* ── High-Impact Performance KPI Cards ────────────────────────── */}
      <div className="v2-insights__kpis">
        <div className="v2-insights__kpi">
          <span className="v2-insights__kpi-val">{(last.demandCum).toLocaleString()}</span>
          <span className="v2-insights__kpi-label">Total Daily Demand</span>
          <small className="v2-insights__kpi-sub">100% bus-eligible arrivals</small>
        </div>
        <div className="v2-insights__kpi v2-insights__kpi--won">
          <span className="v2-insights__kpi-val">{last.boardedCum.toLocaleString()}</span>
          <span className="v2-insights__kpi-label">Captured ({captureRate}%)</span>
          <small className="v2-insights__kpi-sub">฿{wonThb.toLocaleString()} revenue earned</small>
        </div>
        <div className="v2-insights__kpi v2-insights__kpi--alert">
          <span className="v2-insights__kpi-val">{last.abandonedCum.toLocaleString()}</span>
          <span className="v2-insights__kpi-label">Walked Away ({100 - captureRate}%)</span>
          <small className="v2-insights__kpi-sub">฿{lostThb.toLocaleString()} leaked to Grab</small>
        </div>
        <div className="v2-insights__kpi">
          <span className="v2-insights__kpi-val">{view.maxWaiting} pax</span>
          <span className="v2-insights__kpi-label">Peak Curb Queue</span>
          <small className="v2-insights__kpi-sub">Spike at {peak ? fmtTime(peak.min) : "19:45"}</small>
        </div>
      </div>
    </div>
  );
}

function fmtTime(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

