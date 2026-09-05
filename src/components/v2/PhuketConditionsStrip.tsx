import { useMemo, useState, useEffect } from "react";
import { getEnvironmentSnapshot, getWeatherIntelligence } from "../../engine/environmentSimulator";
import { getMaritimeOverview } from "../../engine/maritimeData";

/**
 * Compact Phuket living & operational conditions:
 * - Weather & Rain intensity
 * - Air quality (AirDash)
 * - Flood risk (FloodDash)
 * - Sea State & Marine Department Flag (whether boats can leave shore)
 * - Road friction & Bus traffic slowdown
 */
export function PhuketConditionsStrip() {
  const env = useMemo(() => getEnvironmentSnapshot(), []);
  const wx = useMemo(() => getWeatherIntelligence(), []);
  const marine = useMemo(() => getMaritimeOverview(env.waveHeightM, env.windKph, wx.monsoonSeason), [env, wx]);

  const aqiTone = env.aqi <= 50 ? "good" : env.aqi <= 100 ? "moderate" : "poor";
  const floodTone =
    env.precipMm >= 3 || env.rainProb >= 75
      ? "watch"
      : env.precipMm >= 1 || env.rainProb >= 55
        ? "elevated"
        : "low";
  const floodLabel =
    floodTone === "watch" ? "Flood watch" : floodTone === "elevated" ? "Elevated runoff" : "Flood risk low";

  const maritimeTone = env.maritimeFlag || "green";
  const seaLabel =
    maritimeTone === "red"
      ? "RED FLAG · BOATS BARRED"
      : maritimeTone === "yellow"
        ? "YELLOW FLAG · CAUTION"
        : "GREEN FLAG · ALL CLEAR";

  // Cycle alerts between driver road warning and maritime departure order
  const allAlerts = [
    ...(wx.driverAlerts || []),
    ...(wx.maritimeAdvisories || []),
  ];
  const [alertIndex, setAlertIndex] = useState(0);

  useEffect(() => {
    if (allAlerts.length <= 1) return;
    const interval = setInterval(() => {
      setAlertIndex((prev) => (prev + 1) % allAlerts.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [allAlerts.length]);

  return (
    <div className="v2-conditions" role="region" aria-label="Phuket conditions">
      {/* 1. Weather & Road Friction */}
      <div className="v2-conditions__item">
        <span className="v2-conditions__label">Weather &amp; Roads</span>
        <strong className="v2-conditions__value">
          {env.tempC.toFixed(0)}°C · {env.conditionLabel}
        </strong>
        <span className="v2-conditions__detail">
          Rain {env.rainProb}% · {env.precipMm} mm · {env.roadConditionLabel ?? "Normal flow"}
        </span>
      </div>

      {/* 2. Sea State & Pier Departure Feasibility */}
      <div className={`v2-conditions__item v2-conditions__item--marine-${maritimeTone}`}>
        <span className="v2-conditions__label">Sea State · Pier Departures</span>
        <strong className="v2-conditions__value">
          <span className={`v2-marine-flag-dot is-${maritimeTone}`} />
          {seaLabel}
        </strong>
        <span className="v2-conditions__detail">
          Waves {env.waveHeightM ?? 1.1}m · Wind {env.windKph} km/h ·{" "}
          {env.smallBoatsAllowed ? "Small boats cleared" : "Small boats prohibited"}
        </span>
      </div>

      {/* 3. Air Quality */}
      <div className={`v2-conditions__item v2-conditions__item--aqi-${aqiTone}`}>
        <span className="v2-conditions__label">Air · AirDash</span>
        <strong className="v2-conditions__value">AQI {env.aqi}</strong>
        <span className="v2-conditions__detail">PM2.5 {env.pm25} µg/m³ · seasonal model</span>
      </div>

      {/* 4. Flood Risk */}
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

      {/* Dynamic Alert Banner (Road Slowdown / Marine Order) */}
      {allAlerts.length > 0 && (
        <div className={`v2-conditions__alerts ${maritimeTone === "red" ? "is-red-alert" : ""}`} role="status">
          <span className="v2-conditions__alert-tag">ADVISORY:</span> {allAlerts[alertIndex]}
        </div>
      )}
    </div>
  );
}
