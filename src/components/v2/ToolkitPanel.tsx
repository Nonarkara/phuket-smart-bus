import { useState } from "react";

/**
 * TOOLKIT tab — the no-nonsense summary of the USASCP toolkit this console
 * was built to serve:
 *
 *   "Transit Service Planning for Sustainable Tourism Travel —
 *    Insights from Phuket and Las Vegas"
 *   US-ASEAN Smart Cities Mobility Program (U.S. DOT · U.S. State Dept ·
 *   METRANS/USC · Chulalongkorn CUTI)
 *
 * Written in Dr Non's paraphrase: why the system exists, what the research
 * found, which assumptions this dashboard runs on, and what data would
 * sharpen it. The page follows the Axiom laws — zero gradient, zero shadow,
 * one green accent, and diagrams that teach instead of showing off.
 */

// ---------------------------------------------------------------------------
// Static content — distilled from the 23-page toolkit
// ---------------------------------------------------------------------------

/** The thesis, A to H: people don't choose the fast mode — they choose the
 *  mode that wins on the dimensions they actually feel. */
const TENETS = [
  { l: "A", k: "Accessibility", d: "Can a first-time visitor find it, board it, and understand it — without local knowledge?" },
  { l: "B", k: "Budget", d: "฿100 flat against ฿600–1,000 for a Grab. The spread does the marketing by itself." },
  { l: "C", k: "Comfort", d: "Air-con, a real seat, space for the luggage. After a red-eye, comfort converts." },
  { l: "D", k: "Duration", d: "Not fastest — predictable. A known 95 minutes beats an unknown 60 every time." },
  { l: "E", k: "Experience", d: "The window seat over the Kamala coast is content. The ride can be part of the holiday." },
  { l: "F", k: "Free", d: "Free of the parking hunt, the rental desk, the deposit, the damage claim on return." },
  { l: "G", k: "Green", d: "A lower-carbon bus fleet — the choice a growing share of travelers already wants to make." },
  { l: "H", k: "Hip", d: "Nobody photographs a rental counter. A bus that is cool gets chosen for being cool." },
];

/** The falsifiable questions this console exists to test — each mapped to
 *  the instrument that tests it. */
const HYPOTHESES = [
  {
    q: "If the bus is cheap enough, does price override the convenience of a rental car?",
    t: "The app keeps the ฿100 bus beside the ฿720 taxi. Real ticket sales will tell us whether the price gap changes behaviour or merely wins arguments."
  },
  {
    q: "If we match supply to airport demand hour by hour, can we pull people out of rental cars?",
    t: "This is the whole engine. Missed Money finds the bad hours; the fleet stepper adds a bus and reruns the day. No bus is purchased for emotional reasons."
  },
  {
    q: "If bus + Grab connect seamlessly for the last mile, does it beat renting a motorbike — for tourists who hold no license at home and meet Phuket's rain-slick mountain roads as amateurs?",
    t: "First–last mile ranked #1 for impact and is still the model's biggest blank. Stop catchments and feeder-trip data would turn it from a good idea into a priced one."
  },
  {
    q: "If we make taking the bus cool, does persona 8 — premium, app-first, Grab-loyal — switch?",
    t: "Persona 8 does not need a lecture about sustainability. They need a clean bus, an arrival time they believe and a tap in the app. Then we count whether they switch."
  },
  {
    q: "If we intercept the 'how do I get around Phuket' decision before travelers leave the arrivals hall, does capture jump?",
    t: "The choice is often made in the first fifty metres after customs. The console does not model that persuasion yet. An arrivals-hall pilot, with a control period, would."
  },
];

const OBJECTIVES = [
  { k: "Congestion", d: "Fewer private cars and vans on a road network already at capacity" },
  { k: "Safety", d: "Fewer motorbike-taxi and rental-car trips by first-time visitors" },
  { k: "Emissions", d: "Shared bus trips replacing higher-emission door-to-door runs" },
  { k: "User cost", d: "฿100 flat vs ฿600–1,000 Grab — money that stays in tourists' pockets" },
  { k: "Operator cost", d: "A private operator with no subsidy must fill seats or die" },
];

