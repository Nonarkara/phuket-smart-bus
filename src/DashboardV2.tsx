/**
 * Phuket Smart Bus v2 — One Page, One Story
 *
 * The simulation IS the product. Watch a day unfold:
 * Flights land → Passengers arrive → Buses collect them → Revenue accumulates
 *
 * Every number traces back to the demand-supply chain. Nothing decorative.
 *
 * Two views on the same engine:
 *   · Operations (default) — three columns: demand / map+fleet / supply
 *   · Insights             — full-width queue timeline + cumulative chart
 *
 * Switching views does NOT alter the simulation clock — both views share it.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  computeSimState,
  getDayInfo,
  getHourlyDemandSupply,
  getLiveTotals
} from "./engine/simulation";
import {
  getClockState,
  getSimulatedMinutes,
  setSimulatedMinutes,
  resetClockAnchor,
  startDaySweep,
  goLive,
  play,
  SERVICE_START,
} from "./engine/fleetSimulator";
import { getBangkokDayOfWeek } from "./engine/time";
import { getEnvironmentSnapshot } from "./engine/environmentSimulator";
import {
  buildFlightHourBuckets,
  getOpsFlightSchedule,
  getSimulationDay,
  setSimulationDay
} from "./engine/opsFlightSchedule";
import { getHeadlineMetrics } from "./engine/headlineMetrics";
import { getMapVehicles } from "./engine/mapVehicleSnapshot";
import { getHourlyBalance, getOperatorFleet, getQueueTimeline, getHourPeaks } from "./engine/v2OpsPanel";
import { Counter } from "./components/v2/V2Shared";
import { V2LiveMap, type V2MapHandle } from "./components/v2/V2LiveMap";
import { SimulationControls } from "./components/v2/SimulationControls";
import { ArrivalsBoard } from "./components/v2/ArrivalsBoard";
import { NextBusBoard } from "./components/v2/NextBusBoard";
import { HourlyBalanceChart } from "./components/v2/HourlyBalanceChart";
import { OperatorFleetPanel } from "./components/v2/OperatorFleetPanel";
import { InsightsTimeline } from "./components/v2/InsightsTimeline";
import { InsightsSummaryPanel } from "./components/v2/InsightsSummaryPanel";
import { ToolkitPanel } from "./components/v2/ToolkitPanel";
import { OpsBriefing } from "./components/v2/OpsBriefing";
import { BusPlanPanel } from "./components/v2/BusPlanPanel";
import { TelemetryStatusModal } from "./components/v2/TelemetryStatusModal";
import { isLiveGpsActive, getLiveTelemetryVehicles } from "./engine/liveGpsReceiver";

type ViewMode = "operations" | "insights" | "toolkit" | "live";

function getInitialViewMode(): ViewMode {
  if (typeof window === "undefined") return "operations";
  const requested = new URLSearchParams(window.location.search).get("view");
  return requested === "insights" || requested === "toolkit" ? requested : "operations";
}

/** 1440×900 is the design reference; wall screens scale up, never down.
 * Width-only scaling clipped the body on common 16:9 displays because the
 * header/footer consumed more than their share of the zoomed height. */
function computeOpsScale(): number {
  if (typeof window === "undefined") return 1;
  const widthScale = window.innerWidth / 1440;
  const heightScale = window.innerHeight / 900;
  return Math.min(2.5, Math.max(1, Math.min(widthScale, heightScale)));
}

/** A laptop should get the focused briefing, not a cropped wall console. */
function shouldUseCompactOps(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth < 1360 || window.innerHeight < 820;
}

