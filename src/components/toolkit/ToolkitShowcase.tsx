import { useEffect, useMemo, useState } from "react";
import { getFleetScenario } from "../../engine/demandSupplyEngine";
import { getHeadlineMetrics, type HeadlineMetrics } from "../../engine/headlineMetrics";
import { AbcdefFramework, ProgramArchive, VegasFile, VEGAS_CASES } from "./ProgramArchive";
import { DesignThinkingStudy, FeasibilityStudy, TryLiveSystem } from "./ToolkitStudy";
import "./toolkit-showcase.css";
import "./toolkit-study.css";

const BUS_URL = "https://bus.nonarkara.org/";
const FIELD_ASSET_ROOT = `${import.meta.env.BASE_URL}toolkit/field-notes/`;

const FIELD_NOTES = [
  {
    city: "Singapore",
    date: "01 Aug 2022",
    src: `${FIELD_ASSET_ROOT}singapore-2022.jpg`,
    note: "The programme begins. Different cities, one stubborn question: how does research survive contact with a real street?"
  },
  {
    city: "Jakarta",
    date: "05 Dec 2022",
    src: `${FIELD_ASSET_ROOT}jakarta-ton-2022.jpg`,
    note: "The first workshop, with Ton Jaitong at the table. The toolkit was still loose paper, argument and possibility."
  },
  {
    city: "Los Angeles",
    date: "12 Jul 2023",
    src: `${FIELD_ASSET_ROOT}los-angeles-2023.jpg`,
    note: "Transit ideas on a flipchart: onboarding, safety, service experience and the unglamorous mechanics that make a system usable."
  },
  {
    city: "Phuket",
    date: "13 Mar 2024",
    src: `${FIELD_ASSET_ROOT}phuket-2024.jpg`,
    note: "Back on the island. The point is not to import a city. It is to sharpen the people already building this one."
  },
  {
    city: "Boston",
    date: "17 Sep 2024",
    src: `${FIELD_ASSET_ROOT}boston-2024.jpg`,
    note: "A wider cohort, a harder standard: show the method, admit the assumptions and make the work reproducible."
  },
  {
    city: "Johor Bahru",
    date: "12 Aug 2025",
    src: `${FIELD_ASSET_ROOT}johor-usdot-2025.jpg`,
    note: "USDOT reunion. The conversation has moved from what cities could do to what our systems can already demonstrate."
  }
];

const HERO_PHOTOS = [
  {
    src: `${FIELD_ASSET_ROOT}singapore-2022.jpg`,
    alt: "depa and USDOT learning cohort in Singapore in August 2022",
    title: "Study the system.",
    meta: "Singapore · 01 Aug 2022"
  },
  {
    src: `${FIELD_ASSET_ROOT}los-angeles-2023.jpg`,
    alt: "Transit service design workshop in Los Angeles in July 2023",
    title: "Draw the argument.",
    meta: "Los Angeles · 12 Jul 2023"
  },
  {
    src: `${FIELD_ASSET_ROOT}phuket-2024.jpg`,
    alt: "City systems field workshop in Phuket in March 2024",
    title: "Bring it home.",
    meta: "Phuket · 13 Mar 2024"
  },
  {
    src: `${FIELD_ASSET_ROOT}boston-2024.jpg`,
    alt: "depa and USDOT learning cohort in Boston in September 2024",
    title: "Make it reproducible.",
    meta: "Boston · 17 Sep 2024"
  },
  {
    src: `${FIELD_ASSET_ROOT}johor-ops-2025.jpg`,
    alt: "Operations discussion in Johor Bahru in August 2025",
    title: "Put it to work.",
    meta: "Johor Bahru · 11 Aug 2025"
  },
  {
    src: `${FIELD_ASSET_ROOT}johor-usdot-2025.jpg`,
    alt: "Dr Non with a USDOT colleague in Johor Bahru in August 2025",
    title: "Signed. Sealed. Now deliver.",
    meta: "Johor Bahru · 12 Aug 2025"
  }
] as const;

