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

  if (!selected) return null;

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

      {/* Comparison cards — taxi first (anchoring), bus last */}
      <div className="compare-cards">
        {/* Taxi */}
        <div className="compare-card compare-card--taxi">
          <div className="compare-card__icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="11" width="18" height="8" rx="2"/><path d="M5 11V8a2 2 0 012-2h10a2 2 0 012 2v3"/><path d="M7 15h1M16 15h1"/></svg>
          </div>
          <div className="compare-card__info">
            <span className="compare-card__label">{pick(ui.compareTaxi, lang)}</span>
            <span className="compare-card__price">฿{selected.taxi.minThb.toLocaleString()}-{selected.taxi.maxThb.toLocaleString()}</span>
            <span className="compare-card__time">{selected.taxi.minutes} {pick(ui.compareMinLabel, lang)}</span>
          </div>
          <span className="compare-card__per">{pick(ui.comparePerPerson, lang)}</span>
        </div>

        {/* Tuk-tuk (decoy) */}
        <div className="compare-card compare-card--tuktuk">
          <div className="compare-card__icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="12" width="14" height="7" rx="2"/><path d="M16 15h4a2 2 0 002-2v-2a2 2 0 00-2-2h-2l-2-4H8"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="19" r="2"/></svg>
          </div>
          <div className="compare-card__info">
            <span className="compare-card__label">{pick(ui.compareTukTuk, lang)}</span>
            <span className="compare-card__price">฿{selected.tukTuk.minThb.toLocaleString()}-{selected.tukTuk.maxThb.toLocaleString()}</span>
            <span className="compare-card__time">{selected.tukTuk.minutes} {pick(ui.compareMinLabel, lang)}</span>
          </div>
          <span className="compare-card__per">{pick(ui.comparePerPerson, lang)}</span>
        </div>

        {/* Smart Bus — highlighted */}
        <div className="compare-card compare-card--bus is-highlighted">
          <div className="compare-card__icon compare-card__icon--bus">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="3" width="16" height="16" rx="3"/><path d="M4 11h16M8 19v2M16 19v2"/><circle cx="8" cy="15" r="1"/><circle cx="16" cy="15" r="1"/></svg>
          </div>
          <div className="compare-card__info">
            <span className="compare-card__label">{pick(ui.compareSmartBus, lang)}</span>
            <span className="compare-card__price compare-card__price--bus">฿{selected.bus.fareThb}</span>
            <span className="compare-card__time">{selected.bus.minutes} {pick(ui.compareMinLabel, lang)}</span>
          </div>
          <span className="compare-card__per">{pick(ui.comparePerPerson, lang)}</span>
        </div>
      </div>

      {/* Savings banner — loss aversion framing */}
      <div className="compare-savings">
        <span className="compare-savings__label">{pick(ui.compareSave, lang)}</span>
        <span className="compare-savings__amount">฿{selected.savingsMin.toLocaleString()}-{selected.savingsMax.toLocaleString()}</span>
        <span className="compare-savings__per">{pick(ui.comparePerPerson, lang)}</span>
      </div>

      {/* Social proof */}
      <p className="compare-social">
        <strong>{selected.ridersToday}</strong> {pick(ui.compareRiders, lang)}
      </p>
    </div>
  );
}