function formatClockLabel(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = Math.floor(min % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} BKK`;
}

export default function DashboardV2() {
  const [viewMode, setViewMode] = useState<ViewMode>(getInitialViewMode);
  const [simDay, setSimDayState] = useState(() => getSimulationDay());
  const [state, setState] = useState(() => computeSimState());
  const [metrics, setMetrics] = useState(() => getHeadlineMetrics());
  const dailyFlights = useMemo(() => getOpsFlightSchedule(), [simDay]);
  const hourlyFlights = useMemo(() => buildFlightHourBuckets(dailyFlights), [dailyFlights]);
  const [clockState, setClockState] = useState(getClockState());

  // One-time snapshot for the streaming cells' STATIC placeholders — captured
  // once so they render correct opening values (no 0-flash) yet never change
  // across re-renders, so the 4Hz coarse setState can't re-bind/clobber the
  // text the rAF writes into these refs.
  const [initFrame] = useState(() => {
    const t = getSimulatedMinutes();
    return {
      tot: getLiveTotals(t),
      moving: getMapVehicles(t).filter((v) => v.status === "moving").length,
      clock: formatClockLabel(t),
    };
  });

  // Imperative handle to the map's marker layer (driven per frame) + refs for
  // the streaming money/pax cells. These cells render STATIC placeholders in
  // JSX and are written ONLY by the rAF loop below — never bound to React
  // state, or the 4Hz coarse setState would clobber the live text.
  const mapRef = useRef<V2MapHandle>(null);
  const clockRef = useRef<HTMLSpanElement>(null);
  const revEarnedRef = useRef<HTMLSpanElement>(null);
  const revLostRef = useRef<HTMLSpanElement>(null);
  const revMeterRef = useRef<HTMLSpanElement>(null);
  const paxRef = useRef<HTMLSpanElement>(null);
  const tripsRef = useRef<HTMLSpanElement>(null);
  const kmRef = useRef<HTMLSpanElement>(null);
  const co2Ref = useRef<HTMLSpanElement>(null);
  const demandQueueRef = useRef<HTMLElement>(null);
  const supplyRollingRef = useRef<HTMLElement>(null);
  const walkedRef = useRef<HTMLElement>(null);

  // Day picker: switch the engine's active day and replay it from 05:30.
  // All engine memos are keyed on the day, so every panel re-derives; the rAF
  // loop repaints buses/money on the next frame (getSimulatedMinutes changed).
  const handleDayChange = (dow: number) => {
    setSimulationDay(dow);
    setSimulatedMinutes(SERVICE_START);
    play();
    setSimDayState(dow);
    setState(computeSimState());
    setClockState(getClockState());
  };

  // LIVE: Bangkok wall clock, Bangkok weekday. Buses sit where the published
  // timetable puts them right now; the wait board projects from that.
  const handleGoLive = () => {
    const today = getBangkokDayOfWeek();
    if (today !== getSimulationDay()) setSimulationDay(today);
    goLive();
    setSimDayState(today);
    setState(computeSimState());
    setClockState(getClockState());
  };

  // One-touch cinematic: sweep the whole service day in ~60s, then freeze.
  const handleStartDaySweep = () => {
    startDaySweep();
    setClockState(getClockState());
  };

  const currentHourBucket = hourlyFlights[Math.floor(state.simMinutes / 60) % 24] ?? hourlyFlights[0];
  const responsePct = state.paxWantBus > 0 ? Math.round((state.paxBoarded / state.paxWantBus) * 100) : 100;
  // Honest split: "waiting" is the queue RIGHT NOW; "walked away" is
  // cumulative abandonment. The old serviceGap (demand − boarded) summed
  // both into one fake "waiting" number.
  const serviceGap = state.paxAtAirport;
  const standbyBusesNeeded = Math.ceil(serviceGap / 25);
  const currentDemandPax = currentHourBucket?.arrivalPax ?? 0;

  // Hourly demand-supply balance rows. Memoized by the engine.
  const hourlyBalance = getHourlyBalance();
  const currentBalance = hourlyBalance[Math.floor(state.simMinutes / 60) % 24];
  const hourPeaks = getHourPeaks();

  // Schedule-derived fleet metrics — LAND routes only. Ferry vessels are
  // not buses; counting them produced "74 buses required" absurdity.
  const currentHourly = getHourlyDemandSupply()[Math.floor(state.simMinutes / 60) % 24];
  const currentSupplySeats = currentHourly?.busSeatsAvailable ?? 0;
  const currentBusDemand = currentHourly?.busDemandPax ?? 0;

  // Per-vehicle operations panel rows
  const operatorRows = getOperatorFleet();

  // Bus plan panel: which vehicle the operator is looking at. Hover sets it,
  // click pins it (hover-out no longer clears), × or clicking empty map unpins.
  const [focus, setFocus] = useState<{ id: string | null; pinned: boolean }>({ id: null, pinned: false });
  const handleFocusVehicle = (id: string | null, pinned: boolean) => {
    setFocus((prev) => {
      if (pinned) return { id, pinned: true };
      if (prev.pinned) return prev; // hover doesn't override a pin
      return { id, pinned: false };
    });
  };
  const focusedRow = focus.id ? operatorRows.find((r) => r.vehicleId === focus.id) ?? null : null;

  // Queue timeline snapshots
  const queueTimeline = getQueueTimeline();

  // Wall-screen scaling: zoom the .v2 element itself. `zoom` on the <html>
  // root is unreliable in current Chrome (standardized zoom ignores it),
  // which is why /ops rendered microscopic on large displays. A JS-computed
  // factor on a normal element is honored everywhere. All fonts inside the
  // Axiom block are fixed px, so zoom is the single scale mechanism.
  const [opsScale, setOpsScale] = useState(() => computeOpsScale());
  const [isCompact, setIsCompact] = useState(() => shouldUseCompactOps());
  useEffect(() => {
    const onResize = () => {
      setOpsScale(computeOpsScale());
      setIsCompact(shouldUseCompactOps());
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const [isTelemetryModalOpen, setIsTelemetryModalOpen] = useState(false);
  const [isGpsActive, setIsGpsActive] = useState(() => isLiveGpsActive());
  const [liveGpsCount, setLiveGpsCount] = useState(0);

  useEffect(() => {
    const checkGps = () => {
      setIsGpsActive(isLiveGpsActive());
      setLiveGpsCount(getLiveTelemetryVehicles().size);
    };
    checkGps();
    const interval = setInterval(checkGps, 1500);
    return () => clearInterval(interval);
  }, []);

  const handleViewModeChange = (next: Exclude<ViewMode, "live">) => {
    setViewMode(next);
    const url = new URL(window.location.href);
    if (next === "operations") url.searchParams.delete("view");
    else url.searchParams.set("view", next);
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  };

  // ── The heartbeat: rAF loop + failsafe, two cadences ───────────────────
  // Per frame (~60fps): read the continuous clock ONCE, then drive the two
  // must-be-smooth surfaces imperatively from that single minute — the map
  // markers (road-snapped, no teleport) and the money/pax refs (smooth climb,
  // no 1.2s Counter lag). Buses and money share the one cached minute so they
  // can never desync. Coarse work (the analytic panels) is gated to ~4Hz
  // inside the same loop — they only change on hour/flight boundaries.
  //
  // A coarse setInterval failsafe runs alongside rAF and only does real work
  // if rAF hasn't ticked in >150ms — a live wall display must never silently
  // freeze if rAF is throttled (occluded window, embedded/kiosk browser
  // quirks). Zero overhead when rAF is healthy (the common case).
  useEffect(() => {
    let raf = 0;
    let lastFrameT = -1;
    let lastCoarseMs = 0;
    let lastFrameMs = 0;
    let stopped = false;

    const writeFrame = (t: number) => {
      const totals = getLiveTotals(t);
      const vehicles = getMapVehicles(t);
      mapRef.current?.syncNow(vehicles);
      const moving = vehicles.filter((v) => v.status === "moving").length;

      if (clockRef.current) clockRef.current.textContent = formatClockLabel(t);

      if (revEarnedRef.current) revEarnedRef.current.textContent = `฿${totals.revenueThb.toLocaleString()}`;
      if (revLostRef.current) revLostRef.current.textContent = `−฿${totals.lostRevenueThb.toLocaleString()}`;
      if (revMeterRef.current) {
        const denom = totals.revenueThb + totals.lostRevenueThb;
        revMeterRef.current.style.width = denom > 0 ? `${(totals.revenueThb / denom) * 100}%` : "0%";
      }
      if (paxRef.current) paxRef.current.textContent = totals.paxDelivered.toLocaleString();
      if (tripsRef.current) tripsRef.current.textContent = totals.tripsCompleted.toLocaleString();
      if (kmRef.current) kmRef.current.textContent = totals.kmDriven.toLocaleString();
      if (co2Ref.current) co2Ref.current.textContent = totals.co2SavedKg.toLocaleString();
      if (demandQueueRef.current) demandQueueRef.current.textContent = totals.waiting.toLocaleString();
      if (supplyRollingRef.current) supplyRollingRef.current.textContent = moving.toLocaleString();
      if (walkedRef.current) walkedRef.current.textContent = totals.paxAbandoned.toLocaleString();
    };

    const runFrame = () => {
      lastFrameMs = performance.now();
      const t = getSimulatedMinutes(); // the single mutate-and-advance per frame
      if (t !== lastFrameT) {
        lastFrameT = t;
        writeFrame(t);
        if (lastFrameMs - lastCoarseMs >= 250) {
          lastCoarseMs = lastFrameMs;
          setState(computeSimState());
          setMetrics(getHeadlineMetrics());
          setClockState(getClockState());
        }
      }
    };

    const tick = () => {
      if (stopped) return;
      runFrame();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const heartbeat = setInterval(() => {
      if (stopped) return;
      if (performance.now() - lastFrameMs > 150) runFrame();
    }, 150);

    // A backgrounded tab pauses rAF; on return, re-anchor the clock so it does
    // not leap by hidden-duration × speed (which would teleport every bus once).
    const onVisible = () => {
      if (document.visibilityState === "visible") resetClockAnchor();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return (
    <div className={`v2 v2--${viewMode}`} style={{ zoom: opsScale }}>
      {/* Actionable Intelligence Banner — numbers from the engine, not vibes */}
      {serviceGap > 25 && (
        <div className="v2-alert-banner">
          <span className="v2-alert-banner__icon">⚠</span>
          <div className="v2-alert-banner__content">
            <strong>{serviceGap.toLocaleString()} people in the airport queue now.</strong>
            <span>
              {standbyBusesNeeded} standby {standbyBusesNeeded === 1 ? "bus" : "buses"} would clear it
              {state.paxAbandoned > 0 && ` · ${state.paxAbandoned.toLocaleString()} already walked away today, ฿${state.lostRevenueThb.toLocaleString()} lost to Grab`}.
            </span>
          </div>
        </div>
      )}

      <header className="v2-header">
        <div className="v2-header__brand">
          <span className="v2-header__eyebrow">
            <span className="v2-header__eyebrow-full">Investor &amp; Ops Console</span>
            <span className="v2-header__eyebrow-compact">Investor Ops</span>
          </span>
          <h1>Phuket Smart Bus</h1>
          <span className="v2-header__sub">Fund the right hour · cut SOVs · bank avoided CO₂ as evidence</span>
        </div>
        <div className="v2-header__story">
          {currentBalance ? (
            <>
              <span className="v2-header__story-row">
                <span className="v2-header__story-label">This hour</span>
                <strong className="v2-header__story-value">
                  {(currentBalance.busEligiblePax + currentBalance.outEligiblePax).toLocaleString()} riders want a bus
                </strong>
                <span className={`v2-header__story-status v2-header__story-status--${currentBalance.status}`}>
                  {currentBalance.busesToAdd > 0
                    ? `ADD ${currentBalance.busesToAdd} BUS${currentBalance.busesToAdd === 1 ? "" : "ES"}`
                    : currentBalance.status === "surplus" ? "SEATS TO SPARE" : "COVERED"}
                </span>
              </span>
              <span className="v2-header__story-row">
                <span className="v2-header__story-detail">
                  {(currentBalance.busSeats + currentBalance.outSeats).toLocaleString()} seats on the timetable
                  {" · "}{currentBalance.busEligiblePax.toLocaleString()} leaving the airport, {currentBalance.outEligiblePax.toLocaleString()} heading to it
                </span>
                {hourPeaks.worstShortfallHour != null && hourPeaks.worstShortfallGap > 0 && (
                  <span className="v2-header__story-detail v2-header__story-peak">
                    · worst hour {String(hourPeaks.worstShortfallHour).padStart(2, "0")}:00, {hourPeaks.worstShortfallGap} short
                  </span>
                )}
              </span>
            </>
          ) : (
            <strong className="v2-header__story-value">{state.paxAtAirport} waiting · {responsePct}% capture</strong>
          )}
        </div>
        <nav className="v2-mode-toggle" aria-label="Dashboard views" role="tablist">
          <button
            className={`v2-mode-btn ${viewMode === 'operations' || viewMode === 'live' ? 'is-active' : ''}`}
            onClick={() => handleViewModeChange('operations')}
            role="tab"
            aria-selected={viewMode === 'operations' || viewMode === 'live'}
          >OPS</button>
          <button
            className={`v2-mode-btn ${viewMode === 'insights' ? 'is-active' : ''}`}
            onClick={() => handleViewModeChange('insights')}
            role="tab"
            aria-selected={viewMode === 'insights'}
          >INSIGHTS</button>
          <button
            className={`v2-mode-btn ${viewMode === 'toolkit' ? 'is-active' : ''}`}
            onClick={() => handleViewModeChange('toolkit')}
            role="tab"
            aria-selected={viewMode === 'toolkit'}
          >TOOLKIT</button>
        </nav>
        {/* One clock, one state — the audit's §4D. Day + time + speed + play/pause
            in a single chip. No more four-row decode; one read, one truth. */}
        <div className={`v2-header__clock ${clockState.mode === "live" ? "is-live" : ""}`} role="status" aria-live="off">
          <span className="v2-header__live" aria-hidden="true" />
          <span className="v2-header__mode">{clockState.mode === "live" ? "LIVE" : "REPLAY"}</span>
          <span className="v2-header__day">{getDayInfo().label}</span>
          <span className="v2-header__time" ref={clockRef}>{initFrame.clock}</span>
          <span className="v2-header__speed">
            {clockState.mode === "live" ? "real time" : clockState.mode === "paused" ? "paused" : clockState.sweep ? "whole day" : `${clockState.speed}×`}
          </span>
        </div>

        {/* Live GPS Telemetry Status Pill */}
        <button
          type="button"
          className={`v2-header__telemetry-pill ${isGpsActive ? "is-live" : "is-sim"}`}
          onClick={() => setIsTelemetryModalOpen(true)}
          title="Click to inspect Live GPS Telemetry Console or test live hardware ingestion"
        >
          <span className="v2-telemetry-dot" />
          <span>{isGpsActive ? `LIVE GPS (${liveGpsCount})` : "TIMETABLE SIM"}</span>
        </button>

        {/* Time Bar & Simulation controls */}
        <SimulationControls
          clockState={clockState}
          onClockStateChange={setClockState}
          simDay={simDay}
          onDayChange={handleDayChange}
          onStartDaySweep={handleStartDaySweep}
          onGoLive={handleGoLive}
        />
      </header>

      {viewMode === 'toolkit' ? (
        // TOOLKIT view — the research this console was built to serve
        <ToolkitPanel
          clockLabel={state.clockLabel}
          flightsLanded={state.landedFlights.length}
          arrivingPax={state.totalArrPax}
          likelyRiders={state.paxWantBus}
          boarded={state.paxBoarded}
          waiting={state.paxAtAirport}
          walkedAway={state.paxAbandoned}
          revenueThb={state.revenueThb}
          missedThb={state.lostRevenueThb}
          movingBuses={metrics.fleet.movingBuses}
          onOpenSystem={() => handleViewModeChange('operations')}
        />
      ) : viewMode === 'insights' ? (
        // INSIGHTS view — one-screen bridge from toolkit evidence to decision
        <main className="v2-body v2-body--insights">
          <InsightsSummaryPanel
            rows={hourlyBalance}
            points={queueTimeline}
            currentWaiting={state.paxAtAirport}
          />
          <section className="v2-insights-main">
            <InsightsTimeline points={queueTimeline} simMinutes={state.simMinutes} />
            <HourlyBalanceChart rows={hourlyBalance} simMinutes={state.simMinutes} mode="priority" />
          </section>
        </main>
      ) : isCompact ? (
        <OpsBriefing
          mapRef={mapRef}
          waiting={state.paxAtAirport}
          movingBuses={metrics.fleet.movingBuses}
          boarded={state.paxBoarded}
          abandoned={state.paxAbandoned}
          earnedThb={state.revenueThb}
          lostThb={state.lostRevenueThb}
          currentDemandPax={currentDemandPax}
          currentBusDemand={currentBusDemand}
          currentSupplySeats={currentSupplySeats}
          standbyBuses={standbyBusesNeeded}
          nextDeparture={state.nextDeparture}
          hourlyBalance={hourlyBalance}
        />
      ) : (
        // OPERATIONS view — demand | map | supply. Three columns, three questions:
        // who is landing, where are the buses, how long is the wait.
        <main className="v2-body v2-body--operations ax-ops">
          <section className="ax-col ax-col--demand">
            <ArrivalsBoard
              flights={dailyFlights}
              simMinutes={state.simMinutes}
              simDay={simDay}
              live={clockState.mode === "live"}
            />
          </section>

          <section className="ax-col ax-col--map v2-map">
            <div className="v2-map__hero">
              <div className="v2-map__hero-card">
                <span className="v2-map__hero-label">Waiting at the airport curb</span>
                <strong className="v2-map__hero-value" ref={demandQueueRef}>{initFrame.tot.waiting.toLocaleString()}</strong>
                <span className="v2-map__hero-detail">
                  {state.nextDeparture !== null ? `next bus boards in ${state.nextDeparture} min · takes 25` : "no more departures today"}
                </span>
              </div>
              <div className="v2-map__hero-card">
                <span className="v2-map__hero-label">Buses on the road</span>
                <strong className="v2-map__hero-value" ref={supplyRollingRef}>{initFrame.moving.toLocaleString()}</strong>
                <span className="v2-map__hero-detail">of {metrics.fleet.totalBuses} in service · {metrics.now.avgLoadPct}% average load</span>
              </div>
              <div className="v2-map__hero-card v2-map__hero-card--warn">
                <span className="v2-map__hero-label">Walked away today</span>
                <strong className="v2-map__hero-value" ref={walkedRef}>{initFrame.tot.paxAbandoned.toLocaleString()}</strong>
                <span className="v2-map__hero-detail">gave up after 60 min · ฿{state.lostRevenueThb.toLocaleString()} to Grab</span>
              </div>
            </div>
            <div className="v2-map__stage">
              <V2LiveMap
                ref={mapRef}
                onFocusVehicle={handleFocusVehicle}
                focusedVehicleId={focus.id}
                onOpenTelemetryModal={() => setIsTelemetryModalOpen(true)}
              />
              <BusPlanPanel
                row={focusedRow}
                pinned={focus.pinned}
                onClose={() => setFocus({ id: null, pinned: false })}
              />
            </div>
            <ConditionsLine />
          </section>

          <section className="ax-col ax-col--supply">
            <NextBusBoard
              simMinutes={state.simMinutes}
              live={clockState.mode === "live"}
              focusedVehicleId={focus.id}
              onFocusVehicle={handleFocusVehicle}
            />
            <OperatorFleetPanel rows={operatorRows} waitingAtCurb={state.paxAtAirport} />
          </section>
        </main>
      )}

      <footer className="v2-footer">
        {/* Accumulator bar. The streaming cells (trips/km/pax/money/CO₂) render
            STATIC opening placeholders and are ref-written by the rAF loop each
            frame — never re-bound to React state, so the 4Hz coarse re-render
            can't clobber the buttery live numbers. Buses Now / Avg Load stay
            React-bound (they change slowly, coarse cadence is imperceptible). */}
        <div className="v2-accum">
          <div className="v2-accum__item">
            <span className="v2-accum__val"><Counter value={metrics.fleet.totalBuses} /></span>
            <span className="v2-accum__label">Buses Now</span>
          </div>
          <div className="v2-accum__item">
            <span className="v2-accum__val" ref={tripsRef}>{initFrame.tot.tripsCompleted.toLocaleString()}</span>
            <span className="v2-accum__label">Trips Today</span>
          </div>
          <div className="v2-accum__item">
            <span className="v2-accum__val" ref={kmRef}>{initFrame.tot.kmDriven.toLocaleString()}</span>
            <span className="v2-accum__label">Km Today</span>
          </div>
          <div className="v2-accum__item v2-accum__item--accent">
            <span className="v2-accum__val" ref={paxRef}>{initFrame.tot.paxDelivered.toLocaleString()}</span>
            <span className="v2-accum__label">Pax Delivered</span>
          </div>
          {/* The money on both sides of the bar: earned climbing against
              walked-away-to-capacity. Two accents only (green / amber), a
              hairline proportion meter — §11/§14 compliant. */}
          <div className="v2-accum__item v2-accum__item--twin">
            <span className="v2-accum__twin">
              <span className="v2-accum__earned" ref={revEarnedRef}>฿{initFrame.tot.revenueThb.toLocaleString()}</span>
              <span className="v2-accum__lost"><span ref={revLostRef}>−฿{initFrame.tot.lostRevenueThb.toLocaleString()}</span> walked away</span>
            </span>
            <span className="v2-accum__meter"><span className="v2-accum__meter-fill" ref={revMeterRef} /></span>
            <span className="v2-accum__label">Money on the table</span>
          </div>
          <div className="v2-accum__item v2-accum__item--green">
            <span className="v2-accum__val"><span ref={co2Ref}>{initFrame.tot.co2SavedKg.toLocaleString()}</span> kg</span>
            <span className="v2-accum__label">CO₂ Saved</span>
          </div>
          <div className="v2-accum__item">
            <span className="v2-accum__val">{metrics.now.avgLoadPct}%</span>
            <span className="v2-accum__label">Avg Load</span>
          </div>
        </div>
      </footer>

      <TelemetryStatusModal
        isOpen={isTelemetryModalOpen}
        onClose={() => setIsTelemetryModalOpen(false)}
      />
    </div>
  );
}

/** One quiet line of context under the map: weather, sea flag, air. The full
 *  conditions strip lives in the phone briefing; on the wall it was fighting
 *  the map for attention. */
function ConditionsLine() {
  const env = useMemo(() => getEnvironmentSnapshot(), []);
  const flag = (env.maritimeFlag ?? "green").toUpperCase();
  return (
    <div className="ax-conditions" role="status">
      <span><b>{env.tempC.toFixed(0)}°C</b> {env.conditionLabel} · rain {env.rainProb}%</span>
      <span className={`ax-conditions__sea is-${env.maritimeFlag ?? "green"}`}><i /> Sea {flag} FLAG · waves {env.waveHeightM ?? 1.1} m</span>
      <span>AQI <b>{env.aqi}</b></span>
      <span className="ax-conditions__road">{env.roadConditionLabel ?? "Roads normal"}</span>
    </div>
  );
}