const FLIGHT_MONTHS = [
  ["Jan", 8481], ["Feb", 9301], ["Mar", 10705], ["Apr", 11435],
  ["May", 9829], ["Jun", 9971], ["Jul", 9230], ["Aug", 7887],
  ["Sep", 7124], ["Oct", 7943], ["Nov", 8118], ["Dec", 7133]
] as const;

const METHOD_STEPS = [
  ["Observe", "Watch the trip, the queue and the work-around. What people do beats what a questionnaire says they do."],
  ["Frame", "Turn anecdotes into a testable system: demand, capacity, timing, price, trust and the decision each actor controls."],
  ["Trace", "Connect every visible number to a source or calculation. If the lineage ends at ‘because we typed it’, delete it."],
  ["Build", "Make the smallest working instrument that can prove or disprove the story: simulator first, live feeds when available."],
  ["Operate", "Put the answer in front of the person who can act now: passenger, dispatcher, owner, governor or lender."],
  ["Learn", "Record the decision and outcome. A system that cannot be corrected is only a confident poster."
  ]
] as const;

const STAKEHOLDERS = [
  {
    role: "Bus company",
    ask: "Run the evidence loop",
    items: [
      "Stage extra buses against measured arrival waves, not a heroic average day.",
      "Track boarding, alighting, denied boarding and missed demand by trip.",
      "Publish reliability. Trust is an operating asset, not a branding exercise."
    ]
  },
  {
    role: "Government",
    ask: "Buy the public benefit",
    items: [
      "Price the outcomes the farebox cannot: fewer risky trips, lower emissions and less road pressure.",
      "Make stop access, data sharing and signal priority part of the service contract.",
      "Pay for verified performance, with a clear baseline and an honest counterfactual."
    ]
  },
  {
    role: "Banks",
    ask: "Finance what can be measured",
    items: [
      "Underwrite phased fleet growth against fare cashflow plus contracted public-benefit payments.",
      "Release capital when demand, utilisation and service reliability cross agreed gates.",
      "Treat telemetry as loan monitoring: useful evidence, not a glossy appendix."
    ]
  }
];

const TOOL_ECOSYSTEM = [
  {
    name: "SCITI",
    url: "https://cdp.nonarkara.org/",
    fact: "7 pillars",
    copy: "Compares Thai smart-city capability. It tells us where transport sits inside livability, safety, economy and digital delivery."
  },
  {
    name: "SLIC Index",
    url: "https://slic.nonarkara.org/",
    fact: "163 cities",
    copy: "Tests city claims against 22 scored signals and three diagnostics. The lesson: publish the weights and let people disagree."
  },
  {
    name: "FloodDash",
    url: "https://flood.nonarkara.org/",
    fact: "11 pipelines",
    copy: "Turns water, rain, forecast and environmental feeds into an action verb. The lesson: data is not a decision."
  },
  {
    name: "Phuket Smart Bus",
    url: BUS_URL,
    fact: "1 live chain",
    copy: "Connects flights to queues, buses, passengers, revenue, savings and CO₂. The lesson: the model must end in an operating choice."
  }
];

