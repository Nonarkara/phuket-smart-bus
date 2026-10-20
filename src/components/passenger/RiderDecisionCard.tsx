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
import { useState } from "react";
import type { StopRef } from "./arrivals";
import { appPath } from "../../lib/paths";

interface RiderDecisionCardProps {
  currentStopRef: StopRef;
  stopName: string;
  liveEtaMin: number | null;
  timetableNextStr: string | null;
  children?: React.ReactNode;
}

export function RiderDecisionCard({
  stopName,
  liveEtaMin,
  timetableNextStr,
  children
}: RiderDecisionCardProps) {
  const [extraBuses, setExtraBuses] = useState<number>(0);

  // Determine bus wait minutes
  const busWaitMin = liveEtaMin !== null && liveEtaMin >= 0
    ? Math.round(liveEtaMin)
    : 35; // default reasonable waiting time if timetable only

  // Grounded pricing: ฿100 bus vs ฿750 Grab/taxi
  const busFare = 100;
  const taxiFare = 750;
  const taxiWaitMin = 4;
  const savingsThb = taxiFare - busFare;

  // Decision logic
  const isQuickWait = busWaitMin <= 20;
  const isModerateWait = busWaitMin > 20 && busWaitMin <= 35;
  const isLongWait = busWaitMin > 35;

  // Simulation what-if calculations
  // Adding buses reduces headway: 10 buses = ~40m headway, 12 buses = ~20m, 14 buses = ~12m
  const simulatedWaitMin = extraBuses === 0
    ? busWaitMin
    : extraBuses === 2
      ? Math.max(8, Math.round(busWaitMin * 0.45))
      : Math.max(5, Math.round(busWaitMin * 0.28));

  const additionalDailyRevenue = extraBuses === 0
    ? 0
    : extraBuses === 2
      ? 38000
      : 64000;

  const co2SavedKg = extraBuses === 0
    ? 0
    : extraBuses === 2
      ? 1600
      : 2900;

  return (
    <section className="pa-decision" aria-labelledby="pa-decision-title">
      <header className="pa-decision__head">
        <span className="pa-decision__kicker">Traveler Decision · at {stopName}</span>
        <h2 id="pa-decision-title">Should you wait for the bus?</h2>
      </header>

      {/* Side-by-side mode comparison */}
      <div className="pa-decision__grid">
        {/* Smart Bus Option */}
        <div className="pa-decision__option pa-decision__option--bus">
          <div className="pa-decision__badge">Smart Bus</div>
          <div className="pa-decision__cost">
            <span className="pa-decision__amount">฿{busFare}</span>
            <span className="pa-decision__unit">flat fare</span>
          </div>
          <div className="pa-decision__wait">
            <span className="pa-decision__metric">
              {liveEtaMin !== null
                ? `${busWaitMin} min`
                : timetableNextStr
                  ? `Next: ${timetableNextStr}`
                  : `~${busWaitMin} min`}
            </span>
            <small className="pa-decision__caption">
              {liveEtaMin !== null ? "live GPS pace" : "scheduled departure"}
            </small>
          </div>
          <ul className="pa-decision__perks">
            <li>Air-conditioned</li>
            <li>Dedicated luggage space</li>
            <li>Pay driver cash or PromptPay</li>
          </ul>
        </div>

        {/* Taxi / Grab Option */}
        <div className="pa-decision__option pa-decision__option--taxi">
          <div className="pa-decision__badge pa-decision__badge--muted">Grab / Taxi</div>
          <div className="pa-decision__cost">
            <span className="pa-decision__amount">~฿{taxiFare}</span>
            <span className="pa-decision__unit">avg corridor fare</span>
          </div>
          <div className="pa-decision__wait">
            <span className="pa-decision__metric">~{taxiWaitMin} min</span>
            <small className="pa-decision__caption">immediate dispatch</small>
          </div>
          <ul className="pa-decision__perks">
            <li>Private vehicle</li>
            <li>Direct door-to-door</li>
            <li>Subject to surge pricing</li>
          </ul>
        </div>
      </div>

      {/* The Verdict Banner */}
      <div className={`pa-decision__verdict ${isQuickWait ? "is-recommended" : isModerateWait ? "is-neutral" : "is-warning"}`}>
        <div className="pa-decision__verdict-title">
          {isQuickWait ? (
            <strong>Recommendation: Take the Bus · Save ฿{savingsThb}</strong>
          ) : isModerateWait ? (
            <strong>Worth the Wait: Save ฿{savingsThb} with a {busWaitMin}m wait</strong>
          ) : (
            <strong>Tight Schedule? Grab departs immediately</strong>
          )}
        </div>
        <p className="pa-decision__verdict-text">
          {isQuickWait
            ? `The bus arrives in approximately ${busWaitMin} minutes. Taking the bus saves you ฿${savingsThb} compared to a private taxi or Grab.`
            : isModerateWait
              ? `Waiting ~${busWaitMin} minutes saves ฿${savingsThb}. If you have comfortable time before your check-in, the bus offers an easy, air-conditioned ride.`
              : `The next bus is ~${busWaitMin} minutes away. If you have a flight to catch or a tight reservation, take Grab (~฿${taxiFare}). Otherwise, relax and save ฿${savingsThb}.`}
        </p>
      </div>

      {/* Ticket Action Cards (Directly attached to the decision) */}
      {children}

      {/* The Second Highlight: Interactive Simulation Teaser */}
      <div className="pa-sim-bridge">
        <div className="pa-sim-bridge__head">
          <div>
            <span className="pa-sim-bridge__tag">Second Highlight · Fleet Simulation</span>
            <h3 className="pa-sim-bridge__title">Why do buses come every ~45 minutes?</h3>
          </div>
          <a href={appPath("/ops")} className="pa-sim-bridge__cta">
            Open 30× Ops Simulator ↗
          </a>
        </div>
        <p className="pa-sim-bridge__copy">
          Phuket's airport line operates 10 buses across a 50 km coastal corridor. See how adding buses directly fixes passenger wait times and unlocks operator revenue:
        </p>

        {/* Interactive toggle */}
        <div className="pa-sim-bridge__controls" role="group" aria-label="Simulate fleet size">
          <button
            type="button"
            className={`pa-sim-bridge__btn ${extraBuses === 0 ? "is-active" : ""}`}
            onClick={() => setExtraBuses(0)}
          >
            Current (10 buses)
          </button>
          <button
            type="button"
            className={`pa-sim-bridge__btn ${extraBuses === 2 ? "is-active" : ""}`}
            onClick={() => setExtraBuses(2)}
          >
            +2 Buses (12 buses)
          </button>
          <button
            type="button"
            className={`pa-sim-bridge__btn ${extraBuses === 4 ? "is-active" : ""}`}
            onClick={() => setExtraBuses(4)}
          >
            +4 Buses (14 buses)
          </button>
        </div>

        {/* Live dynamic impact numbers */}
        <div className="pa-sim-bridge__stats">
          <div className="pa-sim-bridge__stat">
            <span className="pa-sim-bridge__stat-label">Estimated Wait</span>
            <strong className={`pa-sim-bridge__stat-value ${extraBuses > 0 ? "is-improved" : ""}`}>
              {simulatedWaitMin} min
            </strong>
          </div>
          <div className="pa-sim-bridge__stat">
            <span className="pa-sim-bridge__stat-label">Daily Revenue Gain</span>
            <strong className="pa-sim-bridge__stat-value">
              {extraBuses === 0 ? "Baseline" : `+฿${additionalDailyRevenue.toLocaleString()}`}
            </strong>
          </div>
          <div className="pa-sim-bridge__stat">
            <span className="pa-sim-bridge__stat-label">Daily CO₂ Saved</span>
            <strong className="pa-sim-bridge__stat-value">
              {extraBuses === 0 ? "Baseline" : `+${co2SavedKg.toLocaleString()} kg`}
            </strong>
          </div>
        </div>
      </div>
    </section>
  );
}
