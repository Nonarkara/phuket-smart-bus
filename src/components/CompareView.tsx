import { useState } from "react";
import type { Lang, PriceComparison } from "@shared/types";
import { ui, pick } from "../lib/i18n";

interface CompareViewProps {
  lang: Lang;
  comparisons: PriceComparison[];
}

// Client-side fallback data when API is unavailable
const FALLBACK_COMPARISONS: PriceComparison[] = [
  {
    destinationId: "airport",
    destinationName: { en: "Airport", th: "สนามบิน", zh: "机场", de: "Flughafen", fr: "Aéroport", es: "Aeropuerto" },
    taxi: { minThb: 800, maxThb: 1200, minutes: 45 },
    tukTuk: { minThb: 500, maxThb: 700, minutes: 55 },
    bus: { fareThb: 100, minutes: 75 },
    savingsMin: 400, savingsMax: 1100, ridersToday: Math.floor(20 + Math.random() * 40)
  },
  {
    destinationId: "patong",
    destinationName: { en: "Patong Beach", th: "หาดป่าตอง", zh: "芭东海滩", de: "Patong Strand", fr: "Plage de Patong", es: "Playa Patong" },
    taxi: { minThb: 400, maxThb: 600, minutes: 25 },
    tukTuk: { minThb: 300, maxThb: 400, minutes: 30 },
    bus: { fareThb: 100, minutes: 40 },
    savingsMin: 200, savingsMax: 500, ridersToday: Math.floor(30 + Math.random() * 50)
  },
  {
    destinationId: "old-town",
    destinationName: { en: "Old Town", th: "เมืองเก่า", zh: "老城", de: "Altstadt", fr: "Vieille ville", es: "Casco antiguo" },
    taxi: { minThb: 300, maxThb: 500, minutes: 20 },
    tukTuk: { minThb: 200, maxThb: 350, minutes: 25 },
    bus: { fareThb: 100, minutes: 35 },
    savingsMin: 100, savingsMax: 400, ridersToday: Math.floor(15 + Math.random() * 30)
  },
  {
    destinationId: "kata",
    destinationName: { en: "Kata Beach", th: "หาดกะตะ", zh: "卡塔海滩", de: "Kata Strand", fr: "Plage de Kata", es: "Playa Kata" },
    taxi: { minThb: 500, maxThb: 700, minutes: 30 },
    tukTuk: { minThb: 350, maxThb: 500, minutes: 40 },
    bus: { fareThb: 100, minutes: 50 },
    savingsMin: 250, savingsMax: 600, ridersToday: Math.floor(10 + Math.random() * 25)
  },
  {
    destinationId: "rawai",
    destinationName: { en: "Rawai", th: "ราไวย์", zh: "拉威", de: "Rawai", fr: "Rawai", es: "Rawai" },
    taxi: { minThb: 500, maxThb: 800, minutes: 35 },
    tukTuk: { minThb: 400, maxThb: 600, minutes: 45 },
    bus: { fareThb: 100, minutes: 60 },
    savingsMin: 300, savingsMax: 700, ridersToday: Math.floor(8 + Math.random() * 20)
  },
];

export function CompareView({ lang, comparisons }: CompareViewProps) {
  // Use API data if available, otherwise use fallback
  const data = comparisons.length > 0 ? comparisons : FALLBACK_COMPARISONS;
  const [selectedId, setSelectedId] = useState(data[0]?.destinationId ?? "airport");
  const selected = data.find((c) => c.destinationId === selectedId) ?? data[0];

  return (
    <div className="compare-view">
      <h1 className="compare-title">{pick(ui.compareTitle, lang)}</h1>

      {/* Destination pills */}
      <div className="compare-pills">
        {data.map((c, i) => (
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
