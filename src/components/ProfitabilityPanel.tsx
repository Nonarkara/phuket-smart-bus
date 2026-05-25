import { useEffect, useState } from "react";
import type { Lang } from "@shared/types";
import { getLineMetrics, type LineMetrics } from "../engine/simulation";

interface ProfitabilityPanelProps {
  lang: Lang;
}

/**
 * Per-line P&L card sheet — designed so an investor can see in 3 seconds:
 *
 *   1. Which lines make money (big green +฿X profit)
 *   2. Which lines lose money (big red -฿X loss)
 *   3. Pax, revenue, cost, CO₂ saved per line — all in one card
 *
 * Sorted so the most profitable line is on top, loss-makers at the bottom.
 * Total P&L row at the foot gives the network-wide answer.
 */
function fmtThb(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `฿${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `฿${Math.round(n / 1_000)}k`;
  return `฿${n}`;
}

export function ProfitabilityPanel({ lang: _lang }: ProfitabilityPanelProps) {
  const [metrics, setMetrics] = useState<LineMetrics[]>(() => getLineMetrics());

  useEffect(() => {
    const id = setInterval(() => setMetrics(getLineMetrics()), 1000);
    return () => clearInterval(id);
  }, []);

  // Sort by profit descending — winners on top, losers at the bottom.
  const sorted = [...metrics].sort((a, b) => b.profitThb - a.profitThb);

  // Network totals
  const totalRev = sorted.reduce((s, l) => s + l.revenueThb, 0);
  const totalCost = sorted.reduce((s, l) => s + l.operatingCostThb, 0);
  const totalProfit = totalRev - totalCost;
  const totalPax = sorted.reduce((s, l) => s + l.passengersServed, 0);
  const totalCO2 = sorted.reduce((s, l) => s + l.carbonSavedKg, 0);

  return (
    <div className="line-pnl">
      <div className="line-pnl__head">
        <h3 className="line-pnl__title">Line Profit & Loss · Today</h3>
        <span className={`line-pnl__network ${totalProfit >= 0 ? "line-pnl__network--profit" : "line-pnl__network--loss"}`}>
          Network {totalProfit >= 0 ? "+" : "−"}{fmtThb(Math.abs(totalProfit))}
        </span>
      </div>

      <div className="line-pnl__list">
        {sorted.map((line) => {
          const profit = line.profitThb;
          const isProfit = profit >= 0;
          return (
            <div
              key={line.lineId}
              className={`line-pnl__row ${isProfit ? "line-pnl__row--profit" : "line-pnl__row--loss"}`}
            >
              {/* Big number — the answer */}
              <div className="line-pnl__answer">
                <div className="line-pnl__name">{line.lineName}</div>
                <div className={`line-pnl__profit ${isProfit ? "line-pnl__profit--good" : "line-pnl__profit--bad"}`}>
                  {isProfit ? "+" : "−"}{fmtThb(Math.abs(profit))}
                </div>
                <div className="line-pnl__margin">
                  {line.profitMargin > 0 ? "+" : ""}{line.profitMargin}% margin
                </div>
              </div>

              {/* Supporting numbers */}
              <div className="line-pnl__detail">
                <div className="line-pnl__cell">
                  <span className="line-pnl__cell-val">{line.passengersServed.toLocaleString()}</span>
                  <span className="line-pnl__cell-lbl">pax served</span>
                </div>
                <div className="line-pnl__cell">
                  <span className="line-pnl__cell-val">{fmtThb(line.revenueThb)}</span>
                  <span className="line-pnl__cell-lbl">revenue</span>
                </div>
                <div className="line-pnl__cell">
                  <span className="line-pnl__cell-val">{fmtThb(line.operatingCostThb)}</span>
                  <span className="line-pnl__cell-lbl">cost</span>
                </div>
                <div className="line-pnl__cell">
                  <span className="line-pnl__cell-val">{line.carbonSavedKg.toLocaleString()} kg</span>
                  <span className="line-pnl__cell-lbl">CO₂ saved</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="line-pnl__totals">
        <div className="line-pnl__totals-cell">
          <span className="line-pnl__totals-lbl">Network pax</span>
          <span className="line-pnl__totals-val">{totalPax.toLocaleString()}</span>
        </div>
        <div className="line-pnl__totals-cell">
          <span className="line-pnl__totals-lbl">Revenue</span>
          <span className="line-pnl__totals-val">{fmtThb(totalRev)}</span>
        </div>
        <div className="line-pnl__totals-cell">
          <span className="line-pnl__totals-lbl">Cost</span>
          <span className="line-pnl__totals-val">{fmtThb(totalCost)}</span>
        </div>
        <div className="line-pnl__totals-cell">
          <span className="line-pnl__totals-lbl">CO₂ saved</span>
          <span className="line-pnl__totals-val">{totalCO2.toLocaleString()} kg</span>
        </div>
      </div>
    </div>
  );
}
