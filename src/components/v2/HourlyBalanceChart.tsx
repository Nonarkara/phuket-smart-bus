import { useMemo } from "react";
import type { HourlyBalance, HourlyBalanceStatus } from "../../engine/v2OpsPanel";
import { scrubToHour } from "./DemandPanel";

interface HourlyBalanceChartProps {
  rows: HourlyBalance[];
  simMinutes: number;
  /** Hour currently shown to operators. When the user clicks a row we
   *  scrub the simulation to that hour so the map follows along. */
  onHourSelect?: (hour: number) => void;
}

const STATUS_LABEL: Record<HourlyBalanceStatus, string> = {
  shortfall: "SHORTFALL",
  tight: "TIGHT",
  balanced: "BALANCED",
  surplus: "SURPLUS"
};

const STATUS_DESC: Record<HourlyBalanceStatus, string> = {
  shortfall: "Demand exceeds supply · passengers wait",
  tight: "Within 25 pax of shortage",
  balanced: "Demand ≈ supply",
  surplus: "Empty seats flying past waiting passengers"
};

function fmtClock(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

/**
 * Hourly Demand-Supply Balance — three bars per hour so over/under-supply
 * is visible at a glance.
 *
 * Row anatomy:
 *   [time] | ARRIVALS  (raw arriving pax — plane-fueled)
 *            BUS POOL  (12% who'll take a bus)
 *            SEATS     (airport-line capacity this hour)
 *          | gap pill · "SHORTFALL −42" / "SURPLUS +35"
 *
 * Service window is 06:00–22:30. Hours outside are dimmed.
 */
export function HourlyBalanceChart({ rows, simMinutes, onHourSelect }: HourlyBalanceChartProps) {
  const currentHour = Math.floor(simMinutes / 60) % 24;
  const max = useMemo(
    () => Math.max(1, ...rows.map((r) => Math.max(r.arrivalPax, r.busEligiblePax, r.busSeats))),
    [rows]
  );

  // Cumulative shortfall / surplus across the day (visible in footer)
  const totals = useMemo(() => {
    let short = 0, surplus = 0, captured = 0, abandoned = 0;
    for (const r of rows) {
      if (r.gapPax > 0) short += r.gapPax;
      else surplus += -r.gapPax;
      captured += r.capturedPax;
      abandoned += r.abandonedPax;
    }
    return { short, surplus, captured, abandoned };
  }, [rows]);

  return (
    <div className="v2-hourly">
      <div className="v2-hourly__title">Hourly Demand · Supply · Capture</div>
      <div className="v2-hourly__legend">
        <span className="v2-hourly__legend-item v2-hourly__legend-item--arr">Plane arrivals</span>
        <span className="v2-hourly__legend-item v2-hourly__legend-item--eligible">Bus pool · 12%</span>
        <span className="v2-hourly__legend-item v2-hourly__legend-item--seats">Bus seats</span>
      </div>
      <div className="v2-hourly__rows">
        {rows.map((row) => {
          const inService = row.hour >= 6 && row.hour <= 22;
          const isCurrent = row.hour === currentHour;
          const w = (n: number) => `${Math.max(0, Math.min(100, (n / max) * 100))}%`;
          const gap = row.gapPax;
          return (
            <div
              key={row.hour}
              className={`v2-hourly__row ${isCurrent ? "is-current" : ""} v2-hourly__row--${row.status}`}
              role="button"
              tabIndex={0}
              title={`Jump to ${fmtClock(row.hour)} — ${STATUS_DESC[row.status]}`}
              onClick={() => {
                onHourSelect?.(row.hour);
                scrubToHour(row.hour);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  onHourSelect?.(row.hour);
                  scrubToHour(row.hour);
                }
              }}
            >
              <span className="v2-hourly__time">{fmtClock(row.hour)}</span>
              <div className="v2-hourly__track" aria-hidden={!inService}>
                <div className="v2-hourly__group">
                  <div
                    className="v2-hourly__fill v2-hourly__fill--arr"
                    style={{ width: w(row.arrivalPax) }}
                    title={`${row.arrivalPax} arriving pax`}
                  />
                  <span className="v2-hourly__fill-label">{row.arrivalPax}</span>
                </div>
                <div className="v2-hourly__group">
                  <div
                    className="v2-hourly__fill v2-hourly__fill--eligible"
                    style={{ width: w(row.busEligiblePax) }}
                    title={`${row.busEligiblePax} bus pool (12% capture)`}
                  />
                  <span className="v2-hourly__fill-label">{row.busEligiblePax}</span>
                </div>
                <div className="v2-hourly__group">
                  <div
                    className="v2-hourly__fill v2-hourly__fill--seats"
                    style={{ width: w(row.busSeats) }}
                    title={`${row.busSeats} bus seats available`}
                  />
                  <span className="v2-hourly__fill-label">{row.busSeats}</span>
                </div>
              </div>
              <span
                className={`v2-hourly__status v2-hourly__status--${row.status}`}
                title={STATUS_DESC[row.status]}
              >
                {STATUS_LABEL[row.status]}
                <span className="v2-hourly__status-num">
                  {gap > 0 ? `−${gap}` : gap < 0 ? `+${-gap}` : "0"}
                </span>
              </span>
            </div>
          );
        })}
      </div>
      <div className="v2-hourly__footer">
        <span><strong>{totals.captured.toLocaleString()}</strong> captured</span>
        <span><strong>{totals.abandoned.toLocaleString()}</strong> walked away</span>
        <span><strong>{totals.short}</strong> pax unmet · <strong>{totals.surplus}</strong> seats empty</span>
      </div>
    </div>
  );
}
