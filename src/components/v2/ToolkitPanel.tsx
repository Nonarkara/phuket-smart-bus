import { useState } from "react";

/**
 * TOOLKIT tab — Executive Briefing of the USASCP Research & Simulation Engine
 *
 * "Transit Service Planning for Sustainable Tourism Travel — Insights from Phuket and Las Vegas"
 * US-ASEAN Smart Cities Mobility Program (U.S. DOT · U.S. State Dept · METRANS/USC · Chulalongkorn CUTI)
 *
 * Structured as a single-track, publication-grade executive briefing:
 * 1. Executive Hero & Live Engine Telemetry
 * 2. The 8 Mode Lenses (ABCDEFGH)
 * 3. 8 Traveler Personas & Friction Matrix
 * 4. Causal Experiment Studio (Hypotheses)
 * 5. 15 Ranked Recommendations (Impact vs Effort)
 * 6. Software Scaffolding & Traceability Ledger
 * 7. Real Data Roadmap & Honest Gaps
 * 8. Institutional Heritage & Partners
 */

// ---------------------------------------------------------------------------
// Static content — distilled from the 23-page toolkit
// ---------------------------------------------------------------------------

const TENETS = [
  { l: "A", k: "Accessibility", q: "Can a first-time visitor find it, board it, and understand it without borrowing local knowledge?", d: "Phuket: airport curb has zero visible English directional signage. Vegas: dedicated Strip Deuce stops every 200m.", cat: "fund" },
  { l: "B", k: "Budget", q: "Does the price make arithmetic sense against taxis and rental alternatives?", d: "฿100 flat against ฿600–1,000 for Grab/taxis. The 6× to 10× spread does the marketing by itself if travelers know it exists.", cat: "fund" },
  { l: "C", k: "Comfort", q: "Is there air-con, space for two suitcases, and a clean seat after a long flight?", d: "After an 8-hour international flight, basic comfort converts travelers who would never ride a regular local truck.", cat: "fund" },
  { l: "D", k: "Duration", q: "Is the trip predictable rather than just fast?", d: "A known 95 minutes beats an unknown 60 minutes in an unmetered taxi every single time. Predictability drives mode choice.", cat: "fund" },
  { l: "E", k: "Experience", q: "Can the journey feel like part of the vacation rather than administrative punishment?", d: "The coastal road from Surin to Kamala is scenic. A window seat on a high bus is travel content, not an ordeal.", cat: "fund" },
  { l: "F", k: "Freedom", q: "Does it free travelers from parking hunts, deposits, and collision damage arguments?", d: "No rental desk deposit, no unfamiliar mountain roads in monsoon rain, no parking extortion at Patong Beach.", cat: "fund" },
  { l: "G", k: "Green", q: "Does lower carbon actually sway visitor decisions?", d: "A lower-carbon EV bus fleet is the choice a growing share of travelers wants to make—once fundamentals A–F are earned.", cat: "ext" },
  { l: "H", k: "Hip", q: "Does transit carry positive social status and visual appeal?", d: "Nobody posts a photo of a taxi queue. An electric, air-conditioned smart bus with panoramic windows gets shared on social media.", cat: "ext" },
] as const;

const HYPOTHESES = [
  {
    q: "If the bus is cheap enough, does price override the convenience of a rental car?",
    t: "The app keeps the ฿100 bus beside the ฿720 taxi. Real ticket sales tell us whether the price gap changes behavior or merely wins polite arguments."
  },
  {
    q: "If we match supply to airport demand hour by hour, can we pull people out of rental cars?",
    t: "This is the entire engine. Missed Money finds the deficit hours; the fleet stepper adds a bus and reruns the day. No bus is bought for emotional reasons."
  },
  {
    q: "If bus + Grab connect seamlessly for the last mile, does it beat renting a motorbike?",
    t: "First–last mile ranked #1 for impact and is still the model's biggest blank. Stop catchments and feeder-trip data will turn it from an idea into a priced asset."
  },
  {
    q: "If we make taking the bus cool, does persona 8 (premium, app-first, Grab-loyal) switch?",
    t: "Persona 8 does not need a lecture about climate. They need a clean bus, an arrival time they believe, and a tap in the app."
  },
  {
    q: "If we intercept travelers before they leave the arrivals hall, does capture jump?",
    t: "The mode choice is decided in the first 50 meters after customs. An arrivals-hall digital kiosk with a live countdown changes that choice."
  },
] as const;

