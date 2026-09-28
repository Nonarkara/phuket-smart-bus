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
import { getPhuketProducerState } from "../../engine/phuketGpsProducer";
import {
  getFleetEfficiencySummary,
  exportFleetEfficiencyJson,
  exportFleetEfficiencyCsv,
  resetFleetEfficiencyLedger,
  type FleetEfficiencySummary,
} from "../../engine/fleetEfficiency";

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

  // The Phuket upstream producer is its own module — see engine/phuketGpsProducer.
  // We just read its state here so the modal can show feed health without
  // owning the polling lifecycle.
  const [producerState, setProducerState] = useState(() => getPhuketProducerState());
  const [efficiency, setEfficiency] = useState<FleetEfficiencySummary>(() => getFleetEfficiencySummary());

  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setHealth(getTelemetryHealth());
      setProducerState(getPhuketProducerState());
      setEfficiency(getFleetEfficiencySummary());
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Filter the roster by the selected source. Memoised on filter + the
  // current set of vehicles so the user can focus on the live fleet without
  // the sim buses drowning it out.
  //
  // NOTE: `getVehiclesNow()` and the filter memo stay ABOVE the
  // `if (!isOpen) return null` early return — React tracks hooks by call
  // order, so a hook that only fires on the open path would throw
  // "Rendered more hooks than during the previous render" (#310) the first
  // time the modal opens. getVehiclesNow is cheap (a plain read of the
  // fleet roster) so calling it on every render — closed or open — is fine.
  const allVehicles = isOpen ? getVehiclesNow() : [];
  const filteredVehicles = useMemo(() => {
    if (sourceFilter === "all") return allVehicles;
    return allVehicles.filter((v) => v.telemetrySource === sourceFilter);
  }, [allVehicles, sourceFilter]);

  if (!isOpen) return null;

  const liveCount = allVehicles.filter((v) => v.telemetrySource === "direct_gps").length;
  const simCount = allVehicles.length - liveCount;

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

  const handleDownloadJson = () => {
    const data = exportFleetEfficiencyJson();
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pksb-fleet-efficiency-report-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadCsv = () => {
    const data = exportFleetEfficiencyCsv();
    const blob = new Blob([data], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pksb-fleet-efficiency-data-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleResetEfficiency = () => {
    if (typeof window !== "undefined" && window.confirm("Reset the 1-week fleet efficiency calibration ledger?")) {
      resetFleetEfficiencyLedger();
      setEfficiency(getFleetEfficiencySummary());
    }
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

            <div className="v2-telemetry-hud__stat">
              <span>UPSTREAM POLL</span>
              <strong className={
                producerState.lastError ? "text-warn" :
                producerState.lastSuccessAt && Date.now() - producerState.lastSuccessAt < 60_000 ? "text-accent" :
                "text-ink"
              }>
                {producerState.lastError ? "ERROR" :
                  producerState.lastSuccessAt === null ? "STARTING…" :
                  `${Math.round((Date.now() - producerState.lastSuccessAt) / 1000)}s ago`}
              </strong>
              <small>
                {producerState.successCount}/{producerState.pollCount} polls OK
                {producerState.lastError ? ` · ${producerState.lastError}` : ""}
              </small>
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

          {/* Fleet Efficiency & 1-Week Calibration */}
          <section className="v2-telemetry-section">
            <div className="v2-telemetry-section__header">
              <div>
                <h3>Fleet Efficiency &amp; 1-Week Calibration</h3>
                <small className="v2-telemetry-sub">
                  Observed hardware signals calibrate cycle times, stop dwelling, and required fleet size for HKT airport demand.
                </small>
              </div>
              <div className="v2-telemetry-export-btns">
                <button
                  type="button"
                  className="v2-btn v2-btn--ghost v2-btn--sm"
                  onClick={handleDownloadJson}
                  title="Download complete calibration ledger as JSON"
                >
                  Download JSON
                </button>
                <button
                  type="button"
                  className="v2-btn v2-btn--ghost v2-btn--sm"
                  onClick={handleDownloadCsv}
                  title="Export fleet efficiency metrics as CSV for Excel/Numbers"
                >
                  Export CSV
                </button>
                <button
                  type="button"
                  className="v2-btn v2-btn--ghost v2-btn--sm text-warn"
                  onClick={handleResetEfficiency}
                  title="Reset recorded efficiency samples"
                >
                  Reset Ledger
                </button>
              </div>
            </div>

            <div className="v2-telemetry-hud">
              <div className="v2-telemetry-hud__stat">
                <span>MOVING / TRANSIT RATIO</span>
                <strong className={efficiency.movingRatioPct >= 70 ? "text-accent" : "text-warn"}>
                  {efficiency.movingRatioPct}%
                </strong>
                <small>{efficiency.fleetUtilizationPct}% total fleet utilization</small>
              </div>

              <div className="v2-telemetry-hud__stat">
                <span>AVERAGE OPERATING SPEED</span>
                <strong className="text-ink">
                  {efficiency.avgFleetSpeedKph} km/h
                </strong>
                <small>{efficiency.totalKmTracked} km tracked across {efficiency.daysCollected} day(s)</small>
              </div>

              <div className="v2-telemetry-hud__stat">
                <span>BUNCHING INCIDENTS</span>
                <strong className={efficiency.detectedBunchingIncidents === 0 ? "text-accent" : "text-warn"}>
                  {efficiency.detectedBunchingIncidents}
                </strong>
                <small>Buses &lt; 600m apart on same route</small>
              </div>

              <div className="v2-telemetry-hud__stat">
                <span>CYCLE TIME CALIBRATION</span>
                <strong className={efficiency.cycleTimeInflationFactor > 1.1 ? "text-warn" : "text-accent"}>
                  {efficiency.observedCycleTimeMin} min
                </strong>
                <small>95m nominal ({efficiency.cycleTimeInflationFactor}× inflation)</small>
              </div>

              <div className="v2-telemetry-hud__stat v2-telemetry-hud__stat--span2">
                <span>OPTIMAL FLEET SIZING RECOMMENDATION</span>
                <strong className={efficiency.recommendation.surplusDeficit > 0 ? "text-warn" : "text-accent"}>
                  {efficiency.recommendation.recommendedBuses} Active Buses Required
                </strong>
                <small>{efficiency.recommendation.summaryText}</small>
              </div>
            </div>

            {/* Real Bus Financial & Revenue Ledger */}
            <div className="v2-telemetry-hud v2-telemetry-hud--finance">
              <div className="v2-telemetry-hud__stat">
                <span>REAL GPS REVENUE EARNED</span>
                <strong className="text-gain">
                  ฿{efficiency.totalRevenueThb.toLocaleString()}
                </strong>
                <small>{efficiency.totalPaxServed.toLocaleString()} pax @ ฿100 flat fare</small>
              </div>

              <div className="v2-telemetry-hud__stat">
                <span>ESTIMATED OPERATING COST</span>
                <strong className="text-ink">
                  ฿{efficiency.totalOperatingCostThb.toLocaleString()}
                </strong>
                <small>฿35/km across {efficiency.totalKmTracked} km driven</small>
              </div>

              <div className="v2-telemetry-hud__stat">
                <span>NET OPERATING MARGIN</span>
                <strong className={efficiency.netMarginThb >= 0 ? "text-gain" : "text-warn"}>
                  {efficiency.netMarginThb >= 0 ? "+" : "−"}฿{Math.abs(efficiency.netMarginThb).toLocaleString()}
                </strong>
                <small>{efficiency.profitMarginPct}% margin · {efficiency.tripsCompleted} trips completed</small>
              </div>

              <div className="v2-telemetry-hud__stat">
                <span>PASSENGER BENEFIT</span>
                <strong className="text-gain">
                  ฿{efficiency.passengerSavingsThb.toLocaleString()} Saved
                </strong>
                <small>vs Grab/taxi · {efficiency.totalCo2SavedKg} kg CO₂ saved</small>
              </div>

              <div className="v2-telemetry-hud__stat v2-telemetry-hud__stat--span2">
                <span>REVENUE DENSITY &amp; EFFICIENCY</span>
                <strong className="text-ink">
                  ฿{efficiency.revenuePerKm} / km · ฿{efficiency.revenuePerActiveBus.toLocaleString()} / active bus
                </strong>
                <small>Traced directly from real bus GPS pings and APC door counts</small>
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
                    <th>Distance</th>
                    <th>Trips</th>
                    <th>Pax</th>
                    <th>Gross Revenue</th>
                    <th>Net Margin</th>
                    <th>Speed</th>
                    <th>Signal Freshness</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVehicles.map((v) => {
                    const isGps = v.telemetrySource === "direct_gps";
                    const eff = efficiency.vehicles.find(
                      (ev) => ev.vehicleId === v.vehicleId || ev.licensePlate === v.licensePlate
                    );
                    const rev = eff?.revenueThb ?? 0;
                    const margin = eff?.netMarginThb ?? 0;
                    const km = eff?.totalDistanceKm ?? 0;
                    const trips = eff?.tripsCompleted ?? 0;
                    const pax = eff?.paxServed ?? 0;

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
                            {isGps ? `${km.toFixed(1)} km` : "—"}
                          </span>
                        </td>
                        <td>{isGps ? trips : "—"}</td>
                        <td>{isGps ? pax : "—"}</td>
                        <td>
                          <strong className={rev > 0 ? "text-gain" : "text-ink"}>
                            {isGps ? `฿${rev.toLocaleString()}` : "—"}
                          </strong>
                        </td>
                        <td>
                          <span className={margin > 0 ? "text-gain" : margin < 0 ? "text-warn" : "text-ink"}>
                            {isGps ? `${margin >= 0 ? "+" : "−"}฿${Math.abs(margin).toLocaleString()}` : "—"}
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
                      <td colSpan={10} className="v2-telemetry-empty">
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