const CITY_CONTRAST = [
  { dim: "How visitors arrive", phuket: "By air, ~60% international (ASEAN, Russia #1, India, China)", vegas: "By car from Southern California; 10% international" },
  { dim: "First trip on arrival", phuket: "Airport → dispersed resorts, immediately", vegas: "Park once, walk the Strip" },
  { dim: "Transit governance", phuket: "Fragmented private operators; national-level licensing (DLT)", vegas: "One public agency (RTC), unified brand" },
  { dim: "The handicap", phuket: "Buses may not stop directly at hotels — taxis win door-to-door", vegas: "Cars win because parking is abundant" },
  { dim: "Terrain", phuket: "Rugged island; airport, resorts and town far apart", vegas: "Flat grid, one corridor" },
];

const PERSONAS = [
  { n: 1, who: "Low-income students & workers", split: "100% resident", need: "Affordability, road safety, clearer drivers", user: true },
  { n: 2, who: "Bus-friendly freelancers", split: "37:63 res:visitor", need: "Professional drivers, shorter waits", user: true },
  { n: 3, who: "Young male adventure visitors", split: "98% visitor", need: "Convenient, affordable, shorter waits", user: true },
  { n: 4, who: "High-income visitors open to buses", split: "100% visitor", need: "Feeling safe; tourist info on board", user: true },
  { n: 5, who: "Budget young riders on motorbikes", split: "48:52", need: "Cleanliness, app integration", user: false },
  { n: 6, who: "Freelancers on motorbike/car/Grab", split: "58:42", need: "App, stops closer to destinations", user: false },
  { n: 7, who: "Mid-income private-car residents", split: "92% resident", need: "Driver communication, on-board service", user: false },
  { n: 8, who: "Premium app-first visitors (Grab loyal)", split: "95% visitor", need: "Punctuality, cleanliness, app", user: false },
];

const THEMES = [
  "Driver professionalism",
  "Waiting time",
  "App integration",
  "Tourist info at stops",
  "Reliability",
  "Cleanliness & comfort",
];

// Impact–Effort points (Figure 6), axes 4–10; quadrant split at ~7.6 / 8.15.
// `end` anchors the label left of the dot (crowded right edge); dy staggers
// colliding rows.
const RECS: { n: number; label: string; e: number; i: number; q: "quick" | "major" | "fill" | "hard"; end?: boolean; dy?: number }[] = [
  { n: 13, label: "First–last mile connectivity", e: 9.3, i: 9.7, q: "major", end: true },
  { n: 8, label: "Adjust routes", e: 9.2, i: 9.5, q: "major", end: true },
  { n: 2, label: "Increase frequency", e: 9.7, i: 9.2, q: "major", end: true },
  { n: 11, label: "Gov agency capacity", e: 8.8, i: 9.2, q: "major", end: true, dy: 16 },
  { n: 12, label: "Route coverage", e: 9.0, i: 9.0, q: "major", end: true, dy: 16 },
  { n: 1, label: "Boarding/alighting points", e: 7.8, i: 9.0, q: "major", end: true, dy: -12 },
  { n: 14, label: "Positive-attitude campaign", e: 9.1, i: 8.7, q: "major", end: true },
  { n: 4, label: "Driving safety standards", e: 5.5, i: 8.6, q: "quick" },
  { n: 10, label: "Driver service skills", e: 6.9, i: 8.4, q: "quick" },
  { n: 6, label: "App integration", e: 6.8, i: 8.3, q: "quick", dy: 12 },
  { n: 15, label: "Free trial rides", e: 6.6, i: 7.9, q: "quick" },
  { n: 3, label: "Accurate timetable info", e: 4.6, i: 7.5, q: "quick" },
  { n: 7, label: "On-board service upgrades", e: 6.6, i: 6.3, q: "fill" },
  { n: 9, label: "Low-floor buses", e: 8.4, i: 6.3, q: "hard" },
  { n: 5, label: "Next-stop displays", e: 6.5, i: 5.7, q: "fill" },
];

