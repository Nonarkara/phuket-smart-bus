/**
 * VegasPhuketSimulator — interactive comparative corridor simulator.
 *
 * Plugs directly into Chapter 2 (Vegas Demand Case).
 * Compares the Las Vegas Strip (RTC The Deuce) and the Phuket Coastal Strip (PKSB).
 * Lets a reader or transit planner experiment with the variables that made
 * Vegas's Deuce generate US$6M annual profit: 24/7 headways and high-capacity
 * vehicles, vs Phuket's current 45-60 min gaps and 25-seat minibuses.
 */

import { useMemo, useState } from "react";

export function VegasPhuketSimulator() {
  const [headwayMin, setHeadwayMin] = useState<number>(30);
  const [vehicleCapacity, setVehicleCapacity] = useState<number>(25);
  const [is24Hours, setIs24Hours] = useState<boolean>(false);

  // Simulation calculations based on corridor dynamics
  const stats = useMemo(() => {
    // Service hours: 16.5 hours (current 06:00-22:30) vs 24 hours
    const serviceHours = is24Hours ? 24 : 16.5;
    const departuresPerDirection = Math.floor((serviceHours * 60) / headwayMin);
    const totalDailySeats = departuresPerDirection * vehicleCapacity * 2; // both directions

    // Base demand in Phuket: ~190 flights/day × ~3,600 daily tourists needing transit
    const potentialDailyDemand = is24Hours ? 4200 : 3500;

    // Load factor and capture based on headway convenience
    // If headway <= 15m, capture is high (80%). If headway >= 60m, capture drops to 30%
    const convenienceMultiplier = headwayMin <= 15 ? 0.85 : headwayMin <= 30 ? 0.65 : headwayMin <= 45 ? 0.45 : 0.32;
    const effectiveDemand = Math.round(potentialDailyDemand * convenienceMultiplier);

    const dailyRiders = Math.min(totalDailySeats, effectiveDemand);
    const dailyMissedRiders = Math.max(0, potentialDailyDemand - dailyRiders);

    // Revenue in THB (฿100 fare)
    const dailyRevenueThb = dailyRiders * 100;
    const annualRevenueThb = dailyRevenueThb * 365;

    // Operating Cost estimation:
    // Fuel, driver shifts, vehicle wear ~ ฿38 per km. 52km route × 2 directions = 104 km per trip
    const costPerTrip = 104 * 38;
    const dailyOperatingCost = departuresPerDirection * 2 * costPerTrip;
    const annualOperatingCost = dailyOperatingCost * 365;

    // Farebox recovery %
    const fareboxRecoveryPct = Math.round((annualRevenueThb / dailyOperatingCost / 365) * 100);

    // Car/Grab trips diverted off the road
    const divertedCarTrips = Math.round(dailyRiders * 0.72);

    return {
      departuresPerDirection,
      totalDailySeats,
      dailyRiders,
      dailyMissedRiders,
      annualRevenueThb,
      annualOperatingCost,
      fareboxRecoveryPct,
      divertedCarTrips
    };
  }, [headwayMin, vehicleCapacity, is24Hours]);

  return (
    <section className="vps-simulator" aria-labelledby="vps-title">
      <header className="vps-head">
        <span className="tk-kicker">Interactive Experiment · Chapter 2 Simulator</span>
        <h3 id="vps-title">What If Phuket Adopted Las Vegas Strip Transit Tactics?</h3>
        <p className="vps-subtitle">
          The Las Vegas Deuce generated <strong>US$6M in annual operating profit</strong> on the Strip by running
          every 12–15 minutes around the clock with 80-passenger double-deckers. Phuket currently runs 25-seat minibuses
          every 45–60 minutes. Drag the levers below to see what happens when service frequency and capacity change:
        </p>
      </header>

      {/* Control Levers */}
      <div className="vps-controls">
        {/* Headway / Frequency */}
        <div className="vps-control">
          <label className="vps-control__label">
            <span>Service Frequency (Headway)</span>
            <strong>Every {headwayMin} minutes</strong>
          </label>
          <div className="vps-pill-group">
            {[15, 20, 30, 45, 60].map((m) => (
              <button
                key={m}
                type="button"
                className={`vps-pill ${headwayMin === m ? "is-active" : ""}`}
                onClick={() => setHeadwayMin(m)}
              >
                {m}m
              </button>
            ))}
          </div>
        </div>

        {/* Vehicle Capacity */}
        <div className="vps-control">
          <label className="vps-control__label">
            <span>Vehicle Type & Capacity</span>
            <strong>{vehicleCapacity === 25 ? "25 Seats (Current Minibus)" : vehicleCapacity === 50 ? "50 Seats (Standard City Bus)" : "80 Seats (Vegas Double-Decker)"}</strong>
          </label>
          <div className="vps-pill-group">
            {[
              { cap: 25, label: "25-Seat Minibus" },
              { cap: 50, label: "50-Seat City Bus" },
              { cap: 80, label: "80-Seat Double-Decker" }
            ].map((v) => (
              <button
                key={v.cap}
                type="button"
                className={`vps-pill ${vehicleCapacity === v.cap ? "is-active" : ""}`}
                onClick={() => setVehicleCapacity(v.cap)}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* Night Hours Toggle */}
        <div className="vps-control">
          <label className="vps-control__label">
            <span>Operating Window</span>
            <strong>{is24Hours ? "24/7 All-Night (Vegas Style)" : "Daytime Only (06:00 – 22:30)"}</strong>
          </label>
          <div className="vps-pill-group">
            <button
              type="button"
              className={`vps-pill ${!is24Hours ? "is-active" : ""}`}
              onClick={() => setIs24Hours(false)}
            >
              Daytime (06:00–22:30)
            </button>
            <button
              type="button"
              className={`vps-pill ${is24Hours ? "is-active" : ""}`}
              onClick={() => setIs24Hours(true)}
            >
              24/7 Night Flights Covered
            </button>
          </div>
        </div>
      </div>

      {/* Dynamic Results Grid */}
      <div className="vps-results">
        <div className="vps-kpi">
          <span className="vps-kpi__label">Daily Ridership</span>
          <strong className="vps-kpi__value">{stats.dailyRiders.toLocaleString()} pax/day</strong>
          <small className="vps-kpi__sub">
            {stats.dailyMissedRiders > 0
              ? `${stats.dailyMissedRiders.toLocaleString()} lost to Grab/taxis`
              : "Zero unmet corridor demand"}
          </small>
        </div>

        <div className="vps-kpi">
          <span className="vps-kpi__label">Annual Farebox Revenue</span>
          <strong className="vps-kpi__value is-gain">฿{(stats.annualRevenueThb / 1_000_000).toFixed(1)}M/year</strong>
          <small className="vps-kpi__sub">
            (≈ US${(stats.annualRevenueThb / 35_000_000).toFixed(2)}M)
          </small>
        </div>

        <div className="vps-kpi">
          <span className="vps-kpi__label">Farebox Recovery Ratio</span>
          <strong className={`vps-kpi__value ${stats.fareboxRecoveryPct >= 100 ? "is-gain" : "is-warn"}`}>
            {stats.fareboxRecoveryPct}%
          </strong>
          <small className="vps-kpi__sub">
            {stats.fareboxRecoveryPct >= 100 ? "Profitable without subsidy" : "Requires municipal support"}
          </small>
        </div>

        <div className="vps-kpi">
          <span className="vps-kpi__label">Car Trips Diverted</span>
          <strong className="vps-kpi__value">{stats.divertedCarTrips.toLocaleString()} cars/day</strong>
          <small className="vps-kpi__sub">Relieving Patong hill & bypass traffic</small>
        </div>
      </div>

      <div className="vps-takeaway">
        <strong>The Policy Lesson:</strong> Frequency creates its own demand. At 15-minute headways, travelers stop looking at schedules and just walk to the stop—just as they do in Las Vegas. At 60-minute headways, any delay pushes passengers directly into private taxis.
      </div>
    </section>
  );
}
