/**
 * Comparative Research — global tourism-transit benchmarks.
 *
 * The "cake and eat it too" question, answered with data. Can a tourism
 * corridor support a profitable bus AND serve the public interest? The
 * evidence says yes — but only under specific structural conditions. This
 * section compares Phuket to six tourism destinations, lays out the
 * farebox-recovery reality, and shows where the "can't be done" argument
 * breaks down.
 */

import { ResearchPanel, type Citation, type Stat } from "./ResearchPanel";

const COMPARATIVE_CITATIONS: Citation[] = [
  {
    text: "Federal Transit Administration — National Transit Database, Annual Database Fare Revenues,",
    meta: "2023. Primary US farebox recovery source. The Deuce on the Las Vegas Strip was one of the only profitable transit lines in the US (2008–2015).",
    href: "https://www.transit.dot.gov/ntd/data-product/2023-annual-database-fare-revenues"
  },
  {
    text: "The Nevada Independent — “As passenger counts dwindle on Strip buses…,”",
    meta: "RTC FY2019 analysis. ~$6M annual profit on the Strip corridor before ride-hailing; 3.3M trips lost after Uber/Lyft legalisation (Sep 2015).",
    href: "https://thenevadaindependent.com/article/as-passenger-counts-dwindle-on-strip-buses-the-rtc-eyes-innovation-while-closely-monitoring-financials"
  },
  {
    text: "TransitLink Singapore — Annual Report 2024,",
    meta: "Singapore public transport: 5.4M daily trips, farebox recovery ~100% (unique globally due to COE vehicle quota system suppressing car ownership).",
    href: "https://www.transitlink.com.sg/"
  },
  {
    text: "TMB (Transports Metropolitans de Barcelona) — Annual Report 2023,",
    meta: "Barcelona: ~550M annual bus + metro boardings. Farebox recovery ~45%. Integrated fare structure; tourism passes subsidise resident fares.",
    href: "https://www.tmb.cat/"
  }
];

const ASEAN_CITATIONS: Citation[] = [
  {
    text: "Asian Development Bank — Asian Transport Outlook,",
    meta: "ADB, 2023. ASEAN mode share data: motorcycle dominance (Thailand 70%, Vietnam 80%, Indonesia 60%). Public transport mode share declining region-wide except Singapore.",
    href: "https://www.adb.org/publications/asian-transport-outlook"
  },
  {
    text: "WHO Thailand — Road Safety,",
    meta: "2023 Global Status Report. Thailand: 25.4 deaths/100k, 9th highest globally. Motorcyclists = 83.8% of fatalities.",
    href: "https://www.who.int/thailand/our-work/road-safety"
  }
];

const BENCHMARK_STATS: Stat[] = [
  { value: "$6M/yr", label: "Las Vegas Strip bus profit, 2008–2015", note: "one of the only profitable US transit lines" },
  { value: "~100%", label: "Singapore farebox recovery", note: "globally unique — COE vehicle quota suppresses car ownership" },
  { value: "13–36%", label: "US transit farebox recovery range, 2019–2024", note: "farebox alone is the bet that fails" },
  { value: "83.8%", label: "Thailand road fatalities involving motorcycles", note: "the safety case for buses" }
];

type CityBenchmark = {
  city: string;
  annual_visitors: string;
  transit_mode: string;
  fare: string;
  farebox_recovery: string;
  profit_years: string;
  lesson: string;
};

