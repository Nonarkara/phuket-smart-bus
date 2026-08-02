import { ResearchPanel } from "./ResearchPanel";
import { CITY_CONTRAST } from "../v2/ToolkitPanel";

const VEGAS_ASSET_ROOT = `${import.meta.env.BASE_URL}toolkit/vegas/`;

const ABCDEF_CITATIONS = [
  {
    text: "McFadden, D. — “Economic Choices,”",
    meta: "Nobel Prize Lecture, 8 Dec 2000. The math under every discrete mode-choice model, ours included.",
    href: "https://www.nobelprize.org/prizes/economic-sciences/2000/mcfadden/lecture/"
  },
  {
    text: "Ben-Akiva, M. & Lerman, S.R. — Discrete Choice Analysis: Theory and Application to Travel Demand,",
    meta: "MIT Press, 1985. The standard textbook translation of that theory into travel-mode models.",
    href: "https://mitpress.mit.edu/9780262536400/discrete-choice-analysis/"
  },
  {
    text: "Bursa, B., Mailer, M. & Axhausen, K.W. — “Travel behavior on vacation: transport mode choice of tourists at destinations,”",
    meta: "Transportation Research Part A, 166 (2022), pp. 234–261. Tourists, not commuters — the paper this framework should have to answer to.",
    href: "https://www.sciencedirect.com/science/article/pii/S0965856422002543"
  },
  {
    text: "TCRP Report 166 — Characteristics of Premium Transit Services that Affect Choice of Mode,",
    meta: "Transportation Research Board / National Academies, 2013. Comfort and reliability move mode choice independent of price — our C and D, footnoted.",
    href: "https://nap.nationalacademies.org/catalog/22401/characteristics-of-premium-transit-services-that-affect-choice-of-mode"
  },
  {
    text: "Moody, J. et al. — “Measuring Explicit and Implicit Social Status Bias in Car vs. Bus Mode Choice,”",
    meta: "MIT Mobility Initiative, 95th TRB Annual Meeting, 2016. Thin literature, real effect — our weakest-cited letter, H, and we say so.",
    href: "https://mobility.mit.edu/publications/2016/moody-implicit-and-explicit-measures-social-status-bias-mode-choice"
  }
];

type VegasCase = {
  photo: { src: string; alt: string; credit: string };
  title: string;
  lede: string;
  facts: readonly (readonly [string, string, string])[];
  source: string;
  sourceHref: string;
};

