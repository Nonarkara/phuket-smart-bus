/**
 * RiderDecisionCard — the core decision engine for a passenger.
 *
 * Answers the two essential human questions:
 *   1. "How long do I wait?"
 *   2. "Should I take the bus or Grab/taxi?"
 *
 * Follows STYLE.md: Braun control-surface feel, hairlines, one accent,
 * tabular figures, concrete comparison, 0 radius.
 */

import type React from "react";
import type { StopRef } from "./arrivals";
import { appPath } from "../../lib/paths";
import { getBangkokNowMinutes } from "../../engine/time";

/** Minutes from now (Bangkok clock) to an "HH:MM" departure; tomorrow's when today's has gone. */
function minutesUntil(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const d = Number(m[1]) * 60 + Number(m[2]) - getBangkokNowMinutes();
  return d < 0 ? d + 1440 : d;
}

interface RiderDecisionCardProps {
  currentStopRef: StopRef;
  stopName: string;
  liveEtaMin: number | null;
  timetableNextStr: string | null;
  children?: React.ReactNode;
}

export function RiderDecisionCard({
  currentStopRef,
  stopName,
  liveEtaMin,
  timetableNextStr,
  children
}: RiderDecisionCardProps) {
  // The wait, and where it comes from. A live bus beats the timetable; the
  // timetable's next departure is only the answer at the airport, where the
  // airport timetable is the one that applies. Anywhere else with no live bus
  // there is no wait to state — the card used to invent "35 minutes" there.
  const atAirport = currentStopRef.routeId === "rawai-airport" && currentStopRef.index === 0;
  const scheduledMin = !atAirport || !timetableNextStr ? null : minutesUntil(timetableNextStr);
  const wait: { min: number; live: boolean } | null =
    liveEtaMin !== null && liveEtaMin >= 0 ? { min: Math.round(liveEtaMin), live: true }
    : scheduledMin !== null ? { min: scheduledMin, live: false }
    : null;

  // Fares from the pricing table in CLAUDE.md: bus ฿100, Grab ฿400–1,000 by
  // destination, ฿750 the corridor average. Grab's dispatch time is not
  // measured anywhere, so it is not stated.
  const busFare = 100;
  const taxiFare = 750;
  const savingsThb = taxiFare - busFare;

  const isQuickWait = wait !== null && wait.min <= 20;
  const isModerateWait = wait !== null && wait.min > 20 && wait.min <= 35;
  const kind = wait === null ? "is-neutral" : isQuickWait ? "is-recommended" : isModerateWait ? "is-neutral" : "is-warning";
  // Where the number comes from, as a clause of its own. Welded onto the
  // noun it read as the bus being 85 minutes away FROM its own GPS.
  const basis = wait?.live ? "the estimate is the bus's own live GPS" : "the estimate is the published timetable";

  return (
    <section className="pa-decision" aria-labelledby="pa-decision-title">
      <header className="pa-decision__head">
        <span className="pa-decision__kicker">Traveler Decision · at {stopName}</span>
        <h2 id="pa-decision-title">Should you wait for the bus?</h2>
      </header>

      {/* Answer the question before asking a traveller to read two comparison
          records. The supporting arithmetic remains one disclosure away. */}
      <div className={`pa-decision__verdict ${kind}`}>
        <div className="pa-decision__verdict-title">
          {wait === null ? (
            <strong>No bus is on its way to {stopName} right now</strong>
          ) : isQuickWait ? (
            <strong>Take the bus · save ฿{savingsThb}</strong>
          ) : isModerateWait ? (
            <strong>Worth the wait: save ฿{savingsThb} for {wait.min} min</strong>
          ) : (
            <strong>Short on time? Grab leaves when you do</strong>
          )}
        </div>
        <p className="pa-decision__verdict-text">
          {wait === null
            ? `Grab is about ฿${taxiFare}; the bus is ฿${busFare} when one comes. The board above updates every few seconds.`
            : isQuickWait
              ? `The bus is about ${wait.min} min away — ${basis}. It saves ฿${savingsThb} over a Grab.`
              : isModerateWait
                ? `About ${wait.min} min — ${basis} — and ฿${savingsThb} saved. If you have time before check-in, the bus is an easy, air-conditioned ride.`
                : `The next bus is about ${wait.min} min away — ${basis}. With a flight to catch, take a Grab (about ฿${taxiFare}); otherwise the bus saves ฿${savingsThb}.`}
        </p>
      </div>

      {/* Ticket Action Cards (Directly attached to the decision) */}
      {children}

      <details className="pa-decision__detail">
        <summary>Compare bus and Grab</summary>
        <div className="pa-decision__grid">
          <div className="pa-decision__option pa-decision__option--bus">
            <div className="pa-decision__badge">Smart Bus</div>
            <div className="pa-decision__cost">
              <span className="pa-decision__amount">฿{busFare}</span>
              <span className="pa-decision__unit">flat fare</span>
            </div>
            <div className="pa-decision__wait">
              <span className="pa-decision__metric">
                {wait === null ? "No bus yet" : wait.live ? `${wait.min} min` : `Next ${timetableNextStr}`}
              </span>
              <small className="pa-decision__caption">
                {wait === null ? "none reported toward this stop" : wait.live ? "live GPS pace" : `scheduled · in ${wait.min} min`}
              </small>
            </div>
            <ul className="pa-decision__perks">
              <li>Air-conditioned</li>
              <li>Dedicated luggage space</li>
              <li>Pay driver cash or PromptPay</li>
            </ul>
          </div>

          <div className="pa-decision__option pa-decision__option--taxi">
            <div className="pa-decision__badge pa-decision__badge--muted">Grab / Taxi</div>
            <div className="pa-decision__cost">
              <span className="pa-decision__amount">~฿{taxiFare}</span>
              <span className="pa-decision__unit">avg corridor fare</span>
            </div>
            <div className="pa-decision__wait">
              <span className="pa-decision__metric">On request</span>
              <small className="pa-decision__caption">no timetable to wait for</small>
            </div>
            <ul className="pa-decision__perks">
              <li>Private vehicle</li>
              <li>Direct door-to-door</li>
              <li>Subject to surge pricing</li>
            </ul>
          </div>
        </div>
      </details>

      {/* The what-if lives where it is real: the operations console runs the
          fleet-size comparison on the recorded service. Here it was a toggle
          over hard-coded revenue and CO₂ figures that no model produced. */}
      <p className="pa-decision__ops">
        Why do buses come so rarely? <a href={appPath("/ops")}>See what more buses would carry</a>
      </p>
    </section>
  );
}
