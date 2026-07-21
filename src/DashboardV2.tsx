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
import type { VehiclePosition } from "@shared/types";
import {
  computeSimState,
  getDayInfo,
  getHourlyDemandSupply,
  getLiveTotals,
  type SimState
} from "./engine/simulation";
import { getVehiclesNow } from "./engine/dataProvider";
import {
  getClockState,
  getFleetAnalysis,
  getSimulatedMinutes,
  setSimulatedMinutes,
  resetClockAnchor,
  startDaySweep,
  SERVICE_START,
} from "./engine/fleetSimulator";
import {
  buildFlightHourBuckets,
  getOpsFlightSchedule,
  getSimulationDay,
  setSimulationDay
} from "./engine/opsFlightSchedule";
import { getHeadlineMetrics } from "./engine/headlineMetrics";
import { getDayModel, getReturnTripLoad } from "./engine/demandSupplyEngine";
import { getHourlyBalance, getOperatorFleet, getQueueTimeline, getHourPeaks } from "./engine/v2OpsPanel";
import { Counter } from "./components/v2/V2Shared";
import { V2LiveMap, type V2MapHandle } from "./components/v2/V2LiveMap";
import { SimulationControls } from "./components/v2/SimulationControls";
import { DemandPanel } from "./components/v2/DemandPanel";
import { SupplyPanel } from "./components/v2/SupplyPanel";
import { HourlyBalanceChart } from "./components/v2/HourlyBalanceChart";
import { OperatorFleetPanel } from "./components/v2/OperatorFleetPanel";
import { InsightsTimeline } from "./components/v2/InsightsTimeline";
import { InsightsSummaryPanel } from "./components/v2/InsightsSummaryPanel";
import { ToolkitPanel } from "./components/v2/ToolkitPanel";
import { OpsBriefing } from "./components/v2/OpsBriefing";

type ViewMode = "operations" | "insights" | "toolkit" | "live";

function getInitialViewMode(): ViewMode {
  if (typeof window === "undefined") return "operations";
  const requested = new URLSearchParams(window.location.search).get("view");
  return requested === "insights" || requested === "toolkit" ? requested : "operations";
}

/** Join a fleet vehicle to the demand-supply engine's per-trip boarding count.
 *
 *  Airport-bound trips ("Bus to Rawai" departs FROM the airport) carry the
 *  engine's exact FIFO-queue load for that departure. Other directions and
 *  the local lines carry a deterministic local-ridership estimate (they don't
 *  serve the airport queue). No more plate-matching fallbacks. */
