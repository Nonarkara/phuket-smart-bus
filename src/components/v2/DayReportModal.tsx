/**
 * DayReportModal — the debrief after a day has run.
 *
 * Opens automatically when the DAY·60s sweep freezes on 24:00, and on demand
 * from the DAY REPORT button. Four answers, in the order an owner asks them:
 *
 *   1. How did the day go?         earned / missed / collected of possible
 *   2. Where do I need MORE buses?  hours short, whole buses, ฿ missed there
 *   3. Where can I run LIGHTER?     hours with whole empty buses, opex to save
 *   4. What would ±N buses do?      whole-day re-runs, net of opex
 *
 * Everything is `getDayDebrief()` — HourlyBalance rows, the day model's
 * combined totals and getFleetScenario. Nothing on this card is new math.
 */

import { useEffect, useMemo } from "react";
import { getDayDebrief, DAILY_OPEX_PER_BUS_THB, TRIP_OPEX_THB, type DebriefHour } from "../../engine/v2OpsPanel";
import { BUS_CAPACITY, FARE_THB } from "../../engine/demandSupplyEngine";
import { scrubToHour } from "./DemandPanel";

interface Props {
  isOpen: boolean;
  simDay: number;
  onClose: () => void;
  onReplay: () => void;
}

function fmtThb(n: number): string {
  const sign = n < 0 ? "−" : "";
  return `${sign}฿${Math.abs(Math.round(n)).toLocaleString()}`;
}
function fmtSigned(n: number): string {
  return n > 0 ? `+${n.toLocaleString()}` : n < 0 ? `−${Math.abs(n).toLocaleString()}` : "0";
}
function clock(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}
const DIR_LABEL: Record<DebriefHour["direction"], string> = {
  in: "airport → island",
  out: "island → airport",
  both: "both directions"
};

