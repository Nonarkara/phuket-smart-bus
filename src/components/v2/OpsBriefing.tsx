import { useMemo, type RefObject } from "react";
import type { HourlyBalance } from "../../engine/v2OpsPanel";
import { scrubToHour } from "./DemandPanel";
import { V2LiveMap, type V2MapHandle } from "./V2LiveMap";

interface OpsBriefingProps {
  mapRef: RefObject<V2MapHandle | null>;
  waiting: number;
  movingBuses: number;
  boarded: number;
  abandoned: number;
  earnedThb: number;
  lostThb: number;
  currentDemandPax: number;
  currentBusDemand: number;
  currentSupplySeats: number;
  standbyBuses: number;
  nextDeparture: number | null;
  hourlyBalance: HourlyBalance[];
}

function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

/**
 * Phone and small-laptop operations view.
 *
 * The wall console answers many questions at once. A handheld should answer
 * only three: what needs action, where the buses are, and why the system made
 * that recommendation. All values remain direct outputs of the same engine.
 */
export function OpsBriefing({
  mapRef,
  waiting,
  movingBuses,
  boarded,
  abandoned,
  earnedThb,
  lostThb,
  currentDemandPax,
  currentBusDemand,
  currentSupplySeats,
  standbyBuses,
  nextDeparture,
  hourlyBalance,
}: OpsBriefingProps) {
  const priorityHours = useMemo(
    () => [...hourlyBalance]
      .sort((left, right) => right.missedThb - left.missedThb || right.gapPax - left.gapPax)
      .slice(0, 3),
    [hourlyBalance]
  );

  const hasQueue = waiting > 25;
  const hourIsShort = currentBusDemand > currentSupplySeats;
  const headline = hasQueue
    ? `Send ${standbyBuses} standby ${standbyBuses === 1 ? "bus" : "buses"}`
    : hourIsShort
      ? "Protect the next airport departure"
      : "Current service covers demand";

  return (
    <main className="v2-brief" aria-label="Mobile operations briefing">
      <section className={`v2-brief__decision ${hasQueue ? "is-warning" : "is-stable"}`}>
        <span className="v2-brief__eyebrow">Decision now</span>
        <h2>{headline}</h2>
        <p>
          {hasQueue
            ? `${waiting.toLocaleString()} people are waiting. At 25 seats each, ${standbyBuses} additional buses would clear this queue.`
            : `${currentBusDemand.toLocaleString()} likely riders meet ${currentSupplySeats.toLocaleString()} scheduled seats this hour.`}
        </p>
        {nextDeparture !== null && <span className="v2-brief__next">Next scheduled departure in {nextDeparture} min</span>}
      </section>

      <section className="v2-brief__map" aria-labelledby="brief-map-title">
        <header className="v2-brief__section-head">
          <div>
            <span className="v2-brief__eyebrow">Live fleet</span>
            <h2 id="brief-map-title">Where the buses are</h2>
          </div>
          <strong>{movingBuses} moving</strong>
        </header>
        <div className="v2-brief__map-frame">
          <V2LiveMap ref={mapRef} />
        </div>
        <p className="v2-brief__note">
          Positions currently follow the published timetable and road geometry.
          GPS can replace the simulation without changing this screen.
        </p>
      </section>

      <section className="v2-brief__evidence" aria-labelledby="brief-evidence-title">
        <header className="v2-brief__section-head">
          <div>
            <span className="v2-brief__eyebrow">Trace the chain</span>
            <h2 id="brief-evidence-title">How demand becomes a decision</h2>
          </div>
        </header>
        <ol className="v2-brief__chain">
          <li><span>Flight passengers this hour</span><strong>{currentDemandPax.toLocaleString()}</strong></li>
          <li><span>Likely bus riders</span><strong>{currentBusDemand.toLocaleString()}</strong></li>
          <li><span>Seats on the timetable</span><strong>{currentSupplySeats.toLocaleString()}</strong></li>
          <li><span>Queue right now</span><strong>{waiting.toLocaleString()}</strong></li>
        </ol>
      </section>

      <section className="v2-brief__totals" aria-label="Today's operating totals">
        <div><span>Boarded</span><strong>{boarded.toLocaleString()}</strong></div>
        <div><span>Walked away</span><strong>{abandoned.toLocaleString()}</strong></div>
        <div><span>Revenue</span><strong>฿{earnedThb.toLocaleString()}</strong></div>
        <div><span>Missed</span><strong>฿{lostThb.toLocaleString()}</strong></div>
      </section>

      <section className="v2-brief__priority" aria-labelledby="brief-priority-title">
        <header className="v2-brief__section-head">
          <div>
            <span className="v2-brief__eyebrow">Plan the day</span>
            <h2 id="brief-priority-title">Three hours to fix first</h2>
          </div>
        </header>
        <div className="v2-brief__hours">
          {priorityHours.map((row) => (
            <button key={row.hour} type="button" onClick={() => scrubToHour(row.hour)}>
              <span>{hourLabel(row.hour)}</span>
              <span>{Math.max(0, row.gapPax).toLocaleString()} seat gap</span>
              <strong>฿{row.missedThb.toLocaleString()} missed</strong>
              <span aria-hidden="true">→</span>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