function vehiclePax(v: VehiclePosition): number {
  if (v.routeId === "rawai-airport" && v.tripStartMin != null) {
    if (v.directionLabel === "Bus to Rawai") {
      // Southbound: the engine's exact FIFO-queue load for this departure.
      const fromCache = getDayModel().trips.find((t) => Math.abs(t.depMin - v.tripStartMin!) <= 2);
      if (fromCache) return fromCache.boarded;
    } else if (v.directionLabel === "Bus to Airport") {
      // Northbound: departing pax the return-leg engine put on this trip.
      const load = getReturnTripLoad(v.tripStartMin);
      if (load !== null) return load;
    }
  }
  // Local lines: deterministic estimate from the trip hash
  const cap = v.routeId === "dragon-line" ? 15 : 25;
  const occ = v.routeId === "patong-old-bus-station" ? 0.42 : v.routeId === "dragon-line" ? 0.31 : 0.35;
  const seed = (v.tripStartMin ?? 0) % 7; // -3..+3 pax variation per trip
  return Math.max(0, Math.round(cap * occ) + (seed - 3));
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

function formatClockLabel(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = Math.floor(min % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} BKK`;
}

function toMapVehicle(v: VehiclePosition): SimState["vehicles"][number] {
  return {
    id: v.vehicleId,
    lat: v.coordinates[0],
    lng: v.coordinates[1],
    heading: v.heading,
    status: v.status === "moving" ? "moving" : "dwelling",
    route: v.routeId,
    pax: vehiclePax(v),
    plate: v.licensePlate
  };
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
      moving: getVehiclesNow(undefined, t).filter((v) => v.status === "moving").length,
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
    setSimDayState(dow);
    setState(computeSimState());
    setClockState(getClockState());
  };

  // One-touch cinematic: sweep the whole service day in ~60s, then freeze.
  const handleStartDaySweep = () => {
    startDaySweep();
    setClockState(getClockState());
  };

  const arrivalsToday = dailyFlights.filter((flight) => flight.type === "arr");
  const departuresToday = dailyFlights.filter((flight) => flight.type === "dep");
  const currentHourBucket = hourlyFlights[Math.floor(state.simMinutes / 60) % 24] ?? hourlyFlights[0];
  const nextIncomingFlight = arrivalsToday.find((flight) => flight.schedMin >= state.simMinutes) ?? arrivalsToday.at(-1) ?? null;
  const nextPeakBucket = hourlyFlights
    .filter((bucket) => bucket.hour >= Math.floor(state.simMinutes / 60) && bucket.arrivalPax > 0)
    .sort((left, right) => right.arrivalPax - left.arrivalPax)[0] ?? currentHourBucket;
  const responsePct = state.paxWantBus > 0 ? Math.round((state.paxBoarded / state.paxWantBus) * 100) : 100;
  // Honest split: "waiting" is the queue RIGHT NOW; "walked away" is
  // cumulative abandonment. The old serviceGap (demand − boarded) summed
  // both into one fake "waiting" number.
  const serviceGap = state.paxAtAirport;
  const standbyBusesNeeded = Math.ceil(serviceGap / 25);
  const currentDemandPax = currentHourBucket?.arrivalPax ?? 0;
  const currentDeparturePax = currentHourBucket?.departurePax ?? 0;

  // Hourly demand-supply balance rows. Memoized by the engine.
  const hourlyBalance = getHourlyBalance();
  const currentBalance = hourlyBalance[Math.floor(state.simMinutes / 60) % 24];
  const hourPeaks = getHourPeaks();

  // Schedule-derived fleet metrics — LAND routes only. Ferry vessels are
  // not buses; counting them produced "74 buses required" absurdity.
  const LAND_ROUTES = new Set(["rawai-airport", "patong-old-bus-station", "dragon-line"]);
  const fleetAnalysis = useFleetAnalysis(LAND_ROUTES);
  const totalBusesRequired = fleetAnalysis.reduce((s, r) => s + r.requiredBuses, 0);
  const currentHourly = getHourlyDemandSupply()[Math.floor(state.simMinutes / 60) % 24];
  const currentSupplySeats = currentHourly?.busSeatsAvailable ?? 0;
  const currentBusDemand = currentHourly?.busDemandPax ?? 0;
  const currentGap = Math.max(0, currentBusDemand - currentSupplySeats);
  const gapStatus = currentGap > 20 ? "shortfall" : currentGap > 0 ? "tight" : "surplus";

  // Per-vehicle operations panel rows
  const operatorRows = getOperatorFleet();

  // Queue timeline snapshots
  const queueTimeline = getQueueTimeline();

  // Wall-screen scaling: zoom the .v2 element itself. `zoom` on the <html>
  // root is unreliable in current Chrome (standardized zoom ignores it),
  // which is why /ops rendered microscopic on large displays. A JS-computed
  // factor on a normal element is honored everywhere. All fonts inside the
  // Axiom block are fixed px, so zoom is the single scale mechanism.
  const [opsScale, setOpsScale] = useState(() => computeOpsScale());
  const [isCompact, setIsCompact] = useState(() =>
    typeof window !== "undefined" && window.innerWidth < 1180
  );
  useEffect(() => {
    const onResize = () => {
      setOpsScale(computeOpsScale());
      setIsCompact(window.innerWidth < 1180);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
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
      const vehicles = getVehiclesNow(undefined, t).map(toMapVehicle);
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
        <div className="v2-alert-banner" style={{ background: '#fff3cd', color: '#7a5700', borderBottom: '1px solid #e8d49a' }}>
          <span className="v2-alert-banner__icon" style={{ color: '#c47a0f' }}>⚠</span>
          <div className="v2-alert-banner__content">
            <strong>
              {serviceGap.toLocaleString()} pax in the airport queue now
              {state.paxAbandoned > 0 && ` · ${state.paxAbandoned.toLocaleString()} already walked away today (฿${state.lostRevenueThb.toLocaleString()} lost)`}.
            </strong>
            <span>Next departure absorbs 25. Dispatching {standbyBusesNeeded} standby buses would clear the current queue.</span>
          </div>
        </div>
      )}

      <header className="v2-header">
        <div className="v2-header__brand">
          <span className="v2-header__eyebrow">
            <span className="v2-header__eyebrow-full">Airport Ops Console</span>
            <span className="v2-header__eyebrow-compact">Airport Ops</span>
          </span>
          <h1>Phuket Smart Bus</h1>
          <span className="v2-header__sub">Demand-Supply Intelligence</span>
        </div>
        <div className="v2-header__story">
          <span className="v2-header__story-label">Right now</span>
          <strong className="v2-header__story-value">
            {currentDemandPax.toLocaleString()} arriving pax this hour
          </strong>
          <span className="v2-header__story-detail">
            {currentBalance
              ? <>Bus pool {currentBalance.busEligiblePax} · seats {currentBalance.busSeats} · <span className={`v2-header__story-status v2-header__story-status--${currentBalance.status}`}>
                  {currentBalance.status.toUpperCase()}
                  {currentBalance.gapPax !== 0 && (currentBalance.gapPax > 0 ? ` −${currentBalance.gapPax}` : ` +${-currentBalance.gapPax}`)}
                </span>
              </>
              : `${state.paxAtAirport} waiting · ${responsePct}% capture`}
          </span>
          {hourPeaks.worstShortfallHour != null && hourPeaks.worstShortfallGap > 0 && (
            <span className="v2-header__story-detail">
              Peak shortfall {hourPeaks.worstShortfallGap} pax @ {String(hourPeaks.worstShortfallHour).padStart(2, "0")}:00
            </span>
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
        <div className="v2-header__clock">
          <span className="v2-header__live">●</span>
          <span className="v2-header__day">{getDayInfo().label}</span>
          <span className="v2-header__time" ref={clockRef}>{initFrame.clock}</span>
          <span className="v2-header__speed">{clockState.speed}× {clockState.mode === 'playing' ? '▶' : '⏸'}</span>
        </div>

        {/* Time Bar & Simulation controls */}
        <SimulationControls
          clockState={clockState}
          onClockStateChange={setClockState}
          simDay={simDay}
          onDayChange={handleDayChange}
          onStartDaySweep={handleStartDaySweep}
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
        // OPERATIONS view — three columns, fleet panel under map
        <main className="v2-body">
          <DemandPanel
            state={state}
            serviceGap={serviceGap}
            currentDemandPax={currentDemandPax}
            nextIncomingFlight={nextIncomingFlight}
            nextPeakBucket={nextPeakBucket}
            hourlyFlights={hourlyFlights}
            dailyFlights={dailyFlights}
            hourlyBalance={hourlyBalance}
          />

          <section className="v2-map">
            <div className="v2-map__hero">
              <div className="v2-map__hero-card">
                <span className="v2-map__hero-label">Demand Queue</span>
                <strong className="v2-map__hero-value" ref={demandQueueRef}>{initFrame.tot.waiting.toLocaleString()}</strong>
                <span className="v2-map__hero-detail">waiting at airport curb</span>
              </div>
              <div className="v2-map__hero-card">
                <span className="v2-map__hero-label">Supply Rolling</span>
                <strong className="v2-map__hero-value" ref={supplyRollingRef}>{initFrame.moving.toLocaleString()}</strong>
                <span className="v2-map__hero-detail">buses moving now</span>
              </div>
              <div className="v2-map__hero-card">
                <span className="v2-map__hero-label">Walked Away</span>
                <strong className="v2-map__hero-value" ref={walkedRef}>{initFrame.tot.paxAbandoned.toLocaleString()}</strong>
                <span className="v2-map__hero-detail">gave up after 60 min queue</span>
              </div>
            </div>
            <V2LiveMap ref={mapRef} />
            <div className="v2-map__overlay">
              <span className="v2-map__stat"><Counter value={metrics.fleet.totalBuses} /> buses · <Counter value={metrics.fleet.movingBuses} /> moving</span>
              <span className="v2-map__next">Demand this hour: {currentDemandPax.toLocaleString()} in · {currentDeparturePax.toLocaleString()} out</span>
              {state.nextDeparture !== null && (
                <span className="v2-map__next">Next departure: {state.nextDeparture} min</span>
              )}
            </div>
            {/* The operator fleet table — sits under the map so operators
                see WHERE every bus is while reading the table below. */}
            <OperatorFleetPanel rows={operatorRows} waitingAtCurb={state.paxAtAirport} />
          </section>

          <SupplyPanel
            state={state}
            serviceGap={serviceGap}
            totalBusesRequired={totalBusesRequired}
            inServiceCount={metrics.fleet.totalBuses}
            fleetAnalysisLength={fleetAnalysis.length}
            gapStatus={gapStatus}
            currentSupplySeats={currentSupplySeats}
            currentBusDemand={currentBusDemand}
            currentGap={currentGap}
            onDayChange={handleDayChange}
          />
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Local hook — fleet analysis for the LAND routes only. Splits out of the
// component to keep DashboardV2 main body readable.
// ---------------------------------------------------------------------------
function useFleetAnalysis(landRoutes: Set<string>) {
  const [rows, setRows] = useState(() => getFleetAnalysis().filter((r) => landRoutes.has(r.routeId)));
  useEffect(() => {
    const id = setInterval(
      () => setRows(getFleetAnalysis().filter((r) => landRoutes.has(r.routeId))),
      5000
    );
    return () => clearInterval(id);
  }, [landRoutes]);
  return rows;
}
