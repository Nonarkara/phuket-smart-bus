import { useEffect, useState } from "react";
import { getVehicleDetail, getVehiclesNow, type DriverTabletData } from "../engine/fleetSimulator";
import { getEnvironmentSnapshot } from "../engine/environmentSimulator";
import { simNow, simClock } from "../engine/simulation";

/**
 * Per-bus tablet view at /driver/[plate]. The driver sees their trip,
 * next stop, on-time delta, passenger count. Auto-refreshes every 1s.
 *
 * This view exists to signal the system is REAL — not just a marketing
 * dashboard. A buyer can scan the QR on a printed bus poster and see
 * exactly what the driver is looking at right now.
 */

export function DriverTablet({ plate }: { plate: string }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const detail: DriverTabletData = getVehicleDetail(plate);
  const weather = getEnvironmentSnapshot();
  const sim = simNow();
  void tick; // re-render trigger

  if (!detail) {
    const allBuses = getVehiclesNow().filter(
      (v) => !v.vehicleId.startsWith("ferry-") && !v.vehicleId.startsWith("orange-") && v.polylineMeters != null
    );
    const activePlates = allBuses.slice(0, 6).map((v) => v.licensePlate);
    return (
      <div className="driver-tablet driver-tablet--missing">
        <div className="driver-tablet__missing-card">
          <div className="driver-tablet__missing-eyebrow">PKSB DRIVER</div>
          <h1 className="driver-tablet__missing-title">Bus {plate} not in service</h1>
          <p className="driver-tablet__missing-body">
            This vehicle is at the depot or between trips. The tablet will
            pick it back up automatically when its next trip starts.
          </p>
          {activePlates.length > 0 && (
            <div className="driver-tablet__missing-plates">
              <div className="driver-tablet__missing-plates-label">Active right now:</div>
              <ul>
                {activePlates.map((p) => (
                  <li key={p}>
                    <a href={`/driver/${encodeURIComponent(p)}`}>{p}</a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="driver-tablet__missing-clock">{simClock()} BKK</div>
          <a href="/" className="driver-tablet__missing-back">← Operator Console</a>
        </div>
      </div>
    );
  }
  void sim;

  const { vehicle, directionLabel, stops, nextStopIdx, etaToNextStopMin, deltaMin, paxCount, paxCapacity } = detail;
  const occupancy = paxCapacity > 0 ? Math.round((paxCount / paxCapacity) * 100) : 0;
  const onTimeStatus = Math.abs(deltaMin) <= 1 ? "on-time" : deltaMin > 0 ? "ahead" : "behind";

  return (
    <div className="driver-tablet">
      <header className="driver-tablet__head">
        <div className="driver-tablet__brand">
          <span className="driver-tablet__brand-eyebrow">PKSB DRIVER</span>
          <span className="driver-tablet__brand-plate">{vehicle.licensePlate}</span>
        </div>
        <div className="driver-tablet__route">
          <span className="driver-tablet__route-label">ROUTE</span>
          <span className="driver-tablet__route-name">{directionLabel}</span>
        </div>
        <div className="driver-tablet__clock">
          <span className="driver-tablet__clock-time">{simClock()}</span>
          <span className="driver-tablet__clock-zone">BKK</span>
        </div>
      </header>

      <div className="driver-tablet__hero">
        {nextStopIdx >= 0 ? (
          <>
            <div className="driver-tablet__hero-eyebrow">NEXT STOP</div>
            <div className="driver-tablet__hero-stop">{stops[nextStopIdx]!.name.en}</div>
            <div className="driver-tablet__hero-stop-th">{stops[nextStopIdx]!.name.th}</div>
            <div className="driver-tablet__hero-eta">
              {etaToNextStopMin != null ? (
                <>
                  <span className="driver-tablet__eta-num">{etaToNextStopMin}</span>
                  <span className="driver-tablet__eta-unit">min</span>
                </>
              ) : (
                <span className="driver-tablet__eta-unit">approaching</span>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="driver-tablet__hero-eyebrow">TRIP COMPLETE</div>
            <div className="driver-tablet__hero-stop">At terminal</div>
            <div className="driver-tablet__hero-eta">
              <span className="driver-tablet__eta-unit">layover</span>
            </div>
          </>
        )}
      </div>

      <div className="driver-tablet__indicators">
        <div className={`driver-tablet__indicator driver-tablet__indicator--${onTimeStatus}`}>
          <span className="driver-tablet__indicator-label">ON-TIME</span>
          <span className="driver-tablet__indicator-value">
            {deltaMin === 0 ? "—" : `${deltaMin > 0 ? "+" : ""}${deltaMin}m`}
          </span>
          <span className="driver-tablet__indicator-status">{onTimeStatus}</span>
        </div>
        <div className="driver-tablet__indicator">
          <span className="driver-tablet__indicator-label">PASSENGERS</span>
          <span className="driver-tablet__indicator-value">{paxCount}<span className="driver-tablet__indicator-cap">/{paxCapacity}</span></span>
          <span className="driver-tablet__indicator-status">{occupancy}% full</span>
        </div>
        <div className="driver-tablet__indicator">
          <span className="driver-tablet__indicator-label">SPEED</span>
          <span className="driver-tablet__indicator-value">{Math.round(vehicle.speedKph)}</span>
          <span className="driver-tablet__indicator-status">km/h</span>
        </div>
        <div className="driver-tablet__indicator">
          <span className="driver-tablet__indicator-label">WEATHER</span>
          <span className="driver-tablet__indicator-value">{Math.round(weather.tempC)}°</span>
          <span className="driver-tablet__indicator-status">{weather.conditionLabel}</span>
        </div>
      </div>

      <div className="driver-tablet__stops">
        <div className="driver-tablet__stops-header">
          <span>UPCOMING STOPS</span>
          <span>{stops.filter((s) => !s.passed).length} ahead</span>
        </div>
        <ol className="driver-tablet__stops-list">
          {stops.map((s, i) => (
            <li
              key={s.stopId}
              className={`driver-tablet__stop ${s.passed ? "driver-tablet__stop--passed" : ""} ${i === nextStopIdx ? "driver-tablet__stop--next" : ""}`}
            >
              <div className="driver-tablet__stop-marker">{i + 1}</div>
              <div className="driver-tablet__stop-name">
                <div className="driver-tablet__stop-name-en">{s.name.en}</div>
                <div className="driver-tablet__stop-name-th">{s.name.th}</div>
              </div>
              <div className="driver-tablet__stop-eta">
                {s.passed ? <span className="driver-tablet__stop-passed-mark">✓</span> : s.etaMinutes != null ? `${s.etaMinutes}m` : "—"}
              </div>
            </li>
          ))}
        </ol>
      </div>

      <footer className="driver-tablet__foot">
        <span>{vehicle.routeId.toUpperCase()}</span>
        <span>•</span>
        <span>VEHICLE {vehicle.vehicleId}</span>
        <span>•</span>
        <span>{vehicle.telemetrySource === "schedule_mock" ? "SIM" : "LIVE GPS"}</span>
      </footer>
    </div>
  );
}
