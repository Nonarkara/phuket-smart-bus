/**
 * Phuket Smart Bus v2 — One Page, One Story
 *
 * The simulation IS the product. Watch a day unfold:
 * Flights land → Passengers arrive → Buses collect them → Revenue accumulates
 *
 * Every number traces back to the demand-supply chain. Nothing decorative.
 */

import { useEffect, useState } from "react";
import { computeSimState, getDayInfo, getHourlyDemandSupply, type SimState } from "./engine/simulation";
import { getVehiclesNow } from "./engine/dataProvider";
import { getClockState, getFleetAnalysis } from "./engine/fleetSimulator";
import { buildFlightHourBuckets, getOpsFlightSchedule } from "./engine/opsFlightSchedule";
import { getHeadlineMetrics } from "./engine/headlineMetrics";
import { AnalyticsPanel } from "./components/AnalyticsPanel";
import { Counter } from "./components/v2/V2Shared";
import { V2LiveMap } from "./components/v2/V2LiveMap";
import { SimulationControls } from "./components/v2/SimulationControls";
import { DemandPanel } from "./components/v2/DemandPanel";
import { SupplyPanel } from "./components/v2/SupplyPanel";

export default function DashboardV2() {
  const [viewMode, setViewMode] = useState<"sim" | "live">("sim");
  const [state, setState] = useState(() => computeSimState());
  const [metrics, setMetrics] = useState(() => getHeadlineMetrics());
  const [dailyFlights] = useState(() => getOpsFlightSchedule());
  const [hourlyFlights] = useState(() => buildFlightHourBuckets(dailyFlights));
  const [clockState, setClockState] = useState(getClockState());
  const [fleetAnalysis] = useState(() => getFleetAnalysis());
  const [mapVehicles, setMapVehicles] = useState<SimState["vehicles"]>(() => {
    const st = computeSimState();
    return getVehiclesNow().map(v => {
      const simMatch = st.vehicles.find(sv => sv.plate === v.licensePlate);
      return {
        id: v.vehicleId,
        lat: v.coordinates[0],
        lng: v.coordinates[1],
        heading: v.heading,
        status: v.status as "moving" | "dwelling",
        route: v.routeId,
        pax: simMatch ? simMatch.pax : Math.round((v.routeId === "dragon-line" ? 15 : 25) * 0.4),
        plate: v.licensePlate
      };
    });
  });

  const arrivalsToday = dailyFlights.filter((flight) => flight.type === "arr");
  const departuresToday = dailyFlights.filter((flight) => flight.type === "dep");
  const currentHourBucket = hourlyFlights[Math.floor(state.simMinutes / 60) % 24] ?? hourlyFlights[0];
  const nextIncomingFlight = arrivalsToday.find((flight) => flight.schedMin >= state.simMinutes) ?? arrivalsToday.at(-1) ?? null;
  const nextPeakBucket = hourlyFlights
    .filter((bucket) => bucket.hour >= Math.floor(state.simMinutes / 60) && bucket.arrivalPax > 0)
    .sort((left, right) => right.arrivalPax - left.arrivalPax)[0] ?? currentHourBucket;
  const responsePct = state.paxWantBus > 0 ? Math.round((state.paxBoarded / state.paxWantBus) * 100) : 100;
  const serviceGap = Math.max(0, state.paxWantBus - state.paxBoarded);
  const currentDemandPax = currentHourBucket?.arrivalPax ?? 0;
  const currentDeparturePax = currentHourBucket?.departurePax ?? 0;

  // Schedule-derived fleet metrics
  const totalBusesRequired = fleetAnalysis.reduce((s, r) => s + r.requiredBuses, 0);
  const currentHourly = getHourlyDemandSupply()[Math.floor(state.simMinutes / 60) % 24];
  const currentSupplySeats = currentHourly?.busSeatsAvailable ?? 0;
  const currentBusDemand = currentHourly?.busDemandPax ?? 0;
  const currentGap = Math.max(0, currentBusDemand - currentSupplySeats);
  const gapStatus = currentGap > 20 ? "shortfall" : currentGap > 0 ? "tight" : "surplus";

  // Poll simulation state every second
  useEffect(() => {
    const id = setInterval(() => {
      const newState = computeSimState();
      setState(newState);
      setMetrics(getHeadlineMetrics());

      const live = getVehiclesNow();
      setMapVehicles(live.map(v => {
        const simMatch = newState.vehicles.find(sv => sv.plate === v.licensePlate);
        return {
          id: v.vehicleId,
          lat: v.coordinates[0],
          lng: v.coordinates[1],
          heading: v.heading,
          status: v.status as "moving" | "dwelling",
          route: v.routeId,
          pax: simMatch ? simMatch.pax : Math.round((v.routeId === "dragon-line" ? 15 : 25) * 0.4),
          plate: v.licensePlate
        };
      }));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="v2">
      {/* Actionable Intelligence Banner */}
      {serviceGap > 25 && (
        <div className="v2-alert-banner">
          <span className="v2-alert-banner__icon">⚠</span>
          <div className="v2-alert-banner__content">
            <strong>Critical Service Gap: {serviceGap} pax waiting.</strong>
            <span>Recommended action: Dispatch 2 standby buses to Phuket Airport immediately.</span>
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
          ⚠️ <strong>Demand Exceeds Supply:</strong> {serviceGap} passengers are waiting at the airport without sufficient bus capacity. Consider dispatching {Math.ceil(serviceGap / 25)} additional buses to capture ฿{serviceGap * 100} in potential revenue.
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
              <span className="v2-map__hero-label">Live Gap</span>
              <strong className="v2-map__hero-value">{serviceGap}</strong>
              <span className="v2-map__hero-detail">still not boarded</span>
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
