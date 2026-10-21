/**
 * /fleet/raw — every bus, every detail, in plain words.
 *
 * Transformed from a stark text list into a complete Fleet Telemetry &
 * Operational Efficiency Observatory:
 *   - Interactive real-time Leaflet map showing all 54 real buses, route geometry,
 *     moving directions, and terminal hubs.
 *   - Live Bus Inspection HUD: click any bus on the map or in the table to inspect
 *     its exact live speed, heading, route progress, efficiency metrics, and raw telemetry.
 *   - Visual Efficiency & Inefficiency Analytics:
 *     1. Fleet Operating State & Idle Inefficiency Ratio (Moving vs Dwelling vs Telemetry lag)
 *     2. Speed & Traffic Congestion Spectrum (Histogram across speed tiers)
 *     3. Corridor Headway & Bunching Inefficiency Detector (Route track spacing & bunching alerts)
 *     4. Asset Mileage & Utilization Ranking (Ranked day distance & productivity)
 *   - Full telemetry ledger with search, filters, order, expandable facts, and CSV/JSON downloads.
 *
 * Source: Live tracker relay (~1 fix/min per bus) + Collector day ledger (/api/research/day, /api/collect/week).
 * Evidence boundary: Passenger counters report zero on every bus, so rider counts remain unclaimed.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import L from "leaflet";
import type { LiveBus } from "@shared/pksbFeed";
import { getLiveBusesRaw, getLiveFeedState, startLiveFeed, subscribeLiveFeed } from "../../engine/liveOps";
import { appPath } from "../../lib/paths";
import {
  ago, bkkClock, BUNCH_M, duration, isOut, LINES, loadToday, MOVING_KPH, readRow, service,
  STATE_WORD, TERMINAL_ZONE_M, TIMETABLE_MIN, type Line, type Row, type State, type Today, CORRIDOR_BOUNDS, CORRIDOR_LANDMARKS,
} from "./fleetRows";
import "./fleetDetail.css";

type Show = "all" | "road" | "quiet" | "off";
type ServiceFilter = "all" | "rawai-airport" | "patong-old-bus-station" | "dragon-line" | "town" | "none";
type Order = "bus" | "signal" | "km" | "speed";

const SHOW_LABEL: Record<Show, string> = { all: "All", road: "On the road", quiet: "Lost signal", off: "Not out" };
const SERVICE_LABEL: Record<ServiceFilter, string> = {
  all: "Every service", "rawai-airport": "Airport ↔ Rawai", "patong-old-bus-station": "Old Town ↔ Patong",
  "dragon-line": "Dragon loop", town: "Town routes", none: "No line given",
};
const COMPASS = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];
const compass = (deg: number) => (Number.isFinite(deg) ? COMPASS[Math.round((((deg % 360) + 360) % 360) / 45) % 8]! : "—");
const bkkDateTime = (ms: number) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(ms));

function serviceKey(r: Row): ServiceFilter {
  if (r.line) return r.line.routeId as ServiceFilter;
  return r.bus.feed === "keyless" ? "town" : "none";
}
function doing(r: Row): string {
  if (r.state === "driving") return `Driving ${Math.round(r.bus.speedKph)} km/h, heading ${compass(r.bus.heading)}`;
  return STATE_WORD[r.state];
}
function lastSignal(r: Row, now: number): string {
  if (r.state === "off") return `Last seen ${bkkDateTime(r.fixMs)}`;
  if (r.state === "quiet") return `${bkkClock(r.fixMs)} (${ago(r.fixMs, now)})`;
  return ago(r.fixMs, now);
}
const where = (r: Row) => (r.atDepot ? "At the depot" : r.near ? `Near ${r.near}` : "—");
const todayText = (t: Today["perBus"][string] | undefined) =>
  t ? [t.trips ? `${t.trips} ${t.trips === 1 ? "trip" : "trips"}` : null, t.km !== null ? `${Math.round(t.km)} km` : null].filter(Boolean).join(" · ") || "—" : "—";

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function download(filename: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ── Leaflet Bus Marker Icon ────────────────────────────────────────────────
function busIcon(r: Row, focus: boolean): L.DivIcon {
  const cls = `fd-mapbus fd-mapbus--${r.state}${focus ? " is-focus" : ""}`;
  const html = r.state === "driving"
    ? `<span class="fd-mapbus__arrow" style="transform: rotate(${Math.round(r.bus.heading)}deg)"></span>`
    : `<span class="fd-mapbus__dot"></span>`;
  const label = focus ? `<span class="fd-mapbus__label">${r.bus.plate}</span>` : "";
  return L.divIcon({ className: cls, html: html + label, iconSize: [0, 0], iconAnchor: [0, 0] });
}

// ── Interactive Map Component ──────────────────────────────────────────────
function FleetDetailMap({
  rows,
  focus,
  onSelect,
}: {
  rows: Row[];
  focus: string | null;
  onSelect: (plate: string) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, {
      center: [7.93, 98.33],
      zoom: 11,
      zoomSnap: 0.1,
      zoomDelta: 0.25,
      minZoom: 9,
      maxZoom: 18,
      worldCopyJump: false,
      attributionControl: true,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(m);

    for (const line of LINES) {
      L.polyline(line.poly.map((p) => [p[0]!, p[1]!] as [number, number]), {
        className: "fd-route-poly",
        weight: 3,
        interactive: false,
      }).addTo(m);
    }

    for (const lm of CORRIDOR_LANDMARKS) {
      L.marker([lm.lat, lm.lng], {
        interactive: false,
        icon: L.divIcon({ className: `fd-landmark-pin fd-landmark-pin--${lm.role}`, html: `<span>${lm.name}</span>`, iconSize: [0, 0] }),
      }).addTo(m);
    }

    layer.current = L.layerGroup().addTo(m);
    map.current = m;

    // Open on the whole island and keep it framed while the full-height column settles,
    // until someone pans or scrolls the map themselves.
    let touched = false;
    m.on("dragstart", () => { touched = true; });
    el.current.addEventListener("wheel", () => { touched = true; }, { passive: true });
    const frame = () => { m.invalidateSize(); if (!touched) m.fitBounds(CORRIDOR_BOUNDS, { padding: [16, 12] }); };
    frame();
    const ro = new ResizeObserver(frame);
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      m.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const g = layer.current;
    if (!g) return;
    g.clearLayers();
    const shown = rows.filter((r) => r.state !== "off");
    for (const r of shown) {
      const isFocused = focus === r.bus.plate;
      const marker = L.marker([r.bus.lat, r.bus.lng], {
        icon: busIcon(r, isFocused),
        keyboard: false,
        zIndexOffset: isFocused ? 1000 : 0,
      });
      marker.bindTooltip(
        `${r.bus.plate} · ${STATE_WORD[r.state]}${r.state === "driving" ? ` (${Math.round(r.bus.speedKph)} km/h)` : ""}${r.near ? ` · near ${r.near}` : ""}`,
        { direction: "top", offset: [0, -10] }
      );
      marker.on("click", () => onSelect(r.bus.plate));
      marker.addTo(g);
    }
  }, [rows, focus, onSelect]);

  useEffect(() => {
    const r = rows.find((x) => x.bus.plate === focus);
    if (r && map.current) {
      map.current.setView([r.bus.lat, r.bus.lng], Math.max(map.current.getZoom(), 14), { animate: true });
    }
  }, [focus, rows]);

  const fitBounds = () => {
    if (!map.current) return;
    const out = rows.filter(isOut);
    if (out.length >= 2) {
      map.current.fitBounds(L.latLngBounds(out.map((r) => [r.bus.lat, r.bus.lng] as [number, number])), {
        padding: [30, 30],
        maxZoom: 13,
      });
    }
  };

  return (
    <div className="fd-mapwrap">
      <div ref={el} className="fd-map" role="application" aria-label="Interactive map of real bus fleet" />
      <div className="fd-map-controls">
        <button type="button" onClick={fitBounds} title="Fit all active buses in view">
          Fit fleet
        </button>
      </div>
      <div className="fd-legend" aria-hidden>
        <span><i className="fd-legend__arrow" /> Driving</span>
        <span><i className="fd-legend__dot" /> Standing</span>
        <span><i className="fd-legend__dot fd-legend__dot--late" /> Late signal</span>
        <span><i className="fd-legend__dot fd-legend__dot--quiet" /> Lost signal</span>
      </div>
    </div>
  );
}

// ── Live Bus Inspection HUD ────────────────────────────────────────────────
function BusInspectorHUD({
  row,
  now,
  today,
  onClose,
  onCenter,
  onJumpToRow,
}: {
  row: Row;
  now: number;
  today: Today["perBus"][string] | undefined;
  onClose: () => void;
  onCenter: () => void;
  onJumpToRow: () => void;
}) {
  const b = row.bus;
  const speed = Math.round(b.speedKph);
  const isMoving = row.state === "driving";

  // Efficiency assessment for this individual bus
  let speedTone: "good" | "warn" | "idle" = "idle";
  let speedComment = "Standing / Idle";
  if (isMoving) {
    if (speed >= 35) {
      speedTone = "good";
      speedComment = "Cruising · Free flow speed";
    } else if (speed >= 15) {
      speedTone = "good";
      speedComment = "Urban corridor flow";
    } else {
      speedTone = "warn";
      speedComment = "Crawl · Heavy traffic or dwell";
    }
  } else {
    if (row.atDepot) {
      speedComment = "At depot base";
    } else if (row.near) {
      speedComment = `Dwelling near ${row.near}`;
    } else {
      speedComment = "Stopped on road";
    }
  }

  const corridorProgressPct = row.line && row.alongM !== null
    ? Math.min(100, Math.max(0, Math.round((row.alongM / row.line.lengthM) * 100)))
    : null;

  return (
    <div className="fd-hud">
      <header className="fd-hud__head">
        <div>
          <span className="fd-hud__tag">Bus Telemetry & Efficiency</span>
          <h2 className="fd-hud__plate">{b.plate}</h2>
        </div>
        <button type="button" className="fd-hud__close" onClick={onClose} aria-label="Close inspection">
          ✕
        </button>
      </header>

      <div className={`fd-hud__status fd-hud__status--${row.state}`}>
        <div className="fd-hud__status-main">
          <strong>{doing(row)}</strong>
          <span>{service(row)}</span>
        </div>
        <span className={`fd-hud__badge is-${speedTone}`}>{speedComment}</span>
      </div>

      {corridorProgressPct !== null && row.line && (
        <div className="fd-hud__progress">
          <div className="fd-hud__progress-labels">
            <span>{row.line.from}</span>
            <span>{corridorProgressPct}% along corridor</span>
            <span>{row.line.loop ? "Round" : row.line.to}</span>
          </div>
          <div className="fd-hud__progress-track">
            <div className="fd-hud__progress-fill" style={{ width: `${corridorProgressPct}%` }} />
          </div>
        </div>
      )}

      <dl className="fd-hud__grid">
        <div>
          <dt>Location</dt>
          <dd>{where(row)}</dd>
        </div>
        <div>
          <dt>Coordinates</dt>
          <dd>
            <a href={`https://www.openstreetmap.org/?mlat=${b.lat}&mlon=${b.lng}#map=17/${b.lat}/${b.lng}`} target="_blank" rel="noreferrer">
              {b.lat.toFixed(4)}, {b.lng.toFixed(4)}
            </a>
          </dd>
        </div>
        <div>
          <dt>Last GPS Signal</dt>
          <dd>{ago(row.fixMs, now)} ({bkkClock(row.fixMs)})</dd>
        </div>
        <div>
          <dt>Speed & Heading</dt>
          <dd>{speed} km/h · {Math.round(b.heading)}° {compass(b.heading)}</dd>
        </div>
        <div>
          <dt>Today&apos;s Distance</dt>
          <dd>{today?.km != null ? `${Math.round(today.km)} km driven` : "No distance logged"}</dd>
        </div>
        <div>
          <dt>Trips Today</dt>
          <dd>{!row.line ? "Not counted — no PKSB line" : today?.trips ? `${today.trips} ${today.trips === 1 ? "trip" : "trips"} completed` : "None finished yet"}</dd>
        </div>
        <div>
          <dt>Tracker Source</dt>
          <dd>{b.feed === "token" ? "Line tracker (Official)" : "Town tracker"}</dd>
        </div>
        <div>
          <dt>Device Link</dt>
          <dd>{b.online === true ? "Online" : b.online === false ? "Offline" : "Not reported"}</dd>
        </div>
      </dl>

      <div className="fd-hud__actions">
        <button type="button" onClick={onCenter}>Center on map</button>
        <button type="button" onClick={onJumpToRow}>Jump to table record & raw JSON</button>
      </div>
    </div>
  );
}

// ── Fleet Efficiency Diagrams & Graphs ─────────────────────────────────────
function FleetEfficiencyAnalytics({
  rows,
  today,
  onSelect,
}: {
  rows: Row[];
  today: Today | null;
  onSelect: (plate: string) => void;
}) {
  const onRoad = rows.filter(isOut);
  const driving = onRoad.filter((r) => r.state === "driving");
  const standing = onRoad.filter((r) => r.state === "standing");
  const late = onRoad.filter((r) => r.state === "late");
  const quiet = rows.filter((r) => r.state === "quiet");
  const off = rows.filter((r) => r.state === "off");

  const total = rows.length || 1;
  const activeCount = onRoad.length;
  const activeMovementEfficiency = activeCount > 0 ? Math.round((driving.length / activeCount) * 100) : 0;
  const idleRatio = activeCount > 0 ? Math.round((standing.length / activeCount) * 100) : 0;

  // Speed spectrum
  const speeds = driving.map((r) => r.bus.speedKph);
  const avgSpeed = speeds.length ? Math.round(speeds.reduce((a, b) => a + b, 0) / speeds.length) : 0;
  const maxSpeed = speeds.length ? Math.round(Math.max(...speeds)) : 0;

  const speedTiers = [
    { label: "Stopped (0–4 km/h)", count: standing.length, tone: "idle" },
    { label: "Crawl (5–15 km/h)", count: driving.filter((r) => r.bus.speedKph > 4 && r.bus.speedKph <= 15).length, tone: "warn" },
    { label: "Urban (16–35 km/h)", count: driving.filter((r) => r.bus.speedKph > 15 && r.bus.speedKph <= 35).length, tone: "good" },
    { label: "Cruising (>35 km/h)", count: driving.filter((r) => r.bus.speedKph > 35).length, tone: "accent" },
  ];
  const maxSpeedTier = Math.max(...speedTiers.map((t) => t.count), 1);

  // Bunching Inefficiency Detection
  const bunchingIncidents = useMemo(() => {
    const list: {
      line: Line;
      dir: "to" | "from";
      busA: Row;
      busB: Row;
      gapM: number;
    }[] = [];
    for (const line of LINES) {
      if (line.loop) continue;
      for (const d of ["to", "from"] as const) {
        const seq = rows
          .filter((r) => r.line === line && r.dir === d && r.alongM !== null && (r.state === "driving" || r.state === "standing"))
          .sort((a, b) => a.alongM! - b.alongM!);
        for (let i = 1; i < seq.length; i++) {
          const [a, b] = [seq[i - 1]!, seq[i]!];
          const atEnd = (x: number) => x < TERMINAL_ZONE_M || x > line.lengthM - TERMINAL_ZONE_M;
          const gap = Math.round(b.alongM! - a.alongM!);
          if (gap < BUNCH_M && !atEnd(a.alongM!) && !atEnd(b.alongM!)) {
            list.push({ line, dir: d, busA: a, busB: b, gapM: gap });
          }
        }
      }
    }
    return list;
  }, [rows]);

  // Mileage ranking
  const topMileage = useMemo(() => {
    return rows
      .filter((r) => (today?.perBus[r.bus.plate]?.km ?? 0) > 0 || isOut(r))
      .map((r) => ({
        plate: r.bus.plate,
        state: r.state,
        km: today?.perBus[r.bus.plate]?.km != null ? Math.round(today.perBus[r.bus.plate]!.km!) : 0,
        trips: today?.perBus[r.bus.plate]?.trips ?? 0,
        speed: Math.round(r.bus.speedKph),
      }))
      .sort((a, b) => b.km - a.km)
      .slice(0, 7);
  }, [rows, today]);
  const maxKm = Math.max(...topMileage.map((m) => m.km), 1);

  return (
    <section className="fd-analytics" aria-labelledby="fleet-efficiency-heading">
      <header className="fd-analytics__head">
        <div>
          <p className="fd-eyebrow">Real-Time Operational Calibration</p>
          <h2 id="fleet-efficiency-heading" className="fd-analytics__title">Fleet Efficiency & Inefficiency Telemetry</h2>
          <p className="fd-analytics__sub">
            Calculated directly from live GPS telemetry and today&apos;s trip record. Gauges transit productivity, spacing regularity, and dwell inefficiency.
          </p>
        </div>
      </header>

      <div className="fd-analytics__grid">
        {/* Card 1: Operating State & Idle Inefficiency Gauge */}
        <div className="fd-card">
          <div className="fd-card__head">
            <h3>Fleet Operating State & Dwell Ratio</h3>
            <span className="fd-badge fd-badge--rate">{activeMovementEfficiency}% moving</span>
          </div>

          <div className="fd-state-bar" role="meter" aria-valuenow={activeMovementEfficiency} aria-valuemin={0} aria-valuemax={100}>
            <div className="fd-state-bar__seg is-driving" style={{ width: `${(driving.length / total) * 100}%` }} title={`Driving: ${driving.length}`} />
            <div className="fd-state-bar__seg is-standing" style={{ width: `${(standing.length / total) * 100}%` }} title={`Standing: ${standing.length}`} />
            <div className="fd-state-bar__seg is-late" style={{ width: `${(late.length / total) * 100}%` }} title={`Late signal: ${late.length}`} />
            <div className="fd-state-bar__seg is-quiet" style={{ width: `${(quiet.length / total) * 100}%` }} title={`Lost signal: ${quiet.length}`} />
            <div className="fd-state-bar__seg is-off" style={{ width: `${(off.length / total) * 100}%` }} title={`Not out: ${off.length}`} />
          </div>

          <div className="fd-card__stats">
            <div>
              <strong>{driving.length}</strong>
              <span>Driving ({activeMovementEfficiency}%)</span>
            </div>
            <div>
              <strong>{standing.length}</strong>
              <span>Idle / Dwell ({idleRatio}%)</span>
            </div>
            <div>
              <strong>{late.length}</strong>
              <span>GPS Lag</span>
            </div>
            <div>
              <strong>{quiet.length}</strong>
              <span>Signal Lost</span>
            </div>
          </div>
          <p className="fd-card__note">
            {activeMovementEfficiency >= 50
              ? "Healthy transit productivity: More than half of on-road vehicles are generating revenue motion."
              : "High dwell inefficiency: Majority of active buses are standing at terminals, curb stops, or idling."}
          </p>
        </div>

        {/* Card 2: Speed Spectrum & Congestion Detector */}
        <div className="fd-card">
          <div className="fd-card__head">
            <h3>Speed Spectrum & Congestion</h3>
            <span className="fd-badge">Avg: {avgSpeed} km/h · Max: {maxSpeed} km/h</span>
          </div>

          <div className="fd-speed-hist">
            {speedTiers.map((tier) => {
              const hPct = Math.round((tier.count / maxSpeedTier) * 100);
              return (
                <div key={tier.label} className="fd-speed-col">
                  <span className="fd-speed-col__val">{tier.count}</span>
                  <div className="fd-speed-col__track">
                    <div className={`fd-speed-col__fill is-${tier.tone}`} style={{ height: `${Math.max(6, hPct)}%` }} />
                  </div>
                  <span className="fd-speed-col__lbl">{tier.label.split(" ")[0]}</span>
                </div>
              );
            })}
          </div>
          <p className="fd-card__note">
            {speedTiers[1]!.count > speedTiers[3]!.count
              ? "Corridor congestion alert: More buses in heavy crawl (<15 km/h) than free-flow cruising."
              : "Free flow prevailing: Arterials running smoothly with cruising speeds above 25 km/h."}
          </p>
        </div>

        {/* Card 3: Corridor Headway Regularity & Bunching Inefficiency Detector */}
        <div className="fd-card fd-card--wide">
          <div className="fd-card__head">
            <h3>Corridor Spacing & Bunching Inefficiency</h3>
            <span className={`fd-badge ${bunchingIncidents.length > 0 ? "fd-badge--warn" : "fd-badge--good"}`}>
              {bunchingIncidents.length === 0 ? "No bunching detected" : `${bunchingIncidents.length} bunching incident${bunchingIncidents.length > 1 ? "s" : ""}`}
            </span>
          </div>

          {bunchingIncidents.length > 0 ? (
            <div className="fd-bunching-alert">
              {bunchingIncidents.map((inc, i) => (
                <div key={i} className="fd-bunching-row">
                  <span className="fd-bunching-icon">⚠️</span>
                  <div className="fd-bunching-info">
                    <strong>
                      {inc.busA.bus.plate} and {inc.busB.bus.plate} are bunched ({inc.gapM}m apart)
                    </strong>
                    <p>
                      Running together toward {inc.dir === "to" ? inc.line.to : inc.line.from} on {inc.line.name}.
                      Inefficiency: Next waiting passenger waits 2× longer; trailing bus carries empty seats.
                    </p>
                  </div>
                  <div className="fd-bunching-actions">
                    <button type="button" onClick={() => onSelect(inc.busA.bus.plate)}>Inspect {inc.busA.bus.plate}</button>
                    <button type="button" onClick={() => onSelect(inc.busB.bus.plate)}>Inspect {inc.busB.bus.plate}</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="fd-card__nominal">
              ✓ Corridors are running with regular headway spacing. No bunching detected across active lines.
            </p>
          )}

          {/* Mini Corridor Rails */}
          <div className="fd-corridors">
            {LINES.map((line) => {
              const lineBuses = rows.filter((r) => r.line === line && isOut(r) && r.alongM !== null);
              return (
                <div key={line.routeId} className="fd-corridor-row">
                  <div className="fd-corridor-label">
                    <strong>{line.name}</strong>
                    <span>{lineBuses.length} active</span>
                  </div>
                  <div className="fd-corridor-track">
                    <span className="fd-corridor-end">{line.from}</span>
                    <div className="fd-corridor-line">
                      <i className="fd-corridor-rail" />
                      {lineBuses.map((r) => {
                        const pct = Math.min(100, Math.max(0, (r.alongM! / line.lengthM) * 100));
                        return (
                          <button
                            key={r.bus.plate}
                            type="button"
                            className={`fd-corridor-bus is-${r.state}`}
                            style={{ left: `${pct}%` }}
                            onClick={() => onSelect(r.bus.plate)}
                            title={`${r.bus.plate} · ${STATE_WORD[r.state]}`}
                          >
                            <span className="fd-corridor-arrow">{r.dir === "from" ? "←" : "→"}</span>
                            <span className="fd-corridor-plate">{r.bus.plate.replace("10-", "")}</span>
                          </button>
                        );
                      })}
                    </div>
                    <span className="fd-corridor-end">{line.loop ? "Loop" : line.to}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Card 4: Mileage Productivity & Asset Utilization */}
        <div className="fd-card">
          <div className="fd-card__head">
            <h3>Today&apos;s Mileage & Utilization</h3>
            <span className="fd-badge">Top active assets</span>
          </div>

          <div className="fd-mileage-list">
            {topMileage.length === 0 ? (
              <p className="fd-empty">No mileage recorded today yet.</p>
            ) : (
              topMileage.map((m) => {
                const wPct = Math.round((m.km / maxKm) * 100);
                return (
                  <button key={m.plate} type="button" className="fd-mileage-row" onClick={() => onSelect(m.plate)}>
                    <span className="fd-mileage-plate">{m.plate}</span>
                    <div className="fd-mileage-track">
                      <div className="fd-mileage-fill" style={{ width: `${Math.max(4, wPct)}%` }} />
                    </div>
                    <span className="fd-mileage-km">{m.km} km</span>
                    <span className="fd-mileage-trips">{m.trips ? `${m.trips}T` : "—"}</span>
                  </button>
                );
              })
            )}
          </div>
          <p className="fd-card__note">
            Asset utilization balance: Highlights workhorse units vs low-mileage buses that have not completed trips today.
          </p>
        </div>
      </div>
    </section>
  );
}

// ── Main Page Component ────────────────────────────────────────────────────
export function FleetDetail() {
  const [now, setNow] = useState(() => Date.now());
  const [buses, setBuses] = useState<readonly LiveBus[]>(() => getLiveBusesRaw());
  const [feed, setFeed] = useState(() => getLiveFeedState());
  const [today, setToday] = useState<Today | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [show, setShow] = useState<Show>("all");
  const [svc, setSvc] = useState<ServiceFilter>("all");
  const [order, setOrder] = useState<Order>("bus");

  useEffect(() => {
    const stop = startLiveFeed();
    const unsub = subscribeLiveFeed(() => {
      setBuses(getLiveBusesRaw());
      setFeed(getLiveFeedState());
    });
    const tick = setInterval(() => setNow(Date.now()), 5_000);
    const pull = () => void loadToday().then((t) => t && setToday(t));
    pull();
    const slow = setInterval(pull, 120_000);
    return () => {
      stop();
      unsub();
      clearInterval(tick);
      clearInterval(slow);
    };
  }, []);

  const rows = useMemo(() => buses.map((b) => readRow(b, now)), [buses, now]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const kmOf = (r: Row) => today?.perBus[r.bus.plate]?.km ?? -1;
    return rows
      .filter((r) => !needle || r.bus.plate.toLowerCase().includes(needle))
      .filter((r) => svc === "all" || serviceKey(r) === svc)
      .sort((a, b) => {
        if (order === "signal") return b.fixMs - a.fixMs;
        if (order === "km") return kmOf(b) - kmOf(a);
        if (order === "speed") return b.bus.speedKph - a.bus.speedKph;
        return a.bus.plate.localeCompare(b.bus.plate);
      });
  }, [rows, search, svc, order, today]);

  const groups: { key: Show; title: string; note: string; rows: Row[] }[] = [
    { key: "road", title: "On the road", note: "a position in the last 15 minutes", rows: visible.filter(isOut) },
    { key: "quiet", title: "Lost signal today", note: "reported earlier today, silent for 15 minutes or more", rows: visible.filter((r) => r.state === "quiet") },
    { key: "off", title: "Not out today", note: "no position in the last 12 hours", rows: visible.filter((r) => r.state === "off") },
  ].filter((g) => (show === "all" || show === g.key) && g.rows.length > 0) as { key: Show; title: string; note: string; rows: Row[] }[];

  const count = (k: Show) => rows.filter((r) => (k === "road" ? isOut(r) : k === "quiet" ? r.state === "quiet" : r.state === "off")).length;
  const feedAge = feed.lastOkMs ? Math.round((now - feed.lastOkMs) / 1000) : null;
  const stamp = new Date(now + 7 * 3_600_000).toISOString().slice(0, 16).replace("T", "_").replace(":", "");

  const focusedRow = useMemo(() => rows.find((r) => r.bus.plate === focus) ?? null, [rows, focus]);

  const handleSelectBus = (plate: string) => {
    setFocus(plate);
    setOpen(plate);
  };

  const handleJumpToRow = (plate: string) => {
    setOpen(plate);
    const el = document.getElementById(`row-${plate}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  function exportRows() {
    return visible.map((r) => ({
      plate: r.bus.plate, doing: doing(r), state: r.state, service: service(r), where: where(r),
      last_fix_bkk: bkkDateTime(r.fixMs), last_fix_utc: r.bus.updatedAt,
      lat: r.bus.lat, lng: r.bus.lng, speed_kph: r.bus.speedKph, heading_deg: r.bus.heading,
      tracker: r.bus.feed ?? "", device_online: r.bus.online ?? "", line_named: r.bus.routeId ?? "", destination: r.bus.destination || "",
      odometer_km: r.bus.odometerM ? Math.round(r.bus.odometerM / 100) / 10 : "",
      counter_on_board: r.bus.paxOnBoard ?? "", counter_up: r.bus.paxUp ?? "", counter_down: r.bus.paxDown ?? "",
      trips_today: today?.perBus[r.bus.plate]?.trips ?? "", km_today: today?.perBus[r.bus.plate]?.km ?? "",
    }));
  }
  function exportCSV() {
    const data = exportRows();
    const cols = Object.keys(data[0] ?? { plate: "" });
    download(`PBUS_${stamp}_DATA_fleet-snapshot.csv`, [cols.join(","), ...data.map((d) => cols.map((c) => csvCell((d as Record<string, unknown>)[c])).join(","))].join("\n"), "text/csv");
  }
  function exportJSON() {
    download(`PBUS_${stamp}_DATA_fleet-snapshot.json`, JSON.stringify({ exportedAt: new Date().toISOString(), sources: feed.sources, buses: exportRows(), raw: visible.map((r) => r.bus) }, null, 2), "application/json");
  }

  return (
    <div className="v2 v2--operations fd">
      <div className="fd-shell">
        <div className="fd-stage__map">
            <header className="fd-stage__map-head">
              <div>
                <strong>Interactive Fleet Map</strong>
                <span>{count("road")} buses transmitting live positions</span>
              </div>
              <span className="fd-stage__freshness">
                {feedAge === null ? "Waiting for relay" : feedAge < 5 ? "Live stream" : `${feedAge}s delay`}
              </span>
            </header>
            <FleetDetailMap rows={rows} focus={focus} onSelect={handleSelectBus} />
          </div>
      <div className="fd-rail">
        <header className="fd-head">
          <div>
            <p className="fd-eyebrow">Phuket Smart Bus · Real Telemetry & Operational Observatory</p>
            <h1 className="fd-title">Every bus, every detail</h1>
            <p className="fd-sub">
              {rows.length} buses across both official trackers: {count("road")} on the road, {count("quiet")} lost signal today, {count("off")} not out.
              {" "}Click any bus on the map or table to inspect live speed, heading, route progress, and operational efficiency.
              {feedAge !== null ? ` Telemetry last updated ${feedAge < 5 ? "just now" : `${feedAge} s ago`}.` : ""}
            </p>
          </div>
          <nav className="fd-nav" aria-label="Other views">
            <a href={appPath("/fleet")}>Fleet now</a>
            <a href={appPath("/research")}>Trips</a>
            <a href={appPath("/study")}>Study</a>
            <a href={appPath("/ops")}>Ops wall</a>
          </nav>
        </header>

        {/* ── Interactive Stage: Live Map + Bus Inspector HUD ───────────── */}
        <section className="fd-stage" aria-label="Bus inspector">


          <aside className="fd-stage__sidebar">
            {focusedRow ? (
              <BusInspectorHUD
                row={focusedRow}
                now={now}
                today={today?.perBus[focusedRow.bus.plate]}
                onClose={() => setFocus(null)}
                onCenter={() => setFocus(focusedRow.bus.plate)}
                onJumpToRow={() => handleJumpToRow(focusedRow.bus.plate)}
              />
            ) : (
              <div className="fd-hud-placeholder">
                <span className="fd-hud__tag">Fleet Live Pulse</span>
                <h3>Click any bus to inspect</h3>
                <p>
                  Select a marker on the map or a row in the table below to inspect speed, corridor position, spacing regularity, and raw GPS fixes.
                </p>
                <div className="fd-hud-kpis">
                  <div>
                    <strong>{count("road")}</strong>
                    <span>On road</span>
                  </div>
                  <div>
                    <strong>{rows.filter((r) => r.state === "driving").length}</strong>
                    <span>Moving</span>
                  </div>
                  <div>
                    <strong>{rows.filter((r) => r.state === "standing" && isOut(r)).length}</strong>
                    <span>Dwelling</span>
                  </div>
                </div>
              </div>
            )}
          </aside>
        </section>

        {/* ── Diagrams & Graphs: Fleet Efficiency Analytics ────────────── */}
        <FleetEfficiencyAnalytics rows={rows} today={today} onSelect={handleSelectBus} />

        {/* ── All Buses: Telemetry Ledger Table ────────────────────────── */}
        <section className="fd-table-section" aria-labelledby="telemetry-ledger-heading">
          <header className="fd-table-head">
            <div>
              <p className="fd-eyebrow">Comprehensive Fleet Inventory</p>
              <h2 id="telemetry-ledger-heading">All 54 Buses — Telemetry Ledger & Raw Inspector</h2>
            </div>
            <div className="fd-downloads">
              <button type="button" onClick={exportCSV}>Download CSV</button>
              <button type="button" onClick={exportJSON}>Download JSON</button>
            </div>
          </header>

          <div className="fd-controls">
            <input
              className="fd-search"
              type="search"
              placeholder="Find a bus, e.g. 1149"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Find a bus by plate"
            />
            <div className="fd-chips" role="group" aria-label="Show">
              {(["all", "road", "quiet", "off"] as Show[]).map((k) => {
                const n = k === "all" ? rows.length : count(k);
                return (
                  <button
                    key={k}
                    type="button"
                    className={show === k ? "is-active" : undefined}
                    aria-pressed={show === k}
                    aria-label={`${SHOW_LABEL[k]}, ${n} buses`}
                    onClick={() => setShow(k)}
                  >
                    <span className="fd-chip-name">{SHOW_LABEL[k]}</span>
                    <span className="fd-chip-count">{n}</span>
                  </button>
                );
              })}
            </div>
            <label className="fd-select">
              <span>Service</span>
              <select value={svc} onChange={(e) => setSvc(e.target.value as ServiceFilter)}>
                {(Object.keys(SERVICE_LABEL) as ServiceFilter[]).map((k) => (
                  <option key={k} value={k}>{SERVICE_LABEL[k]}</option>
                ))}
              </select>
            </label>
            <label className="fd-select">
              <span>Order by</span>
              <select value={order} onChange={(e) => setOrder(e.target.value as Order)}>
                <option value="bus">Bus number</option>
                <option value="speed">Fastest speed first</option>
                <option value="signal">Latest signal first</option>
                <option value="km">Most km today</option>
              </select>
            </label>
          </div>

          {groups.length === 0 && (
            <p className="fd-empty">{rows.length === 0 ? "Waiting for the trackers…" : "No bus matches."}</p>
          )}

          {groups.map((g) => (
            <section key={g.key} className="fd-group">
              <h2>{g.title} <span>{g.rows.length} · {g.note}</span></h2>
              <div className="fd-scroll">
                <table className="fd-table">
                  <thead>
                    <tr>
                      <th>Bus</th>
                      <th>Doing</th>
                      <th>Service</th>
                      <th>Where</th>
                      <th>Last signal</th>
                      <th>Today</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.rows.map((r) => {
                      const isOpen = open === r.bus.plate;
                      const isFocused = focus === r.bus.plate;
                      return [
                        <tr
                          key={r.bus.plate}
                          id={`row-${r.bus.plate}`}
                          className={`fd-row fd-row--${r.state}${isOpen ? " is-open" : ""}${isFocused ? " is-focus" : ""}`}
                        >
                          <td>
                            <button
                              type="button"
                              className="fd-plate"
                              aria-expanded={isOpen}
                              onClick={() => {
                                setOpen(isOpen ? null : r.bus.plate);
                                setFocus(r.bus.plate);
                              }}
                            >
                              <span className="fd-caret" aria-hidden>{isOpen ? "−" : "+"}</span>
                              {r.bus.plate}
                            </button>
                          </td>
                          <td className="fd-doing">{doing(r)}</td>
                          <td>{service(r)}</td>
                          <td>{where(r)}</td>
                          <td>{lastSignal(r, now)}</td>
                          <td>{todayText(today?.perBus[r.bus.plate])}</td>
                          <td>
                            <button
                              type="button"
                              className="fd-row-action"
                              onClick={() => handleSelectBus(r.bus.plate)}
                              title="Show on map and inspect"
                            >
                              View on map
                            </button>
                          </td>
                        </tr>,
                        isOpen && (
                          <tr key={`${r.bus.plate}-detail`} className="fd-detail-row">
                            <td colSpan={7}>
                              <BusFacts row={r} today={today?.perBus[r.bus.plate]} />
                            </td>
                          </tr>
                        ),
                      ];
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </section>

        <p className="fd-foot">
          Sources: the two trackers behind the official map (smartbus.phuket.cloud) — the line-fleet tracker for Airport, Patong and Dragon buses, and the
          town-fleet tracker for town routes. &quot;Today&quot; is our collector&apos;s record since 03:00 Bangkok. Passenger counters read zero on every bus, so they are shown as sent and never used as rider counts.
        </p>
      </div>
      </div>
    </div>
  );
}

function BusFacts({ row: r, today }: { row: Row; today: Today["perBus"][string] | undefined }) {
  const b = r.bus;
  const counter = [b.paxOnBoard, b.paxUp, b.paxDown];
  const facts: [string, ReactNode][] = [
    ["Position", (
      <>
        <a href={`https://www.openstreetmap.org/?mlat=${b.lat}&mlon=${b.lng}#map=17/${b.lat}/${b.lng}`} target="_blank" rel="noreferrer">
          {b.lat.toFixed(5)}, {b.lng.toFixed(5)}
        </a>
        {r.near ? ` — near ${r.near}` : ""}
        {r.atDepot ? " — at the depot" : ""}
      </>
    )],
    ["Speed", `${Math.round(b.speedKph * 10) / 10} km/h, facing ${compass(b.heading)} (${Math.round(b.heading)}°)`],
    ["Last GPS fix", `${bkkDateTime(Date.parse(b.updatedAt))} Bangkok`],
    ["Service", `${service(r)}${b.routeId ? "" : b.feed === "keyless" ? " (this tracker never names a line)" : " (tracker names no line right now)"}`],
    ["Tracker", b.feed === "token" ? "Line-fleet tracker (Airport, Patong, Dragon buses)" : "Town-fleet tracker (town routes)"],
    ["Device link", b.online === true ? "Online" : b.online === false ? "Offline — the device reports it is not connected" : "Not reported"],
    ["Odometer", b.odometerM ? `${(b.odometerM / 1000).toLocaleString("en-GB", { maximumFractionDigits: 1 })} km` : "Not sent by this tracker"],
    ["Passenger counter", counter.every((c) => c == null) ? "Not sent" : `On board ${b.paxOnBoard ?? "—"}, boarded ${b.paxUp ?? "—"}, alighted ${b.paxDown ?? "—"}${counter.every((c) => !c) ? " — reads zero, so treated as no counter" : ""}`],
    ["Today", today ? [r.line ? `${today.trips} ${today.trips === 1 ? "trip" : "trips"} completed` : null, today.km !== null ? `${Math.round(today.km)} km driven` : null].filter(Boolean).join(" · ") || "Nothing recorded yet" : "No record yet today"],
  ];
  return (
    <div className="fd-facts">
      <dl>{facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      <details><summary>Raw tracker row</summary><pre>{JSON.stringify(b, null, 2)}</pre></details>
    </div>
  );
}
