/**
 * Glossary — terms used in the toolkit, defined for the careful reader.
 *
 * Transit finance, public policy and operations research all use
 * shorthand. This page makes the shorthand legible: every term is
 * defined, and every definition is sourced to the document or body
 * that uses the term in its specific sense.
 *
 * Click any term to jump to its definition. The glossary is sorted
 * alphabetically and is plain-text searchable.
 */

type Term = {
  term: string;
  short: string;
  long: string;
  source?: string;
};

const TERMS: Term[] = [
  {
    term: "APTA",
    short: "American Public Transportation Association",
    long: "The US trade body whose CO₂ factors (0.21 kg/pax-km car, 0.06 kg/pax-km bus) are used in the toolkit's /roi model. These are conservative figures widely cited in transit finance.",
    source: "APTA / FTA Public Transportation's Role in Responding to Climate Change, 2010 update"
  },
  {
    term: "Bidirectional corridor",
    short: "A bus corridor modelled in both directions at the same hour",
    long: "The Phuket engine models both the airport→island leg and the island→airport leg simultaneously. A bus works both legs of its duty cycle, so adding 1 bus to the corridor means +25 seats inbound AND +25 seats outbound in the same hour.",
    source: "src/engine/demandSupplyEngine.ts"
  },
  {
    term: "BOT",
    short: "Build-Operate-Transfer",
    long: "Concession structure where the private party finances, builds and operates the asset, then transfers ownership to the public sector at the end of the contract. Common in Thai transport infrastructure. PKSB operates the airport line under a structure similar to this.",
    source: "World Bank PPP Reference Guide v3, 2024"
  },
  {
    term: "Capture rate",
    short: "The share of arriving passengers who choose the bus over other modes",
    long: "The engine uses a region-based heuristic: SE-Asia 7%, China 4%, Europe 3%, India 5%, Russia/CIS 3%, Middle East 3%, weighted to ≈ 5% fleet-wide. The day PKSB shares a week of real boarding counts, this becomes calibrated.",
    source: "src/engine/travelBehavior.ts"
  },
  {
    term: "DSCR",
    short: "Debt Service Coverage Ratio",
    long: "Annual operating cashflow ÷ annual debt service. A DSCR of 1.30× means the project generates 30% more cash than the bank needs. Mock covenant gate in the feasibility study. World Bank project-finance convention converges on 1.10×–1.50×.",
    source: "World Bank PPP Reference Guide v3, 2024"
  },
  {
    term: "EBITDA",
    short: "Earnings Before Interest, Tax, Depreciation and Amortisation",
    long: "A standard operating-profit measure. The /roi model uses a deliberately simple pre-tax, pre-depreciation computation and labels it as illustrative, not a credit offer.",
    source: "Standard accounting / transit finance"
  },
  {
    term: "IRAP",
    short: "International Road Assessment Programme",
    long: "The body that rates road infrastructure for safety (1–5 stars). Used in the WHO Thailand road-safety report cited in the DataProvenance panel.",
    source: "WHO Global Status Report on Road Safety 2023"
  },
  {
    term: "IRR",
    short: "Internal Rate of Return",
    long: "The discount rate that makes the NPV of a project equal to zero. The /roi model exposes the payback period (years) rather than IRR to keep the illustration readable.",
    source: "Standard project finance"
  },
  {
    term: "O&M",
    short: "Operations & Maintenance",
    long: "The annual cost of running the bus service (drivers, fuel, insurance, dispatch, telematics, charging). In the toolkit the per-bus annual O&M is ฿800,000 sourced from PKSB 2024 statements and BMTA benchmarks.",
    source: "src/engine/roi.ts"
  },
  {
    term: "OPS / OpEx",
    short: "Operating expenditure",
    long: "Recurring spend to keep the system running. Distinguished from CapEx (one-time spend to build the asset).",
    source: "Standard accounting"
  },
  {
    term: "PIU",
    short: "Project Implementation Unit",
    long: "A small government team inside the contracting authority (in this case the Phuket PAO) that oversees a major project day-to-day. Standard structure in World Bank–funded Thai transport projects.",
    source: "OTP clean-mobility study 2017"
  },
  {
    term: "PPP",
    short: "Public-Private Partnership",
    long: "A long-term contract between a public authority and a private operator for delivery of a public service. Spans concessions, BOT, BOO, BOOT and other variants. World Bank PPP Reference Guide v3 is the toolkit's anchor reference.",
    source: "World Bank PPP Reference Guide v3, 2024"
  },
  {
    term: "Service window",
    short: "The daily period when buses actually run",
    long: "For the Phuket airport line, 06:00–22:30. Outside the window the simulator shows '—' on live numbers rather than 0, to avoid implying the demand is zero (it is just unaddressed).",
    source: "PKSB schedule fixture"
  },
  {
    term: "SLA",
    short: "Service Level Agreement",
    long: "The contract terms that specify what the operator must deliver (on-time performance, vehicle availability, passenger counts). The mock covenant in the feasibility study exposes 1.30× DSCR + ≥98% telemetry completeness + published reliability as the SLA gates.",
    source: "World Bank PforR framework, 2023"
  },
  {
    term: "VfM",
    short: "Value for Money",
    long: "The net benefit a public authority captures by procuring through a private operator rather than delivering the service in-house. The toolkit's case for the operator-over-public model rests on this.",
    source: "UK Treasury VfM Framework (referenced)"
  }
];

export function Glossary() {
  return (
    <section className="gl-section" aria-labelledby="gl-title">
      <header className="gl-section__head">
        <p className="tk-kicker">Glossary · for the careful reader</p>
        <h2 id="gl-title">The shorthand, decoded.</h2>
        <p>
          Transit finance, public policy and operations research all
          use jargon. This glossary makes the toolkit's shorthand
          legible. Each term has a one-line definition, a fuller
          explanation in the toolkit's specific sense, and a source for
          the term-as-used-here. Sorted alphabetically. Click any
          term to jump to its definition.
        </p>
      </header>

      <div className="gl-grid">
        <nav className="gl-index" aria-label="Alphabetical index">
          {Array.from(new Set(TERMS.map((t) => t.term[0].toUpperCase()))).sort().map((letter) => (
            <a key={letter} href={`#gl-${letter}`} className="gl-index__letter">{letter}</a>
          ))}
        </nav>

        <dl className="gl-list">
          {TERMS.map((t) => {
            const id = `gl-${t.term[0].toUpperCase()}`;
            return (
              <div key={t.term} className="gl-item" id={id}>
                <dt>
                  <span className="gl-term">{t.term}</span>
                  <span className="gl-short">{t.short}</span>
                </dt>
                <dd>
                  <p className="gl-long">{t.long}</p>
                  {t.source && (
                    <p className="gl-source">
                      <span className="tk-kicker">Sourced from</span>
                      {t.source}
                    </p>
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
      </div>
    </section>
  );
}

export default Glossary;
