import { useState } from "react";
import type { Lang, PriceComparison, VehiclePosition } from "@shared/types";
import { ui, pick } from "../lib/i18n";

interface WelcomeSheetProps {
  lang: Lang;
  vehicles: VehiclePosition[];
  comparisons: PriceComparison[];
  onRideNow: () => void;
}

export function WelcomeSheet({ lang, vehicles, comparisons, onRideNow }: WelcomeSheetProps) {
  const [expanded, setExpanded] = useState(false);

  // Find the soonest arriving bus from all vehicles
  const movingBuses = vehicles.filter(v => v.status === "moving");
  const nextBus = movingBuses.length > 0 ? movingBuses[0] : null;

  // Estimate minutes until arrival (use stopsAway as rough proxy)
  const nextMinutes = nextBus?.stopsAway != null
    ? Math.max(2, nextBus.stopsAway * 3) // ~3 min per stop
    : movingBuses.length > 0 ? 8 : null;

  // Get cheapest bus fare for savings display
  const cheapest = comparisons.length > 0 ? comparisons[0] : null;
  const savingsMultiplier = cheapest
    ? Math.floor(cheapest.taxi.maxThb / Math.max(cheapest.bus.fareThb, 1))
    : 10;

  return (
    <div className={`welcome-sheet ${expanded ? "is-expanded" : ""}`}>
      {/* Drag handle */}
      <div className="welcome-sheet__handle" onClick={() => setExpanded(!expanded)}>
        <div className="welcome-sheet__bar" />
      </div>

      {/* Welcome header */}
      <div className="welcome-sheet__header">
        <h1 className="welcome-sheet__title">{pick(ui.welcomeTitle, lang)}</h1>
        <p className="welcome-sheet__subtitle">{pick(ui.welcomeSubtitle, lang)}</p>
      </div>

      {/* Next bus card */}
      {nextMinutes != null ? (
        <div className="welcome-sheet__next-bus">
          <div className="welcome-sheet__countdown">
            <span className="welcome-sheet__minutes">{nextMinutes}</span>
            <span className="welcome-sheet__min-label">{pick(ui.welcomeMinAway, lang)}</span>
          </div>
          <div className="welcome-sheet__bus-info">
            <span className="welcome-sheet__bus-label">{pick(ui.welcomeNextBus, lang)}</span>
            {nextBus ? (
              <span className="welcome-sheet__bus-dest">{nextBus.destination.en}</span>
            ) : null}
            <span className="welcome-sheet__seats">
              {movingBuses.length * 32} {pick(ui.welcomeSeats, lang)}
            </span>
          </div>
          <button className="welcome-sheet__ride-btn" type="button" onClick={onRideNow}>
            {pick(ui.welcomeRideNow, lang)}
          </button>
        </div>
      ) : (
        <div className="welcome-sheet__next-bus welcome-sheet__next-bus--idle">
          <div className="welcome-sheet__bus-info">
            <span className="welcome-sheet__bus-label">{pick(ui.welcomeNextBus, lang)}</span>
            <span className="welcome-sheet__bus-dest">
              {pick(ui.welcomeFrom, lang)} ฿{cheapest?.bus.fareThb ?? 50}
            </span>
          </div>
          <button className="welcome-sheet__ride-btn" type="button" onClick={onRideNow}>
            {pick(ui.welcomeRideNow, lang)}
          </button>
        </div>
      )}

      {/* Savings teaser */}
      <div className="welcome-sheet__savings">
        <span className="welcome-sheet__savings-multiplier">{savingsMultiplier}×</span>
        <span className="welcome-sheet__savings-text">{pick(ui.welcomeSavings, lang)}</span>
      </div>

      {/* Expanded: destination savings cards */}
      {expanded && comparisons.length > 0 ? (
        <div className="welcome-sheet__destinations">
          {comparisons.slice(0, 4).map((c) => (
            <div key={c.destinationId} className="welcome-sheet__dest-card">
              <span className="welcome-sheet__dest-name">{pick(c.destinationName, lang)}</span>
              <div className="welcome-sheet__dest-prices">
                <span className="welcome-sheet__dest-bus">฿{c.bus.fareThb}</span>
                <span className="welcome-sheet__dest-taxi">
                  <del>฿{c.taxi.minThb.toLocaleString()}-{c.taxi.maxThb.toLocaleString()}</del>
                </span>
              </div>
              <span className="welcome-sheet__dest-save">
                {pick(ui.compareSaveUpTo, lang)} ฿{c.savingsMax.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