const VEGAS_CASES = {
  abcdef: {
    photo: {
      src: `${VEGAS_ASSET_ROOT}deuce-strip.jpg`,
      alt: "A Deuce double-decker bus running on the Las Vegas Strip",
      credit: "Photo: Eric Fischer · CC BY 2.0 · Wikimedia Commons"
    },
    title: "Vegas already passed the ABCDEF test, at Strip scale.",
    lede: "USASCP paired Phuket with Las Vegas in 2024 to study tourism mode choice for exactly this reason. RTC Southern Nevada’s Strip service is the closest real proof this pitch has: legible pricing, honest timing and a fleet built for the trip, not adapted to it.",
    facts: [
      ["$4 · $8", "single ride · 24-hour pass", "B — arithmetic a first-time visitor can do at the curb"],
      ["100 seats", "Alexander Dennis Enviro500 double-decker", "C + H — capacity and tourist appeal in one vehicle"],
      ["2005", "the Strip’s dedicated double-decker service began", "D — two decades of one fixed, legible route"],
      ["No parking. No rental counter.", "the same freedom argument as ฿100 versus a car", "F"]
    ],
    source: "RTC Southern Nevada, Fares & Passes",
    sourceHref: "https://www.rtcsnv.com/ways-to-travel/fares-passes/"
  },
  financing: {
    photo: {
      src: `${VEGAS_ASSET_ROOT}deuce-vehicle.jpg`,
      alt: "An RTC Transit Alexander Dennis Enviro500 double-decker bus, the vehicle used on the Deuce route",
      credit: "Photo: Cello06, 2006 · public domain · Wikimedia Commons"
    },
    title: "A corridor that ran a $6m annual profit—until it had competition.",
    lede: "This is the financing case study behind our thesis. The Strip service is funded by a sales tax built for transit, not scraped from a general fund. It ran profitably for a decade. Then ride-hailing arrived, and even a purpose-built tax base needed to start subsidising it.",
    facts: [
      ["0.375%", "of Clark County sales tax, dedicated to transit since 2002", "a funding source designed for buses, not competing with schools and roads for a vote"],
      ["~40¢", "farebox recovery per operating dollar, general routes", "about double the U.S. national average—and still not enough alone"],
      ["$6m/yr", "Strip corridor profit before 2015", "the double-decker route paid for itself, once"],
      ["2015 → 2019", "ride-hailing legalised → RTC subsidises the Strip for the first time", "3.3m fewer passenger trips; seats filled fell from 90% to ~60%"]
    ],
    source: "The Nevada Independent, “As passenger counts dwindle on Strip buses…”, 22 Jul 2019. Percentages are RTC’s own public reporting, not an independent audit.",
    sourceHref: "https://thenevadaindependent.com/article/as-passenger-counts-dwindle-on-strip-buses-the-rtc-eyes-innovation-while-closely-monitoring-financials"
  },
  deal: {
    photo: {
      src: `${VEGAS_ASSET_ROOT}deuce-stop.jpg`,
      alt: "A Deuce bus stop on the Las Vegas Strip",
      credit: "Photo: Sean MacEntee · CC BY 2.0 · Wikimedia Commons"
    },
    title: "The joined ledger, already law in Clark County.",
    lede: "Nevada’s motor-fuel tax is constitutionally restricted to roads—it cannot legally pay for a bus. So the county built a second, dedicated stream for transit instead of hoping the farebox would stretch. That is the same structural move this deal proposes for Phuket.",
    facts: [
      ["Roadway-only", "constitutional limit on Nevada’s fuel tax", "transit needed its own lane, literally by law"],
      ["3 states", "reporting names Nevada among states with zero state-level transit funding", "the county, not the state, carries the mandate"]
    ],
    source: "Nevada Current / News From The States, “Last year Nevada delivered on roadway funding…”, 4 Mar 2026",
    sourceHref: "https://nevadacurrent.com/2026/03/04/last-year-nevada-delivered-on-roadway-funding-public-transit-may-not-fare-as-well/"
  }
} as const satisfies Record<string, VegasCase>;

function VegasFile({ vegasCase }: { vegasCase: VegasCase }) {
  return (
    <aside className="tk-vegas" aria-label={`Partner city comparable: Las Vegas Strip — ${vegasCase.title}`}>
      <figure>
        <img src={vegasCase.photo.src} alt={vegasCase.photo.alt} loading="lazy" />
        <figcaption>{vegasCase.photo.credit}</figcaption>
      </figure>
      <div className="tk-vegas__body">
        <span className="tk-kicker">Partner city file · Las Vegas Strip</span>
        <h3>{vegasCase.title}</h3>
        <p>{vegasCase.lede}</p>
        <div className="tk-vegas__facts">
          {vegasCase.facts.map(([value, label, note]) => (
            <div key={label}><strong>{value}</strong><span>{label}</span><small>{note}</small></div>
          ))}
        </div>
        <p className="tk-source"><a href={vegasCase.sourceHref}>Source: {vegasCase.source} ↗</a></p>
      </div>
    </aside>
  );
}

