import { useEffect, useState } from "react";
import type { Lang } from "@shared/types";
import { getLineMetrics } from "../engine/simulation";
import { ui, pick } from "../lib/i18n";

interface ProfitabilityPanelProps {
  lang: Lang;
}

export function ProfitabilityPanel({ lang }: ProfitabilityPanelProps) {
  const [metrics, setMetrics] = useState(() => getLineMetrics());

  useEffect(() => {
    const id = setInterval(() => setMetrics(getLineMetrics()), 1000);
    return () => clearInterval(id);
  }, []);

  const profitColor = (margin: number): string => {
    if (margin > 20) return "#34C759"; // green
    if (margin > 5) return "#FF9500"; // orange
    return "#FF3B30"; // red
  };

  return (
    <div className="profitability-panel">
      <h3 className="profitability-panel__title">Line Performance</h3>

      {metrics.map((line) => (
        <div key={line.lineId} className="profitability-line">
          <div className="profitability-line__header">
            <span className="profitability-line__name">{line.lineName}</span>
            <span
              className="profitability-line__margin"
              style={{ color: profitColor(line.profitMargin) }}
            >
              {line.profitMargin > 0 ? "+" : ""}{line.profitMargin}%
            </span>
          </div>

          <div className="profitability-line__row">
            <div className="profitability-line__metric">
              <span className="profitability-line__label">Revenue</span>
              <span className="profitability-line__value">
                ฿{line.revenueThb.toLocaleString()}
              </span>
            </div>
            <div className="profitability-line__metric">
              <span className="profitability-line__label">Cost</span>
              <span className="profitability-line__value">
                ฿{line.operatingCostThb.toLocaleString()}
              </span>
            </div>
            <div className="profitability-line__metric">
              <span className="profitability-line__label">
                {line.profitThb >= 0 ? "Profit" : "Loss"}
              </span>
              <span
                className="profitability-line__value"
                style={{ color: line.profitThb >= 0 ? "#34C759" : "#FF3B30" }}
              >
                {line.profitThb >= 0 ? "+" : ""}
                ฿{Math.abs(line.profitThb).toLocaleString()}
              </span>
            </div>
          </div>

          <div className="profitability-line__bar">
            <div
              className="profitability-line__fill"
              style={{
                width: `${Math.min(100, (line.revenueThb / (line.operatingCostThb || 1)) * 50)}%`,
                backgroundColor: profitColor(line.profitMargin),
              }}
            />
          </div>

          <div className="profitability-line__stats">
            <span className="profitability-line__stat">
              {line.passengersServed.toLocaleString()} pax
            </span>
            <span className="profitability-line__stat">
              {line.carbonSavedKg} kg CO₂ saved
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