const OBJECTIVES = [
  { k: "Congestion", d: "Fewer private cars and passenger vans on a coastal road network already at capacity", metric: "−18% peak vehicle trips" },
  { k: "Safety", d: "Fewer motorbike rentals by inexperienced tourists on steep monsoon switchbacks", metric: "Zero tourist road incidents" },
  { k: "Emissions", d: "High-capacity electric bus trips replacing single-occupancy combustion vehicles", metric: "0.15 kg CO₂ saved / pax-km" },
  { k: "User Cost", d: "฿100 flat fare vs ฿600–1,000 unmetered taxi fares—money staying in traveler pockets", metric: "฿620 savings / trip" },
  { k: "Operator Viability", d: "Private concessionaire with no operating subsidy must fill seats to survive", metric: "≥1.30× Debt Service Coverage" },
] as const;

const CITY_CONTRAST = [
  { dim: "Arrival Mode", phuket: "100% by air; ~60% international arrivals (Russia, China, India, ASEAN)", vegas: "70% by car from Southern California; only 10% international" },
  { dim: "First Trip on Arrival", phuket: "Airport to dispersed coastal resorts (40–95 min road trip immediately)", vegas: "Park vehicle at hotel once, walk or ride the Strip" },
  { dim: "Transit Governance", phuket: "Fragmented private operators under national DLT licensing", vegas: "One regional public agency (RTC Southern Nevada), unified brand" },
  { dim: "Door-to-Door Reality", phuket: "Buses cannot stop directly inside hotel driveways; taxis win door-to-door", vegas: "Vehicles win because parking garages are ubiquitous" },
  { dim: "Geography & Terrain", phuket: "Mountainous island spine; airport in north, resorts along west coast", vegas: "Flat desert grid with one high-density 6-mile corridor" },
] as const;

const PERSONAS = [
  { n: 1, who: "Low-Income Students & Island Workers", split: "100% Resident", need: "Absolute affordability, safety, clear schedules", user: true },
  { n: 2, who: "Bus-Friendly Freelancers & Nomads", split: "37% Res · 63% Visitor", need: "Professional drivers, shorter headways, Wi-Fi", user: true },
  { n: 3, who: "Young Male Adventure Travelers", split: "98% Visitor", need: "Affordable beach access, surfboard/luggage space", user: true },
  { n: 4, who: "High-Income Visitors Open to Transit", split: "100% Visitor", need: "Perceived security, onboard travel advice, air-con", user: true },
  { n: 5, who: "Budget Young Tourists on Motorbikes", split: "48% Res · 52% Visitor", need: "Cleanliness, smartphone app tracking, easy tickets", user: false },
  { n: 6, who: "Freelancers on Motorbike/Car/Grab", split: "58% Res · 42% Visitor", need: "Trip planner app, stops closer to co-working hubs", user: false },
  { n: 7, who: "Mid-Income Private-Car Residents", split: "92% Resident", need: "Driver punctuality, premium seating, park-and-ride", user: false },
  { n: 8, who: "Premium App-First Visitors (Grab-Loyal)", split: "95% Visitor", need: "Punctuality, live GPS map, zero hassle", user: false },
] as const;

const THEMES = [
  "Driver Professionalism",
  "Waiting Time Predictability",
  "App & Live GPS Integration",
  "Tourist Wayfinding at Stops",
  "Timetable Punctuality",
  "Vehicle Cleanliness & Luggage Space",
] as const;

