/**
 * LandingPage — the clear, interactive argument that earns the long research.
 *
 * Sequence of Discovery:
 *   Act 1: The Passenger Choice (Elena, Somchai, Chen, Liam simulator)
 *   Act 2: The Operator Math (+1 Bus Calculator)
 *   Act 3: The Signal Chain (Tap to Bankability)
 *   Act 4: The 10-Step Blueprint (Curb to Concession)
 *   Act 5: Myths vs Reality (4 Hard Transit Doubts Answered)
 *   Handover: Chapters 01–04 + Expandable Verified Provenance Audit
 */

import { useState } from "react";
import { AddBusCalculator } from "./AddBusCalculator";
import { TravelerJourneySimulator } from "./TravelerJourneySimulator";
import { DataProvenance } from "./DataProvenance";

type Beat = {
  number: string;
  label: string;
  status: "Observed" | "Modelled" | "Build-ready" | "Proposed" | "Due diligence";
  title: string;
  body: string;
  proof: string;
  href: string;
  link: string;
};

const BEATS: Beat[] = [
  {
    number: "01",
    label: "Passenger Promise",
    status: "Observed",
    title: "Answer the traveler standing at arrivals in under 30 seconds.",
    body: "When is the next bus? Where does it leave? How much is it to Patong or Kata? The phone app reads the official airport timetable and keeps these answers visible above everything else.",
    proof: "The live countdown is calculated from the official departure timetable used by the fleet simulator.",
    href: "https://bus.nonarkara.org/",
    link: "Try the passenger screen"
  },
  {
    number: "02",
    label: "Hotel Drop-off",
    status: "Proposed",
    title: "A hotel name becomes a driver task without causing traffic chaos.",
    body: "The passenger selects a hotel, beach, or landmark. The request reaches the driver tablet, confirming a designated safe pull-over spot along the 402/4233 coastal corridor. Flexibility never compromises road safety.",
    proof: "The prototype captures destination coordinates today; safe-stopping geo-fencing is part of the 90-day pilot scope.",
    href: "https://bus.nonarkara.org/",
    link: "Test the destination flow"
  },
  {
    number: "03",
    label: "Payment & Passes",
    status: "Proposed",
    title: "Sell a ฿100 ride simply. Sell 3-day island passes without creating another walled wallet.",
    body: "The prototype offers a ฿100 single ride and a 72-hour unlimited pass. In production, payments hand off to standard PromptPay QR, Apple Pay, and credit cards with instant digital boarding tokens.",
    proof: "Simulated checkout demonstrates transaction contracts and digital QR boarding passes without charging live cards.",
    href: "https://bus.nonarkara.org/",
    link: "Walk through mock checkout"
  },
  {
    number: "04",
    label: "Legal Authority",
    status: "Due diligence",
    title: "Software can be coded in weeks. Concessions require public authority.",
    body: "Exclusive route rights, curb access at HKT International, fare caps, insurance liabilities, and contract tenure long enough to amortize EV bus assets — these determine whether wheels actually roll.",
    proof: "Chapter 3 separates the operational software model from the public concession approvals and DLT route licenses.",
    href: "#feasibility",
    link: "Inspect concession feasibility"
  },
  {
    number: "05",
    label: "Fleet Duty Cycles",
    status: "Modelled",
    title: "One bus handles both directions: arriving tourists south, departing travelers north.",
    body: "The same 10-bus airport fleet runs south to Rawai and returns north to HKT. The simulation tracks each bus on real road geography (3,944 GPS points), balancing layovers and directional queues.",
    proof: "Built on the published 20-departure timetable + high-resolution road geometry. No fake vehicle dots.",
    href: "https://bus.nonarkara.org/ops",
    link: "Watch real fleet movement"
  },
  {
    number: "06",
    label: "Hardware & Sensors",
    status: "Build-ready",
    title: "GPS shows where. The tablet tells the driver why. The door sensor shows how full.",
    body: "Three essential tools instead of an expensive hardware catalog: vehicle GPS, a driver assistance screen, and anonymous doorway passenger counters. Each pipeline is already implemented in the backend.",
    proof: "Vehicle telemetry, seat capacity, driver tasking, and passenger flow data types already exist in production code.",
    href: "#proof",
    link: "Trace architecture into code"
  },
  {
    number: "07",
    label: "Passenger Privacy",
    status: "Proposed",
    title: "Count riders anonymously. Never track individual identities.",
    body: "Doorway optical sensors register boarding and alighting numbers and device health — zero facial recognition, zero biometric profiling. Complying strictly with Thailand's PDPA law from day one.",
    proof: "The system enforces aggregate counting at the edge, transmitting numbers rather than video streams.",
    href: "#proof",
    link: "Read privacy standards"
  },
  {
    number: "08",
    label: "Smart Dispatch",
    status: "Proposed",
    title: "Not just more buses — the right vehicle dispatched at the exact arrival wave.",
    body: "Flight arrivals land in distinct waves (Russian charters mid-day, European flights evening). Destination requests signal where demand is heading. Dispatches dynamically adjust to prevent passenger stranding.",
    proof: "The operations console separates inbound and outbound queues hour-by-hour so neither masks the other.",
    href: "https://bus.nonarkara.org/ops",
    link: "Explore missed revenue by hour"
  },
  {
    number: "09",
    label: "Local Merchants",
    status: "Proposed",
    title: "Hotels and attractions sponsor rides only when reconciliation is automated.",
    body: "Resorts and restaurants can subsidize tourist rides. The platform tracks who issued the credit, who boarded, which trip occurred, and automatically settles accounts between businesses and the bus operator.",
    proof: "Boarding tokens carry partner metadata IDs, allowing transparent automated clearing.",
    href: "#method",
    link: "See merchant model"
  },
  {
    number: "10",
    label: "Bankable Finance",
    status: "Modelled",
    title: "Finance the next 90-day experiment, not an untested 10-year promise.",
    body: "The financial model is a diligence instrument for bankers. A 90-day pilot measures real ridership, operating cost per km, and debt coverage (DSCR). Capital is released in verified milestones.",
    proof: "Chapter 3 exposes interactive debt service coverage (1.30× target) and concession payback schedules.",
    href: "#feasibility",
    link: "Stress-test the financials"
  }
];

