import { Counter, InsightCard } from "./V2Shared";
import { getDayModel } from "../../engine/demandSupplyEngine";
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
// What-if: the engine re-runs the whole day with extra buses inserted at the
// worst-queue moments. This is the "how much more could we capture" answer,
// computed — not guessed.
// ---------------------------------------------------------------------------

function fmtClock(min: number) {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

function WhatIfCard() {
  const model = getDayModel();
  if (model.totals.abandoned === 0) return null;
  return (
    <div className="v2-whatif">
      <h3 className="v2-whatif__title">If we had more buses</h3>
      {model.whatIf.map((w) => (
        <div key={w.extraBuses} className="v2-whatif__row" title={`Duty cycles start at ${w.insertedAt.map(fmtClock).join(", ")} — each bus shuttles Airport ↔ Rawai for the rest of the day`}>
          <span className="v2-whatif__buses">+{w.extraBuses} buses</span>
          <span className="v2-whatif__gain">+{w.gainedPax.toLocaleString()} pax</span>
          <span className="v2-whatif__rev">+฿{w.gainedRevenueThb.toLocaleString()}/day</span>
        </div>
      ))}
      <p className="v2-whatif__note">
        Engine re-runs the whole day with each extra bus shuttling from the
        worst-queue moment onward (one airport departure every ~3.5 h per bus).
        Same flights, same 12% capture — only the supply changes.
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

      <WhatIfCard />

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
