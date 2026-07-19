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
 * sharpen it. All figures are hand-coded SVG under the Axiom laws — zero
 * radius, zero gradient, zero shadow, green + amber only.
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
    t: "The ฿100-vs-฿720 spread runs through every surface; the capture heuristics are the knob that real ticketing data will answer this with."
  },
  {
    q: "If we match supply to airport demand hour by hour, can we pull people out of rental cars?",
    t: "The whole demand-supply engine. The Missed Money diagram shows exactly which hours the match fails today; the Fleet Scenario stepper prices fixing it."
  },
  {
    q: "If bus + Grab connect seamlessly for the last mile, does it beat renting a motorbike — for tourists who hold no license at home and meet Phuket's rain-slick mountain roads as amateurs?",
    t: "First–last mile is the toolkit's #1-impact intervention and this model's declared gap — the next thing the data unlocks. The safety case is already on the tourist app's risk strip."
  },
  {
    q: "If we make taking the bus cool, does persona 8 — premium, app-first, Grab-loyal — switch?",
    t: "Tenet H. The survey says punctuality, cleanliness and app integration are their price of entry; the positive-attitude campaign (#14) is the push."
  },
  {
    q: "If we intercept the 'how do I get around Phuket' decision before travelers leave the arrivals hall, does capture jump?",
    t: "Boarding/alighting points (#1) and tourist information (theme 4) — the decision is made in the first fifty meters after customs. Nothing on this console models it yet; an arrivals-hall pilot would."
  },
];

