/**
 * TravelerJourneySimulator — playable tourist experience simulator.
 *
 * Turns abstract demographic and travel behavior models into an interactive,
 * empathetic experience. A reader picks a traveler persona, selects their
 * transport mode (Smart Bus vs Grab vs Minivan), and watches their journey,
 * costs, delays, and friction play out in real time.
 */

import { useState } from "react";

interface Persona {
  id: string;
  name: string;
  badge: string;
  origin: string;
  flightTime: string;
  destination: string;
  paxCount: number;
  luggage: string;
  budgetThb: number;
  motivation: string;
}

const PERSONAS: Persona[] = [
  {
    id: "elena",
    name: "Elena · Solo Backpacker",
    badge: "Solo",
    origin: "Berlin (via Singapore)",
    flightTime: "21:30 (Late Night)",
    destination: "Patong Beach (Hostel)",
    paxCount: 1,
    luggage: "15 kg backpack",
    budgetThb: 500,
    motivation: "Wants affordable, safe transit without getting scammed by unmetered taxis."
  },
  {
    id: "somchai",
    name: "Somchai & Family",
    badge: "Family",
    origin: "Bangkok (Suvarnabhumi)",
    flightTime: "11:15 (Mid-day)",
    destination: "Kata Beach (Resort)",
    paxCount: 4,
    luggage: "3 large suitcases + stroller",
    budgetThb: 1500,
    motivation: "Values convenience and luggage space for young kids and elderly parents."
  },
  {
    id: "chen",
    name: "Chen & Partner",
    badge: "Couple",
    origin: "Chengdu (Direct Charter)",
    flightTime: "14:20 (Peak Afternoon)",
    destination: "Phuket Old Town",
    paxCount: 2,
    luggage: "2 carry-on bags",
    budgetThb: 800,
    motivation: "First time in Thailand; wants easy English/Chinese signage and electronic payment."
  },
  {
    id: "liam",
    name: "Liam · Remote Worker",
    badge: "Nomad",
    origin: "Living in Rawai",
    flightTime: "08:30 (Morning Departure)",
    destination: "Phuket Airport (HKT)",
    paxCount: 1,
    luggage: "1 cabin roller + laptop bag",
    budgetThb: 400,
    motivation: "Frequent flyer doing a visa run; needs predictable arrival time."
  }
];

type TransportMode = "bus" | "grab" | "minivan";