const RECS: { n: number; label: string; e: number; i: number; q: "quick" | "major" | "fill" | "hard" }[] = [
  { n: 13, label: "First–last mile feeder connections", e: 9.3, i: 9.7, q: "major" },
  { n: 8, label: "Adjust routes to resort clusters", e: 9.2, i: 9.5, q: "major" },
  { n: 2, label: "Increase frequency during arrival banks", e: 9.7, i: 9.2, q: "major" },
  { n: 11, label: "Inter-agency data coordination", e: 8.8, i: 9.2, q: "major" },
  { n: 12, label: "Expand route coverage to Rawai/Chalong", e: 9.0, i: 9.0, q: "major" },
  { n: 1, label: "Dedicated airport curb boarding points", e: 7.8, i: 9.0, q: "major" },
  { n: 14, label: "Positive image & social campaign", e: 9.1, i: 8.7, q: "major" },
  { n: 4, label: "Driver safety & defensive training", e: 5.5, i: 8.6, q: "quick" },
  { n: 10, label: "Driver bilingual hospitality skills", e: 6.9, i: 8.4, q: "quick" },
  { n: 6, label: "Live mobile app & QR ticketing", e: 6.8, i: 8.3, q: "quick" },
  { n: 15, label: "First-ride promotional passes", e: 6.6, i: 7.9, q: "quick" },
  { n: 3, label: "Accurate real-time timetable displays", e: 4.6, i: 7.5, q: "quick" },
  { n: 7, label: "On-board luggage storage racks", e: 6.6, i: 6.3, q: "fill" },
  { n: 9, label: "Low-floor accessibility retrofits", e: 8.4, i: 6.3, q: "hard" },
  { n: 5, label: "Next-stop digital audio/visual screens", e: 6.5, i: 5.7, q: "fill" },
];

const LEDGER = [
  { finding: "Published PKSB timetable is the supply; no operating subsidy", model: "Supply fixed by schedule both directions; ฿100/boarding is the only revenue", surface: "Accumulator bar & revenue counters" },
  { finding: "Arrivals mix: ~60% international; Russia, China, India lead", model: "Capture heuristics by origin (Europeans rent cars 3%, SE Asia budget airlines 7%)", surface: "Demand rail flight inspector" },
  { finding: "Departing visitors must reach airport T−60 before check-in closes", model: "Return leg: passengers bid on latest feasible northbound bus; overflow takes Grab", surface: "OUT → Airport corridor load" },
  { finding: "Non-users cite wait unpredictability, not destinations", model: "60-minute patience threshold: longer queues abandon and count as missed revenue", surface: "Walked-away metric & alert chips" },
  { finding: "Buses run on intervals; aircraft land in waves", model: "Minute-resolution FIFO curb queue; conservation: demand = boarded + waiting + lost", surface: "Queue Dynamics timeline" },
  { finding: "\"Increase frequency\" ranked top impact but was unpriced", model: "Dynamic fleet scenario: adding +3 buses reruns the entire day's financial return", surface: "Fleet Lab scenario stepper" },
];

const DATA_WANTED = [
  { metric: "AOT Real Flight Manifests", source: "Airports of Thailand (AOT) API", unlocks: "Replaces the curated peak-day schedule with live daily passenger manifests" },
  { metric: "Electronic Ticketing Counts", source: "Phuket Smart Bus POS / QR Validator", unlocks: "Calibrates the 8 capture heuristics into empirically measured origin conversion rates" },
  { metric: "Live Automatic Vehicle Location (AVL)", source: "In-bus GPS trackers (API endpoints ready in server/)", unlocks: "Swaps simulated timetable positions for sub-second real-world GPS positions" },
  { metric: "OD Survey Seasonality Series", source: "Chulalongkorn CUTI survey instrument", unlocks: "Updates traveler personas across high, shoulder, and monsoon seasons" },
  { metric: "Hotel Occupancy by Micro-Zone", source: "Thai Hotels Association (THA) Southern Chapter", unlocks: "Weights southbound alighting and northbound return-leg pickups by lodging zone" },
  { metric: "Trip Planner & App Analytics", source: "PKSB passenger app telemetry", unlocks: "Measures Persona 8 digital conversion before passengers even land at the airport" },
];

