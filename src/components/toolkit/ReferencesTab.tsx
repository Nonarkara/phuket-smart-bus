/**
 * References Tab — consolidated bibliography and data inventory.
 *
 * Every citation scattered across the research hub, consolidated into one
 * searchable, categorised reference list. For the academics who want to
 * check the work — and for anyone who wants to build on it.
 */

import { useState } from "react";

type RefCategory = "peer-reviewed" | "grey-literature" | "data-sources" | "programme" | "legal-financial";

type Reference = {
  category: RefCategory;
  text: string;
  meta: string;
  href: string;
};

const REFERENCES: Reference[] = [
  // Peer-reviewed
  {
    category: "peer-reviewed",
    text: "Piatkowski, D., Lee, J., & USDOT UNLV TRB paper — “Does what happens in Vegas increase pedestrian safety?”",
    meta: "Taylor & Francis Transport Reviews, 2026. NDOT 1997–2023 collision data; 80.8% reduction at Flamingo after pedestrian bridge.",
    href: "https://www.tandfonline.com/doi/full/10.1080/21650020.2026.2652651"
  },
  {
    category: "peer-reviewed",
    text: "McFadden, D. — “Economic Choices,”",
    meta: "Nobel Prize Lecture, 8 Dec 2000. Discrete-choice theory under every mode-choice model.",
    href: "https://www.nobelprize.org/prizes/economic-sciences/2000/mcfadden/lecture/"
  },
  {
    category: "peer-reviewed",
    text: "Ben-Akiva, M. & Lerman, S.R. — Discrete Choice Analysis: Theory and Application to Travel Demand,",
    meta: "MIT Press, 1985. The standard textbook translation of discrete-choice theory into travel-mode models.",
    href: "https://mitpress.mit.edu/9780262536400/discrete-choice-analysis/"
  },
  {
    category: "peer-reviewed",
    text: "Bursa, B., Mailer, M. & Axhausen, K.W. — “Travel behavior on vacation: transport mode choice of tourists at destinations,”",
    meta: "Transportation Research Part A, 166 (2022), pp. 234–261.",
    href: "https://www.sciencedirect.com/science/article/pii/S0965856422002543"
  },
  {
    category: "peer-reviewed",
    text: "Eldeeb, G. & Mohamed, M. — “Understanding the Transit Market: A Persona-Based Approach for Preferences Quantification,”",
    meta: "Sustainability, 12(9), 3863, 2020. Seven rider personas from 5,238-response Ontario survey.",
    href: "https://www.mdpi.com/2071-1050/12/9/3863"
  },
  {
    category: "peer-reviewed",
    text: "Wang, Y., Guo, J., Ceder, A., Currie, G., Dong, W. & Yuan, H. — queueing analysis of balking and reneging transit passengers,",
    meta: "Transportation Research Part B: Methodological, 2014. The formal model behind the 60-minute patience threshold.",
    href: "https://www.researchgate.net/publication/261186876"
  },
  {
    category: "peer-reviewed",
    text: "Grimes, A. et al. — “Impacts of zero-fare transit policy on health and social determinants,”",
    meta: "Frontiers in Public Health, 12, 2024. Kansas City natural experiment design.",
    href: "https://pmc.ncbi.nlm.nih.gov/articles/PMC11532055/"
  },
  {
    category: "peer-reviewed",
    text: "Pearl, J. & Mackenzie, D. — The Book of Why: The New Science of Cause and Effect,",
    meta: "Basic Books, 2018. The ladder of causation.",
    href: "https://www.hachettebookgroup.com/titles/judea-pearl/the-book-of-why/9781541608986/"
  },
  {
    category: "peer-reviewed",
    text: "Rubin, D.B. — “Estimating Causal Effects of Treatments in Randomized and Nonrandomized Studies,”",
    meta: "Journal of Educational Psychology, 66(5), 688–701, 1974. Potential-outcomes framework.",
    href: "https://eric.ed.gov/?id=EJ118470"
  },
  // Grey literature / reports
  {
    category: "grey-literature",
    text: "Airports of Thailand (AOT) — Annual Report 2025,",
    meta: "17.5M HKT passenger movements; 106,585 aircraft movements (2025).",
    href: "https://www.airportthai.co.th/wp-content/uploads/2026/06/ANNUAL-REPORT-2025.pdf"
  },
  {
    category: "grey-literature",
    text: "C9 Hotelworks — “Phuket Hotel & Tourism Update,” March 2026,",
    meta: "17.4M pax in 2025; airport operating at 39% above designed capacity.",
    href: "https://c9hotelworks.com/wp-content/uploads/2026/03/Phuket-Hotel-Tourism-Update.pdf"
  },
  {
    category: "grey-literature",
    text: "WHO Thailand — “Road Safety in Thailand,” 2023 Global Status Report,",
    meta: "Death rate 25.4/100k; 18,218 deaths/year; motorcyclists = 83.8% of fatalities.",
    href: "https://www.who.int/thailand/our-work/road-safety"
  },
  {
    category: "grey-literature",
    text: "Hodges, T. — Public Transportation’s Role in Responding to Climate Change,",
    meta: "Federal Transit Administration, 2010. CO₂ methodology basis.",
    href: "https://www.epa.gov/sites/default/files/2016-04/documents/public_transportations_role_in_responding_to_climate_change.pdf"
  },
  {
    category: "grey-literature",
    text: "Thai Meteorological Department — Phuket station monthly rainfall,",
    meta: "TMD 30-year normals. Annual 2,200 mm; 70% May–Oct.",
    href: "https://www.thephuketnews.com/phuket-rainfall-hits-records-98341.php"
  },
  {
    category: "grey-literature",
    text: "The Nevada Independent — “As passenger counts dwindle on Strip buses…”,",
    meta: "RTC FY2019. ~$6M Strip profit 2008–2015; 3.3M trips lost post ride-hailing.",
    href: "https://thenevadaindependent.com/article/as-passenger-counts-dwindle-on-strip-buses-the-rtc-eyes-innovation-while-closely-monitoring-financials"
  },
  {
    category: "grey-literature",
    text: "RTC Southern Nevada — Fares & Passes,",
    meta: "Deuce: $4 single, $8 24-hr, $20 72-hr. 100-seat Enviro500.",
    href: "https://www.rtcsnv.com/ways-to-travel/fares-passes/"
  },
  // Data sources
  {
    category: "data-sources",
    text: "AEROTHAI — Phuket flight-control volume, FY2025",
    meta: "107,157 controlled flight movements; 294/day average; 389 daily maximum. data.go.th.",
    href: "https://data.go.th/dataset/bangkok-fir-all-2568"
  },
  {
    category: "data-sources",
    text: "Department of Disease Control — Integrated road-death records (3 databases)",
    meta: "Thailand road-death data. data.go.th.",
    href: "https://www.data.go.th/dataset/rtddi"
  },
  {
    category: "data-sources",
    text: "Ministry of Tourism and Sports — Monthly provincial tourism statistics",
    meta: "data.go.th.",
    href: "https://www.data.go.th/th/dataset/stattourism"
  },
  {
    category: "data-sources",
    text: "FTA National Transit Database — Annual Database Fare Revenues, 2023",
    meta: "US farebox recovery range 13–36%.",
    href: "https://www.transit.dot.gov/ntd/data-product/2023-annual-database-fare-revenues"
  },
  {
    category: "data-sources",
    text: "Asian Development Bank — Asian Transport Outlook, 2023",
    meta: "ASEAN mode share data.",
    href: "https://www.adb.org/publications/asian-transport-outlook"
  },
  // Programme records
  {
    category: "programme",
    text: "USASCP — Smart Sustainable Mobility programme record",
    meta: "USDOT / U.S. Department of State.",
    href: "https://www.usascp.org/programs/transportationprogram/"
  },
  {
    category: "programme",
    text: "METRANS Transportation Consortium — University Partnership Programme",
    meta: "Four city-pair toolkits published 2026.",
    href: "https://www.metrans.org/upp"
  },
  {
    category: "programme",
    text: "Transit Service Planning for Sustainable Tourism Travel — Insights from Phuket and Las Vegas",
    meta: "USASCP toolkit, 23 pp.",
    href: "https://www.metrans.org/upp"
  },
  {
    category: "programme",
    text: "TCRP Report 36 — Using Market Segmentation to Increase Transit Ridership,",
    meta: "Transportation Research Board / National Academies, 1998.",
    href: "https://onlinepubs.trb.org/onlinepubs/tcrp/tcrp_rpt_36-a.pdf"
  },
  {
    category: "programme",
    text: "TCRP Report 166 — Premium Transit Services that Affect Choice of Mode,",
    meta: "Transportation Research Board / National Academies, 2013.",
    href: "https://nap.nationalacademies.org/catalog/22401/characteristics-of-premium-transit-services-that-affect-choice-of-mode"
  },
  {
    category: "programme",
    text: "TCRP Synthesis 89 — Public Participation Strategies for Transit,",
    meta: "Transportation Research Board / National Academies, 2011.",
    href: "https://www.nationalacademies.org/publications/22865"
  },
  // Legal / financial
  {
    category: "legal-financial",
    text: "World Bank Group — PPP Reference Guide, Version 3, 2024",
    meta: "1.1×–1.5× DSCR covenants.",
    href: "https://ppp.worldbank.org/sites/default/files/2024-08/PPP%20Reference%20Guide%20Version%203.pdf"
  },
  {
    category: "legal-financial",
    text: "Thailand — Act on Private Participation in State Undertaking B.E. 2562 (2019)",
    meta: "Thai PPP framework.",
    href: "https://www.pppthailand.go.th/"
  },
  {
    category: "legal-financial",
    text: "OTP — Thailand clean-mobility funding mechanism, 2017",
    meta: "฿12m EV bus; ฿0.9m annual operating cost.",
    href: "https://www.otp.go.th/uploads/tiny_uploads/ProjectOTP/2560/Project17/4-DevelopmentofaFundingMechanism.pdf"
  },
  {
    category: "legal-financial",
    text: "ADB — Piloting Results-Based Lending for Programs, 2013–2019",
    meta: "19 loans, 11 countries, $4.8bn.",
    href: "https://www.adb.org/documents/piloting-results-based-lending-programs-working-paper"
  },
  {
    category: "legal-financial",
    text: "LSTA — Green Loan Principles (GLP), 2023",
    meta: "Electric buses explicitly eligible.",
    href: "https://www.lsta.org/content/guidance-on-green-loan-principles-glp/"
  },
  {
    category: "legal-financial",
    text: "Bank of Thailand — Monetary Policy Report Q1 2026",
    meta: "7.07% MLR stress benchmark.",
    href: "https://www.bot.or.th/content/dam/bot/documents/en/our-roles/monetary-policy/mpc-publication/monetary-policy-report/MPR_2026_Q1.pdf"
  }
];