const MODE_LENS = [
  ["A", "Accessibility", "Can a first-time visitor find it, understand it and board it without borrowing local knowledge?"],
  ["B", "Budget", "Does the price make sense beside the taxi, rental car and all the costs people forget to count?"],
  ["C", "Comfort", "Air-con, luggage space, a clean seat and a driver you trust. Basic is not the same as optional."],
  ["D", "Duration", "Not merely fast: predictable. A known 95 minutes can beat an unknown 60."],
  ["E", "Experience", "The trip can be part of the holiday, not the administrative punishment before it."],
  ["F", "Freedom", "No parking hunt, rental deposit, fuel stop, damage argument or unfamiliar road in the rain."],
] as const;

const EXTENSIONS = [
  ["G", "Green", "Lower-carbon mobility matters—after the service has first earned people’s confidence."],
  ["H", "Hip", "A bus people want to be seen using has a demand advantage. Yes, image is transport policy too."],
] as const;

function AbcdefFramework() {
  return (
    <section className="tk-section tk-abcdef" id="abcdef">
      <div className="tk-section__intro">
        <span className="tk-kicker">The project’s mode-choice framework</span>
        <h2>ABCDEF: six tests before anyone chooses your bus.</h2>
        <p>This is our practical lens—not a USDOT acronym and not a magic formula. Each letter turns a vague promise into a question a passenger can answer. G and H are useful extensions; they cannot rescue a service that fails A to F.</p>
      </div>
      <div className="tk-abcdef__flow" aria-label="ABCDEF mode-choice framework">
        {MODE_LENS.map(([letter, title, copy]) => (
          <article key={letter}>
            <span>{letter}</span>
            <h3>{title}</h3>
            <p>{copy}</p>
          </article>
        ))}
      </div>
      <div className="tk-abcdef__extensions">
        <div><span>First earn the trip</span><strong>A → B → C → D → E → F</strong><small>Service fundamentals</small></div>
        <div className="tk-abcdef__plus">+</div>
        {EXTENSIONS.map(([letter, title, copy]) => (
          <article key={letter}><span>{letter}</span><strong>{title}</strong><p>{copy}</p></article>
        ))}
      </div>
      <p className="tk-abcdef__caveat">This is a proposition map, not a causal estimate. The live system gives us somewhere to test which letters actually change search, boarding and repeat use.</p>
      <VegasFile vegasCase={VEGAS_CASES.abcdef} />
      <ResearchPanel
        title="Is “ABCDEF” actually a thing, or did we just make a fun acronym?"
        stats={[
          { value: "1974", label: "the year discrete-choice theory was formalised", note: "McFadden — later a Nobel Prize, 2000" },
          { value: "6+2", label: "lenses in this framework", note: "A–F fundamentals, G/H extensions" },
          { value: "8", label: "rider personas it was tested against", note: "from the original toolkit survey — see the Design Thinking section" }
        ]}
        citations={ABCDEF_CITATIONS}
      >
        <p className="tk-research-note">
          Honest answer: partly. The theory that people weigh a bundle of felt factors — not just price and speed — when picking a
          travel mode is decades old and Nobel-decorated. “ABCDEF” is our own mnemonic on top of it, built for a workshop room, not
          peer review. G and H lean on thinner evidence than A–D. We say so on purpose — a framework that hides its weakest plank
          isn’t a framework, it’s a pitch deck.
        </p>
        <div className="tk-research-table" role="table" aria-label="Phuket versus Las Vegas, five structural differences">
          <div className="tk-research-table__row tk-research-table__row--head" role="row">
            <span role="columnheader"></span>
            <span role="columnheader">Phuket</span>
            <span role="columnheader">Las Vegas</span>
          </div>
          {CITY_CONTRAST.map((row) => (
            <div className="tk-research-table__row" role="row" key={row.dim}>
              <strong role="cell">{row.dim}</strong>
              <span role="cell">{row.phuket}</span>
              <span role="cell">{row.vegas}</span>
            </div>
          ))}
        </div>
      </ResearchPanel>
    </section>
  );
}

export { AbcdefFramework, VegasFile, VEGAS_CASES };