const GAPS = [
  { gap: "First–Last Mile Micro-Transit", why: "Ranked #1 for impact (#13). A 500m stop buffer and feeder-van micro-network needs to be priced and simulated." },
  { gap: "Hotel-Driveway Regulatory Ban", why: "Current local regulations ban transit buses from entering hotel grounds—a structural advantage taxis exploit." },
  { gap: "Resident Baseline Commute Load", why: "The model is primarily flight-driven today; a resident base commute model will enrich off-peak midday truth." },
  { gap: "Service Quality Feedback Multiplier", why: "Driver ratings and onboard cleanliness shift capture rates; quality multipliers should directly price staff training programs." },
  { gap: "Monsoon Seasonality Curve", why: "Current week model reflects high-season; an annual 12-month series will model the monsoon demand dip and school holidays." },
];

const CAUSAL_STORIES = [
  {
    id: "wait",
    tab: "1. The Wait Mismatch",
    title: "Why cheap buses run empty while expensive taxis win",
    observation: "Non-riders travel the exact same Phuket Town–Kathu–Patong corridor as bus riders.",
    correlation: "The route is geographically useful, yet 84% of potential riders choose Grab or private transfers.",
    cause: "Uncertain, long waits make a ฿100 bus feel exorbitantly expensive in lost vacation time.",
    intervention: "Dynamically match bus departures to flight arrival banks instead of fixed 60-minute intervals.",
    measure: "Boarded count, curb wait duration, walked-away count, and incremental fare revenue.",
  },
  {
    id: "last-mile",
    tab: "2. The Last-Mile Void",
    title: "Price advantage evaporates without door-to-door access",
    observation: "Visitors praise the ฿100 fare in surveys but still hail ฿800 door-to-door minivans at the curb.",
    correlation: "A ฿700 price gap is not enough to overcome carrying luggage 800m up a steep hill in 32°C heat.",
    cause: "The main-road bus line stops on the arterial, while resorts sit 1–3 km away along steep coves.",
    intervention: "Introduce synchronized feeder loops and negotiated Grab Last-Mile discounts at key hubs.",
    measure: "Conversion by resort cluster, transfer dwell time, and combined trip cost.",
  },
  {
    id: "trust",
    tab: "3. The Trust & Evidence Gap",
    title: "A timetable without live GPS is fiction to a tourist",
    observation: "Punctuality and real-time tracking rank in the top 3 desires across all 8 traveler personas.",
    correlation: "Travelers who doubt when the bus will arrive abandon the stop within 15 minutes.",
    cause: "Monsoon traffic causes headway bunching. An empty stop with a printed sign conveys zero confidence.",
    intervention: "Deploy digital countdown markers at stops and in the app driven by live GPS telemetry.",
    measure: "Passenger curb dwell tolerance, repeat ridership, and app query conversion.",
  },
] as const;

type ToolkitPanelProps = {
  clockLabel: string;
  flightsLanded: number;
  arrivingPax: number;
  likelyRiders: number;
  boarded: number;
  waiting: number;
  walkedAway: number;
  revenueThb: number;
  missedThb: number;
  movingBuses: number;
  onOpenSystem: () => void;
};