const HEADLINE_STATS = [
  { value: "17.5M", label: "HKT annual air passengers", note: "observed · AOT 2025" },
  { value: "20", label: "daily airport departures", note: "observed · PKSB timetable" },
  { value: "25", label: "seats per airport minibus", note: "modelled fleet capacity" },
  { value: "90 days", label: "instrumented pilot", note: "proposed decision gate" }
];

const SIGNAL_CHAIN = [
  { step: "01", actor: "Passenger", action: "Names hotel & gets ฿100 pass" },
  { step: "02", actor: "Driver Tablet", action: "Confirms safe pull-over spot" },
  { step: "03", actor: "Bus Telemetry", action: "Emits GPS & anonymous occupancy" },
  { step: "04", actor: "Operator", action: "Matches curb queues to dispatch" },
  { step: "05", actor: "City & Bank", action: "Verifies farebox revenue & DSCR" }
];

const MYTHS_VS_FACTS = [
  {
    myth: "Why buses? Phuket tourists just rent motorbikes anyway.",
    fact: "WHO ranks Thailand 9th globally for road fatalities; 92.7% of Phuket accidents involve a motorbike. Travelers only rent motorbikes when no safe, predictable transit exists. A ฿100 coastal bus eliminates lethal road risk.",
    tag: "Safety & Lives"
  },
  {
    myth: "Just subsidize Grab or Bolt — it requires zero public capex.",
    fact: "Subsidizing private ride-hailing permanently locks the island into an unregulated monopoly. Once public right-of-way and corridor rights lapse, the public will pay ฿800 per ride forever.",
    tag: "Public Right-of-Way"
  },
  {
    myth: "A world-class island needs a $1B light rail or monorail.",
    fact: "Las Vegas spent US$650M on a 3.9-mile monorail that went bankrupt twice. On that exact same road, double-decker express buses generated US$6M annual net profit. Transit that uses existing pavement wins.",
    tag: "Proven Economics"
  },
  {
    myth: "The local government doesn't have the budget to buy a fleet.",
    fact: "The government doesn't buy the buses. A private operator finances the fleet under a performance-concession agreement. Farebox cashflow backed by capped milestone payments comfortably achieves 1.30× debt service coverage.",
    tag: "Bankability"
  }
];