export function TravelerJourneySimulator() {
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>("elena");
  const [selectedMode, setSelectedMode] = useState<TransportMode>("bus");

  const persona = PERSONAS.find((p) => p.id === selectedPersonaId) ?? PERSONAS[0];

  // Dynamic simulation outcomes based on persona + mode
  function getOutcome(p: Persona, mode: TransportMode) {
    switch (mode) {
      case "bus": {
        const fareTotal = p.paxCount * 100;
        const waitMin = p.flightTime.includes("21:30") ? 42 : 18;
        const travelMin = p.destination.includes("Patong") ? 100 : p.destination.includes("Kata") ? 115 : 60;
        const totalTime = waitMin + travelMin;
        const isWithinBudget = fareTotal <= p.budgetThb;
        const stressLevel = p.paxCount >= 4 ? "Moderate (kids + luggage on bus)" : "Low (relaxing coastal views)";
        const co2Kg = 1.2 * p.paxCount;
        return {
          fareTotal,
          farePerPerson: 100,
          waitMin,
          travelMin,
          totalTime,
          isWithinBudget,
          stressLevel,
          co2Kg,
          summary: `Air-conditioned ride along the coast. Elena pays only ฿100 (saving ฿650 vs taxi), but waits ${waitMin}m at the curb.`
        };
      }
      case "grab": {
        const fareTotal = p.destination.includes("Patong") ? 750 : p.destination.includes("Kata") ? 850 : 550;
        const waitMin = 4;
        const travelMin = p.destination.includes("Patong") ? 45 : p.destination.includes("Kata") ? 60 : 35;
        const totalTime = waitMin + travelMin;
        const isWithinBudget = fareTotal <= p.budgetThb;
        const stressLevel = "Low (private door-to-door car)";
        const co2Kg = 6.8;
        return {
          fareTotal,
          farePerPerson: Math.round(fareTotal / p.paxCount),
          waitMin,
          travelMin,
          totalTime,
          isWithinBudget,
          stressLevel,
          co2Kg,
          summary: `Instant departure in 4m. Fast and private, but costs ฿${fareTotal} (exceeds Elena's ฿500 total budget).`
        };
      }
      case "minivan": {
        const fareTotal = p.paxCount * 200;
        const waitMin = 30; // waiting for van to fill up
        const travelMin = p.destination.includes("Patong") ? 75 : 90; // multiple hotel dropoffs
        const totalTime = waitMin + travelMin;
        const isWithinBudget = fareTotal <= p.budgetThb;
        const stressLevel = "High (cramped seats, sales pitch stop, erratic driver)";
        const co2Kg = 3.5;
        return {
          fareTotal,
          farePerPerson: 200,
          waitMin,
          travelMin,
          totalTime,
          isWithinBudget,
          stressLevel,
          co2Kg,
          summary: "Van waits 30m until all 12 seats fill up, then detours through multiple hotels and an unrequested gem shop."
        };
      }
    }
  }

  const outcome = getOutcome(persona, selectedMode);

  return (
    <section className="tjs-container" aria-labelledby="tjs-title">
      <header className="tjs-head">
        <span className="tk-kicker">Interactive Experiment · Empathy Engine</span>
        <h2 id="tjs-title">Choose Your Traveler: Playable Journey Simulator</h2>
        <p className="tjs-subtitle">
          Why do 95% of airport tourists currently take cars instead of public transit? Select a real traveler profile,
          pick their transport choice, and inspect how cost, waiting friction, and comfort dictate their decisions.
        </p>
      </header>

      {/* Persona Selector */}
      <div className="tjs-personas" role="tablist" aria-label="Select traveler persona">
        {PERSONAS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={selectedPersonaId === p.id}
            className={`tjs-persona-card ${selectedPersonaId === p.id ? "is-selected" : ""}`}
            onClick={() => setSelectedPersonaId(p.id)}
          >
            <span className="tjs-persona-badge">{p.badge}</span>
            <div className="tjs-persona-meta">
              <strong>{p.name}</strong>
              <small>{p.destination} · {p.flightTime}</small>
            </div>
          </button>
        ))}
      </div>

      {/* Selected Persona Brief */}
      <div className="tjs-brief">
        <div className="tjs-brief__item">
          <span className="tjs-brief__label">Origin & Flight</span>
          <strong>{persona.origin} ({persona.flightTime})</strong>
        </div>
        <div className="tjs-brief__item">
          <span className="tjs-brief__label">Party Size & Bags</span>
          <strong>{persona.paxCount} pax · {persona.luggage}</strong>
        </div>
        <div className="tjs-brief__item">
          <span className="tjs-brief__label">Target Budget</span>
          <strong>฿{persona.budgetThb.toLocaleString()}</strong>
        </div>
        <div className="tjs-brief__item">
          <span className="tjs-brief__label">Primary Goal</span>
          <em>{persona.motivation}</em>
        </div>
      </div>

      {/* Mode Selector */}
      <div className="tjs-modes">
        <span className="tjs-modes__prompt">Select Transport Mode:</span>
        <div className="tjs-modes__group">
          <button
            type="button"
            className={`tjs-mode-btn ${selectedMode === "bus" ? "is-active" : ""}`}
            onClick={() => setSelectedMode("bus")}
          >
            Phuket Smart Bus (฿100)
          </button>
          <button
            type="button"
            className={`tjs-mode-btn ${selectedMode === "grab" ? "is-active" : ""}`}
            onClick={() => setSelectedMode("grab")}
          >
            Grab / Private Taxi (~฿{selectedPersonaId === "chen" ? "550" : selectedPersonaId === "somchai" ? "850" : "750"})
          </button>
          <button
            type="button"
            className={`tjs-mode-btn ${selectedMode === "minivan" ? "is-active" : ""}`}
            onClick={() => setSelectedMode("minivan")}
          >
            Shared Minivan (฿200/pax)
          </button>
        </div>
      </div>

      {/* Outcome Dashboard */}
      <div className="tjs-results">
        <div className="tjs-results__scorecard">
          <div className="tjs-metric">
            <span className="tjs-metric__label">Total Cost</span>
            <strong className={`tjs-metric__value ${outcome.isWithinBudget ? "is-good" : "is-warn"}`}>
              ฿{outcome.fareTotal.toLocaleString()}
            </strong>
            <small className="tjs-metric__sub">
              {outcome.farePerPerson ? `฿${outcome.farePerPerson} / person` : ""}
              {outcome.isWithinBudget ? " · within budget" : " · OVER budget"}
            </small>
          </div>

          <div className="tjs-metric">
            <span className="tjs-metric__label">Wait at Curb</span>
            <strong className="tjs-metric__value">
              {outcome.waitMin} min
            </strong>
            <small className="tjs-metric__sub">
              {selectedMode === "bus" ? "headway gap" : selectedMode === "grab" ? "driver dispatch" : "filling seats"}
            </small>
          </div>

          <div className="tjs-metric">
            <span className="tjs-metric__label">Total Journey Time</span>
            <strong className="tjs-metric__value">
              {outcome.totalTime} min
            </strong>
            <small className="tjs-metric__sub">
              {outcome.travelMin}m en-route + {outcome.waitMin}m wait
            </small>
          </div>

          <div className="tjs-metric">
            <span className="tjs-metric__label">Carbon Footprint</span>
            <strong className="tjs-metric__value is-good">
              {outcome.co2Kg.toFixed(1)} kg CO₂
            </strong>
            <small className="tjs-metric__sub">
              {selectedMode === "bus" ? "0.15 kg/pax-km" : "shared vehicle baseline"}
            </small>
          </div>
        </div>

        {/* Narrative Journey Breakdown */}
        <div className="tjs-storyboard">
          <div className="tjs-storyboard__title">Journey Simulation Breakdown</div>
          <p className="tjs-storyboard__summary">{outcome.summary}</p>
          <div className="tjs-storyboard__steps">
            <div className="tjs-step">
              <span className="tjs-step__time">00:00</span>
              <div className="tjs-step__desc">
                <strong>Exit Terminal 2 Arrivals</strong>
                <span>Passes the taxi kiosk gauntlet. Sees Smart Bus stop sign at curb.</span>
              </div>
            </div>
            <div className="tjs-step">
              <span className="tjs-step__time">+{outcome.waitMin}m</span>
              <div className="tjs-step__desc">
                <strong>Boarding & Departure</strong>
                <span>
                  {selectedMode === "bus"
                    ? "Boards 25-seat air-conditioned bus. Loads luggage into front rack. Pays ฿100."
                    : selectedMode === "grab"
                      ? "Driver arrives at pick-up zone in white sedan. Trunk fits all bags."
                      : "Squeezes into minivan. Wait for 5 other passengers to arrive."}
                </span>
              </div>
            </div>
            <div className="tjs-step">
              <span className="tjs-step__time">+{outcome.totalTime}m</span>
              <div className="tjs-step__desc">
                <strong>Arrival at {persona.destination}</strong>
                <span>
                  {selectedMode === "bus"
                    ? "Driver pulls over safely at requested hotel/beach stop. Passenger walks 2 min to lobby."
                    : selectedMode === "grab"
                      ? "Direct drop-off at resort front steps."
                      : "Finally reaches hotel after stopping at 4 other hotels in Kamala."}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