const LEDGER = [
  { finding: "Published PKSB timetable is the supply; no subsidy backstop", model: "Supply fixed by schedule, both directions; ฿100/boarding is the only revenue", surface: "Every ฿ on this console" },
  { finding: "Arrivals mix: ~60% international; Russians, Indians, Chinese lead (AOT)", model: "Capture heuristics by origin — Europeans rent cars 3%, SE Asia budget carriers 7%; fleet-wide ≈5%", surface: "Demand panel, per-flight +n trace" },
  { finding: "Departing visitors must reach the airport before check-in closes", model: "Return leg: at airport by T−60, latest feasible northbound bus, overflow cascades or takes Grab", surface: "OUT → airport bars, return-trip bus loads" },
  { finding: "Non-users cite waiting time & unpredictability, not destinations", model: "60-minute patience: queue longer than that walks away — revenue counted as missed", surface: "Walked-away ฿, alert banner" },
  { finding: "Buses run intervals; planes don't", model: "FIFO queue at minute resolution; conservation demand = boarded + lost held exactly, tested", surface: "Missed Money · Hour by Hour" },
  { finding: "\"Increase frequency\" ranked top-impact but unpriced", model: "Fleet scenario: ±N buses re-runs the whole day, both directions", surface: "Fleet Scenario stepper (right panel)" },
];

const DATA_WANTED = [
  { metric: "Real daily arrivals & load factors", source: "AOT flight feed (the annual reports already exist)", unlocks: "Replaces the curated peak-day schedule — demand curve becomes fact" },
  { metric: "Ticketing / boarding counts", source: "PKSB fare system", unlocks: "Calibrates the 8 capture heuristics into measured rates, by hour and by origin" },
  { metric: "Live GPS (AVL)", source: "Fleet trackers — ingest endpoints already built in server/", unlocks: "Simulated positions become real ones; one import swap by design" },
  { metric: "OD survey re-runs", source: "Toolkit method — the ~$20k Chulalongkorn instrument is reusable", unlocks: "1 km demand grids (Figures 2–5) as a live map layer; persona drift over seasons" },
  { metric: "Hotel occupancy by zone", source: "Patong Hotel Association / THA Southern Chapter", unlocks: "Return-leg origins weighted by where tourists actually sleep" },
  { metric: "App analytics", source: "PKSB app + trip planners", unlocks: "Converts persona 8 (app-first, Grab-loyal) — the highest-value shift the survey found" },
];

const GAPS = [
  { gap: "First–last mile isn't modelled", why: "The toolkit's single highest-impact intervention (#13). A 500 m stop catchment assumption would price feeder loops and walking access." },
  { gap: "The hotel-stop ban isn't a variable", why: "Regulation forbids buses stopping at hotels — a structural capture suppressor taxis exploit. Worth modelling as a scenario toggle: what would door-adjacent stops earn?" },
  { gap: "Residents ride too", why: "Personas 1–2 and 7 are locals (Phuket Mahanakorn's base). The model is flight-driven; a resident base-load would lift off-peak truth." },
  { gap: "Service quality isn't a lever yet", why: "The six themes (drivers, waiting, app, info, reliability, cleanliness) shift capture — the survey says so. Today capture is origin-only; themed multipliers would let the scenario card price a driver-training program, not just a bus." },
  { gap: "Seasonality", why: "The week model is high-season. AOT monthly curves would give a monsoon week and an honest annual number." },
];

