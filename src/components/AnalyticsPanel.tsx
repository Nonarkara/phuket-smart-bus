import { useEffect, useState } from "react";
import type { Lang } from "@shared/types";
import { getHourlyDemandSupply, simNow, type HourlyDemandSupply } from "../engine/simulation";
import { pause, setSimulatedMinutes } from "../engine/fleetSimulator";

interface AnalyticsPanelProps {
  lang: Lang;
  /** When set (ops console replay), use this instead of the live sim clock. */
  simMinutes?: number | null;
  /** Clicking an hour column scrubs the sim clock there (default on). */
  scrubbable?: boolean;
}

const HOURS = Array.from({ length: 17 }, (_, i) => 6 + i); // 06:00 → 22:00

function fmtThb(n: number): string {
  if (n >= 1000) return `฿${(n / 1000).toFixed(1)}k`;
  return `฿${n}`;
}

export function AnalyticsPanel({ lang: _lang, simMinutes: propSimMinutes, scrubbable = true }: AnalyticsPanelProps) {
  const [data, setData] = useState<HourlyDemandSupply[]>(() => getHourlyDemandSupply());
  const [engineHour, setEngineHour] = useState<number>(() => Math.floor(simNow() / 60));

  useEffect(() => {
    const id = setInterval(() => {
      setData(getHourlyDemandSupply());
      setEngineHour(Math.floor(simNow() / 60));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // When the ops console replay scrubber is active, use its hour.
  // Otherwise fall back to the live engine clock.
  const currentHour = propSimMinutes != null
    ? Math.floor(propSimMinutes / 60)
    : engineHour;

  // Trim to service window
  const rows = HOURS.map((h) => data[h]).filter(Boolean);
  if (rows.length === 0) return null;

  const maxDemand = Math.max(1, ...rows.map((r) => r.busDemandPax));
  const maxSupply = Math.max(1, ...rows.map((r) => r.busSeatsAvailable));
  const yMax = Math.max(maxDemand, maxSupply, 25);
  const maxRevenue = Math.max(1, ...rows.map((r) => r.revenueThb));

  const past = rows.filter((r) => r.hour <= currentHour);
  const totalDemand = past.reduce((s, r) => s + r.busDemandPax, 0);
  const totalServed = past.reduce((s, r) => s + r.servedPax, 0);
  const totalUnmet = past.reduce((s, r) => s + r.unmetPax, 0);
  const totalRevenue = past.reduce((s, r) => s + r.revenueThb, 0);
  const lostRevenue = totalUnmet * 100;

  return (
    <div className="analytics-panel">
      <div className="analytics-panel__head">
        <h3 className="analytics-panel__title">Demand vs Supply · By Hour</h3>
        <div className="analytics-panel__legend">
          <span className="analytics-panel__legend-item analytics-panel__legend-item--demand">
            <span className="analytics-panel__legend-swatch analytics-panel__legend-swatch--demand" /> Bus demand (pax)
          </span>
          <span className="analytics-panel__legend-item analytics-panel__legend-item--supply">
            <span className="analytics-panel__legend-swatch analytics-panel__legend-swatch--supply" /> Seats available
          </span>
          <span className="analytics-panel__legend-item analytics-panel__legend-item--revenue">
            <span className="analytics-panel__legend-swatch analytics-panel__legend-swatch--revenue" /> Revenue (฿)
          </span>
        </div>
      </div>

      <div className="analytics-chart">
        <div className="analytics-chart__grid">
          {rows.map((r) => {
            const isCurrent = r.hour === currentHour;
            const isFuture = r.hour > currentHour;
            // The whole day is precomputed — future hours show the PLAN at
            // reduced opacity instead of an empty column. Click any hour to
            // jump there and watch the buses run it.
            const demandPct = (r.busDemandPax / yMax) * 100;
            const supplyPct = (r.busSeatsAvailable / yMax) * 100;
            const revenuePct = (r.revenueThb / maxRevenue) * 100;
            const isGap = r.unmetPax > 0;
            const scrub = scrubbable
              ? () => { setSimulatedMinutes(r.hour * 60); pause(); }
              : undefined;
            return (
              <div
                key={r.hour}
                className={`analytics-col ${isCurrent ? "analytics-col--current" : ""} ${isFuture ? "analytics-col--future" : ""} ${isGap ? "analytics-col--gap" : ""} ${scrubbable ? "analytics-col--scrub" : ""}`}
                role={scrubbable ? "button" : undefined}
                tabIndex={scrubbable ? 0 : undefined}
                onClick={scrub}
                onKeyDown={scrub ? (e) => { if (e.key === "Enter" || e.key === " ") scrub(); } : undefined}
                title={`${String(r.hour).padStart(2, "0")}:00 · demand ${r.busDemandPax} pax · seats ${r.busSeatsAvailable} · ${fmtThb(r.revenueThb)}${r.unmetPax > 0 ? ` · ${r.unmetPax} lost to capacity` : ""}${scrubbable ? " — click to jump here" : ""}`}
              >
                <div className="analytics-col__plot">
                  <div
                    className="analytics-col__demand"
                    style={{ height: `${demandPct}%` }}
                  />
                  <div
                    className="analytics-col__supply"
                    style={{ bottom: `${supplyPct}%` }}
                  />
                </div>
                <div className="analytics-col__revenue-track">
                  <div
                    className="analytics-col__revenue-fill"
                    style={{ height: `${revenuePct}%` }}
                  />
                </div>
                <div className="analytics-col__hour">{String(r.hour).padStart(2, "0")}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="analytics-summary">
        <div className="analytics-summary__cell">
          <div className="analytics-summary__label">Total demand</div>
          <div className="analytics-summary__value">{totalDemand.toLocaleString()} pax</div>
        </div>
        <div className="analytics-summary__cell">
          <div className="analytics-summary__label">Served</div>
          <div className="analytics-summary__value">{totalServed.toLocaleString()} pax</div>
        </div>
        <div className="analytics-summary__cell analytics-summary__cell--gap">
          <div className="analytics-summary__label">Unmet</div>
          <div className="analytics-summary__value">{totalUnmet.toLocaleString()} pax</div>
        </div>
        <div className="analytics-summary__cell">
          <div className="analytics-summary__label">Revenue</div>
          <div className="analytics-summary__value">{fmtThb(totalRevenue)}</div>
        </div>
        <div className="analytics-summary__cell analytics-summary__cell--lost">
          <div className="analytics-summary__label">Lost (capacity)</div>
          <div className="analytics-summary__value">{fmtThb(lostRevenue)}</div>
        </div>
      </div>
    </div>
  );
}