function useLiveMetrics() {
  const [metrics, setMetrics] = useState<HeadlineMetrics>(() => getHeadlineMetrics());
  useEffect(() => {
    const id = window.setInterval(() => setMetrics(getHeadlineMetrics()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return metrics;
}

function formatBaht(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}฿${Math.abs(value).toLocaleString()}`;
}

function Arrow({ direction = "right" }: { direction?: "right" | "down" }) {
  return (
    <svg className={`tk-arrow tk-arrow--${direction}`} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M3 16h23M19 8l8 8-8 8" />
    </svg>
  );
}

function ReadingProgress() {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setValue(max > 0 ? Math.min(1, window.scrollY / max) : 0);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);
  return <div className="tk-progress" style={{ transform: `scaleX(${value})` }} aria-hidden="true" />;
}

function HeroPhotoRotator() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setActiveIndex((current) => (current + 1) % HERO_PHOTOS.length), 5200);
    return () => window.clearInterval(id);
  }, []);

  const active = HERO_PHOTOS[activeIndex];
  return (
    <figure className="tk-hero__photo">
      <div className="tk-hero__photo-stack">
        {HERO_PHOTOS.map((photo, index) => (
          <img key={photo.src} src={photo.src} alt={index === activeIndex ? photo.alt : ""} aria-hidden={index !== activeIndex} className={index === activeIndex ? "is-active" : ""} />
        ))}
      </div>
      <figcaption><strong>{active.title}</strong><span>{active.meta}</span></figcaption>
      <div className="tk-hero__photo-controls" aria-label="Choose hero photograph">
        {HERO_PHOTOS.map((photo, index) => <button key={photo.src} type="button" aria-label={`Show ${photo.meta}`} aria-pressed={index === activeIndex} onClick={() => setActiveIndex(index)}>{String(index + 1).padStart(2, "0")}</button>)}
      </div>
    </figure>
  );
}

function LiveProof() {
  const metrics = useLiveMetrics();
  return (
    <div className="tk-live" aria-label="Live simulation proof">
      <div className="tk-live__status">
        <span className="tk-live__pulse" />
        <span>Simulation live</span>
        <strong>{metrics.clockLabel}</strong>
      </div>
      <div className="tk-live__metric">
        <strong>{metrics.now.paxAtAirport}</strong>
        <span>waiting now</span>
      </div>
      <div className="tk-live__metric">
        <strong>{metrics.fleet.totalBuses}</strong>
        <span>buses active</span>
      </div>
      <div className="tk-live__metric">
        <strong>{metrics.today.paxDelivered.toLocaleString()}</strong>
        <span>delivered today</span>
      </div>
      <div className="tk-live__metric">
        <strong>{Math.round(metrics.today.co2SavedKg).toLocaleString()} kg</strong>
        <span>CO₂ avoided*</span>
      </div>
      <a className="tk-live__link" href={BUS_URL}>Open the working system <span>↗</span></a>
    </div>
  );
}

function EvidenceChain() {
  const nodes = [
    ["Observed", "107,157 movements", "AEROTHAI 2025"],
    ["Modelled", "380 movements", "peak-day fixture"],
    ["Estimated", "3–7%", "bus intent by origin"],
    ["Constrained", "25 seats", "per bus"],
    ["Delivered", "passengers", "not vanity reach"],
    ["Accounted", "฿ · CO₂", "cash + public value"]
  ];
  return (
    <div className="tk-chain" role="img" aria-label="Causal chain from official flights to public value">
      {nodes.map(([verb, value, note], index) => (
        <div className="tk-chain__unit" key={verb}>
          <div className="tk-chain__node">
            <span>{verb}</span>
            <strong>{value}</strong>
            <small>{note}</small>
          </div>
          {index < nodes.length - 1 && <Arrow />}
        </div>
      ))}
    </div>
  );
}

function FlightEvidence() {
  const max = Math.max(...FLIGHT_MONTHS.map(([, value]) => value));
  return (
    <div className="tk-flight">
      <div className="tk-flight__headline">
        <div><strong>107,157</strong><span>controlled flight movements · 2025</span></div>
        <div><strong>294</strong><span>average movements per day</span></div>
        <div><strong>389</strong><span>busiest daily maximum reported</span></div>
        <div className="tk-flight__verdict"><span>Our peak fixture</span><strong>380</strong><small>inside the observed range</small></div>
      </div>
      <div className="tk-flight__bars" aria-label="Monthly Phuket flight movements in 2025">
        {FLIGHT_MONTHS.map(([month, value]) => (
          <div className="tk-flight__bar" key={month}>
            <span>{value.toLocaleString()}</span>
            <i style={{ height: `${Math.max(12, (value / max) * 100)}%` }} />
            <small>{month}</small>
          </div>
        ))}
      </div>
      <p className="tk-source">
        Source: <a href="https://data.go.th/dataset/bangkok-fir-all-2568">AEROTHAI flight-control volume, Phuket Airport, FY2025 · data.go.th ↗</a>
        The 380-movement simulation is a peak-day fixture, not an annual average.
      </p>
    </div>
  );
}

function FleetLab() {
  const [delta, setDelta] = useState(3);
  const scenario = useMemo(() => getFleetScenario(delta), [delta]);
  const baseline = useMemo(() => getFleetScenario(0), []);
  const servedPct = scenario.boarded + scenario.lost > 0
    ? Math.round((scenario.boarded / (scenario.boarded + scenario.lost)) * 100)
    : 0;
  const baselinePct = baseline.boarded + baseline.lost > 0
    ? Math.round((baseline.boarded / (baseline.boarded + baseline.lost)) * 100)
    : 0;

  return (
    <div className="tk-lab">
      <div className="tk-lab__control">
        <span>Fleet change</span>
        <strong>{delta > 0 ? `+${delta}` : delta} buses</strong>
        <input
          aria-label="Change number of buses"
          type="range"
          min="-5"
          max="10"
          step="1"
          value={delta}
          onChange={(event) => setDelta(Number(event.target.value))}
          onInput={(event) => setDelta(Number((event.target as HTMLInputElement).value))}
        />
        <div className="tk-lab__ticks"><span>−5</span><span>baseline</span><span>+10</span></div>
        <button type="button" onClick={() => setDelta(0)}>Reset to today</button>
      </div>
      <div className="tk-lab__results">
        <div><span>Passengers served</span><strong>{scenario.boarded.toLocaleString()}</strong><small>{scenario.deltaBoarded >= 0 ? "+" : ""}{scenario.deltaBoarded.toLocaleString()} vs baseline</small></div>
        <div><span>Fare revenue</span><strong>฿{scenario.revenueThb.toLocaleString()}</strong><small>{formatBaht(scenario.deltaRevenueThb)} vs baseline</small></div>
        <div><span>Unserved demand</span><strong>{scenario.lost.toLocaleString()}</strong><small>people who still need another ride</small></div>
        <div><span>Demand served</span><strong>{servedPct}%</strong><small>{servedPct - baselinePct >= 0 ? "+" : ""}{servedPct - baselinePct} points</small></div>
      </div>
      <div className="tk-lab__logic">
        <span>Same flights</span><Arrow /><span>same demand</span><Arrow /><span>new duty chains</span><Arrow /><strong>different outcome</strong>
      </div>
      <p className="tk-source">This is not a spreadsheet multiplier. The engine re-runs the whole service day in both directions. Added buses start where queues are worst, then continue a physical Airport↔Rawai duty cycle.</p>
    </div>
  );
}

function TonDedication() {
  return (
    <section className="tk-ton" aria-labelledby="ton-title">
      <figure>
        <img src={`${FIELD_ASSET_ROOT}jakarta-ton-2022.jpg`} alt="Ton Jaitong with colleagues at the Jakarta workshop in December 2022" loading="lazy" />
        <figcaption>Jakarta · 05 December 2022 · image date from file metadata</figcaption>
      </figure>
      <div>
        <span className="tk-kicker">For Ton</span>
        <h2 id="ton-title">The work continues with him in it.</h2>
        <p className="tk-ton__lead">This toolkit is dedicated to our friend and colleague <strong>Ton Jaitong</strong>, who died suddenly last year.</p>
        <p>Ton was with us at the first Jakarta workshop in 2022 and helped quietly in the background ever since. In remote communities, he worked with farmers to build their capacity in smart farming: practical work, done close to the people it was meant to serve.</p>
        <p>That is the standard here. Technology must leave someone more capable than before. The system should not merely remember the people who built it. It should carry their way of working forward.</p>
      </div>
    </section>
  );
}

export default function ToolkitShowcase() {
  useEffect(() => {
    document.documentElement.classList.add("toolkit-site-mode");
    document.body.classList.add("toolkit-site-mode");
    const oldTitle = document.title;
    document.title = "The City Systems Toolkit · Dr Non";
    return () => {
      document.documentElement.classList.remove("toolkit-site-mode");
      document.body.classList.remove("toolkit-site-mode");
      document.title = oldTitle;
    };
  }, []);

  return (
    <div className="toolkit-site">
      <ReadingProgress />
      <header className="tk-nav">
        <a className="tk-nav__brand" href="#top" aria-label="The City Systems Toolkit home">
          <span>NON</span><strong>City Systems Toolkit</strong>
        </a>
        <nav aria-label="Page chapters">
          <a href="#try-system">Try it</a>
          <a href="#abcdef">ABCDEF</a>
          <a href="#programme">Journey</a>
          <a href="#working-console">Console</a>
        </nav>
        <a className="tk-nav__live" href={BUS_URL}>Live system ↗</a>
      </header>

      <main id="top">
        <section className="tk-hero">
          <div className="tk-hero__copy">
            <p className="tk-kicker">Research that got tired of waiting for permission.</p>
            <h1>The report was never the deliverable.</h1>
            <p className="tk-hero__standfirst">A practical toolkit for turning fieldwork, public data and difficult questions into city systems that people can actually use.</p>
            <div className="tk-hero__actions">
              <a href="#method">Read the method <span>↓</span></a>
              <a href={BUS_URL}>Try the live bus system <span>↗</span></a>
            </div>
          </div>
          <HeroPhotoRotator />
          <aside className="tk-hero__note">
            <strong>A PDF cannot move a bus.</strong>
            <p>It can frame the problem. Then the toolkit has to earn its keep.</p>
          </aside>
        </section>

        <LiveProof />

        <TryLiveSystem busUrl={BUS_URL} />

        <section className="tk-thesis">
          <p>We studied how cities think.</p>
          <p>Then we built something that thinks with them.</p>
          <small>Not magic AI. Not decorative KPI soup. A traceable chain from evidence to action.</small>
        </section>

        <AbcdefFramework />

        <ProgramArchive />

        <section className="tk-section tk-method" id="method">
          <div className="tk-section__intro">
            <span className="tk-kicker">The operating method</span>
            <h2>Six verbs. No ceremonial innovation theatre.</h2>
            <p>Use the toolkit in order when the problem is new. Enter anywhere when the system already exists. The discipline is the loop: the last step must improve the first.</p>
          </div>
          <div className="tk-method__grid">
            {METHOD_STEPS.map(([title, copy], index) => (
              <article key={title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
          <div className="tk-loop" aria-label="Observe, frame, trace, build, operate and learn as a continuous loop">
            {METHOD_STEPS.map(([title], index) => (
              <div key={title}><strong>{title}</strong>{index < METHOD_STEPS.length - 1 ? <Arrow /> : <span className="tk-loop__return">↺</span>}</div>
            ))}
          </div>
        </section>

        <DesignThinkingStudy />

        <section className="tk-section tk-proof" id="proof">
          <div className="tk-section__intro tk-section__intro--dark">
            <span className="tk-kicker">Proof, not promise</span>
            <h2>Phuket Smart Bus is the toolkit with wheels on.</h2>
            <p>Flights create arrival waves. Some passengers want a bus. Timetables create capacity. The mismatch creates a queue. Dispatch changes the outcome. Everything downstream is accounting, not decoration.</p>
          </div>
          <EvidenceChain />
          <FlightEvidence />
          <a className="tk-proof__cta" href={BUS_URL}><span>Open bus.nonarkara.org</span><strong>Watch every number move.</strong><b>↗</b></a>
        </section>

        <section className="tk-section tk-causality">
          <div className="tk-section__intro">
            <span className="tk-kicker">Correlation is a clue</span>
            <h2>Causation needs a chain you can kick.</h2>
            <p>More buses do not automatically mean better transport. Put them in the wrong hour and you buy diesel, depreciation and a very expensive empty seat. The intervention only works through timing.</p>
          </div>
          <div className="tk-causality__diagram">
            <div className="tk-causality__bad"><span>Tempting story</span><strong>More buses → less congestion</strong><small>Maybe. Also maybe twelve empty buses in a traffic jam.</small></div>
            <div className="tk-causality__good">
              <span>Testable story</span>
              <div><b>Arrival wave</b><Arrow /><b>queue exceeds seats</b><Arrow /><b>targeted departure</b><Arrow /><b>more riders served</b><Arrow /><b>fewer substitute trips</b></div>
              <small>Each arrow has a measurement and an assumption. Break one and the claim gets weaker. Good. Now we know where to look.</small>
            </div>
          </div>
        </section>

        <section className="tk-section tk-scenario">
          <div className="tk-section__intro">
            <span className="tk-kicker">Touch the model</span>
            <h2>How many buses? Move the argument.</h2>
            <p>The slider changes the fleet. The engine keeps the flights and demand constant, builds new duty chains, and shows the operational result. This is the conversation owners, government and lenders need to have together.</p>
          </div>
          <FleetLab />
        </section>

        <FeasibilityStudy />

        <section className="tk-section tk-deal" id="deal">
          <div className="tk-section__intro tk-section__intro--dark">
            <span className="tk-kicker">The institutional deal</span>
            <h2>The operator sells rides. The city receives more than rides.</h2>
            <p>Fare revenue lands on the bus company’s books. Safer roads, lower emissions and reduced congestion mostly do not. If government wants those benefits, and banks want a credible repayment story, the contract has to join the ledgers.</p>
          </div>
          <div className="tk-value-ledger">
            <div><span>Operator ledger</span><strong>Fares</strong><strong>Utilisation</strong><strong>Reliability</strong><small>Directly monetisable</small></div>
            <div className="tk-value-ledger__join">+</div>
            <div><span>Public ledger</span><strong>CO₂ avoided</strong><strong>Safer mobility</strong><strong>Road space</strong><small>Measured public value</small></div>
            <div className="tk-value-ledger__join">=</div>
            <div className="tk-value-ledger__answer"><span>Financeable service</span><strong>One outcome contract</strong><small>Phased capital · verified delivery · shared data</small></div>
          </div>
          <div className="tk-stakeholders">
            {STAKEHOLDERS.map((stakeholder) => (
              <article key={stakeholder.role}>
                <span>{stakeholder.role}</span>
                <h3>{stakeholder.ask}</h3>
                <ul>{stakeholder.items.map((item) => <li key={item}>{item}</li>)}</ul>
              </article>
            ))}
          </div>
          <div className="tk-contract">
            <span>Recommended structure</span>
            <div><b>1</b><strong>90-day instrumented pilot</strong><small>GPS + boarding + published reliability</small></div>
            <Arrow />
            <div><b>2</b><strong>Outcome baseline</strong><small>Demand served, substitute trips, CO₂ and safety proxy</small></div>
            <Arrow />
            <div><b>3</b><strong>Phased fleet facility</strong><small>Capital released at utilisation and service gates</small></div>
            <Arrow />
            <div><b>4</b><strong>Public benefit payment</strong><small>Government pays only for verified additional outcomes</small></div>
          </div>
          <VegasFile vegasCase={VEGAS_CASES.deal} />
        </section>

        <section className="tk-section tk-ecosystem">
          <div className="tk-section__intro">
            <span className="tk-kicker">One research practice, several instruments</span>
            <h2>The bus is not a side project. It is a worked example.</h2>
            <p>SCITI asks what Thai cities can deliver. SLIC asks what a city ranking hides. FloodDash asks what someone should do now. The bus system joins those questions in one visible operating chain.</p>
          </div>
          <div className="tk-ecosystem__grid">
            {TOOL_ECOSYSTEM.map((tool) => (
              <a href={tool.url} key={tool.name}>
                <span>{tool.name}</span><strong>{tool.fact}</strong><p>{tool.copy}</p><b>Visit ↗</b>
              </a>
            ))}
          </div>
          <div className="tk-ecosystem__lesson">
            <span>Shared rule</span>
            <strong>Every number traces back. Every signal ends in a decision. Every decision creates a record we can learn from.</strong>
          </div>
        </section>

        <TonDedication />

        <section className="tk-section tk-field" id="field-notes">
          <div className="tk-section__intro">
            <span className="tk-kicker">Field notes · 2022–2025</span>
            <h2>The toolkit travelled. The question stayed.</h2>
            <p>Dates below come from the image metadata where available, not the day somebody eventually copied the files into this repository.</p>
          </div>
          <div className="tk-field__rail">
            {FIELD_NOTES.map((item, index) => (
              <figure key={item.city} className={index % 2 ? "tk-field__item tk-field__item--offset" : "tk-field__item"}>
                <img src={item.src} alt={`${item.city} field workshop, ${item.date}`} loading="lazy" />
                <figcaption><span>{item.date}</span><h3>{item.city}</h3><p>{item.note}</p></figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className="tk-section tk-sources">
          <div className="tk-section__intro">
            <span className="tk-kicker">Source rack</span>
            <h2>Open the cupboard. Check our ingredients.</h2>
            <p>The page separates observations, modelled values and assumptions. These sources are the next layer of audit, not a row of logos pretending to be methodology.</p>
          </div>
          <div className="tk-sources__list">
            <a href="https://data.go.th/dataset/bangkok-fir-all-2568"><span>01</span><strong>Phuket flight-control volume, FY2025</strong><small>AEROTHAI · data.go.th</small><b>↗</b></a>
            <a href="https://www.data.go.th/dataset/rtddi"><span>02</span><strong>Integrated road-death records, 3 databases</strong><small>Department of Disease Control · data.go.th</small><b>↗</b></a>
            <a href="https://www.data.go.th/th/dataset/stattourism"><span>03</span><strong>Monthly provincial tourism statistics</strong><small>Ministry of Tourism and Sports · data.go.th</small><b>↗</b></a>
            <a href="https://www.data.go.th/dataset/dataset_10_3710"><span>04</span><strong>International passengers through Phuket Airport</strong><small>Phuket Provincial Office · data.go.th catalogue</small><b>↗</b></a>
            <a href={`${BUS_URL}ops?view=toolkit`}><span>05</span><strong>Assumptions, formulas and live simulation</strong><small>Phuket Smart Bus · working toolkit console</small><b>↗</b></a>
            <a href="https://www.airportthai.co.th/wp-content/uploads/2026/06/ANNUAL-REPORT-2025.pdf"><span>06</span><strong>Phuket Airport traffic report, 2025</strong><small>Airports of Thailand · 17.5m passenger movements</small><b>↗</b></a>
            <a href="https://www.phuket.go.th/webpk/file_data/hilight/hilight2567.pdf"><span>07</span><strong>Phuket provincial highlights, 2024</strong><small>Existing EV routes and ridership evidence</small><b>↗</b></a>
            <a href="https://www.otp.go.th/uploads/tiny_uploads/ProjectOTP/2560/Project17/4-DevelopmentofaFundingMechanism.pdf"><span>08</span><strong>Thailand clean-mobility funding mechanism</strong><small>OTP · EV bus costs and financing gap</small><b>↗</b></a>
            <a href="https://sme.krungthai.com/sme/productListAction.action?cateId=14&cateMenu=PRODUCT&command=getDetail&itemId=438"><span>09</span><strong>Krungthai sustainability loan</strong><small>Indicative green-finance product terms</small><b>↗</b></a>
            <a href="https://www.bot.or.th/content/dam/bot/documents/en/our-roles/monetary-policy/mpc-publication/monetary-policy-report/MPR_2026_Q1.pdf"><span>10</span><strong>Thailand lending-rate stress benchmark</strong><small>Bank of Thailand · Q1 2026</small><b>↗</b></a>
            <a href="https://www.usascp.org/programs/transportationprogram/"><span>11</span><strong>Smart Sustainable Mobility programme record</strong><small>U.S.-ASEAN Smart Cities Partnership</small><b>↗</b></a>
            <a href="https://www.metrans.org/upp"><span>12</span><strong>University Partnership Programme and four toolkits</strong><small>METRANS Transportation Consortium · 2026</small><b>↗</b></a>
            <a href="https://thenevadaindependent.com/article/as-passenger-counts-dwindle-on-strip-buses-the-rtc-eyes-innovation-while-closely-monitoring-financials"><span>13</span><strong>Las Vegas Strip bus financing case study</strong><small>The Nevada Independent · farebox recovery, ridership, subsidy history</small><b>↗</b></a>
          </div>
          <p className="tk-sources__caveat">* CO₂ is a modelled avoided-emissions estimate, not a certified carbon credit. Accident and congestion benefits are intervention goals until an instrumented baseline and observed counterfactual exist. We would rather tell you exactly what we do not know than sell you a decimal point wearing a tie.</p>
        </section>

        <section className="tk-final">
          <p>Research asks why.</p>
          <p>Building finds out.</p>
          <a href={BUS_URL}>See what is already running <span>↗</span></a>
          <small>The City Systems Toolkit · depa × USDOT learning journey · built in Phuket</small>
        </section>
      </main>
    </div>
  );
}
