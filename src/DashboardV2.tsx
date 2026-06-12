/**
 * Phuket Smart Bus v2 — One Page, One Story
 *
 * The simulation IS the product. Watch a day unfold:
 * Flights land → Passengers arrive → Buses collect them → Revenue accumulates
 *
 * Every number traces back to the demand-supply chain. Nothing decorative.
 */

import { useEffect, useState } from "react";
import type { VehiclePosition } from "@shared/types";
import { computeSimState, getDayInfo, getHourlyDemandSupply, type SimState } from "./engine/simulation";
import { getVehiclesNow } from "./engine/dataProvider";
import { getClockState, getFleetAnalysis } from "./engine/fleetSimulator";
import { buildFlightHourBuckets, getOpsFlightSchedule } from "./engine/opsFlightSchedule";
import { getHeadlineMetrics } from "./engine/headlineMetrics";
import { getDayModel, getTripLoad } from "./engine/demandSupplyEngine";
import { AnalyticsPanel } from "./components/AnalyticsPanel";
import { Counter } from "./components/v2/V2Shared";
import { V2LiveMap } from "./components/v2/V2LiveMap";
import { SimulationControls } from "./components/v2/SimulationControls";
import { DemandPanel } from "./components/v2/DemandPanel";
import { SupplyPanel } from "./components/v2/SupplyPanel";

/** Join a fleet vehicle to the demand-supply engine's per-trip boarding count.
 *
 *  Airport-bound trips ("Bus to Rawai" departs FROM the airport) carry the
 *  engine's exact FIFO-queue load for that departure. Other directions and
 *  the local lines carry a deterministic local-ridership estimate (they don't
 *  serve the airport queue). No more plate-matching fallbacks. */