const CAUSAL_STORIES = [
  {
    id: "wait",
    tab: "The wait",
    observation: "Non-riders use the same Town–Kathu–Patong corridor as riders.",
    correlation: "The route is useful. The service still loses them.",
    cause: "Long, uncertain waits make a cheap bus feel expensive in time.",
    intervention: "Match departures to flight demand, hour by hour.",
    measure: "Boarded, still waiting, walked away and missed baht.",
  },
  {
    id: "last-mile",
    tab: "The last mile",
    observation: "Visitors value the bus fare but still choose door-to-door transport.",
    correlation: "Price matters. Convenience often wins anyway.",
    cause: "The bus can reach the corridor without reaching the hotel door.",
    intervention: "Test a bus + feeder or bus + Grab connection.",
    measure: "Conversion by stop catchment, transfer time and total trip cost.",
  },
  {
    id: "trust",
    tab: "The trust gap",
    observation: "Punctuality, information and cleanliness recur across eight personas.",
    correlation: "People who distrust the service are less willing to try it.",
    cause: "A timetable nobody believes is just decorative typography.",
    intervention: "Publish live arrival evidence and improve service delivery.",
    measure: "Repeat use, app conversion, observed punctuality and complaints.",
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

// ---------------------------------------------------------------------------
// SVG figures — hand-coded, Axiom palette, zero decoration
// ---------------------------------------------------------------------------

function PipelineFigure() {
  const steps = [
    ["Stakeholders", "5 groups mapped"],
    ["Travel survey", "~$20k · Cochran-sized · 500 m buffers"],
    ["8 personas", "clustered, users + non-users"],
    ["Co-design", "~$5k workshop · 15 recommendations"],
    ["Impact–Effort", "sequenced action"],
  ];
  return (
    <ol className="tk-pipeline" aria-label="Toolkit method pipeline">
      {steps.map(([title, detail]) => (
        <li key={title}>
          <strong>{title}</strong>
          <span>{detail}</span>
        </li>
      ))}
    </ol>
  );
}

function ImpactEffortFigure() {
  const W = 860, H = 520, pad = 46;
  const x = (e: number) => pad + ((e - 4) / 6) * (W - pad - 16);
  const y = (i: number) => H - pad - ((i - 5) / 5) * (H - pad - 30);
  const splitX = x(7.6), splitY = y(8.15);
  const qColor = { quick: "#1f6e43", major: "#c47a0f", fill: "#a9a59a", hard: "#a23a26" } as const;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="tk-fig" role="img" aria-label="Impact–effort framework, 15 stakeholder recommendations">
      {/* Quadrant tints — flat, near-invisible, hairline-separated */}
      <rect x={pad} y={30} width={splitX - pad} height={splitY - 30} fill="#f2f7f3" />
      <rect x={splitX} y={30} width={W - 16 - splitX} height={splitY - 30} fill="#fdf6ea" />
      <line x1={splitX} y1={30} x2={splitX} y2={H - pad} stroke="#d2cfc5" strokeDasharray="4 4" />
      <line x1={pad} y1={splitY} x2={W - 16} y2={splitY} stroke="#d2cfc5" strokeDasharray="4 4" />
      <line x1={pad} y1={H - pad} x2={W - 16} y2={H - pad} stroke="#191712" />
      <line x1={pad} y1={30} x2={pad} y2={H - pad} stroke="#191712" />
      <text x={pad + 8} y={46} fontSize="11" fontWeight="700" fill="#1f6e43" letterSpacing="1">QUICK WINS — DO NOW</text>
      <text x={splitX + 8} y={46} fontSize="11" fontWeight="700" fill="#8a4a00" letterSpacing="1">MAJOR PROJECTS — FUND & SEQUENCE</text>
      <text x={pad + 8} y={splitY + 16} fontSize="11" fontWeight="700" fill="#6f6c63" letterSpacing="1">FILL-INS</text>
      <text x={splitX + 8} y={splitY + 16} fontSize="11" fontWeight="700" fill="#a23a26" letterSpacing="1">HARD SLOG — DEPRIORITIZE</text>
      <text x={(W + pad) / 2} y={H - 10} textAnchor="middle" fontSize="11" fill="#6f6c63" letterSpacing="2">EFFORT →</text>
      <text x={14} y={(H - pad + 30) / 2} fontSize="11" fill="#6f6c63" letterSpacing="2" transform={`rotate(-90 14 ${(H - pad + 30) / 2})`}>IMPACT →</text>
      {RECS.map((r) => (
        <g key={r.n}>
          <circle cx={x(r.e)} cy={y(r.i)} r={5} fill={qColor[r.q]} />
          <text
            x={x(r.e) + (r.end ? -10 : 9)}
            y={y(r.i) + 4 + (r.dy ?? 0)}
            fontSize="11"
            fill="#191712"
            textAnchor={r.end ? "end" : "start"}
          >{r.n} · {r.label}</text>
        </g>
      ))}
    </svg>
  );
}

function CausalMap() {
  const [activeId, setActiveId] = useState<(typeof CAUSAL_STORIES)[number]["id"]>("wait");
  const active = CAUSAL_STORIES.find((story) => story.id === activeId) ?? CAUSAL_STORIES[0];

  return (
    <div className="tk-causal">
      <div className="tk-causal__tabs" role="group" aria-label="Choose a research question">
        {CAUSAL_STORIES.map((story) => (
          <button
            key={story.id}
            type="button"
            aria-pressed={story.id === activeId}
            onClick={() => setActiveId(story.id)}
          >
            {story.tab}
          </button>
        ))}
      </div>
      <div className="tk-causal__graph" role="img" aria-label={`${active.observation} This suggests ${active.correlation} We test ${active.cause} by ${active.intervention} and measure ${active.measure}`}>
        <div className="tk-causal__node">
          <span>01 · We observed</span>
          <strong>{active.observation}</strong>
        </div>
        <div className="tk-causal__edge tk-causal__edge--correlation">
          <span>correlation</span>
          <b>suggests, does not prove</b>
        </div>
        <div className="tk-causal__node">
          <span>02 · Our best explanation</span>
          <strong>{active.cause}</strong>
          <small>{active.correlation}</small>
        </div>
        <div className="tk-causal__edge tk-causal__edge--causal">
          <span>causal test</span>
          <b>change one thing</b>
        </div>
        <div className="tk-causal__node tk-causal__node--test">
          <span>03 · We would change</span>
          <strong>{active.intervention}</strong>
          <small>Then measure: {active.measure}</small>
        </div>
      </div>
      <p className="tk-note">A relationship is a clue. An intervention with a measured outcome is evidence. The dashboard is the measuring instrument, not the conclusion.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The tab
// ---------------------------------------------------------------------------

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
  const accountedFor = boarded + waiting + walkedAway;

  return (
    <main className="v2-toolkit">
      <h1 className="sr-only">Phuket Smart Bus Toolkit</h1>
      <div className="tk-inner">
        <nav className="tk-index" aria-label="Toolkit chapters">
          <a href="#toolkit-system"><span>01</span> The system</a>
          <a href="#toolkit-thinking"><span>02</span> The thinking</a>
          <a href="#toolkit-evidence"><span>03</span> The evidence</a>
          <a href="#toolkit-build"><span>04</span> The build</a>
        </nav>

        {/* ── The working system is the hero ─────────────────────────── */}
        <section className="tk-system-hero" id="toolkit-system" aria-labelledby="tk-system-title">
          <div className="tk-system-hero__copy">
            <span className="tk-eyebrow">The system is the hero</span>
            <h2 className="tk-display" id="tk-system-title">We did the research. Then we made it move.</h2>
            <p className="tk-lead">
              A report can tell you buses and travelers miss each other. This one
              watches it happen, prices the miss, and lets the operator try another
              bus before buying one. Much cheaper than learning by parking a new bus.
            </p>
            <div className="tk-actions">
              <button className="tk-action tk-action--primary" type="button" onClick={onOpenSystem}>Open the live system <span aria-hidden="true">→</span></button>
              <a className="tk-action" href="#toolkit-evidence">Follow the evidence <span aria-hidden="true">↓</span></a>
            </div>
          </div>

          <div className="tk-live" aria-label={`Live simulation at ${clockLabel}`}>
            <div className="tk-live__status">
              <span><i aria-hidden="true" /> LIVE MODEL · {clockLabel}</span>
              <span>{movingBuses} buses moving · 30× time</span>
            </div>
            <ol className="tk-live__chain">
              <li><span>Flights landed</span><strong>{flightsLanded}</strong><small>{arrivingPax.toLocaleString()} arriving passengers</small></li>
              <li><span>Likely bus riders</span><strong>{likelyRiders.toLocaleString()}</strong><small>3–7% by passenger origin</small></li>
              <li><span>Boarded</span><strong>{boarded.toLocaleString()}</strong><small>25 seats per airport bus</small></li>
              <li><span>Waiting now</span><strong>{waiting.toLocaleString()}</strong><small>{walkedAway.toLocaleString()} already walked away</small></li>
            </ol>
            <div className="tk-live__money">
              <span><small>Earned</small><strong>฿{revenueThb.toLocaleString()}</strong></span>
              <span><small>Missed</small><strong>฿{missedThb.toLocaleString()}</strong></span>
            </div>
            <p className={`tk-live__check ${accountedFor === likelyRiders ? "is-true" : ""}`}>
              {likelyRiders.toLocaleString()} likely riders = {boarded.toLocaleString()} boarded + {waiting.toLocaleString()} waiting + {walkedAway.toLocaleString()} walked away
            </p>
          </div>
        </section>

        <section className="tk-story" aria-label="Why the system exists">
          <span className="tk-story__number">00</span>
          <div>
            <h2>Everyone came to the meeting. The buses still ran emptier than expected.</h2>
            <p>
              Regulators, operators, hotels and universities were in the room. The
              missing person was demand. Nobody could say, hour by hour, who needed
              the bus and whether a seat would be there. So we stopped producing
              another recommendation and built the instrument the recommendation needed.
            </p>
          </div>
        </section>

        {/* ── The thesis ──────────────────────────────────────────────── */}
        <section className="tk-section" id="toolkit-thinking">
          <span className="tk-chapter">02 · The thinking</span>
          <h2 className="tk-section-title">Nobody chooses a mode because a planner says it is efficient.</h2>
          <p className="tk-body">
            People choose the whole deal: money, certainty, comfort, image and the
            nonsense they avoid. Eight useful lenses keep us honest. “Fast” is only
            one of them, and not always the winner.
          </p>
          <div className="tk-tenets">
            {TENETS.map((t) => (
              <div className="tk-tenet" key={t.l}>
                <span className="tk-tenet__l">{t.l}</span>
                <span className="tk-tenet__k">{t.k}</span>
                <span className="tk-tenet__d">{t.d}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── The hypotheses ──────────────────────────────────────────── */}
        <section className="tk-section">
          <h2 className="tk-section-title tk-section-title--small">Good research gives the system something it can prove wrong.</h2>
          <p className="tk-body">
            These are not inspirational questions. Each one demands a number that
            can embarrass us later. That is healthy.
          </p>
          {HYPOTHESES.map((h, i) => (
            <div className="tk-hyp" key={i}>
              <span className="tk-hyp__q">{h.q}</span>
              <span className="tk-hyp__t">{h.t}</span>
            </div>
          ))}
        </section>

        {/* ── Two cities, one problem ─────────────────────────────────── */}
        <section className="tk-section">
          <h2 className="tk-section-title tk-section-title--small">Phuket and Las Vegas: same tourism, opposite physics.</h2>
          <div className="tk-table" role="table">
            <div className="tk-tr tk-tr--head" role="row">
              <span role="columnheader"></span>
              <span role="columnheader">Phuket</span>
              <span role="columnheader">Las Vegas</span>
            </div>
            {CITY_CONTRAST.map((r) => (
              <div className="tk-tr" role="row" key={r.dim}>
                <span className="tk-dim" role="cell">{r.dim}</span>
                <span role="cell">{r.phuket}</span>
                <span role="cell">{r.vegas}</span>
              </div>
            ))}
          </div>
          <p className="tk-note">
            Las Vegas tries to get visitors out of cars after they arrive. Phuket
            must win the very first trip, while the taxi is waiting at the door and
            the bus is not allowed to be. Same workshop vocabulary; very different Tuesday.
          </p>
        </section>

        {/* ── Objectives ──────────────────────────────────────────────── */}
        <section className="tk-section">
          <h2 className="tk-section-title tk-section-title--small">One bus problem is secretly five problems.</h2>
          <div className="tk-objectives">
            {OBJECTIVES.map((o) => (
              <div className="tk-obj" key={o.k}>
                <span className="tk-obj__k">{o.k}</span>
                <span className="tk-obj__d">{o.d}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Method ──────────────────────────────────────────────────── */}
        <section className="tk-section">
          <h2 className="tk-section-title tk-section-title--small">The method, with the ceremony removed.</h2>
          <p className="tk-body">
            Map who can say yes. Survey riders and non-riders where they actually
            travel. Turn the answers into eight recognisable people, not one mythical
            “average user.” Then put the people who control the system in a room until
            fifteen actions come out ranked. Coffee helps. Evidence helps more.
          </p>
          <PipelineFigure />
        </section>

        <section className="tk-section" id="toolkit-evidence">
          <span className="tk-chapter">03 · The evidence</span>
          <h2 className="tk-section-title">Correlation gives us a suspect. Causation needs an experiment.</h2>
          <p className="tk-body">
            A beautiful network diagram can still be a bowl of spaghetti. This one
            is a guided path: what we saw, what might explain it, what we change, and
            what number decides whether we were right.
          </p>
          <CausalMap />
        </section>

        {/* ── Findings ────────────────────────────────────────────────── */}
        <section className="tk-section">
          <h2 className="tk-section-title tk-section-title--small">The non-riders are not somewhere else. They are right there.</h2>
          <p className="tk-body">
            The origin–destination grids gave us the useful bit: <strong>non-users
            travel the same Phuket Town–Kathu–Patong corridor the bus already
            serves.</strong> The route is not innocent, but it is not the whole crime.
            People are choosing another mode because the total offer works better.
          </p>
          <div className="tk-personas">
            {PERSONAS.map((p) => (
              <div className={`tk-persona ${p.user ? "is-user" : ""}`} key={p.n}>
                <span className="tk-persona__n">{p.n}</span>
                <span className="tk-persona__who">{p.who}</span>
                <span className="tk-persona__split">{p.split}</span>
                <span className="tk-persona__need">{p.need}</span>
                <span className="tk-persona__tag">{p.user ? "RIDES TODAY" : "COULD RIDE"}</span>
              </div>
            ))}
          </div>
          <p className="tk-body">
            Across all eight, the same six annoyances keep turning up:
          </p>
          <div className="tk-themes">
            {THEMES.map((t) => <span className="tk-theme" key={t}>{t}</span>)}
          </div>
        </section>

        {/* ── Recommendations ─────────────────────────────────────────── */}
        <section className="tk-section">
          <h2 className="tk-section-title tk-section-title--small">Fifteen ideas entered. Impact and effort decided who left first.</h2>
          <ImpactEffortFigure />
          <ol className="tk-recs-mobile" aria-label="Ranked recommendations">
            {RECS.map((recommendation) => (
              <li key={recommendation.n}>
                <span>{String(recommendation.n).padStart(2, "0")}</span>
                <strong>{recommendation.label}</strong>
                <small>{recommendation.q === "quick" ? "Do now" : recommendation.q === "major" ? "Fund and sequence" : recommendation.q === "fill" ? "Fill-in" : "Hard slog"}</small>
              </li>
            ))}
          </ol>
          <p className="tk-note">
            The cheap wins are mostly trust: safer driving, better information,
            decent service. The expensive ones involve asphalt, routes and buses.
            The live scenario tool prices “increase frequency” before the purchase
            order does. Procurement officers may now breathe normally.
          </p>
        </section>

        {/* ── Assumption ledger ───────────────────────────────────────── */}
        <section className="tk-section" id="toolkit-build">
          <span className="tk-chapter">04 · The build</span>
          <h2 className="tk-section-title">Every research sentence has to earn a job in the software.</h2>
          <p className="tk-body">
            Finding → assumption → code → visible decision. If we cannot trace the
            route, the number does not get a seat on the dashboard.
          </p>
          <div className="tk-table tk-table--ledger" role="table">
            <div className="tk-tr tk-tr--head" role="row">
              <span role="columnheader">Toolkit finding</span>
              <span role="columnheader">Model assumption</span>
              <span role="columnheader">Where it lives</span>
            </div>
            {LEDGER.map((r) => (
              <div className="tk-tr" role="row" key={r.surface}>
                <span role="cell">{r.finding}</span>
                <span role="cell">{r.model}</span>
                <span className="tk-dim" role="cell">{r.surface}</span>
              </div>
            ))}
          </div>
          <p className="tk-note">
            The non-negotiable law: nobody disappears into a PowerPoint transition.
            Every likely rider boards, waits, or walks away — exactly once. The test
            suite checks that conservation across the modelled day.
          </p>
        </section>

        {/* ── Data wanted ─────────────────────────────────────────────── */}
        <section className="tk-section">
          <h2 className="tk-section-title tk-section-title--small">The simulation is scaffolding. Real data replaces one plank at a time.</h2>
          <p className="tk-body">
            We are not pretending the estimates are sensors. Each future data feed
            has a named place to land and a specific assumption to retire.
          </p>
          <div className="tk-table tk-table--ledger" role="table">
            <div className="tk-tr tk-tr--head" role="row">
              <span role="columnheader">Data</span>
              <span role="columnheader">Source</span>
              <span role="columnheader">What it unlocks</span>
            </div>
            {DATA_WANTED.map((r) => (
              <div className="tk-tr" role="row" key={r.metric}>
                <span className="tk-dim" role="cell">{r.metric}</span>
                <span role="cell">{r.source}</span>
                <span role="cell">{r.unlocks}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Honest gaps ─────────────────────────────────────────────── */}
        <section className="tk-section">
          <h2 className="tk-section-title tk-section-title--small">What we do not know yet — printed here so nobody mistakes confidence for accuracy.</h2>
          {GAPS.map((g) => (
            <div className="tk-gap" key={g.gap}>
              <span className="tk-gap__k">{g.gap}</span>
              <span className="tk-gap__d">{g.why}</span>
            </div>
          ))}
        </section>

        {/* ── Bio + source ────────────────────────────────────────────── */}
        <section className="tk-section tk-program">
          <h2 className="tk-section-title tk-section-title--small">The serious people who made the useful trouble possible.</h2>
          <div className="tk-logos">
            <img src={`${import.meta.env.BASE_URL}brand/usascp.png`} alt="U.S.-ASEAN Smart Cities Partnership (USASCP)" className="tk-logo" />
            <img src={`${import.meta.env.BASE_URL}brand/usdot.svg`} alt="U.S. Department of Transportation" className="tk-logo" />
            <img src={`${import.meta.env.BASE_URL}brand/depa.jpg`} alt="Digital Economy Promotion Agency (DEPA)" className="tk-logo" />
            <img src={`${import.meta.env.BASE_URL}brand/smart-city-thailand.jpg`} alt="Smart City Thailand Office" className="tk-logo" />
          </div>
          <p className="tk-body">
            This work grew from the <strong>U.S.-ASEAN Smart Cities Mobility
            Program</strong>, led by U.S. DOT under USASCP with the U.S. Department
            of State. Phuket was paired with Las Vegas; METRANS/USC, Chulalongkorn
            CUTI, DEPA, RTC Southern Nevada, PKCD / Phuket Smart Bus, Phuket
            Mahanakorn and DLT brought the brains, constraints and actual buses.
          </p>
          <p className="tk-body">
            Credit to <strong>Roshan Desai</strong> for leading the transportation
            program and making an unlikely city pairing useful instead of ceremonial.
            <a className="tk-link" href="https://www.usascp.org/programs/transportationprogram/" target="_blank" rel="noreferrer"> Read the program →</a>
          </p>
        </section>

        <section className="tk-section tk-bio">
          <h2 className="tk-section-title tk-section-title--small">Who built this, and why.</h2>
          <p className="tk-body">
            <strong>Non Arkara</strong> is an architect who got tired of city reports
            ending exactly where the work should begin. He builds urban-intelligence
            systems across Thailand and ASEAN, created the SLIC and SCITI city
            indices, worked on the Phuket–Las Vegas program from day one, and built
            this console so the next bus decision starts with evidence rather than a
            confident person pointing at a timetable.
          </p>
          <p className="tk-source">
            Source: <em>Transit Service Planning for Sustainable Tourism Travel —
            Insights from Phuket and Las Vegas</em>, US-ASEAN Smart Cities Mobility
            Program (U.S. DOT, U.S. Dept. of State, METRANS/USC, Chulalongkorn CUTI).
            Visitor-mix figures: AOT Annual Reports 2024–2025. Simulation assumptions:
            this repository, tested. Diagram approach informed by the open-source
            <a className="tk-link" href="https://github.com/Egonex-AI/Understand-Anything" target="_blank" rel="noreferrer"> Understand Anything</a>
            principle that graphs should teach rather than merely impress.
          </p>
        </section>
      </div>
    </main>
  );
}
