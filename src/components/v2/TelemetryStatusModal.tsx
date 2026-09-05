import React, { useEffect, useState, useMemo } from "react";
import {
  getTelemetryHealth,
  getLiveTelemetryVehicles,
  setTelemetryMode,
  simulateLiveGpsBurst,
  toggleSimulatedGpsStream,
  clearTelemetry,
  startTelemetryPolling,
  type TelemetryHealthStatus,
} from "../../engine/liveGpsReceiver";
import { getVehiclesNow } from "../../engine/fleetSimulator";

interface TelemetryStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SourceFilter = "all" | "direct_gps" | "schedule_mock";

export function TelemetryStatusModal({ isOpen, onClose }: TelemetryStatusModalProps) {
  const [health, setHealth] = useState<TelemetryHealthStatus>(() => getTelemetryHealth());
  const [isStreaming, setIsStreaming] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [endpointSaved, setEndpointSaved] = useState(false);
  const [customEndpoint, setCustomEndpoint] = useState(() => {
    return typeof localStorage !== "undefined"
      ? localStorage.getItem("pksb_gps_endpoint") || "/api/vehicles/all"
      : "/api/vehicles/all";
  });

  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setHealth(getTelemetryHealth());
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  const allVehicles = getVehiclesNow();
  const liveCount = allVehicles.filter((v) => v.telemetrySource === "direct_gps").length;
  const simCount = allVehicles.length - liveCount;

  // Filter the roster by the selected source. Memoised on filter + the
  // current set of vehicles so the user can focus on the live fleet without
  // the sim buses drowning it out.
  const filteredVehicles = useMemo(() => {
    if (sourceFilter === "all") return allVehicles;
    return allVehicles.filter((v) => v.telemetrySource === sourceFilter);
  }, [allVehicles, sourceFilter]);

  const handleToggleStream = () => {
    const next = toggleSimulatedGpsStream();
    setIsStreaming(next);
    setHealth(getTelemetryHealth());
  };

  const handleModeSelect = (mode: "auto" | "live_only" | "sim_only") => {
    setTelemetryMode(mode);
    setHealth(getTelemetryHealth());
  };

  const handleSaveEndpoint = (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("pksb_gps_endpoint", customEndpoint);
    }
    // Wire it up: actually start the polling. The function returns a
    // stop fn we don't currently expose; future work could add a "Stop
    // polling" button. Saving the endpoint also immediately starts the
    // poll so a misconfigured value fails fast instead of waiting for
    // next page load.
    startTelemetryPolling(customEndpoint);
    setEndpointSaved(true);
    setHealth(getTelemetryHealth());
    window.setTimeout(() => setEndpointSaved(false), 2400);
  };

  return (
    <div className="v2-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="v2-modal v2-telemetry-modal" onClick={(e) => e.stopPropagation()}>
        <header className="v2-modal__header">
          <div>
            <span className="v2-modal__eyebrow">FLEET TELEMETRY &amp; HARDWARE INGESTION</span>
            <h2 className="v2-modal__title">Live Bus GPS Integration Console</h2>
          </div>
          <button type="button" className="v2-modal__close" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </header>

        <div className="v2-telemetry-body">
          {/* Status Ribbon */}
          <div className="v2-telemetry-hud">
            <div className="v2-telemetry-hud__stat">
              <span>ACTIVE TELEMETRY MODE</span>
              <strong className={health.active ? "text-accent" : "text-warn"}>
                {health.mode === "sim_only"
                  ? "SIMULATION ONLY"
                  : health.active
                    ? "LIVE DIRECT GPS"
                    : "AUTO (AWAITING GPS)"}
              </strong>
              <small>{health.active ? "Receiving live device packets" : "Falling back to timetable model"}</small>
            </div>

            <div className="v2-telemetry-hud__stat">
              <span>ONLINE GPS BUSES</span>
              <strong>{liveCount} / {allVehicles.length}</strong>
              <small>{simCount} vehicles on timetable schedule</small>
            </div>

            <div className="v2-telemetry-hud__stat">
              <span>SIGNAL FRESHNESS</span>
              <strong className={health.latencyMs && health.latencyMs < 5000 ? "text-accent" : "text-ink"}>
                {health.latencyMs !== null ? `${(health.latencyMs / 1000).toFixed(1)}s latency` : "No live pings"}
              </strong>
              <small>{health.lastPingTime ? new Date(health.lastPingTime).toLocaleTimeString() : "Awaiting stream"}</small>
            </div>
          </div>

          {/* Mode Selector & Quick Actions */}
          <section className="v2-telemetry-section">
            <h3>Ingestion Controls &amp; Testing</h3>
            <div className="v2-telemetry-actions">
              <div className="v2-telemetry-mode-btns">
                <button
                  type="button"
                  className={`v2-btn-mode ${health.mode === "auto" ? "is-active" : ""}`}
                  onClick={() => handleModeSelect("auto")}
                >
                  Auto-Detect (GPS + Schedule Fallback)
                </button>
                <button
                  type="button"
                  className={`v2-btn-mode ${health.mode === "live_only" ? "is-active" : ""}`}
                  onClick={() => handleModeSelect("live_only")}
                >
                  Live GPS Only
                </button>
                <button
                  type="button"
                  className={`v2-btn-mode ${health.mode === "sim_only" ? "is-active" : ""}`}
                  onClick={() => handleModeSelect("sim_only")}
                >
                  Force Timetable Simulation
                </button>
              </div>

              <div className="v2-telemetry-sim-btns">
                <button
                  type="button"
                  className="v2-btn v2-btn--primary"
                  onClick={() => {
                    simulateLiveGpsBurst();
                    setHealth(getTelemetryHealth());
                  }}
                >
                  Inject Live GPS Pulse (10 Buses)
                </button>
                <button
                  type="button"
                  className={`v2-btn ${isStreaming ? "v2-btn--warn" : "v2-btn--ghost"}`}
                  onClick={handleToggleStream}
                >
                  {isStreaming ? "Stop Stream" : "Continuous GPS Stream (2s)"}
                </button>
                <button
                  type="button"
                  className="v2-btn v2-btn--ghost"
                  onClick={() => {
                    clearTelemetry();
                    setHealth(getTelemetryHealth());
                  }}
                >
                  Clear Telemetry
                </button>
              </div>
            </div>
          </section>

          {/* Endpoint Configuration & Developer Bridge */}
          <section className="v2-telemetry-section">
            <h3>Hardware &amp; API Ingest Endpoints</h3>
            <form className="v2-telemetry-form" onSubmit={handleSaveEndpoint}>
              <div className="v2-form-group">
                <label htmlFor="gps-endpoint">Live GPS API / Webhook Endpoint:</label>
                <div className="v2-form-input-row">
                  <input
                    id="gps-endpoint"
                    type="text"
                    value={customEndpoint}
                    onChange={(e) => setCustomEndpoint(e.target.value)}
                    placeholder="/api/vehicles/all or https://gps-gateway.pksb.co.th/api"
                  />
                  <button type="submit" className="v2-btn v2-btn--primary">
                    {endpointSaved ? "Saved · polling now" : "Save Endpoint"}
                  </button>
                </div>
              </div>
            </form>
            <div className="v2-telemetry-docs">
              <p>
                <strong>Browser JavaScript Ingest Bridge:</strong> External tracking scripts or mobile devices can push live coordinates directly:
              </p>
              <code>
                window.__PKSB_INGEST_GPS__&#123; vehicleId: &quot;1001&quot;, coordinates: [8.108, 98.307], speedKph: 42 &#125;;
              </code>
            </div>
          </section>

          {/* Vehicle Fleet Roster Status */}
          <section className="v2-telemetry-section">
            <h3>Vehicle Telemetry Roster ({filteredVehicles.length} of {allVehicles.length} vehicles)</h3>
            <div className="v2-telemetry-source-filter" role="tablist" aria-label="Filter fleet roster by source">
              <button
                type="button"
                className={`v2-btn-mode ${sourceFilter === "all" ? "is-active" : ""}`}
                onClick={() => setSourceFilter("all")}
                aria-pressed={sourceFilter === "all"}
              >
                All ({allVehicles.length})
              </button>
              <button
                type="button"
                className={`v2-btn-mode ${sourceFilter === "direct_gps" ? "is-active" : ""}`}
                onClick={() => setSourceFilter("direct_gps")}
                aria-pressed={sourceFilter === "direct_gps"}
              >
                Live GPS ({liveCount})
              </button>
              <button
                type="button"
                className={`v2-btn-mode ${sourceFilter === "schedule_mock" ? "is-active" : ""}`}
                onClick={() => setSourceFilter("schedule_mock")}
                aria-pressed={sourceFilter === "schedule_mock"}
              >
                Sim ({simCount})
              </button>
            </div>
            <div className="v2-telemetry-table-wrap">
              <table className="v2-telemetry-table">
                <thead>
                  <tr>
                    <th>Bus Plate</th>
                    <th>Telemetry Source</th>
                    <th>Current Coordinates</th>
                    <th>Speed</th>
                    <th>Signal Freshness</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVehicles.map((v) => {
                    const isGps = v.telemetrySource === "direct_gps";
                    return (
                      <tr key={v.vehicleId || v.id} className={isGps ? "is-live-gps" : ""}>
                        <td><strong>{v.licensePlate || v.vehicleId}</strong></td>
                        <td>
                          <span className={`v2-telemetry-tag ${isGps ? "v2-telemetry-tag--live" : "v2-telemetry-tag--sim"}`}>
                            {isGps ? "DIRECT GPS" : "TIMETABLE SIM"}
                          </span>
                        </td>
                        <td>
                          <span className="v2-font-mono">
                            {v.coordinates[0].toFixed(4)}, {v.coordinates[1].toFixed(4)}
                          </span>
                        </td>
                        <td>{v.speedKph} km/h</td>
                        <td>
                          <span className={`v2-freshness-pill is-${v.freshness}`}>
                            {isGps ? v.freshness.toUpperCase() : "SIMULATED"}
                          </span>
                        </td>
                        <td>{v.status.toUpperCase()}</td>
                      </tr>
                    );
                  })}
                  {filteredVehicles.length === 0 && (
                    <tr>
                      <td colSpan={6} className="v2-telemetry-empty">
                        No vehicles match this filter.{" "}
                        {sourceFilter !== "all" && (
                          <button type="button" className="v2-btn-link" onClick={() => setSourceFilter("all")}>
                            Show all
                          </button>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
