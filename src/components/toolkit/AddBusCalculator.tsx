/**
 * AddBusCalculator — the "what if +1 bus" simulator.
 *
 * Pulls the engine's per-hour corridor and lets a reader drag a slider to
 * see how much missed money disappears if PKSB adds another bus to a
 * specific hour. Both directions are computed — the bus does both legs
 * of its duty cycle, so adding 1 bus means 25 more seats inbound *and*
 * 25 more seats outbound that hour.
 *
 * This is the most direct interactive tie between the prose argument
 * ("almost every hour is under-supplied") and the engine's actual math.
 * Every number on screen is computed, not estimated.
 */

import { useMemo, useState } from "react";
import { getHourlyCorridor } from "../../engine/demandSupplyEngine";

const SEATS_PER_BUS = 25;
const FARE_THB = 100;

function formatTHB(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `฿${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `฿${Math.round(n / 1_000)}k`;
  return `฿${Math.round(n)}`;
}

export function AddBusCalculator() {
  const corridor = useMemo(() => getHourlyCorridor(), []);
  const [hour, setHour] = useState<number>(12);
  const [extraBuses, setExtraBuses] = useState<number>(2);

  // The current hour, with the user's "add N buses" applied to BOTH
  // directions. Each bus = 25 seats; the bus works both legs of its duty.
  const calc = useMemo(() => {
    const beforeMissedPax = corridor.reduce(
      (sum, h) => sum + h.abandonedPax + h.outLostPax,
      0
    );
    const beforeMissedThb = corridor.reduce((sum, h) => sum + h.missedThb, 0);
    const h = corridor[hour] ?? corridor[0];
    const addedSeats = extraBuses * SEATS_PER_BUS;
    // Each direction: new boarded = min(demand, current + added). Both
    // directions share the same vehicle, so the +N is applied to both.
    const newInBoarded = Math.min(h.demandPax, h.seats + addedSeats);
    const newInAbandoned = Math.max(0, h.demandPax - h.seats - addedSeats);
    const newOutBoarded = Math.min(h.outDemandPax, h.outSeats + addedSeats);
    const newOutLost = Math.max(0, h.outDemandPax - h.outSeats - addedSeats);
    const newHourMissedPax = newInAbandoned + newOutLost;
    const newHourMissedThb = newHourMissedPax * FARE_THB;
    const newTotalMissedThb = beforeMissedThb - h.missedThb + newHourMissedThb;
    const newTotalMissedPax = beforeMissedPax - (h.abandonedPax + h.outLostPax) + newHourMissedPax;
    return {
      hour: h,
      before: { pax: h.abandonedPax + h.outLostPax, thb: h.missedThb },
      after: { pax: newHourMissedPax, thb: newHourMissedThb },
      dayBefore: { pax: beforeMissedPax, thb: beforeMissedThb },
      dayAfter: { pax: newTotalMissedPax, thb: newTotalMissedThb }
    };
  }, [corridor, hour, extraBuses]);

  // Peak missed hour — where the problem is biggest.
  const peakHour = useMemo(() => {
    let bestHour = 0;
    let bestMissed = 0;
    corridor.forEach((h, i) => {
      const total = h.abandonedPax + h.outLostPax;
      if (total > bestMissed) {
        bestMissed = total;
        bestHour = i;
      }
    });
    return bestHour;
  }, [corridor]);

  const maxHourMissed = useMemo(() => {
    let m = 0;
    corridor.forEach((h) => {
      const total = h.abandonedPax + h.outLostPax;
      if (total > m) m = total;
    });
    return m;
  }, [corridor]);

  const hourDeltaThb = calc.dayBefore.thb - calc.dayAfter.thb;
  const hourDeltaPct = calc.dayBefore.thb > 0
    ? Math.round((hourDeltaThb / calc.dayBefore.thb) * 100)
    : 0;

  return (
    <section className="abc-section" aria-labelledby="abc-title">
      <header className="abc-section__head">
        <p className="tk-kicker">Interactive · drag the slider</p>
        <h2 id="abc-title">What happens if PKSB adds <em>N</em> more buses at hour <em>H</em>?</h2>
        <p className="abc-section__sub">
          Pick the hour. Pick the bus count. The calculator reads the engine's
          actual hourly corridor and recomputes the missed-money figure in both
          directions. Each bus adds 25 seats inbound <em>and</em> 25 seats
          outbound (same vehicle, both legs of the duty cycle).
        </p>
      </header>

      <div className="abc-grid">
        {/* CONTROLS ----------------------------------------- */}
        <aside className="abc-controls" aria-label="Controls">
          <div className="abc-controls__group">
            <span className="tk-kicker">1 · Pick the hour</span>
            <div className="abc-hour-strip" role="radiogroup" aria-label="Hour of day">
              {corridor.map((h, i) => {
                const total = h.abandonedPax + h.outLostPax;
                const intensity = maxHourMissed > 0 ? total / maxHourMissed : 0;
                const isPeak = i === peakHour;
                return (
                  <button
                    key={i}
                    type="button"
                    role="radio"
                    aria-checked={i === hour}
                    title={`${String(i).padStart(2, "0")}:00 · ${total} pax missed${isPeak ? " · peak" : ""}`}
                    className={`abc-hour-strip__cell ${i === hour ? "is-active" : ""} ${isPeak ? "is-peak" : ""}`}
                    style={{ "--abc-intensity": intensity } as React.CSSProperties}
                    onClick={() => setHour(i)}
                  >
                    <span className="abc-hour-strip__num">{String(i).padStart(2, "0")}</span>
                    <span className="abc-hour-strip__bar" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
            <small className="abc-controls__hint">
              The peak (orange) is where the queue is biggest. Pick any hour.
            </small>
          </div>

          <div className="abc-controls__group">
            <span className="tk-kicker">2 · Add this many buses</span>
            <div className="abc-stepper" role="radiogroup" aria-label="Extra buses">
              {[0, 1, 2, 3, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={extraBuses === n}
                  className={`abc-stepper__btn ${extraBuses === n ? "is-active" : ""}`}
                  onClick={() => setExtraBuses(n)}
                >
                  +{n}
                </button>
              ))}
            </div>
            <small className="abc-controls__hint">
              +{extraBuses} buses = +{extraBuses * SEATS_PER_BUS * 2} seats per hour (both directions)
            </small>
          </div>

          <div className="abc-controls__group abc-controls__quote">
            <span className="tk-kicker">What the operator hears</span>
            <blockquote>
              {hourDeltaThb > 0
                ? <>If PKSB adds {extraBuses} bus{extraBuses === 1 ? "" : "es"} at the <strong>{String(hour).padStart(2, "0")}:00</strong> hour, the day's missed money drops by <strong>{formatTHB(hourDeltaThb)}</strong> ({hourDeltaPct}%).</>
                : <>With {extraBuses} bus{extraBuses === 1 ? "" : "es"} added at <strong>{String(hour).padStart(2, "0")}:00</strong>, the hour's demand is fully met. The remaining day-wide missed money is in the other hours.</>
              }
            </blockquote>
            <small>Numbers are computed from the same <code>getDayModel()</code> the live dashboard reads.</small>
          </div>
        </aside>

        {/* RESULTS ------------------------------------------- */}
        <div className="abc-results" aria-live="polite">
          <div className="abc-results__hour" aria-label={`Hour ${String(hour).padStart(2, "0")}:00`}>
            <span className="abc-results__hour-label">Hour {String(hour).padStart(2, "0")}:00</span>
            <span className="abc-results__hour-status">
              {calc.after.pax === 0 ? "Cleared" : calc.after.pax < calc.before.pax ? "Improved" : "Same"}
            </span>
          </div>

          <div className="abc-results__pair">
            <div className="abc-results__cell">
              <span className="tk-kicker">Before</span>
              <strong>{formatTHB(calc.before.thb)}</strong>
              <small>{calc.before.pax} pax missed this hour</small>
            </div>
            <div className="abc-results__arrow" aria-hidden="true">→</div>
            <div className="abc-results__cell abc-results__cell--after">
              <span className="tk-kicker">After +{extraBuses} bus{extraBuses === 1 ? "" : "es"}</span>
              <strong>{formatTHB(calc.after.thb)}</strong>
              <small>{calc.after.pax} pax missed this hour</small>
            </div>
          </div>

          <div className="abc-results__bars" aria-label="Day-wide missed money by hour">
            <span className="tk-kicker">Day-wide missed money (every hour)</span>
            <ol className="abc-bars" role="list">
              {corridor.map((h, i) => {
                const total = h.abandonedPax + h.outLostPax;
                const totalThb = h.missedThb;
                const max = maxHourMissed > 0 ? total / maxHourMissed : 0;
                const isSelected = i === hour;
                return (
                  <li
                    key={i}
                    className={`abc-bars__cell ${isSelected ? "is-selected" : ""}`}
                    style={{ "--abc-intensity": max } as React.CSSProperties}
                    aria-label={`${String(i).padStart(2, "0")}:00 · ${formatTHB(totalThb)}`}
                  >
                    <span className="abc-bars__bar" aria-hidden="true" />
                    <span className="abc-bars__num">{String(i).padStart(2, "0")}</span>
                  </li>
                );
              })}
            </ol>
          </div>

          <div className="abc-results__totals">
            <div>
              <span className="tk-kicker">Total before</span>
              <strong>{formatTHB(calc.dayBefore.thb)}</strong>
              <small>{calc.dayBefore.pax.toLocaleString()} pax walk away in a day</small>
            </div>
            <div>
              <span className="tk-kicker">Total after this change</span>
              <strong className={hourDeltaThb > 0 ? "is-gain" : ""}>
                {formatTHB(calc.dayAfter.thb)}
              </strong>
              <small>
                {formatTHB(hourDeltaThb)} saved ·{" "}
                {calc.dayAfter.pax.toLocaleString()} pax still walk away
              </small>
            </div>
          </div>

          <p className="abc-results__caveat">
            <strong>Caveat:</strong> this assumes the extra buses are staffed and
            positioned at the right terminal at the right minute. Real-world
            duty planning is a separate problem; the operator who clears the math
            still has to clear the contract.
          </p>
        </div>
      </div>
    </section>
  );
}

export default AddBusCalculator;
