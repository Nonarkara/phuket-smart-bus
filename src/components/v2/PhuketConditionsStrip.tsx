import { useMemo } from "react";
import { getEnvironmentSnapshot, getWeatherIntelligence } from "../../engine/environmentSimulator";

/**
 * Compact Phuket living conditions — weather, air, flood risk —
 * so the ops console is useful beyond bus numbers.
 * Flood risk is derived from the seasonal rain model (same chain as advisories);
 * deep-link to FloodDash for station-level water levels.
 */
export function PhuketConditionsStrip() {
  const env = useMemo(() => getEnvironmentSnapshot(), []);
  const wx = useMemo(() => getWeatherIntelligence(), []);

  const aqiTone = env.aqi <= 50 ? "good" : env.aqi <= 100 ? "moderate" : "poor";
  const floodTone =
    env.precipMm >= 3 || env.rainProb >= 75
      ? "watch"
      : env.precipMm >= 1 || env.rainProb >= 55
        ? "elevated"
        : "low";
  const floodLabel =
    floodTone === "watch" ? "Flood watch" : floodTone === "elevated" ? "Elevated runoff" : "Flood risk low";

  return (
    <div className="v2-conditions" role="region" aria-label="Phuket conditions">
      <div className="v2-conditions__item">
        <span className="v2-conditions__label">Weather</span>
        <strong className="v2-conditions__value">
          {env.tempC.toFixed(0)}°C · {env.conditionLabel}
        </strong>
        <span className="v2-conditions__detail">
          Rain {env.rainProb}% · {env.precipMm} mm · Wind {env.windKph} km/h
          {wx.monsoonSeason ? " · Monsoon" : ""}
        </span>
      </div>
      <div className={`v2-conditions__item v2-conditions__item--aqi-${aqiTone}`}>
        <span className="v2-conditions__label">Air · AirDash</span>
        <strong className="v2-conditions__value">AQI {env.aqi}</strong>
        <span className="v2-conditions__detail">PM2.5 {env.pm25} µg/m³ · seasonal model</span>
      </div>
      <div className={`v2-conditions__item v2-conditions__item--flood-${floodTone}`}>
        <span className="v2-conditions__label">Flood · FloodDash</span>
        <strong className="v2-conditions__value">{floodLabel}</strong>
        <span className="v2-conditions__detail">
          From rain model ·{" "}
          <a
            href="https://flood.nonarkara.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="v2-conditions__link"
          >
            Open FloodDash ↗
          </a>
        </span>
      </div>
      {wx.driverAlerts.length > 0 && (
        <div className="v2-conditions__alerts" role="status">
          {wx.driverAlerts[0]}
        </div>
      )}
    </div>
  );
}