export function ToolkitPanel({
  clockLabel,
  flightsLanded,
  arrivingPax,
  likelyRiders,
  boarded,
  waiting,
  walkedAway,
  revenueThb,
  missedThb,
  movingBuses,
  onOpenSystem,
}: ToolkitPanelProps) {
  const [activeCausalId, setActiveCausalId] = useState<(typeof CAUSAL_STORIES)[number]["id"]>("wait");
  const activeStory = CAUSAL_STORIES.find((s) => s.id === activeCausalId) ?? CAUSAL_STORIES[0];

  const accountedFor = boarded + waiting + walkedAway;

  return (
    <main className="v2-toolkit">
      <div className="tk-briefing">
        {/* ── Sticky Sub-Nav ────────────────────────────────────────── */}
        <nav className="tk-subnav" aria-label="Toolkit briefing chapters">
          <div className="tk-subnav__inner">
            <span className="tk-subnav__brand">USASCP Toolkit Briefing</span>
            <div className="tk-subnav__links">
              <a href="#tk-hero">01 Overview</a>
              <a href="#tk-lenses">02 The 8 Lenses</a>
              <a href="#tk-personas">03 Personas</a>
              <a href="#tk-causation">04 Causation</a>
              <a href="#tk-recs">05 Recommendations</a>
              <a href="#tk-ledger">06 Traceability</a>
              <a href="#tk-partners">07 Partners</a>
            </div>
          </div>
        </nav>

        {/* ── Section 01: Executive Hero & Live Telemetry ───────────── */}
        <section className="tk-hero-block" id="tk-hero">
          <div className="tk-hero-block__content">
            <div className="tk-hero-eyebrow">
              <span className="tk-tag tk-tag--green">USASCP Sustainable Mobility</span>
              <span className="tk-tag tk-tag--outline">Phuket ↔ Las Vegas Pairing</span>
            </div>
            <h1 className="tk-hero-title">We Did the Research. Then We Made It Move.</h1>
            <p className="tk-hero-desc">
              Instead of producing another 300-page static PDF report that sits on a shelf, this project translated four years of field data, traveler surveys, and international peer exchange into a <strong>living client-side simulation engine</strong>.
            </p>
            <p className="tk-hero-desc">
              It models minute-level arrival waves, prices timetable mismatches, and tests fleet investments before public money is committed.
            </p>
            <div className="tk-hero-actions">
              <button className="tk-btn tk-btn--primary" type="button" onClick={onOpenSystem}>
                Launch Live Operations Console <span>→</span>
              </button>
              <a className="tk-btn tk-btn--ghost" href="#tk-lenses">
                Read The 8 Mode Lenses <span>↓</span>
              </a>
            </div>
          </div>

          {/* Live Engine HUD Card */}
          <div className="tk-hud-card" aria-label="Live simulation telemetry HUD">
            <div className="tk-hud-card__head">
              <div className="tk-hud-status">
                <span className="tk-hud-dot" />
                <strong>LIVE ENGINE · {clockLabel}</strong>
              </div>
              <span className="tk-hud-meta">{movingBuses} buses in service · 30× time</span>
            </div>

            <div className="tk-hud-pipeline">
              <div className="tk-hud-step">
                <span>1. Flights Landed</span>
                <strong>{flightsLanded}</strong>
                <small>{arrivingPax.toLocaleString()} arriving pax</small>
              </div>
              <div className="tk-hud-step">
                <span>2. Likely Riders</span>
                <strong>{likelyRiders.toLocaleString()}</strong>
                <small>3–7% origin capture</small>
              </div>
              <div className="tk-hud-step tk-hud-step--accent">
                <span>3. Boarded &amp; Won</span>
                <strong>{boarded.toLocaleString()}</strong>
                <small>฿{revenueThb.toLocaleString()} revenue</small>
              </div>
              <div className="tk-hud-step tk-hud-step--alert">
                <span>4. Walked to Taxi</span>
                <strong>{walkedAway.toLocaleString()}</strong>
                <small>฿{missedThb.toLocaleString()} leaked</small>
              </div>
            </div>

            <div className="tk-hud-formula">
              <span className="tk-hud-formula__badge">100% Demand Conserved</span>
              <span>
                {likelyRiders.toLocaleString()} Likely = {boarded.toLocaleString()} Boarded + {waiting.toLocaleString()} Waiting + {walkedAway.toLocaleString()} Walked Away
              </span>
            </div>
          </div>
        </section>

        {/* ── Section 02: The 8 Mode Lenses (ABCDEFGH) ─────────────── */}
        <section className="tk-section-box" id="tk-lenses">
          <div className="tk-section-head">
            <span className="tk-section-kicker">02 · The Core Thesis</span>
            <h2>Nobody Chooses a Mode Because a Planner Says It Is Efficient</h2>
            <p>
              Travelers do not solve transportation optimization equations. They weigh a bundle of felt factors: money, certainty, luggage space, personal image, and the friction they avoid.
            </p>
          </div>

          <div className="tk-lenses-grid">
            {TENETS.map((t) => (
              <article key={t.l} className={`tk-lens-card tk-lens-card--${t.cat}`}>
                <div className="tk-lens-card__top">
                  <span className="tk-lens-card__letter">{t.l}</span>
                  <div className="tk-lens-card__title-wrap">
                    <strong className="tk-lens-card__title">{t.k}</strong>
                    <span className="tk-lens-card__category">{t.cat === "fund" ? "Service Fundamental" : "Value Extension"}</span>
                  </div>
                </div>
                <p className="tk-lens-card__question">"{t.q}"</p>
                <div className="tk-lens-card__fact">
                  <span>Takeaway:</span> {t.d}
                </div>
              </article>
            ))}
          </div>

          {/* City Comparison Table */}
          <div className="tk-comparison-box">
            <h3>Phuket vs. Las Vegas: Same Tourism Scale, Opposite Physics</h3>
            <div className="tk-comparison-table" role="table">
              <div className="tk-comparison-tr tk-comparison-tr--head" role="row">
                <span role="columnheader">Structural Dimension</span>
                <span role="columnheader">Phuket Reality</span>
                <span role="columnheader">Las Vegas Strip Benchmark</span>
              </div>
              {CITY_CONTRAST.map((row) => (
                <div key={row.dim} className="tk-comparison-tr" role="row">
                  <strong role="cell">{row.dim}</strong>
                  <span role="cell">{row.phuket}</span>
                  <span role="cell">{row.vegas}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Section 03: 8 Traveler Personas & Friction Matrix ─────── */}
        <section className="tk-section-box" id="tk-personas">
          <div className="tk-section-head">
            <span className="tk-section-kicker">03 · Traveler Segmentation</span>
            <h2>The Non-Riders Are Not Somewhere Else. They Are Right Beside Us.</h2>
            <p>
              Chulalongkorn CUTI travel surveys revealed that non-riders travel the exact same Phuket Town–Kathu–Patong corridor as current riders. They choose other modes because of specific friction points.
            </p>
          </div>

          <div className="tk-personas-wrapper">
            <div className="tk-personas-column">
              <h3 className="tk-personas-group-title text-accent">Segment A · Currently Riding (Personas 1–4)</h3>
              <div className="tk-persona-cards">
                {PERSONAS.filter((p) => p.user).map((p) => (
                  <div key={p.n} className="tk-persona-card tk-persona-card--user">
                    <div className="tk-persona-card__head">
                      <span className="tk-persona-num">#{p.n}</span>
                      <strong className="tk-persona-name">{p.who}</strong>
                      <span className="tk-persona-badge tk-persona-badge--won">Rides Today</span>
                    </div>
                    <div className="tk-persona-meta">
                      <span>Demographic:</span> <strong>{p.split}</strong>
                    </div>
                    <p className="tk-persona-need"><strong>Primary Need:</strong> {p.need}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="tk-personas-column">
              <h3 className="tk-personas-group-title text-warn">Segment B · Could Ride / Lost to Alternatives (Personas 5–8)</h3>
              <div className="tk-persona-cards">
                {PERSONAS.filter((p) => !p.user).map((p) => (
                  <div key={p.n} className="tk-persona-card tk-persona-card--nonuser">
                    <div className="tk-persona-card__head">
                      <span className="tk-persona-num">#{p.n}</span>
                      <strong className="tk-persona-name">{p.who}</strong>
                      <span className="tk-persona-badge tk-persona-badge--opp">Opportunity</span>
                    </div>
                    <div className="tk-persona-meta">
                      <span>Demographic:</span> <strong>{p.split}</strong>
                    </div>
                    <p className="tk-persona-need"><strong>Primary Need:</strong> {p.need}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 6 Recurring Friction Points */}
          <div className="tk-friction-box">
            <h4>The Six Universal Friction Points Across All 8 Personas:</h4>
            <div className="tk-friction-tags">
              {THEMES.map((theme, i) => (
                <span key={theme} className="tk-friction-tag">
                  <strong>{i + 1}.</strong> {theme}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── Section 04: Causal Experiment Studio ─────────────────── */}
        <section className="tk-section-box" id="tk-causation">
          <div className="tk-section-head">
            <span className="tk-section-kicker">04 · Scientific Causality</span>
            <h2>Correlation Gives Us a Suspect. Causation Needs an Experiment.</h2>
            <p>
              More buses do not automatically mean better transport. If dispatched in the wrong hour, you buy diesel and an expensive empty seat. The intervention only works through timing.
            </p>
          </div>

          <div className="tk-causal-studio">
            <div className="tk-causal-tabs">
              {CAUSAL_STORIES.map((story) => (
                <button
                  key={story.id}
                  type="button"
                  className={`tk-causal-tab ${activeCausalId === story.id ? "is-active" : ""}`}
                  onClick={() => setActiveCausalId(story.id)}
                >
                  {story.tab}
                </button>
              ))}
            </div>

            <div className="tk-causal-card">
              <h3 className="tk-causal-card__title">{activeStory.title}</h3>

              <div className="tk-causal-flow">
                <div className="tk-causal-step">
                  <span className="tk-causal-step__num">01 · Observation</span>
                  <h4>{activeStory.observation}</h4>
                  <p>{activeStory.correlation}</p>
                </div>

                <div className="tk-causal-arrow">→</div>

                <div className="tk-causal-step">
                  <span className="tk-causal-step__num">02 · Root Cause</span>
                  <h4>Hypothesis</h4>
                  <p>{activeStory.cause}</p>
                </div>

                <div className="tk-causal-arrow">→</div>

                <div className="tk-causal-step tk-causal-step--action">
                  <span className="tk-causal-step__num">03 · Software Intervention</span>
                  <h4>{activeStory.intervention}</h4>
                  <p>Model the departure bank in the simulator before modifying contracts.</p>
                </div>

                <div className="tk-causal-arrow">→</div>

                <div className="tk-causal-step tk-causal-step--metric">
                  <span className="tk-causal-step__num">04 · Proof Metric</span>
                  <h4>Measurable Proof</h4>
                  <p>{activeStory.measure}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Section 05: 15 Recommendations (Impact vs Effort) ────── */}
        <section className="tk-section-box" id="tk-recs">
          <div className="tk-section-head">
            <span className="tk-section-kicker">05 · Action Roadmap</span>
            <h2>Fifteen Ideas Entered. Impact and Effort Decided Who Left First.</h2>
            <p>
              Stakeholders mapped 15 actionable interventions onto an Impact–Effort quadrant. Cheap wins focus on trust and information; major projects require capital and route reallocation.
            </p>
          </div>

          <div className="tk-recs-grid">
            <div className="tk-recs-quadrant tk-recs-quadrant--quick">
              <div className="tk-quadrant-header">
                <span className="tk-quadrant-badge">DO NOW</span>
                <h3>Quick Wins (High Impact · Low Effort)</h3>
              </div>
              <ul className="tk-recs-list">
                {RECS.filter((r) => r.q === "quick").map((r) => (
                  <li key={r.n}>
                    <span className="tk-rec-n">#{r.n}</span>
                    <strong>{r.label}</strong>
                  </li>
                ))}
              </ul>
            </div>

            <div className="tk-recs-quadrant tk-recs-quadrant--major">
              <div className="tk-quadrant-header">
                <span className="tk-quadrant-badge">FUND &amp; SEQUENCE</span>
                <h3>Major Projects (High Impact · High Effort)</h3>
              </div>
              <ul className="tk-recs-list">
                {RECS.filter((r) => r.q === "major").map((r) => (
                  <li key={r.n}>
                    <span className="tk-rec-n">#{r.n}</span>
                    <strong>{r.label}</strong>
                  </li>
                ))}
              </ul>
            </div>

            <div className="tk-recs-quadrant tk-recs-quadrant--fill">
              <div className="tk-quadrant-header">
                <span className="tk-quadrant-badge">FILL-INS</span>
                <h3>Secondary Upgrades</h3>
              </div>
              <ul className="tk-recs-list">
                {RECS.filter((r) => r.q === "fill").map((r) => (
                  <li key={r.n}>
                    <span className="tk-rec-n">#{r.n}</span>
                    <strong>{r.label}</strong>
                  </li>
                ))}
              </ul>
            </div>

            <div className="tk-recs-quadrant tk-recs-quadrant--hard">
              <div className="tk-quadrant-header">
                <span className="tk-quadrant-badge">DEPRIORITIZE</span>
                <h3>Hard Slog (Low Impact · High Effort)</h3>
              </div>
              <ul className="tk-recs-list">
                {RECS.filter((r) => r.q === "hard").map((r) => (
                  <li key={r.n}>
                    <span className="tk-rec-n">#{r.n}</span>
                    <strong>{r.label}</strong>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ── Section 06: Traceability & Software Scaffolding ──────── */}
        <section className="tk-section-box" id="tk-ledger">
          <div className="tk-section-head">
            <span className="tk-section-kicker">06 · Code Traceability</span>
            <h2>Every Research Sentence Has to Earn a Job in the Software</h2>
            <p>
              Finding → Model Assumption → Tested Code → UI Decision Surface. If an assumption cannot be justified by evidence, it is deleted from the codebase.
            </p>
          </div>

          <div className="tk-ledger-table-wrap">
            <table className="tk-ledger-table">
              <thead>
                <tr>
                  <th>Field Research Finding</th>
                  <th>Simulation Engine Model Rule</th>
                  <th>Where It Lives in Software</th>
                </tr>
              </thead>
              <tbody>
                {LEDGER.map((row) => (
                  <tr key={row.surface}>
                    <td><strong>{row.finding}</strong></td>
                    <td>{row.model}</td>
                    <td><span className="tk-code-tag">{row.surface}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Real Data Scaffolding */}
          <div className="tk-roadmap-box">
            <h3>Real Data Feeds That Replace the Simulation Planks</h3>
            <p>We do not pretend estimates are sensors. Each upcoming telemetry feed has an ingest endpoint already waiting:</p>
            <div className="tk-data-grid">
              {DATA_WANTED.map((d) => (
                <div key={d.metric} className="tk-data-card">
                  <strong>{d.metric}</strong>
                  <span className="tk-data-source">Source: {d.source}</span>
                  <p>{d.unlocks}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Section 07: Institutional Partners & Heritage ────────── */}
        <section className="tk-section-box" id="tk-partners">
          <div className="tk-section-head">
            <span className="tk-section-kicker">07 · Institutional Partners</span>
            <h2>Four Years. Eight Cities. One Living Legacy.</h2>
            <p>
              Developed under the U.S.-ASEAN Smart Cities Partnership (USASCP) with USDOT, U.S. Department of State, depa Thailand, and University Partnership Program (UPP) consortiums.
            </p>
          </div>

          <div className="tk-partner-logos">
            <img src={`${import.meta.env.BASE_URL}brand/usascp.png`} alt="USASCP" className="tk-partner-logo" />
            <img src={`${import.meta.env.BASE_URL}brand/usdot.svg`} alt="USDOT" className="tk-partner-logo" />
            <img src={`${import.meta.env.BASE_URL}brand/depa.jpg`} alt="depa Thailand" className="tk-partner-logo" />
            <img src={`${import.meta.env.BASE_URL}brand/smart-city-thailand.jpg`} alt="Smart City Thailand" className="tk-partner-logo" />
          </div>

          <div className="tk-credits-box">
            <p>
              <strong>Leadership:</strong> Roshan Desai (USDOT Volpe), Stephanie Fischer (USDOT), Joseph Traini (USDOT), Prof. Marlon Boarnet (USC METRANS), Andre Comandon (METRANS), Dr. Non Arkaraprasertkul (depa), Andrew Kjellman (RTC Southern Nevada), David Swallow (RTC), Scott Mazick (RTC).
            </p>
            <p className="tk-credits-note">
              In dedicated memory of <strong>Ton Jaitong</strong>, colleague, mentor, and smart city builder.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

export {
  TENETS,
  HYPOTHESES,
  OBJECTIVES,
  CITY_CONTRAST,
  PERSONAS,
  THEMES,
  RECS,
  LEDGER,
  DATA_WANTED,
  GAPS,
  CAUSAL_STORIES,
};