export function LandingPage() {
  const [showProvenance, setShowProvenance] = useState<boolean>(false);

  return (
    <section className="lp-landing" id="landing" aria-labelledby="lp-title">
      {/* Hero Header */}
      <header className="lp-hero">
        <p className="tk-kicker lp-hero__kicker">
          How to Build a Public Transit System · The Case of Phuket Smart Bus
        </p>
        <h1 id="lp-title" className="lp-hero__title">
          What if an airport passenger can find the bus, name the hotel and get a ticket in one minute?
        </h1>
        <p className="lp-hero__sub">
          Follow that single choice outside arrivals all the way through the driver,
          the fleet schedule, the island's coastal highway, and the bank. The passenger gets one simple screen.
          The island gets verified evidence it can build on.
        </p>
        <div className="lp-hero__status" aria-label="Evidence status legend">
          <span><b>Observed</b> cited or published record</span>
          <span><b>Modelled</b> calculated by this repository</span>
          <span><b>Proposed</b> still needs a decision or pilot</span>
        </div>
        <div className="lp-hero__stats" role="list" aria-label="Headline evidence">
          {HEADLINE_STATS.map((stat) => (
            <div key={stat.label} role="listitem">
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
              <small>{stat.note}</small>
            </div>
          ))}
        </div>
        <div className="lp-hero__actions">
          <a className="lp-btn lp-btn--primary" href="#act-passengers">
            Explore Traveler Choices <span>↓</span>
          </a>
          <a className="lp-btn" href="https://bus.nonarkara.org/">
            Try Live Passenger App <span>↗</span>
          </a>
          <a className="lp-btn" href="https://bus.nonarkara.org/ops">
            Run Operations Console <span>↗</span>
          </a>
        </div>
      </header>

      {/* Act 1: Interactive Traveler Choices */}
      <section className="lp-section" id="act-passengers" aria-labelledby="lp-act1-title">
        <div className="lp-section__head">
          <span className="tk-kicker">Act 1 · The Arrival Curb</span>
          <h2 id="lp-act1-title">Pick a traveler. See what happens when their flight lands.</h2>
          <p className="lp-section__sub">
            Transit decisions begin with human circumstances: luggage weight, travelling with toddlers,
            fear of being overcharged by unmetered cabs, or language barriers. Select a traveler below
            to simulate their journey time, cost, stress level, and carbon impact:
          </p>
        </div>
        <TravelerJourneySimulator />
      </section>

      {/* Act 2: Operator Arithmetic (+1 Bus) */}
      <section className="lp-section" id="act-operator" aria-labelledby="lp-act2-title">
        <div className="lp-section__head">
          <span className="tk-kicker">Act 2 · The Operating Math</span>
          <h2 id="lp-act2-title">Can we solve peak passenger shortages by adding just 1 or 2 buses?</h2>
          <p className="lp-section__sub">
            At peak hours (11:00–14:00), flight arrivals overwhelm the scheduled 25-seat minibuses.
            Stranded tourists give up and pay ฿800 for private cars. Drag the slider below to see how
            many riders and how much revenue Phuket Smart Bus recovers by adding extra capacity:
          </p>
        </div>
        <AddBusCalculator />
      </section>

      {/* Act 3: 5-Node Signal Chain */}
      <section className="lp-signal" aria-labelledby="lp-signal-title">
        <div className="lp-signal__intro">
          <span className="tk-kicker">Act 3 · The Chain of Consequence</span>
          <h2 id="lp-signal-title">A ticket is not the end of the journey. It is the first useful signal.</h2>
          <p>
            The interface stays simple because the machinery behind it is explicit.
            Every passenger interaction produces a verifiable data record that powers operational decisions:
          </p>
        </div>
        <ol className="lp-signal__chain" aria-label="Passenger action to verified outcome">
          {SIGNAL_CHAIN.map((item, index) => (
            <li key={item.step}>
              <small>{item.step}</small>
              <strong>{item.actor}</strong>
              <span>{item.action}</span>
              {index < SIGNAL_CHAIN.length - 1 && <b aria-hidden="true">→</b>}
            </li>
          ))}
        </ol>
      </section>

      {/* Act 4: The 10-Step Blueprint */}
      <section className="lp-arg" id="five-minute" aria-labelledby="lp-arg-title">
        <header className="lp-arg__head">
          <span className="tk-kicker">Act 4 · The System Blueprint</span>
          <h2 id="lp-arg-title">Ten questions. In order. Then we are ready to test—not ready to buy buses.</h2>
          <p className="lp-arg__sub">
            Read the badge on every card. <strong>Observed</strong> is ground evidence.
            <strong> Modelled</strong> is calculated by the simulation. <strong>Proposed</strong> is work
            still owed for the 90-day pilot. Keeping them distinct is what separates a bankable transit system
            from an expensive press release.
          </p>
        </header>

        <ol className="lp-cards" role="list">
          {BEATS.map((beat) => (
            <li key={beat.number} className="lp-card">
              <div className="lp-card__head">
                <span className="lp-card__num">{beat.number}</span>
                <span className="lp-card__label">{beat.label}</span>
                <span className={`lp-card__status lp-card__status--${beat.status.toLowerCase().replace("-", "-").replace(" ", "-")}`}>
                  {beat.status}
                </span>
              </div>
              <h3 className="lp-card__title">{beat.title}</h3>
              <p className="lp-card__body">{beat.body}</p>
              <div className="lp-card__proof">
                <span className="tk-kicker">Verification & Code Path</span>
                <p>{beat.proof}</p>
                <a href={beat.href} className="lp-card__link">
                  {beat.link} <span>↗</span>
                </a>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Act 5: Myths vs Field Evidence */}
      <section className="lp-section lp-myths" aria-labelledby="lp-myths-title">
        <div className="lp-section__head">
          <span className="tk-kicker">Act 5 · Hard Questions</span>
          <h2 id="lp-myths-title">Four common transit doubts — answered with field data.</h2>
          <p className="lp-section__sub">
            Whenever public transit is proposed for Phuket, the same objections appear.
            Here is how real evidence and global comparisons answer each of them:
          </p>
        </div>
        <div className="lp-myths__grid">
          {MYTHS_VS_FACTS.map((item) => (
            <article key={item.myth} className="lp-myth-card">
              <span className="lp-myth-card__tag">{item.tag}</span>
              <h3 className="lp-myth-card__myth">“{item.myth}”</h3>
              <p className="lp-myth-card__fact">{item.fact}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Handover to Chapters */}
      <section className="lp-handover" aria-labelledby="lp-handover-title">
        <div className="lp-handover__copy">
          <span className="tk-kicker">The Complete Research Repository</span>
          <h2 id="lp-handover-title">The five-minute case is complete. The evidence chapters are below.</h2>
          <p>
            This portal is the interactive digital realization of the 23-page USASCP transit toolkit,
            developed jointly by the U.S. Department of Transportation, METRANS Transportation Consortium,
            and Chulalongkorn University after four years of bilateral study pairing Phuket with Las Vegas.
            Explore each specialized chapter below:
          </p>
        </div>
        <div className="lp-handover__buttons">
          <a className="lp-btn lp-btn--primary" href="#phuket">Explore Phuket Corridor (Tab 2) <span>→</span></a>
          <a className="lp-btn" href="#evidence">Las Vegas Strip Comparison (Tab 3) <span>→</span></a>
          <a className="lp-btn" href="#build">Build & Finance Sandbox (Tab 4) <span>→</span></a>
        </div>
        <ol className="lp-handover__chapters" role="list" aria-label="Full research chapters">
          <li>
            <span>01</span>
            <strong>Phuket Corridor</strong>
            <em>The island geography, coastal choke points &amp; bus fleets</em>
          </li>
          <li>
            <span>02</span>
            <strong>Evidence</strong>
            <em>Las Vegas Strip $6M profit case &amp; interactive corridor simulator</em>
          </li>
          <li>
            <span>03</span>
            <strong>Build &amp; Finance</strong>
            <em>Interactive concession simulator, ABCDEF framework &amp; debt coverage</em>
          </li>
          <li>
            <span>04</span>
            <strong>Field Notes</strong>
            <em>4-year research chronicle, memorials, team &amp; downloadable toolkit PDF</em>
          </li>
        </ol>
      </section>

      {/* Expandable Data Provenance Drawer */}
      <section className="lp-provenance-section">
        <div className="lp-provenance-toggle">
          <button
            type="button"
            className="lp-provenance-btn"
            onClick={() => setShowProvenance(!showProvenance)}
            aria-expanded={showProvenance}
          >
            <strong>{showProvenance ? "▲ Hide Public Data Audit & Sources" : "▼ Inspect Verified Sources & Public Data Audit (20 Claims Checked)"}</strong>
            <small>AOT reports, WHO road safety data, PKSB timetables, and meteorological normals</small>
          </button>
        </div>
        {showProvenance && (
          <div className="lp-provenance-container">
            <DataProvenance />
          </div>
        )}
      </section>
    </section>
  );
}

export default LandingPage;