const OBJECTIVES = [
  { k: "Congestion", d: "Fewer private cars and vans on a road network already at capacity" },
  { k: "Safety", d: "Fewer motorbike-taxi and rental-car trips by first-time visitors" },
  { k: "Emissions", d: "EV buses replacing petrol door-to-door runs" },
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
  const W = 860, H = 92, box = 150, gap = (W - box * 5) / 4;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="tk-fig" role="img" aria-label="Toolkit method pipeline">
      {steps.map(([t, d], i) => {
        const x = i * (box + gap);
        return (
          <g key={t}>
            <rect x={x} y={18} width={box} height={56} fill="#ffffff" stroke="#d2cfc5" />
            <text x={x + box / 2} y={42} textAnchor="middle" fontSize="13" fontWeight="700" fill="#191712">{t}</text>
            <text x={x + box / 2} y={60} textAnchor="middle" fontSize="10" fill="#6f6c63">{d}</text>
            {i < 4 && <path d={`M ${x + box + 6} 46 h ${gap - 18} m -6 -5 l 6 5 l -6 5`} stroke="#a9a59a" fill="none" />}
          </g>
        );
      })}
    </svg>
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

// ---------------------------------------------------------------------------
// The tab
// ---------------------------------------------------------------------------

export function ToolkitPanel() {
  return (
    <main className="v2-toolkit">
      <div className="tk-inner">

        {/* ── Why this exists ─────────────────────────────────────────── */}
        <section className="tk-hero">
          <span className="tk-eyebrow">The Toolkit Behind This Console</span>
          <h1 className="tk-title">Everyone collaborated. The buses still ran emptier than expected.</h1>
          <p className="tk-lead">
            In October 2024, Phuket Smart Bus — a private operator under Phuket City
            Development — launched a new EV route between Phuket Town and Patong,
            with the Department of Land Transport's blessing. Regulators, operators,
            hotels and universities all showed up. And ridership still came in under
            expectations. The toolkit's own closing lesson says why: <em>nobody had
            reliable demand data. Service design wasn't aligned with how people
            actually travel.</em> Buses run on intervals; travelers don't.
          </p>
          <p className="tk-lead">
            This console is the answer to that sentence. It models the demand the
            island already generates — every arriving and departing flight — against
            the fixed timetable, and prices the mismatch in baht, hour by hour. When
            real data arrives, the heuristics become measurements. The machine is
            already built.
          </p>
        </section>

        {/* ── The thesis ──────────────────────────────────────────────── */}
        <section className="tk-section">
          <h2 className="tk-h2">The Thesis — Nobody Chooses a Mode Because It Is Fast</h2>
          <p className="tk-body">
            Transport planning keeps optimizing for speed while travelers keep
            choosing on everything else: money, certainty, comfort, image, the
            hassle they are escaping. Eight tenets, A to H, decide whether a
            visitor steps onto a bus — and every one of them is designable.
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
          <h2 className="tk-h2">The Hypotheses — What If?</h2>
          <p className="tk-body">
            A simulation is only worth building if it can be proven wrong.
            These are the falsifiable questions this console exists to test,
            each with the instrument that tests it:
          </p>
          {HYPOTHESES.map((h, i) => (
            <div className="tk-hyp" key={i}>
              <span className="tk-hyp__q">{h.q}</span>
              <span className="tk-hyp__t">{h.t}</span>
            </div>
          ))}
        </section>

        {/* ── Program credit ──────────────────────────────────────────── */}
        <section className="tk-section">
          <h2 className="tk-h2">The Program</h2>
          <div className="tk-logos">
            <img src={`${import.meta.env.BASE_URL}brand/usascp.png`} alt="U.S.-ASEAN Smart Cities Partnership (USASCP)" className="tk-logo" />
            <img src={`${import.meta.env.BASE_URL}brand/usdot.svg`} alt="U.S. Department of Transportation" className="tk-logo" />
            <img src={`${import.meta.env.BASE_URL}brand/depa.jpg`} alt="Digital Economy Promotion Agency (DEPA)" className="tk-logo" />
            <img src={`${import.meta.env.BASE_URL}brand/smart-city-thailand.jpg`} alt="Smart City Thailand Office" className="tk-logo" />
          </div>
          <p className="tk-body">
            The research behind this comes from the <strong>U.S.-ASEAN Smart Cities
            Mobility Program</strong> — a U.S. Department of Transportation-led
            initiative under the U.S.-ASEAN Smart Cities Partnership (USASCP), with
            the U.S. Department of State, pairing eight cities across two continents.
            Phuket's partner city is <strong>Las Vegas</strong>. Research support came
            from the METRANS Transportation Consortium (USC / CSULB) and the
            Chulalongkorn University Transportation Institute, with DEPA, the Regional
            Transportation Commission of Southern Nevada, PKCD / Phuket Smart Bus,
            Phuket Mahanakorn, and the Department of Land Transport at the table.
          </p>
          <p className="tk-body">
            Credit where it is due: the transportation program — and the
            peer-exchange structure that made a Phuket–Las Vegas pairing produce
            something this practical — is led by <strong>Roshan Desai</strong>{" "}
            (<a className="tk-link" href="https://www.usascp.org/programs/transportationprogram/" target="_blank" rel="noreferrer">usascp.org/programs/transportationprogram</a>).
            I have been part of this project from day one.
          </p>
        </section>

        {/* ── Two cities, one problem ─────────────────────────────────── */}
        <section className="tk-section">
          <h2 className="tk-h2">Two Tourism Cities, Opposite Problems</h2>
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
            Same industry, inverted physics. Las Vegas fights the private car with
            walkability; Phuket must fight the door-to-door taxi with a bus that is
            legally barred from the hotel door. That is why capture rates here are
            single-digit — and why every captured rider is earned.
          </p>
        </section>

        {/* ── Objectives ──────────────────────────────────────────────── */}
        <section className="tk-section">
          <h2 className="tk-h2">Five Things a Bus Fixes at Once</h2>
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
          <h2 className="tk-h2">The Method, Minus the Jargon</h2>
          <p className="tk-body">
            Map who actually controls the system. Survey riders <em>and</em>{" "}
            non-riders where they stand (Cochran-sized sample, 500 m around stops,
            pilot first). Cluster the answers into eight real people instead of one
            imaginary average passenger. Then lock the people who run the system in
            a room until the findings become fifteen ranked actions.
          </p>
          <PipelineFigure />
        </section>

        {/* ── Findings ────────────────────────────────────────────────── */}
        <section className="tk-section">
          <h2 className="tk-h2">What the Survey Found</h2>
          <p className="tk-body">
            The origin–destination grids produced the single most useful sentence in
            the study: <strong>non-users travel the same Phuket Town–Kathu–Patong
            corridor the bus already serves.</strong> They are not going somewhere
            else — they are choosing something else. Non-use is a service-performance
            problem, not a route problem. That is latent demand, standing on the
            curb, priced daily by this console's missed-฿ column.
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
            Across all eight, six service themes decide whether people board:
          </p>
          <div className="tk-themes">
            {THEMES.map((t) => <span className="tk-theme" key={t}>{t}</span>)}
          </div>
        </section>

        {/* ── Recommendations ─────────────────────────────────────────── */}
        <section className="tk-section">
          <h2 className="tk-h2">Fifteen Actions, Ranked by the People Who Must Do Them</h2>
          <ImpactEffortFigure />
          <p className="tk-note">
            Quick wins are people-and-information problems: driver training, safety
            standards, app integration, honest timetables, free trial rides. The
            expensive quadrant is structural: first–last mile, routes, frequency.
            This console exists to price that quadrant — the Fleet Scenario stepper
            on the OPS view re-runs the whole day for "increase frequency" (#2)
            before anyone signs for a bus.
          </p>
        </section>

        {/* ── Assumption ledger ───────────────────────────────────────── */}
        <section className="tk-section">
          <h2 className="tk-h2">How the Toolkit Became This Dashboard</h2>
          <p className="tk-body">
            Every number on this console traces to a modelling assumption, and every
            assumption traces to a finding. The ledger, in full:
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
            One law binds all of it: passengers are conserved. Everyone who wants a
            bus either boards, gives up, or is still waiting — counted exactly once,
            asserted in tests at every minute of every modelled day.
          </p>
        </section>

        {/* ── Data wanted ─────────────────────────────────────────────── */}
        <section className="tk-section">
          <h2 className="tk-h2">If We Can Find the Data, We Can Map This Better</h2>
          <p className="tk-body">
            The toolkit's hardest-won lesson is that collaboration without demand
            intelligence produces empty buses. Here is exactly which data sharpens
            which number:
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
          <h2 className="tk-h2">What This Model Still Does Not Know</h2>
          {GAPS.map((g) => (
            <div className="tk-gap" key={g.gap}>
              <span className="tk-gap__k">{g.gap}</span>
              <span className="tk-gap__d">{g.why}</span>
            </div>
          ))}
        </section>

        {/* ── Bio + source ────────────────────────────────────────────── */}
        <section className="tk-section tk-bio">
          <h2 className="tk-h2">About</h2>
          <p className="tk-body">
            <strong>Non Arkara</strong> is an architect and urban-intelligence
            practitioner working across Thailand and ASEAN — creator of the SLIC and
            SCITI city indices and builder of operational dashboards for cities that
            want to act on their own data. He has been part of the US-ASEAN Smart
            Cities transportation program from day one, working the Phuket–Las Vegas
            pairing alongside the toolkit team, and built this console for the
            Phuket Smart Bus operation under Phuket City Development — so that the
            next service decision on this island starts from evidence, not
            intervals.
          </p>
          <p className="tk-source">
            Source: <em>Transit Service Planning for Sustainable Tourism Travel —
            Insights from Phuket and Las Vegas</em>, US-ASEAN Smart Cities Mobility
            Program (U.S. DOT, U.S. Dept. of State, METRANS/USC, Chulalongkorn CUTI).
            Visitor-mix figures: AOT Annual Reports 2024–2025. Simulation assumptions:
            this repository, tested.
          </p>
        </section>

      </div>
    </main>
  );
}
