/**
 * DemandSupplyBalanceChart — the day's balance sheet in one glance.
 *
 * Twenty-four columns, one per hour, each split by direction (IN = airport →
 * island, OUT = island → airport). Bars rise ABOVE the axis when riders
 * outnumber seats (over-demand / under-supply: add a bus) and fall BELOW it
 * when seats outnumber riders (over-supply / under-demand: run lighter).
 * The verdict row under the axis prices the hour in whole buses.
 *
 * Every bar is `HourlyBalance.inGapPax` / `outGapPax` — the engine's
 * per-direction demand − seats. Nothing here is a second model.
 */

import { useMemo } from "react";
import type { HourlyBalance } from "../../engine/v2OpsPanel";
import { BUS_CAPACITY } from "../../engine/demandSupplyEngine";
import { scrubToHour } from "./DemandPanel";

interface Props {
  rows: HourlyBalance[];
  simMinutes: number;
  /** Compact variant for the operations rail (fewer labels, shorter bars). */
  variant?: "rail" | "full";
  onHourSelect?: (hour: number) => void;
}

function fmtThb(n: number): string {
  return `฿${n.toLocaleString()}`;
}

export function DemandSupplyBalanceChart({ rows, simMinutes, variant = "rail", onHourSelect }: Props) {
  const currentHour = Math.floor(simMinutes / 60) % 24;
  const minuteFrac = (simMinutes % 1440) / 1440;

  const view = useMemo(() => {
    let scale = BUS_CAPACITY;
    let shortHours = 0, lightHours = 0, busesToAdd = 0, busesToPull = 0, missed = 0, emptySeats = 0;
    for (const r of rows) {
      scale = Math.max(scale, Math.abs(r.inGapPax), Math.abs(r.outGapPax));
      if (r.busesToAdd > 0) { shortHours += 1; busesToAdd += r.busesToAdd; }
      const pull = Math.floor(Math.max(0, -r.inGapPax) / BUS_CAPACITY) + Math.floor(Math.max(0, -r.outGapPax) / BUS_CAPACITY);
      if (pull > 0) { lightHours += 1; busesToPull += pull; }
      missed += r.missedThb;
      emptySeats += r.emptySeatsPax;
    }
    return { scale, shortHours, lightHours, busesToAdd, busesToPull, missed, emptySeats };
  }, [rows]);

  const pct = (n: number) => `${Math.max(0, Math.min(100, (n / view.scale) * 100))}%`;

  return (
    <section className={`v2-balance v2-balance--${variant}`} aria-label="Hour-by-hour demand versus supply, both directions">
      <header className="v2-balance__head">
        <div>
          <span className="v2-balance__eyebrow">Demand vs supply · hour by hour</span>
          <h3 className="v2-balance__title">Where riders outnumber seats, and where seats ride empty</h3>
        </div>
        <div className="v2-balance__legend" aria-hidden="true">
          <span><i className="is-in" /> IN airport→island</span>
          <span><i className="is-out" /> OUT island→airport</span>
          <span className="v2-balance__legend-axis is-short">▲ short · add bus</span>
          <span className="v2-balance__legend-axis is-light">▼ light · run lighter</span>
        </div>
      </header>

      <div className="v2-balance__plot">
        <span className="v2-balance__axis v2-balance__axis--up">▲ riders without a seat · add a bus</span>
        <div className="v2-balance__cols" role="list">
          {rows.map((r) => {
            const upIn = Math.max(0, r.inGapPax);
            const upOut = Math.max(0, r.outGapPax);
            const downIn = Math.max(0, -r.inGapPax);
            const downOut = Math.max(0, -r.outGapPax);
            const pull = Math.floor(downIn / BUS_CAPACITY) + Math.floor(downOut / BUS_CAPACITY);
            const isNow = r.hour === currentHour;
            const verdict = r.busesToAdd > 0 ? `+${r.busesToAdd}` : pull > 0 ? `−${pull}` : "·";
            const tone = r.busesToAdd > 0 ? "is-short" : pull > 0 ? "is-light" : "is-even";
            const title = [
              `${String(r.hour).padStart(2, "0")}:00`,
              `IN ${r.busEligiblePax} riders vs ${r.busSeats} seats (${r.inGapPax > 0 ? `${r.inGapPax} short` : `${-r.inGapPax} spare`})`,
              `OUT ${r.outEligiblePax} riders vs ${r.outSeats} seats (${r.outGapPax > 0 ? `${r.outGapPax} short` : `${-r.outGapPax} spare`})`,
              r.busesToAdd > 0 ? `Add ${r.busesToAdd} bus${r.busesToAdd === 1 ? "" : "es"} · ${fmtThb(r.missedThb)} missed` : pull > 0 ? `${pull} bus${pull === 1 ? "" : "es"} ran empty` : "Balanced",
              "Click to replay this hour"
            ].join("\n");
            return (
              <button
                key={r.hour}
                type="button"
                role="listitem"
                className={`v2-balance__col ${tone} ${isNow ? "is-now" : ""}`}
                title={title}
                onClick={() => { onHourSelect?.(r.hour); scrubToHour(r.hour); }}
              >
                <span className="v2-balance__up">
                  <i className="is-in" style={{ height: pct(upIn) }} />
                  <i className="is-out" style={{ height: pct(upOut) }} />
                </span>
                <span className="v2-balance__down">
                  <i className="is-in" style={{ height: pct(downIn) }} />
                  <i className="is-out" style={{ height: pct(downOut) }} />
                </span>
                <span className="v2-balance__hour">{String(r.hour).padStart(2, "0")}</span>
                <b className="v2-balance__verdict">{verdict}</b>
              </button>
            );
          })}
          <span className="v2-balance__now" style={{ left: `${minuteFrac * 100}%` }} aria-hidden="true" />
        </div>
        <span className="v2-balance__axis v2-balance__axis--down">▼ seats without a rider · run lighter</span>
      </div>

      <footer className="v2-balance__foot">
        <span className="is-short"><strong>{view.shortHours}</strong> hrs short · <strong>+{view.busesToAdd}</strong> buses · <strong>{fmtThb(view.missed)}</strong> missed</span>
        <span className="is-light"><strong>{view.lightHours}</strong> hrs light · <strong>−{view.busesToPull}</strong> buses · <strong>{view.emptySeats.toLocaleString()}</strong> seats empty</span>
      </footer>
    </section>
  );
}

export default DemandSupplyBalanceChart;
