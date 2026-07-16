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
  shortfall: "ADD BUS",
  tight: "TIGHT",
  balanced: "OK",
  surplus: "LIGHT"
};

const STATUS_DESC: Record<HourlyBalanceStatus, string> = {
  shortfall: "More demand than seats — a bus added here earns ฿100 per boarding",
  tight: "Within 25 pax of shortage",
  balanced: "Demand ≈ supply",
  surplus: "Buses running light — fewer riders than seats this hour"
};

function fmtClock(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

function fmtThb(n: number): string {
  return `฿${n.toLocaleString()}`;
}

/**
 * The basic diagram: hour by hour, both directions, where the money is.
 *
 * Row anatomy:
 *   [time] | IN → island   (arriving flights → bus queue, engine demand)
 *          | OUT → airport (departing flights → be there 1h early)
 *          | SEATS         (the fixed timetable, both directions)
 *          | verdict chip  (ADD BUS −n / LIGHT +n) + ฿ missed this hour
 *
 * Buses run on intervals; planes don't. Amber hours are missed money —
 * demand outran the fixed schedule. Gray LIGHT hours are seats flying
 * past nobody. The footer totals answer the operator's four questions.
 */
export function HourlyBalanceChart({ rows, simMinutes, onHourSelect }: HourlyBalanceChartProps) {
  const currentHour = Math.floor(simMinutes / 60) % 24;
  const max = useMemo(
    () => Math.max(1, ...rows.map((r) => Math.max(r.busEligiblePax, r.outEligiblePax, r.busSeats + r.outSeats))),
    [rows]
  );

  const totals = useMemo(() => {
    let earned = 0, missed = 0, shortHours = 0, lightHours = 0, emptySeats = 0;
    for (const r of rows) {
      earned += r.earnedThb;
      missed += r.missedThb;
      if (r.status === "shortfall" || r.status === "tight") shortHours += 1;
      // Per-direction: an hour can need a southbound bus AND have northbound
      // seats running empty — both truths count.
      emptySeats += r.emptySeatsPax;
      if (r.emptySeatsPax >= 25) lightHours += 1;
    }
    return { earned, missed, shortHours, lightHours, emptySeats };
  }, [rows]);

  return (
    <div className="v2-hourly">
      <div className="v2-hourly__title">Missed Money · Hour by Hour</div>
      <div className="v2-hourly__legend">
        <span className="v2-hourly__legend-item v2-hourly__legend-item--arr">IN → island</span>
        <span className="v2-hourly__legend-item v2-hourly__legend-item--out">OUT → airport</span>
        <span className="v2-hourly__legend-item v2-hourly__legend-item--seats">Seats scheduled</span>
      </div>
      <div className="v2-hourly__rows">
        {rows.map((row) => {
          const isCurrent = row.hour === currentHour;
          const w = (n: number) => `${Math.max(0, Math.min(100, (n / max) * 100))}%`;
          const gap = row.gapPax;
          const totalSeats = row.busSeats + row.outSeats;
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
              <div className="v2-hourly__track">
                <div className="v2-hourly__group">
                  <div
                    className="v2-hourly__fill v2-hourly__fill--arr"
                    style={{ width: w(row.busEligiblePax) }}
                    title={`${row.busEligiblePax} pax landing → want a bus to the island`}
                  />
                  <span className="v2-hourly__fill-label">{row.busEligiblePax}</span>
                </div>
                <div className="v2-hourly__group">
                  <div
                    className="v2-hourly__fill v2-hourly__fill--out"
                    style={{ width: w(row.outEligiblePax) }}
                    title={`${row.outEligiblePax} pax flying out → need a bus to the airport`}
                  />
                  <span className="v2-hourly__fill-label">{row.outEligiblePax}</span>
                </div>
                <div className="v2-hourly__group">
                  <div
                    className="v2-hourly__fill v2-hourly__fill--seats"
                    style={{ width: w(totalSeats) }}
                    title={`${totalSeats} scheduled seats (${row.busSeats} out of airport · ${row.outSeats} toward airport)`}
                  />
                  <span className="v2-hourly__fill-label">{totalSeats}</span>
                </div>
              </div>
              <span className="v2-hourly__verdict">
                <span
                  className={`v2-hourly__status v2-hourly__status--${row.status}`}
                  title={STATUS_DESC[row.status]}
                >
                  {STATUS_LABEL[row.status]}
                  <span className="v2-hourly__status-num">
                    {gap > 0 ? `−${gap}` : gap < 0 ? `+${-gap}` : "0"}
                  </span>
                </span>
                {row.missedThb > 0 && (
                  <span className="v2-hourly__missed" title={`${fmtThb(row.missedThb)} rode away in Grabs this hour`}>
                    {fmtThb(row.missedThb)} missed
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
      <div className="v2-hourly__footer">
        <span className="v2-hourly__footer-earned"><strong>{fmtThb(totals.earned)}</strong> earned</span>
        <span className="v2-hourly__footer-missed"><strong>{fmtThb(totals.missed)}</strong> missed</span>
        <span>
          <strong>{totals.shortHours}</strong> hrs need buses · <strong>{totals.lightHours}</strong> hrs light
          ({totals.emptySeats.toLocaleString()} empty seats)
        </span>
      </div>
    </div>
  );
}