export function DayReportModal({ isOpen, simDay, onClose, onReplay }: Props) {
  // Recomputed when the day changes — the debrief is memoised per day-of-week
  // inside the engine, so this is a cache read after the first open.
  const report = useMemo(() => (isOpen ? getDayDebrief() : null), [isOpen, simDay]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen || !report) return null;

  const jump = (hour: number) => { scrubToHour(hour); onClose(); };
  const addTop = report.addHours.slice(0, 6);
  const lightTop = report.lightHoursList.slice(0, 6);
  const best = report.bestFleet;

  return (
    <div className="v2-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="End of day report">
      <div className="v2-modal v2-report" onClick={(e) => e.stopPropagation()}>
        <header className="v2-modal__header v2-report__header">
          <div>
            <span className="v2-modal__eyebrow">End of day · {report.dayLabel} · 24-hour model, both directions</span>
            <h2 className="v2-modal__title">
              {report.collectedPax.toLocaleString()} riders collected of {report.couldHavePax.toLocaleString()} who wanted a bus · {report.capturePct}%
            </h2>
          </div>
          <button type="button" className="v2-modal__close" onClick={onClose} aria-label="Close report">✕</button>
        </header>

        <div className="v2-report__body">
          {/* 1 · the day in four numbers */}
          <section className="v2-report__kpis" aria-label="Day totals">
            <div className="v2-report__kpi is-earned">
              <strong>{fmtThb(report.earnedThb)}</strong>
              <span>earned · {report.collectedPax.toLocaleString()} boardings × ฿{FARE_THB}</span>
            </div>
            <div className="v2-report__kpi is-missed">
              <strong>{fmtThb(report.missedThb)}</strong>
              <span>missed · {report.lostPax.toLocaleString()} riders took a Grab</span>
            </div>
            <div className="v2-report__kpi is-short">
              <strong>+{report.busesToAdd}</strong>
              <span>bus-trips short across {report.shortHours} hr{report.shortHours === 1 ? "" : "s"}{report.peakShortHour != null ? ` · worst ${clock(report.peakShortHour)}` : ""}</span>
            </div>
            <div className="v2-report__kpi is-light">
              <strong>−{report.busesToPull}</strong>
              <span>bus-trips ran empty across {report.lightHours} hr{report.lightHours === 1 ? "" : "s"} · {report.emptySeats.toLocaleString()} empty seats</span>
            </div>
          </section>

          {/* 1b · the conservation line — visible math so the operator sees
                where every wanted rider ends up at 24:00. 3-term:
                collected + lost (Grab) + waiting (still on the curb) = couldHave. */}
          <p className="v2-report__conservation">
            <span><b>{report.collectedPax.toLocaleString()}</b> collected</span>
            <span aria-hidden="true">+</span>
            <span><b>{report.lostPax.toLocaleString()}</b> took a Grab</span>
            <span aria-hidden="true">+</span>
            <span><b>{report.waitingPax.toLocaleString()}</b> still waiting</span>
            <span aria-hidden="true">=</span>
            <span><b>{report.couldHavePax.toLocaleString()}</b> wanted a bus</span>
          </p>
          <p className="v2-report__conservation-note">
            {report.waitingPax === 0
              ? "Midnight: the curb was empty. Everyone who wanted a bus either boarded or took a Grab."
              : `Midnight: ${report.waitingPax.toLocaleString()} still on the curb. They never boarded and they never took a Grab — they carry into tomorrow.`}
          </p>

          <div className="v2-report__grid">
            {/* 2 · add buses here */}
            <section className="v2-report__table" aria-label="Hours that need more buses">
              <header>
                <span className="v2-report__eyebrow is-short">Add buses here</span>
                <small>riders outnumbered seats · sorted by ฿ missed</small>
              </header>
              {addTop.length === 0 ? (
                <p className="v2-report__empty">No hour ran short. The timetable covered every rider.</p>
              ) : (
                <table>
                  <thead>
                    <tr><th>Hour</th><th>Direction</th><th>Riders</th><th>Seats</th><th>Add</th><th>Missed</th></tr>
                  </thead>
                  <tbody>
                    {addTop.map((h) => (
                      <tr key={h.hour} onClick={() => jump(h.hour)} title={`Replay ${clock(h.hour)}`}>
                        <td><b>{clock(h.hour)}</b></td>
                        <td>{DIR_LABEL[h.direction]}</td>
                        <td>{h.demandPax}</td>
                        <td>{h.seats}</td>
                        <td className="is-short"><b>+{h.buses}</b> bus{h.buses === 1 ? "" : "es"}</td>
                        <td className="is-missed">{fmtThb(h.thb)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            {/* 3 · run lighter here */}
            <section className="v2-report__table" aria-label="Hours with empty buses">
              <header>
                <span className="v2-report__eyebrow is-light">Run lighter here</span>
                <small>whole {BUS_CAPACITY}-seat trips carried nobody · ฿{TRIP_OPEX_THB} opex per trip</small>
              </header>
              {lightTop.length === 0 ? (
                <p className="v2-report__empty">No hour ran a whole bus empty.</p>
              ) : (
                <table>
                  <thead>
                    <tr><th>Hour</th><th>Direction</th><th>Riders</th><th>Seats</th><th>Pull</th><th>Opex saved</th></tr>
                  </thead>
                  <tbody>
                    {lightTop.map((h) => (
                      <tr key={h.hour} onClick={() => jump(h.hour)} title={`Replay ${clock(h.hour)}`}>
                        <td><b>{clock(h.hour)}</b></td>
                        <td>{DIR_LABEL[h.direction]}</td>
                        <td>{h.demandPax}</td>
                        <td>{h.seats}</td>
                        <td className="is-light"><b>−{h.buses}</b> bus{h.buses === 1 ? "" : "es"}</td>
                        <td>{fmtThb(h.thb)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </div>

          {/* 4 · what ±N buses would have done — whole-day re-runs */}
          <section className="v2-report__fleet" aria-label="Fleet what-if">
            <header>
              <span className="v2-report__eyebrow">What ±N buses would have done</span>
              <small>whole day re-run against the same flights · opex ฿{DAILY_OPEX_PER_BUS_THB.toLocaleString()} per bus-day (฿800k/yr ÷ 365 ÷ 16 h)</small>
            </header>
            <div className="v2-report__ladder">
              {report.fleet.map((f) => (
                <div key={f.deltaBuses} className={`v2-report__rung ${f.netThb > 0 ? "is-gain" : f.netThb < 0 ? "is-loss" : ""} ${best && best.deltaBuses === f.deltaBuses ? "is-best" : ""}`}>
                  <b>{fmtSigned(f.deltaBuses)} bus{Math.abs(f.deltaBuses) === 1 ? "" : "es"}</b>
                  <span>{fmtSigned(f.deltaBoarded)} riders</span>
                  <span>{fmtThb(f.deltaRevenueThb)} fares</span>
                  <span>{fmtThb(-f.deltaOpexThb)} opex</span>
                  <strong>{fmtThb(f.netThb)} net</strong>
                </div>
              ))}
            </div>
            <p className="v2-report__verdict">
              {best
                ? <>Best move: <b>{fmtSigned(best.deltaBuses)} bus{Math.abs(best.deltaBuses) === 1 ? "" : "es"}</b> would have added <b>{fmtSigned(best.deltaBoarded)} riders</b> and <b>{fmtThb(best.netThb)}</b> net of opex on this day.</>
                : <>No fleet change clears its own opex on this day — the money is in <b>timing</b>, not fleet size: move buses to the short hours above.</>}
            </p>
          </section>
        </div>

        <footer className="v2-report__actions">
          <button type="button" className="v2-report__btn is-primary" onClick={() => { onReplay(); onClose(); }}>▶ Replay the day · 60s</button>
          {report.peakShortHour != null && (
            <button type="button" className="v2-report__btn" onClick={() => jump(report.peakShortHour!)}>Jump to worst hour · {clock(report.peakShortHour)}</button>
          )}
          <button type="button" className="v2-report__btn" onClick={onClose}>Close</button>
        </footer>
      </div>
    </div>
  );
}

export default DayReportModal;
