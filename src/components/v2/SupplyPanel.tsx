import { useState } from "react";
import { Counter, InsightCard } from "./V2Shared";
import { getFleetScenario, getWeekEconomics } from "../../engine/demandSupplyEngine";
import { getSimulationDay } from "../../engine/opsFlightSchedule";
import type { SimState } from "../../engine/simulation";

// ---------------------------------------------------------------------------
// Helpers and Sub-components
// ---------------------------------------------------------------------------
function formatCurrencyCompact(value: number) {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: value >= 100_000 ? 1 : 0
  }).format(value);
}

interface DestinationResponseProps {
  breakdown: SimState["destBreakdown"];
}

function DestinationResponse({ breakdown }: DestinationResponseProps) {
  const visible = breakdown.filter((destination) => destination.served > 0);
  const peakServed = Math.max(...visible.map((destination) => destination.served), 1);

  if (visible.length === 0) {
    return <p className="v2-dest-row__empty">Waiting for first passengers...</p>;
  }

  return (
    <div className="v2-destinations">
      <h3 className="v2-destinations__title">Response by Destination</h3>
      {visible.map((destination) => (
        <div key={destination.name} className="v2-dest-card">
          <div className="v2-dest-card__meta">
            <span className="v2-dest-row__name">{destination.name}</span>
            <span className="v2-dest-row__served">{destination.served} pax</span>
          </div>
          <div className="v2-dest-card__track">
            <div
              className="v2-dest-card__fill"
              style={{ width: `${(destination.served / peakServed) * 100}%` }}
            />
          </div>
          <span className="v2-dest-row__rev">฿{destination.revenue.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Interactive fleet scenario — add or remove buses, the WHOLE day re-runs
// (both directions) against the same flights. The toolkit's co-design ranked
// "increase frequency" among the top interventions but couldn't price it —
// this stepper prices it, live.
// ---------------------------------------------------------------------------

function FleetScenarioCard() {
  const [delta, setDelta] = useState(0);
  const s = getFleetScenario(delta);
  const gained = s.deltaRevenueThb;
  return (
    <div className="v2-whatif">
      <h3 className="v2-whatif__title">Fleet Scenario · Whole-Day Re-run</h3>
      <div className="v2-scenario__stepper">
        <button
          className="v2-scenario__btn"
          onClick={() => setDelta((d) => Math.max(-5, d - 1))}
          disabled={delta <= -5}
          title="Withdraw the emptiest duty chain (a bus's whole day of trips)"
        >−</button>
        <span className="v2-scenario__delta">
          {delta === 0 ? "current fleet" : delta > 0 ? `+${delta} bus${delta > 1 ? "es" : ""}` : `${delta} bus${delta < -1 ? "es" : ""}`}
        </span>
        <button
          className="v2-scenario__btn"
          onClick={() => setDelta((d) => Math.min(10, d + 1))}
          disabled={delta >= 10}
          title="Add a bus running Airport ↔ Rawai duty cycles from the worst-queue moment"
        >+</button>
      </div>
      <div className="v2-whatif__row">
        <span className="v2-whatif__buses">Revenue</span>
        <span className="v2-whatif__rev">฿{s.revenueThb.toLocaleString()}</span>
        <span className={`v2-scenario__delta-val ${gained > 0 ? "is-pos" : gained < 0 ? "is-neg" : ""}`}>
          {gained === 0 ? "—" : `${gained > 0 ? "+" : "−"}฿${Math.abs(gained).toLocaleString()}`}
        </span>
      </div>
      <div className="v2-whatif__row">
        <span className="v2-whatif__buses">Riders</span>
        <span className="v2-whatif__rev">{s.boarded.toLocaleString()}</span>
        <span className={`v2-scenario__delta-val ${s.deltaBoarded > 0 ? "is-pos" : s.deltaBoarded < 0 ? "is-neg" : ""}`}>
          {s.deltaBoarded === 0 ? "—" : `${s.deltaBoarded > 0 ? "+" : "−"}${Math.abs(s.deltaBoarded).toLocaleString()} pax`}
        </span>
      </div>
      <div className="v2-whatif__row">
        <span className="v2-whatif__buses">Unserved</span>
        <span className="v2-whatif__rev">{s.lost.toLocaleString()} pax</span>
        <span className={`v2-scenario__delta-val ${s.deltaLostThb < 0 ? "is-pos" : s.deltaLostThb > 0 ? "is-neg" : ""}`}>
          {s.deltaLostThb === 0 ? "—" : `${s.deltaLostThb > 0 ? "+" : "−"}฿${Math.abs(s.deltaLostThb).toLocaleString()}`}
        </span>
      </div>
      <p className="v2-whatif__note">
        Supply stays scheduled; demand stays what the flights bring. +1 bus =
        one more Airport ↔ Rawai duty cycle all day (both directions), placed
        at the worst queue. −1 withdraws the emptiest chain. Every number is a
        full-day re-run; passengers stay conserved.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Weekly economics: the week is Σ of the 7 deterministic day models — same
// published timetable every day, demand varies by day-of-week. This is the
// "how much per week" answer, computed, not annualised guesswork.
// ---------------------------------------------------------------------------

function WeekCard({ onDayChange }: { onDayChange?: (dow: number) => void }) {
  const { days, week } = getWeekEconomics();
  const activeDow = getSimulationDay();
  const maxRevenue = Math.max(...days.map((d) => d.revenueThb), 1);
  return (
    <div className="v2-week">
      <h3 className="v2-week__title">Weekly Revenue · This Fleet</h3>
      {days.map((d) => (
        <button
          key={d.dow}
          className={`v2-week__row ${d.dow === activeDow ? "is-active" : ""}`}
          onClick={() => onDayChange?.(d.dow)}
          title={`Replay ${d.label} · ${d.boarded.toLocaleString()} boarded · ${d.abandoned.toLocaleString()} walked away`}
        >
          <span className="v2-week__day">{d.label}</span>
          <span className="v2-week__track">
            <span
              className="v2-week__fill"
              style={{ width: `${(d.revenueThb / maxRevenue) * 100}%` }}
            />
          </span>
          <span className="v2-week__rev">฿{d.revenueThb.toLocaleString()}</span>
          <span className="v2-week__lost">−฿{formatCurrencyCompact(d.lostRevenueThb)}</span>
        </button>
      ))}
      <div className="v2-week__total">
        <span className="v2-week__total-label">Week</span>
        <span className="v2-week__total-val">฿{week.revenueThb.toLocaleString()}</span>
        <span className="v2-week__total-lost">฿{week.lostRevenueThb.toLocaleString()} lost to capacity</span>
      </div>
      <p className="v2-week__note">
        Σ of 7 deterministic day models — same timetable daily, demand varies
        by day. Click a day to replay it.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
interface SupplyPanelProps {
  state: SimState;
  serviceGap: number;
  totalBusesRequired: number;
  inServiceCount: number;
  fleetAnalysisLength: number;
  gapStatus: "shortfall" | "tight" | "surplus";
  currentSupplySeats: number;
  currentBusDemand: number;
  currentGap: number;
  onDayChange?: (dow: number) => void;
}

export function SupplyPanel({
  state,
  serviceGap,
  totalBusesRequired,
  inServiceCount,
  fleetAnalysisLength,
  gapStatus,
  currentSupplySeats,
  currentBusDemand,
  currentGap,
  onDayChange,
}: SupplyPanelProps) {
  return (
    <aside className={`v2-panel v2-panel--supply ${serviceGap > 25 ? 'is-alert' : ''}`}>
      <h2 className="v2-panel__title">Supply & Impact</h2>

      <InsightCard
        eyebrow="Fleet Capacity"
        headline={`${totalBusesRequired} buses required · ${inServiceCount} in service`}
        detail={`Schedule-derived fleet size across ${fleetAnalysisLength} routes. Headway varies by demand pattern.`}
        tone="supply"
      />

      <div className="v2-kpi-stack">
        <div className={`v2-kpi ${gapStatus === "shortfall" ? "v2-kpi--alert" : gapStatus === "tight" ? "v2-kpi--warn" : "v2-kpi--green"}`}>
          <div className="v2-kpi__val">
            <span className="counter">{currentSupplySeats}</span>
            <span className="v2-kpi__sub">/{currentBusDemand}</span>
          </div>
          <div className="v2-kpi__label">Seats vs Demand this hour</div>
        </div>
        <div className="v2-kpi v2-kpi--green">
          <div className="v2-kpi__val"><Counter value={state.paxBoarded} /></div>
          <div className="v2-kpi__label">Captured (boarded)</div>
        </div>
        <div className={`v2-kpi ${state.paxAbandoned > 0 ? "v2-kpi--alert" : ""}`}>
          <div className="v2-kpi__val"><Counter value={state.paxAbandoned} /></div>
          <div className="v2-kpi__label">Walked away (60 min wait)</div>
        </div>
        <div className={`v2-kpi ${state.lostRevenueThb > 0 ? "v2-kpi--alert" : ""}`}>
          <div className="v2-kpi__val"><Counter value={state.lostRevenueThb} prefix="฿" /></div>
          <div className="v2-kpi__label">Revenue lost to capacity</div>
        </div>
        <div className="v2-kpi v2-kpi--green">
          <div className="v2-kpi__val"><Counter value={state.revenueThb} prefix="฿" /></div>
          <div className="v2-kpi__label">Revenue earned</div>
        </div>
        <div className="v2-kpi">
          <div className="v2-kpi__val"><span className="counter">฿{formatCurrencyCompact(state.savingsThb)}</span></div>
          <div className="v2-kpi__label">Saved vs Grab/taxi</div>
        </div>
      </div>

      <FleetScenarioCard />

      <WeekCard onDayChange={onDayChange} />

      <div className="v2-impact">
        <h3 className="v2-impact__title">Environmental Impact</h3>
        <div className="v2-impact__row">
          <span className="v2-impact__label">CO₂ if all took taxis</span>
          <span className="v2-impact__val"><Counter value={state.co2TaxiKg} suffix=" kg" /></span>
        </div>
        <div className="v2-impact__row">
          <span className="v2-impact__label">CO₂ with Smart Bus</span>
          <span className="v2-impact__val v2-impact__val--green"><Counter value={Math.round(state.paxDelivered * 28 * 0.06)} suffix=" kg" /></span>
        </div>
        <div className="v2-impact__row v2-impact__row--highlight">
          <span className="v2-impact__label">CO₂ saved</span>
          <span className="v2-impact__val v2-impact__val--green"><Counter value={state.co2SavedKg} suffix=" kg" /></span>
        </div>
      </div>

      <DestinationResponse breakdown={state.destBreakdown} />
    </aside>
  );
}
