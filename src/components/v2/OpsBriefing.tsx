import { useMemo, type RefObject } from "react";
import type { HourlyBalance } from "../../engine/v2OpsPanel";
import { scrubToHour } from "./DemandPanel";
import { V2LiveMap, type V2MapHandle } from "./V2LiveMap";
import { PhuketConditionsStrip } from "./PhuketConditionsStrip";

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
  /** Set in LIVE: real tracker buses and today's observed/estimated totals. */
  live?: { gps: "current" | "last-seen" | "unavailable"; busesMoving: number; trips: number | null; km: number | null; riders: number; ridersCounted: number; fareThb: number } | null;
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
  live = null,
}: OpsBriefingProps) {
  const priorityHours = useMemo(
    () => [...hourlyBalance]
      .sort((left, right) => right.missedThb - left.missedThb || right.busesToAdd - left.busesToAdd)
      .slice(0, 3),
    [hourlyBalance]
  );

  const hasQueue = waiting > 25;
  const hourIsShort = currentBusDemand > currentSupplySeats;
  const headline = hasQueue
    ? `Test ${standbyBuses} standby ${standbyBuses === 1 ? "bus" : "buses"}`
    : hourIsShort
      ? "Protect the next airport departure"
      : "No modelled airport curb shortfall";

  return (
    <main className="v2-brief" aria-label="Mobile operations briefing">
      <section className="v2-brief__map" aria-labelledby="brief-map-title">
        <div className="v2-brief__map-frame">
          <V2LiveMap ref={mapRef} />
        </div>
        <header className="v2-brief__map-key">
          <h2 id="brief-map-title">{!live ? "Fleet map · simulation" : live.gps === "current" ? "Fleet map · live GPS" : live.gps === "last-seen" ? "Fleet map · last GPS fixes" : "Fleet map · GPS unavailable"}</h2>
          <strong>{live && live.gps !== "current" ? "No current count" : `${live ? live.busesMoving : movingBuses} moving`}</strong>
        </header>
      </section>

      <section className={`v2-brief__decision ${hasQueue ? "is-warning" : "is-stable"}`}>
        <span className="v2-brief__eyebrow">Modelled dispatch</span>
        <h2>{headline}</h2>
        <p>
          {hasQueue
            ? `${waiting.toLocaleString()} modelled arrivals are waiting. At 25 seats per bus, this is the estimated capacity needed. Check actual boardings before dispatch.`
            : `${currentBusDemand.toLocaleString()} modelled riders meet ${currentSupplySeats.toLocaleString()} ${live ? "seats on today's service" : "scheduled seats"} this hour.`}
        </p>
        {nextDeparture !== null && (
          <span className="v2-brief__next">
            Next departure in the service plan: {nextDeparture} min
          </span>
        )}
      </section>

      <section className="v2-brief__evidence" aria-labelledby="brief-evidence-title">
        <header className="v2-brief__section-head">
          <div>
            <span className="v2-brief__eyebrow">Trace the chain</span>
            <h2 id="brief-evidence-title">How demand becomes a decision</h2>
          </div>
        </header>
        <ol className="v2-brief__chain">
          <li><span>Modelled flight arrivals this hour</span><strong>{currentDemandPax.toLocaleString()}</strong></li>
          <li><span>Likely riders from the airport</span><strong>{currentBusDemand.toLocaleString()}</strong></li>
          <li><span>Seats leaving the airport this hour</span><strong>{currentSupplySeats.toLocaleString()}</strong></li>
          <li><span>Modelled queue now</span><strong>{waiting.toLocaleString()}</strong></li>
        </ol>
      </section>

      {live ? (
        <section className="v2-brief__totals" aria-label="Today's live totals">
          <div><span>Trips · GPS</span><strong>{live.trips?.toLocaleString() ?? "—"}</strong></div>
          <div><span>Km · GPS</span><strong>{live.km?.toLocaleString() ?? "—"}</strong></div>
          <div><span>{live.riders === 0 ? "Riders · not measured" : live.riders === live.ridersCounted ? "Riders · counted" : "Riders · partly modelled"}</span><strong>{live.riders > 0 ? live.riders.toLocaleString() : "—"}</strong></div>
          <div><span>Fares · derived</span><strong>{live.riders > 0 ? `฿${live.fareThb.toLocaleString()}` : "—"}</strong></div>
        </section>
      ) : (
        <section className="v2-brief__totals" aria-label="Today's operating totals">
          <div><span>Boarded</span><strong>{boarded.toLocaleString()}</strong></div>
          <div><span>Walked away</span><strong>{abandoned.toLocaleString()}</strong></div>
          <div><span>Revenue</span><strong>฿{earnedThb.toLocaleString()}</strong></div>
          <div><span>Missed</span><strong>฿{lostThb.toLocaleString()}</strong></div>
        </section>
      )}

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
              <span>{(Math.max(0, row.inGapPax) + Math.max(0, row.outGapPax)).toLocaleString()} seats short</span>
              <strong>฿{row.missedThb.toLocaleString()} missed</strong>
              <span aria-hidden="true">→</span>
            </button>
          ))}
        </div>
      </section>

      <PhuketConditionsStrip />
      <p className="v2-brief__note">
        {live
          ? "Positions are GPS fixes from the PKSB tracker. Trips and distance are observed; the queue and dispatch estimate are modelled. Fares are derived from riders, not observed payments."
          : "Replay positions follow the recorded service or published timetable along road geometry. Demand, boardings, and fares are modelled."}
      </p>
    </main>
  );
}