const CATEGORY_LABELS: Record<RefCategory, string> = {
  "peer-reviewed": "Peer-reviewed literature",
  "grey-literature": "Reports & grey literature",
  "data-sources": "Open data sources",
  "programme": "Programme records & TCRP",
  "legal-financial": "Legal & financial references"
};

const CATEGORY_ORDER: RefCategory[] = ["peer-reviewed", "grey-literature", "data-sources", "programme", "legal-financial"];

const DATA_INVENTORY = [
  { metric: "Real daily arrivals & load factors", source: "AOT flight feed", unlocks: "Replaces curated peak-day schedule with fact" },
  { metric: "Ticketing / boarding counts", source: "PKSB fare system", unlocks: "Calibrates the 8 capture heuristics" },
  { metric: "Live GPS (AVL)", source: "Fleet trackers", unlocks: "Simulated positions become real" },
  { metric: "OD survey re-runs", source: "Toolkit method (~$20k)", unlocks: "1 km demand grids as live map layer" },
  { metric: "Hotel occupancy by zone", source: "Patong Hotel Association / THA", unlocks: "Return-leg origins weighted" },
  { metric: "App analytics", source: "PKSB app + trip planners", unlocks: "Persona 8 conversion tracking" }
];

export function ReferencesTab() {
  const [activeCategory, setActiveCategory] = useState<RefCategory | "all">("all");

  const filtered = activeCategory === "all"
    ? REFERENCES
    : REFERENCES.filter((r) => r.category === activeCategory);

  return (
    <section className="rt-section" id="references" aria-labelledby="references-title">
      <header className="rt-section__head">
        <p className="tk-kicker">Bibliography · data inventory · reproducibility</p>
        <h2 id="references-title">Open the cupboard. Check our ingredients.</h2>
        <p className="rt-section__standfirst">
          Every citation in this research hub, consolidated and categorised. Filter by type to find peer-reviewed
          literature, government reports, open data sources, programme records or legal-financial references.
          If a claim in this site doesn't trace back to one of these, it's our synthesis — said plainly.
        </p>
      </header>

      {/* Filter controls */}
      <div className="rt-filters" role="group" aria-label="Filter references by category">
        <button
          type="button"
          className={activeCategory === "all" ? "rt-filter is-active" : "rt-filter"}
          onClick={() => setActiveCategory("all")}
        >
          All ({REFERENCES.length})
        </button>
        {CATEGORY_ORDER.map((cat) => {
          const count = REFERENCES.filter((r) => r.category === cat).length;
          return (
            <button
              key={cat}
              type="button"
              className={activeCategory === cat ? "rt-filter is-active" : "rt-filter"}
              onClick={() => setActiveCategory(cat)}
            >
              {CATEGORY_LABELS[cat]} ({count})
            </button>
          );
        })}
      </div>

      {/* Reference list */}
      <ol className="rt-list">
        {filtered.map((ref, index) => (
          <li key={ref.href} className="rt-item">
            <span className="rt-item__num">{String(index + 1).padStart(2, "0")}</span>
            <div className="rt-item__body">
              <a href={ref.href} target="_blank" rel="noreferrer" className="rt-item__link">
                {ref.text} <b>↗</b>
              </a>
              <small className="rt-item__meta">{ref.meta}</small>
              <span className={`rt-item__cat rt-item__cat--${ref.category}`}>{CATEGORY_LABELS[ref.category]}</span>
            </div>
          </li>
        ))}
      </ol>

      {/* Data inventory */}
      <div className="rt-inventory">
        <h3 className="rt-subhead">Data wanted — what would sharpen this model</h3>
        <p className="rt-intro-note">
          The simulation is scaffolding. Each future data feed has a named place to land and a specific assumption
          to retire. This is the inventory for the next research phase.
        </p>
        <div className="rt-inventory-table" role="table" aria-label="Data wanted, source and what it unlocks">
          <div className="rt-inventory-row rt-inventory-row--head" role="row">
            <span role="columnheader">Data needed</span>
            <span role="columnheader">Source</span>
            <span role="columnheader">What it unlocks</span>
          </div>
          {DATA_INVENTORY.map((d) => (
            <div className="rt-inventory-row" role="row" key={d.metric}>
              <strong role="cell">{d.metric}</strong>
              <span role="cell">{d.source}</span>
              <span role="cell">{d.unlocks}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Reproducibility note */}
      <div className="rt-reproducibility">
        <span className="tk-kicker">Reproducibility</span>
        <h3>This is an open repository. Run the numbers yourself.</h3>
        <p>
          The Phuket Smart Bus system is open-source. The simulation engine, route geometry, timetables and
          conservation-law tests are all in the <a href="https://github.com/Nonarkara/phuket-smart-bus">GitHub
          repository</a>. The 130 unit tests verify that demand = boarded + lost at every minute, in both
          directions. Clone it, run it, break it — then tell us what you found.
        </p>
        <div className="rt-reproducibility-links">
          <a href="https://github.com/Nonarkara/phuket-smart-bus" className="rt-btn">View the repository ↗</a>
          <a href="https://bus.nonarkara.org/ops" className="rt-btn">Run the operations console ↗</a>
        </div>
      </div>
    </section>
  );
}

export default ReferencesTab;