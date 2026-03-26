import { useState } from "react";
import type { Lang, PriceComparison } from "@shared/types";
import { ui, pick } from "../lib/i18n";

interface CompareViewProps {
  lang: Lang;
  comparisons: PriceComparison[];
}

export function CompareView({ lang, comparisons }: CompareViewProps) {
  const [selectedId, setSelectedId] = useState(comparisons[0]?.destinationId ?? "airport");
  const selected = comparisons.find((c) => c.destinationId === selectedId) ?? comparisons[0];

  // Loading state
  if (comparisons.length === 0) {
    return (
      <div className="compare-view">
        <h1 className="compare-title">{pick(ui.compareTitle, lang)}</h1>
        <div className="compare-loading">
          <div className="compare-loading__skeleton" />
          <div className="compare-loading__skeleton compare-loading__skeleton--short" />
          <p className="compare-loading__text">{pick(ui.compareLoading, lang)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="compare-view">
      <h1 className="compare-title">{pick(ui.compareTitle, lang)}</h1>

      {/* Destination pills */}
      <div className="compare-pills">
        {comparisons.map((c, i) => (
          <button
            key={c.destinationId}
            className={selectedId === c.destinationId ? "compare-pill is-active" : "compare-pill"}
            type="button"
            onClick={() => setSelectedId(c.destinationId)}
          >
            {i === 0 ? <span className="compare-pill__badge">{pick(ui.compareMostPopular, lang)}</span> : null}
            {pick(c.destinationName, lang)}
          </button>
        ))}
      </div>

      {selected ? (
        <>
          {/* Savings hero */}
          <div className="compare-hero">
            <div className="compare-hero__bus">
              <span className="compare-hero__fare">฿{selected.bus.fareThb}</span>
              <span className="compare-hero__label">{pick(ui.compareBusFare, lang)}</span>
            </div>
            <div className="compare-hero__vs">vs</div>
            <div className="compare-hero__taxi">
              <span className="compare-hero__taxi-fare">
                <del>฿{selected.taxi.minThb.toLocaleString()}-{selected.taxi.maxThb.toLocaleString()}</del>
              </span>
              <span className="compare-hero__label">{pick(ui.compareTaxiFare, lang)}</span>
            </div>
          </div>

          {/* Savings banner */}
          <div className="compare-savings">
            <span className="compare-savings__label">{pick(ui.compareSaveUpTo, lang)}</span>
            <span className="compare-savings__amount">฿{selected.savingsMax.toLocaleString()}</span>
            <span className="compare-savings__per">{pick(ui.comparePerPerson, lang)}</span>
          </div>

          {/* Time comparison */}
          <div className="compare-time-row">
            <div className="compare-time-card">
              <span className="compare-time-card__icon">🚌</span>
              <span className="compare-time-card__value">{selected.bus.minutes} {pick(ui.compareMinLabel, lang)}</span>
              <span className="compare-time-card__label">{pick(ui.compareSmartBus, lang)}</span>
            </div>
            <div className="compare-time-card">
              <span className="compare-time-card__icon">🚕</span>
              <span className="compare-time-card__value">{selected.taxi.minutes} {pick(ui.compareMinLabel, lang)}</span>
              <span className="compare-time-card__label">{pick(ui.compareTaxi, lang)}</span>
            </div>
          </div>

          {/* Social proof */}
          <p className="compare-social">
            <strong>{selected.ridersToday}</strong> {pick(ui.compareRiders, lang)}
          </p>
        </>
      ) : null}
    </div>
  );
}