const BENCHMARKS: CityBenchmark[] = [
  {
    city: "Las Vegas, USA",
    annual_visitors: "~38M (2019)",
    transit_mode: "The Deuce (double-decker bus, 100 seats)",
    fare: "$4 single / $8 24-hr / $20 72-hr",
    farebox_recovery: "~40¢/operating-dollar (general routes); Strip corridor profitable",
    profit_years: "2008–2015 (7 years, ~$6M/yr)",
    lesson: "A purpose-built bus on a saturated tourism corridor can profit for a decade — until ride-hailing arrives. Build before the competition owns the curb."
  },
  {
    city: "Barcelona, Spain",
    annual_visitors: "~12M (2023)",
    transit_mode: "TMB bus + metro integrated network",
    fare: "€2.40 single / €10.50 10-trip T-Casual",
    farebox_recovery: "~45%",
    profit_years: "Subsidised; tourism passes cross-subsidise resident fares",
    lesson: "Integrated fare structure lets tourism revenue support resident mobility. The structure, not the fare, does the work."
  },
  {
    city: "Singapore",
    annual_visitors: "~15M (2023)",
    transit_mode: "MRT + bus, integrated under TransitLink",
    fare: "S$2.10 max bus fare",
    farebox_recovery: "~100%",
    profit_years: "Sustained (unique globally)",
    lesson: "The COE vehicle quota system (S$100k+ for a car) is the demand-management tool that makes transit dominant. No quota, no ~100% recovery."
  },
  {
    city: "Bali, Indonesia",
    annual_visitors: "~6M (2023)",
    transit_mode: "No mass airport transit. Kura-Kura Bus (tourist-oriented, limited coverage).",
    fare: "Rp 20,000–80,000 (~$1.30–5.20)",
    farebox_recovery: "Low; service reduced since COVID",
    profit_years: "Never profitable",
    lesson: "Bali is the cautionary tale: tourism demand without transit infrastructure creates a motorbike and ride-hail monoculture. Phuket is heading there."
  },
  {
    city: "Honolulu, USA",
    annual_visitors: "~9M (2023)",
    transit_mode: "TheBus (public, extensive coverage) + Skyline rail (opening 2031)",
    fare: "$3 adult",
    farebox_recovery: "~27%",
    profit_years: "Subsidised; no profit history",
    lesson: "An island tourism economy can sustain a bus — but Honolulu's 27% recovery shows even high demand doesn't guarantee farebox sufficiency."
  },
  {
    city: "Cancún, Mexico",
    annual_visitors: "~30M (2023)",
    transit_mode: "ADO first-class bus (airport ↔ Hotel Zone ↔ downtown)",
    fare: "MX$80–120 (~$5–7)",
    farebox_recovery: "Profitable on airport corridor",
    profit_years: "Sustained",
    lesson: "A direct airport-to-resort bus, clearly branded and well-priced, captures tourism demand. Cancún's ADO is the closest structural analogue to what Phuket needs."
  },
  {
    city: "Phuket, Thailand",
    annual_visitors: "17.4M HKT pax (2025)",
    transit_mode: "PKSB Airport Line (฿100, 95 min) + Orange Line 8411",
    fare: "฿100 ($2.80) flat",
    farebox_recovery: "Unknown — pilot requirement",
    profit_years: "Not yet demonstrated",
    lesson: "The demand exists. The corridor exists. The fare is right. The question is operational: can reliability, information and last-mile solve the capture gap?"
  }
];

const CAKE_REBUTTAL = [
  {
    claim: "You can't run a profitable transit system AND serve the public interest.",
    response: "Las Vegas did it for seven years (2008–2015). The Strip corridor ran ~$6M/year in profit while moving 37,000 people a day. The public interest — pedestrian safety, reduced congestion, lower emissions — was served simultaneously. The corridor lost profitability when ride-hailing arrived, not because the model was wrong.",
    evidence: "RTC Southern Nevada FY2019 board report; The Nevada Independent, July 2019"
  },
  {
    claim: "Farebox recovery is always too low for transit to be bankable.",
    response: "Farebox recovery ranges from ~13% (lowest US systems) to ~100% (Singapore). The range proves it is a design choice, not a law of physics. Singapore achieves ~100% because the COE quota makes cars expensive enough to shift demand. Phuket doesn't need Singapore's model — it needs enough fare + a capped public payment to clear a 1.30× DSCR.",
    evidence: "FTA National Transit Database 2023; TransitLink Singapore Annual Report 2024"
  },
  {
    claim: "Tourists won't ride buses. They'll take taxis or rent cars.",
    response: "Cancún's ADO bus moves millions of tourists a year from airport to Hotel Zone at $5–7. The Deuce moved 5.7M boardings in FY2023. Tourists ride buses when the bus is legible, reliable and priced honestly. The ABCDEF framework is the test: pass A (accessibility) through F (freedom) and tourists ride.",
    evidence: "Wikipedia — The Deuce (transit bus service), FY2023 ridership; ADO corporate reporting"
  },
  {
    claim: "Electric buses are too expensive to finance without massive subsidy.",
    response: "OTP's 2017 benchmark: ฿12m ($340k) per EV bus, ฿0.9m annual operating cost. Green Loan Principles (LSTA/APLMA, 2023) explicitly include electric buses as an eligible category — the cost of capital can be 4% (Krungthai ESG loan floor). The math works if the demand is real and the contract joins the ledgers.",
    evidence: "OTP clean-mobility study, 2017; Krungthai ESG loan product terms"
  },
  {
    claim: "The demand model is just a simulation — you can't finance a bus on a guess.",
    response: "Correct. That is why the recommendation is not 'buy buses.' It is 'run a 90-day instrumented pilot, measure GPS reliability + real boarding counts + denied demand, then release fleet capital only if the gates hold.' The simulation is scaffolding; real data replaces it one plank at a time. The pilot is the diligence instrument.",
    evidence: "This repository — engine conservation tests; mock credit memo structure"
  }
];