function vehiclePax(v: VehiclePosition): number {
  if (v.routeId === "rawai-airport" && v.directionLabel === "Bus to Rawai" && v.tripStartMin != null) {
    const load = getTripLoad(v.tripStartMin);
    if (load !== null) return load;
  }
  // Local lines / return direction: deterministic estimate from the trip hash
  // (stable per trip — no flicker between ticks).
  const cap = v.routeId === "dragon-line" ? 15 : 25;
  const occ = v.routeId === "patong-old-bus-station" ? 0.42 : v.routeId === "dragon-line" ? 0.31 : 0.35;
  const seed = (v.tripStartMin ?? 0) % 7; // -3..+3 pax variation per trip
  return Math.max(0, Math.round(cap * occ) + (seed - 3));
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
  const [viewMode, setViewMode] = useState<"sim" | "live">("sim");
  const [state, setState] = useState(() => computeSimState());
  const [metrics, setMetrics] = useState(() => getHeadlineMetrics());
  const [dailyFlights] = useState(() => getOpsFlightSchedule());
  const [hourlyFlights] = useState(() => buildFlightHourBuckets(dailyFlights));
  const [clockState, setClockState] = useState(getClockState());
  const [fleetAnalysis] = useState(() => getFleetAnalysis());
  const [mapVehicles, setMapVehicles] = useState<SimState["vehicles"]>(() => getVehiclesNow().map(toMapVehicle));

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
  const currentDemandPax = currentHourBucket?.arrivalPax ?? 0;
  const currentDeparturePax = currentHourBucket?.departurePax ?? 0;

  // Schedule-derived fleet metrics — LAND routes only. Ferry vessels are
  // not buses; counting them produced "74 buses required" absurdity.
  const LAND_ROUTES = new Set(["rawai-airport", "patong-old-bus-station", "dragon-line"]);
  const totalBusesRequired = fleetAnalysis
    .filter((r) => LAND_ROUTES.has(r.routeId))
    .reduce((s, r) => s + r.requiredBuses, 0);
  const currentHourly = getHourlyDemandSupply()[Math.floor(state.simMinutes / 60) % 24];
  const currentSupplySeats = currentHourly?.busSeatsAvailable ?? 0;
  const currentBusDemand = currentHourly?.busDemandPax ?? 0;
  const currentGap = Math.max(0, currentBusDemand - currentSupplySeats);
  const gapStatus = currentGap > 20 ? "shortfall" : currentGap > 0 ? "tight" : "surplus";

  // Poll simulation state every second. clockState is included so a pause
  // triggered anywhere (hour-chart click, flight-pulse click) updates the
  // play/pause button without prop drilling.
  useEffect(() => {
    const id = setInterval(() => {
      setState(computeSimState());
      setMetrics(getHeadlineMetrics());
      setMapVehicles(getVehiclesNow().map(toMapVehicle));
      setClockState(getClockState());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="v2">
      {/* Actionable Intelligence Banner — numbers from the engine, not vibes */}
      {serviceGap > 25 && (
        <div className="v2-alert-banner">
          <span className="v2-alert-banner__icon">⚠</span>
          <div className="v2-alert-banner__content">
            <strong>
              {serviceGap.toLocaleString()} pax in the airport queue now
              {state.paxAbandoned > 0 && ` · ${state.paxAbandoned.toLocaleString()} already walked away today (฿${state.lostRevenueThb.toLocaleString()} lost)`}.
            </strong>
            <span>Next departure absorbs 25. Dispatching {Math.min(5, Math.ceil(serviceGap / 25))} standby buses clears the current queue.</span>
          </div>
        </div>
      )}

      <header className="v2-header">
        <div className="v2-header__brand">
          <span className="v2-header__eyebrow">Airport Ops Console</span>
          <h1>Phuket Smart Bus</h1>
          <span className="v2-header__sub">Demand-Supply Intelligence</span>
        </div>
        <div className="v2-header__story">
          <span className="v2-header__story-label">Right now</span>
          <strong className="v2-header__story-value">{currentDemandPax.toLocaleString()} arriving pax this hour</strong>
          <span className="v2-header__story-detail">{state.paxAtAirport} waiting for buses · {responsePct}% boarding capture</span>
        </div>
        <div className="v2-header__clock">
          <div className="v2-mode-toggle">
            <button 
              className={`v2-mode-btn ${viewMode === 'sim' ? 'is-active' : ''}`}
              onClick={() => setViewMode('sim')}
            >SIM</button>
            <button 
              className={`v2-mode-btn ${viewMode === 'live' ? 'is-active' : ''}`}
              onClick={() => setViewMode('live')}
            >LIVE</button>
          </div>
          <span className="v2-header__live">●</span>
          <span className="v2-header__day">{getDayInfo().label}</span>
          <span className="v2-header__time">{state.clockLabel} BKK</span>
          <span className="v2-header__speed">{viewMode === 'sim' ? `${clockState.speed}×` : '1×'} {clockState.mode === 'playing' ? '▶' : '⏸'}</span>
        </div>

        {/* Time Bar & Simulation controls */}
        <SimulationControls clockState={clockState} onClockStateChange={setClockState} />

        <div className="v2-header__meta">
          <span>{arrivalsToday.length} arrivals</span>
          <span>{departuresToday.length} departures</span>
          <span>HKT · {getDayInfo().label} pattern</span>
        </div>
      </header>

      {/* Main grid: left panel + map + right panel */}
      {serviceGap > 25 && (
        <div className="v2-coordination-banner">
          ⚠️ <strong>Demand exceeds supply:</strong> {serviceGap.toLocaleString()} pax queueing now ·
          ฿{(serviceGap * 100).toLocaleString()} on the curb. Engine says +2 well-timed buses
          recover ฿{(getDayModel().whatIf[0]?.gainedRevenueThb ?? 0).toLocaleString()}/day — see "If we had more buses".
        </div>
      )}
      <main className="v2-body">
        {/* Left: Demand side (flights → passengers) */}
        <DemandPanel
          state={state}
          serviceGap={serviceGap}
          currentDemandPax={currentDemandPax}
          nextIncomingFlight={nextIncomingFlight}
          nextPeakBucket={nextPeakBucket}
          hourlyFlights={hourlyFlights}
          dailyFlights={dailyFlights}
        />

        {/* Center: Map */}
        <section className="v2-map">
          <div className="v2-map__hero">
            <div className="v2-map__hero-card">
              <span className="v2-map__hero-label">Demand Queue</span>
              <strong className="v2-map__hero-value">{state.paxAtAirport}</strong>
              <span className="v2-map__hero-detail">waiting at airport curb</span>
            </div>
            <div className="v2-map__hero-card">
              <span className="v2-map__hero-label">Supply Rolling</span>
              <strong className="v2-map__hero-value">{metrics.fleet.movingBuses}</strong>
              <span className="v2-map__hero-detail">buses moving now</span>
            </div>
            <div className="v2-map__hero-card">
              <span className="v2-map__hero-label">Walked Away</span>
              <strong className="v2-map__hero-value">{state.paxAbandoned.toLocaleString()}</strong>
              <span className="v2-map__hero-detail">gave up after 60 min · ฿{state.lostRevenueThb.toLocaleString()} lost</span>
            </div>
          </div>
          <V2LiveMap vehicles={mapVehicles} />
          <div className="v2-map__overlay">
            <span className="v2-map__stat"><Counter value={metrics.fleet.totalBuses} /> buses · <Counter value={metrics.fleet.movingBuses} /> moving</span>
            <span className="v2-map__next">Demand this hour: {currentDemandPax.toLocaleString()} in · {currentDeparturePax.toLocaleString()} out</span>
            {state.nextDeparture !== null && (
              <span className="v2-map__next">Next departure: {state.nextDeparture} min</span>
            )}
          </div>
        </section>

        {/* Right: Supply side (buses → revenue → impact) */}
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
        />
      </main>

      {/* Bottom: Live demand–supply chart paired with the accumulator bar */}
      <footer className="v2-footer">
        <AnalyticsPanel lang="en" />
        <div className="v2-accum">
          <div className="v2-accum__item">
            <span className="v2-accum__val"><Counter value={metrics.fleet.totalBuses} /></span>
            <span className="v2-accum__label">Buses Now</span>
          </div>
          <div className="v2-accum__item">
            <span className="v2-accum__val"><Counter value={state.tripsCompleted} /></span>
            <span className="v2-accum__label">Trips Today</span>
          </div>
          <div className="v2-accum__item">
            <span className="v2-accum__val"><Counter value={state.kmDriven} /></span>
            <span className="v2-accum__label">Km Today</span>
          </div>
          <div className="v2-accum__item v2-accum__item--accent">
            <span className="v2-accum__val"><Counter value={state.paxDelivered} /></span>
            <span className="v2-accum__label">Pax Delivered</span>
          </div>
          <div className="v2-accum__item v2-accum__item--accent">
            <span className="v2-accum__val"><Counter value={state.revenueThb} prefix="฿" /></span>
            <span className="v2-accum__label">Revenue Today</span>
          </div>
          <div className="v2-accum__item v2-accum__item--green">
            <span className="v2-accum__val"><Counter value={state.co2SavedKg} suffix=" kg" /></span>
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
