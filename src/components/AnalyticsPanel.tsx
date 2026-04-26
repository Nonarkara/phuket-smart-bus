import { useEffect, useState } from "react";
import type { Lang } from "@shared/types";
import { getLineMetrics } from "../engine/simulation";
import { getSimulatedMinutes } from "../engine/fleetSimulator";

interface AnalyticsPanelProps {
  lang: Lang;
}

// Simulated hourly data (in reality, this would come from the simulation engine)
function getHourlyAnalytics(simMinutes: number) {
  const hour = Math.floor(simMinutes / 60);
  const hourlyFlights = [2, 3, 5, 6, 8, 7, 6, 5, 4, 3, 3, 2, 2, 2, 3, 3, 4];
  const hourlyRevenue = [200, 350, 600, 800, 950, 900, 850, 750, 600, 400, 300, 250, 300, 350, 400, 450, 500];
  const busCapacity = [25, 25, 25, 25, 25, 25, 25];
  const busDemand = [15, 22, 28, 32, 35, 28, 20];

  return {
    currentHour: hour,
    flights: hourlyFlights,
    revenue: hourlyRevenue,
    busCapacity,
    busDemand,
  };
}

export function AnalyticsPanel({ lang }: AnalyticsPanelProps) {
  const [analytics, setAnalytics] = useState(() => getHourlyAnalytics(getSimulatedMinutes()));

  useEffect(() => {
    const id = setInterval(() => {
      setAnalytics(getHourlyAnalytics(getSimulatedMinutes()));
    }, 2000);
    return () => clearInterval(id);
  }, []);

  const maxFlights = Math.max(...analytics.flights);
  const maxRevenue = Math.max(...analytics.revenue);
  const hours = Array.from({ length: 17 }, (_, i) => 6 + i);

  return (
    <div className="analytics-panel">
      <h3 className="analytics-panel__title">Daily Analytics</h3>

      {/* Flights by hour */}
      <div className="analytics-section">
        <h4 className="analytics-section__title">Flights Arriving by Hour</h4>
        <div className="analytics-chart">
          {hours.map((h) => {
            const idx = h - 6;
            const flights = analytics.flights[idx] ?? 0;
            const height = maxFlights > 0 ? (flights / maxFlights) * 100 : 0;
            const isCurrent = h === analytics.currentHour;
            return (
              <div
                key={h}
                className={`analytics-bar ${isCurrent ? "is-current" : ""}`}
                style={{ "--height": `${height}%` } as any}
                title={`${h}:00 - ${flights} flights`}
              >
                <span className="analytics-bar__value">{flights}</span>
              </div>
            );
          })}
        </div>
        <div className="analytics-legend">
          Peak arrivals drive demand. Most passengers clear customs within 30 min.
        </div>
      </div>

      {/* Revenue by hour */}
      <div className="analytics-section">
        <h4 className="analytics-section__title">Revenue by Hour</h4>
        <div className="analytics-chart">
          {hours.map((h) => {
            const idx = h - 6;
            const revenue = analytics.revenue[idx] ?? 0;
            const height = maxRevenue > 0 ? (revenue / maxRevenue) * 100 : 0;
            const isCurrent = h === analytics.currentHour;
            return (
              <div
                key={`rev-${h}`}
                className={`analytics-bar analytics-bar--green ${isCurrent ? "is-current" : ""}`}
                style={{ "--height": `${height}%` } as any}
                title={`${h}:00 - ฿${revenue}`}
              >
                <span className="analytics-bar__value">฿{revenue}</span>
              </div>
            );
          })}
        </div>
        <div className="analytics-legend">
          Morning peak drives 45% of daily revenue. Bus fares are 87% cheaper than taxis.
        </div>
      </div>

      {/* Capacity demand */}
      <div className="analytics-section">
        <h4 className="analytics-section__title">Capacity Demand vs Supply</h4>
        <div className="analytics-capacity">
          {[...Array(7)].map((_, i) => {
            const demand = analytics.busDemand[i] ?? 0;
            const capacity = analytics.busCapacity[i] ?? 0;
            const full = demand >= capacity;
            return (
              <div key={i} className="capacity-row">
                <span className="capacity-row__label">Bus {i + 1}</span>
                <div className="capacity-row__bar">
                  <div
                    className={`capacity-row__fill ${full ? "capacity-row__fill--full" : ""}`}
                    style={{ width: `${(demand / capacity) * 100}%` }}
                  />
                </div>
                <span className={`capacity-row__stat ${full ? "capacity-row__stat--full" : ""}`}>
                  {demand}/{capacity}
                </span>
              </div>
            );
          })}
        </div>
        <div className="analytics-legend">
          Buses 1–3 at capacity during morning peak. Adding peak-hour fleet would increase revenue 23%.
        </div>
      </div>
    </div>
  );
}