const ASEAN_MODE_SHARE = [
  { country: "Thailand", motorcycle: 70, car: 15, bus: 8, other: 7 },
  { country: "Vietnam", motorcycle: 80, car: 5, bus: 10, other: 5 },
  { country: "Indonesia", motorcycle: 60, car: 12, bus: 18, other: 10 },
  { country: "Malaysia", motorcycle: 45, car: 40, bus: 10, other: 5 },
  { country: "Singapore", motorcycle: 5, car: 30, bus: 55, other: 10 }
];

export function ComparativeResearch() {
  const maxMode = Math.max(...ASEAN_MODE_SHARE.map((d) => d.motorcycle));
  return (
    <section className="cr-section" id="comparative" aria-labelledby="comparative-title">
      <header className="cr-section__head">
        <p className="tk-kicker">Global benchmarks · the "cake and eat it" question</p>
        <h2 id="comparative-title">Seven tourism destinations. One question. The data answers it.</h2>
        <p className="cr-section__standfirst">
          Can a tourism corridor support a profitable bus AND serve the public interest? The comparative evidence
          says yes — under specific structural conditions. Las Vegas did it for seven years. Barcelona does it
          through fare integration. Cancún does it with a direct airport-to-resort bus. Singapore does it with
          demand management. Phuket has the demand; the question is whether the structure follows.
        </p>
      </header>

      {/* Stats */}
      <div className="cr-stats" role="list" aria-label="Comparative headline figures">
        {BENCHMARK_STATS.map((s) => (
          <div key={s.label} role="listitem">
            <strong>{s.value}</strong>
            <span>{s.label}</span>
            {s.note && <small>{s.note}</small>}
          </div>
        ))}
      </div>

      {/* Benchmark table */}
      <div className="cr-benchmark">
        <h3 className="cr-subhead">Tourism-transit comparison: seven destinations</h3>
        <div className="cr-benchmark-table" role="table" aria-label="Tourism transit comparison across seven destinations">
          <div className="cr-benchmark-row cr-benchmark-row--head" role="row">
            <span role="columnheader">Destination</span>
            <span role="columnheader">Annual visitors</span>
            <span role="columnheader">Transit mode</span>
            <span role="columnheader">Fare</span>
            <span role="columnheader">Farebox recovery</span>
            <span role="columnheader">Profit history</span>
            <span role="columnheader">The lesson</span>
          </div>
          {BENCHMARKS.map((b) => (
            <div className="cr-benchmark-row" role="row" key={b.city}>
              <strong role="cell">{b.city}</strong>
              <span role="cell">{b.annual_visitors}</span>
              <span role="cell">{b.transit_mode}</span>
              <span role="cell">{b.fare}</span>
              <span role="cell">{b.farebox_recovery}</span>
              <span role="cell">{b.profit_years}</span>
              <span role="cell">{b.lesson}</span>
            </div>
          ))}
        </div>
      </div>

      {/* "Cake and eat it" rebuttal */}
      <div className="cr-rebuttal">
        <h3 className="cr-subhead">"You can't have cake and eat it too" — five claims, five responses</h3>
        <p className="cr-intro-note">
          Five things a skeptic says about tourist-transit economics, and what actually happens when you check.
          Not to win the argument — to find out which parts of it are true.
        </p>
        <div className="cr-rebuttal-grid">
          {CAKE_REBUTTAL.map((item, index) => (
            <article key={index} className="cr-rebuttal-card">
              <header>
                <span className="tk-kicker">Claim {String(index + 1).padStart(2, "0")}</span>
                <h4>{item.claim}</h4>
              </header>
              <div className="cr-rebuttal-response">
                <span className="tk-kicker">Response</span>
                <p>{item.response}</p>
              </div>
              <div className="cr-rebuttal-evidence">
                <span className="tk-kicker">Evidence</span>
                <p>{item.evidence}</p>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* ASEAN mode share chart */}
      <div className="cr-asean">
        <h3 className="cr-subhead">ASEAN mode share — the regional context</h3>
        <p className="cr-intro-note">
          Phuket doesn't compete with Singapore. It competes with the motorcycle. Thailand's 70% motorcycle mode
          share — and the 83.8% of road deaths that share produces — is the status quo a bus has to shift. The
          chart shows how hard that is, and why Singapore is the outlier (not the benchmark).
        </p>
        <figure className="cr-chart" aria-label="ASEAN mode share comparison chart">
          <figcaption>
            <strong>Motorcycle dominance in ASEAN transport.</strong>
            <p>
              Singapore is the outlier — car ownership is deliberately expensive (COE quota), so transit wins.
              Every other ASEAN country is motorcycle-dominated. Thailand's 70% motorcycle share is both the
              problem (safety, emissions) and the opportunity (a mode-shift target).
            </p>
          </figcaption>
          <div className="cr-chart-bars">
            {ASEAN_MODE_SHARE.map((d) => (
              <div key={d.country} className="cr-chart-row">
                <span className="cr-chart-label">{d.country}</span>
                <div className="cr-chart-track">
                  <i className="cr-chart-fill cr-chart-fill--moto" style={{ width: `${(d.motorcycle / maxMode) * 100}%` }} />
                  <small className="cr-chart-val">{d.motorcycle}%</small>
                </div>
                <div className="cr-chart-track cr-chart-track--bus">
                  <i className="cr-chart-fill cr-chart-fill--bus" style={{ width: `${d.bus * 2}%` }} />
                  <small className="cr-chart-val">{d.bus}%</small>
                </div>
              </div>
            ))}
          </div>
          <div className="cr-chart-legend">
            <span><i style={{ background: "var(--tk-red)" }} /> motorcycle</span>
            <span><i style={{ background: "var(--tk-blue)" }} /> public transport</span>
          </div>
        </figure>
      </div>

      <ResearchPanel
        title="Global benchmarks: farebox recovery, tourism transit and the profit question"
        stats={BENCHMARK_STATS}
        citations={COMPARATIVE_CITATIONS}
      >
        <p>
          The Las Vegas Strip corridor is the closest structural analogue to Phuket: a tourism-saturated corridor
          served by a purpose-built bus. It ran profitably for seven years (2008–2015) — one of the only profitable
          transit lines in the United States. Singapore's ~100% farebox recovery is globally unique, driven by the
          COE vehicle quota system that makes car ownership prohibitively expensive. Barcelona's ~45% recovery is
          achieved through integrated fare structuring where tourism passes subsidise resident fares. The lesson:
          profitability is a design choice, not a law — but the design has to match the place.
        </p>
      </ResearchPanel>

      <ResearchPanel
        title="ASEAN mode share, motorcycle dominance and the safety case"
        stats={[]}
        citations={ASEAN_CITATIONS}
      >
        <p>
          The Asian Transport Outlook (ADB, 2023) documents the regional pattern: motorcycle mode share of 70–80%
          across Thailand, Vietnam and Indonesia. WHO's 2023 Global Status Report confirms Thailand's 25.4 deaths
          per 100,000 — 9th highest globally — with motorcyclists accounting for 83.8% of fatalities. This is the
          status quo a bus has to shift. The safety case for transit is not abstract; it is the mortality case.
        </p>
      </ResearchPanel>
    </section>
  );
}

export default ComparativeResearch;