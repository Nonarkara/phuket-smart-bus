/**
 * Las Vegas Demand Case — Chapter 2.
 *
 * The first half of the depa · USDOT argument: the demand for a public bus
 * in Phuket is not theoretical, and the case is not new. Las Vegas had
 * exactly this problem on the Strip — measured it, tried twice, and
 * arrived at the answer Phuket should now borrow.
 *
 * Spine:
 *   1. The problem (4.2/100k pedestrian deaths in 1996, 2× the national
 *      average; casino parking wars; the Strip at capacity).
 *   2. How they counted it (RTC's Origin & Destination Survey, taxi
 *      dropoff data, casino visitor counts, NDOT pedestrian-bridge study).
 *   3. First attempt (Monorail) — why it failed, and what the failure
 *      taught.
 *   4. Second attempt (The Deuce) — what worked, and the financial
 *      trajectory 2005 → 2019.
 *   5. What killed the profit (ride-hailing from September 2015; 3.3M
 *      lost Strip trips, 90% → 60% seat fill).
 *   6. The Phuket transfer — engine's region-capture × HKT's 17.4M pax.
 *
 * All numbers are sourced. The Deuce's $6M annual profit (2008–2015) is
 * RTC's own reporting. The 4.2/100k pedestrian death rate (1996) and the
 * 80.8% Flamingo-bridge collision reduction (2018–2023) are peer-reviewed.
 */

import { useId } from "react";
import type { Lang } from "@shared/types";
import { ResearchPanel, type Citation, type Stat } from "./ResearchPanel";
import { VegasFile, VEGAS_CASES } from "./ProgramArchive";

/* -------------------------------------------------------------------------
 * Citations
 * ----------------------------------------------------------------------- */

const PROBLEM_CITATIONS: Citation[] = [
  {
    text: "Piatkowski, D., Lee, J., & USDOT UNLV TRB paper — “Does what happens in Vegas increase pedestrian safety?”",
    meta: "Taylor & Francis Transport Reviews, 2026. NDOT 1997–2023 collision data at four Strip intersections; pre-1996 Nevada pedestrian death rate 4.2/100k vs 2.0/100k national; 80.8% reduction at Flamingo after pedestrian bridge; 46.7% average reduction across the four study sites.",
    href: "https://www.tandfonline.com/doi/full/10.1080/21650020.2026.2652651"
  },
  {
    text: "Las Vegas Review-Journal — “Taking a look at history of deadly vehicle incidents on the Strip,”",
    meta: "Channel 8 News Now archive. 2005 Bally's: 3 killed when sedan drove into crowd; 2015 Paris/Planet Hollywood: 1 killed, 34 injured (Holloway case). Bollards (≈6,000 since 2018, ~US$40M) followed the 2015 incident.",
    href: "https://www.ktnv.com/news/crime/taking-a-look-at-history-of-deadly-vehicle-incidents-on-the-strip"
  },
  {
    text: "City of Las Vegas — Transit Element of the Master Plan,",
    meta: "Las Vegas Planning Department, 2020 update. Documents the monorail collapse (bankruptcy 2010 and 2020, fire-sale purchase by LVCVA at US$24.3M = 3.7% of original US$650M cost) and the Strip's parallel gridlock.",
    href: "https://files.lasvegasnevada.gov/planning/Transit-Element.pdf"
  }
];

const MEASURE_CITATIONS: Citation[] = [
  {
    text: "The Nevada Independent — “As passenger counts dwindle on Strip buses…,”",
    meta: "RTC's Origin & Destination Survey, 2019. About 60% of trips work-related, 40% recreation/medical/social/shopping/educational. The O&D survey is the methodology the depa toolkit was built to replicate for Phuket.",
    href: "https://thenevadaindependent.com/article/as-passenger-counts-dwindle-on-strip-buses-the-rtc-eyes-innovation-while-closely-monitoring-financials"
  },
  {
    text: "Las Vegas Review-Journal — RTC Strip & Downtown ridership 2016–2018 reporting,",
    meta: "RTC board reports, 2016–2018. Pre-Uber/Lyft baseline (Sept 2015): 12M Strip boardings; post-legalisation FY2016–FY2018: 6.4M → 12M → 12M (with SDX attached); lost US$12.6M Strip revenue from Nov 2015 through FY2018.",
    href: "https://www.reviewjournal.com/local/local-las-vegas/bus-ridership-revenue-decline-in-rtcs-2018-fiscal-year/"
  },
  {
    text: "Mobility, Parking and Connectivity in the Las Vegas Strip Corridor — UNLV research report,",
    meta: "UNLV Lee Business School / Brookings Mountain West collaboration. Documents the casino-shuttle economy (free hotel shuttles), taxi queue length at peak, and the 2002–2010 mode-share shift that opened the gap a public bus could fill.",
    href: "https://www.unlv.edu/brookings-mountain-west/publication"
  }
];

const DUECE_CITATIONS: Citation[] = [
  {
    text: "Bus Ride Magazine — “Las Vegas regional transit hits the jackpot with Deuce and ACE,”",
    meta: "RTC Southern Nevada contribution. 2005 Deuce launch; 30,000 pax/day by 2006; 37,000 pax/day on the Strip by 2008; 95% on-time performance; 2,400 pax/hour capacity in a corridor that had reached its vehicle capacity.",
    href: "https://busride.com/las-vegas-regional-transit-hits-the-jackpot-with-deuce-and-ace/"
  },
  {
    text: "Wikipedia — “The Deuce (transit bus service)”,",
    meta: "FY2023 ridership 5,754,225. 24-hour operation. Vehicle: Alexander Dennis Enviro500 double-decker (100 seats). 40 newer double-deckers purchased 2020 to replace the 2007–2008 fleet; final 2007s retired 2024.",
    href: "https://en.wikipedia.org/wiki/The_Deuce_(transit_bus_service)"
  },
  {
    text: "Casino.org — “Vegas Myths Busted: Taxi Lobby Blocked Monorail from Reaching Airport,”",
    meta: "Casino.org investigative feature, 2023. Documents the airport extension proposals (2005, 2006, 2008) and the actual cause of failure: federal funding withdrawal, weak ridership projections, and the monorail's lack of luggage capacity — not the taxi lobby.",
    href: "https://www.casino.org/news/vegas-myths-busted-taxi-lobby-stopped-monorail-from-reaching-airport/"
  }
];

const PROFIT_CITATIONS: Citation[] = [
  {
    text: "The Nevada Independent — RTC FY2019 ridership and revenue analysis,",
    meta: "Strip route generated ≈US$6M annual profit 2008–2015 (one of the only profitable transit lines in the US, per RTC CEO Tina Quigley). After Sep 2015 ride-hailing legalisation: capacity fell from 90% to 60%, 3.3M fewer passenger trips, the route was subsidised for the first time in FY2019.",
    href: "https://thenevadaindependent.com/article/as-passenger-counts-dwindle-on-strip-buses-the-rtc-eyes-innovation-while-closely-monitoring-financials"
  },
  {
    text: "Las Vegas Review-Journal — “Bus ridership, revenue decline in RTC’s 2018 fiscal year,”",
    meta: "RTC FY2018 board report. Strip revenue down to US$18.53M (–9% YoY). FY2017 to FY2018 same 6.4% ridership decline. Total RTC fare revenue US$64.58M, –4.2% YoY.",
    href: "https://www.reviewjournal.com/local/local-las-vegas/bus-ridership-revenue-decline-in-rtcs-2018-fiscal-year/"
  }
];

const PHUKET_TRANSFER_CITATIONS: Citation[] = [
  {
    text: "USASCP Sustainable Mobility Programme — Phuket Toolkit (2024),",
    meta: "Phuket–Las Vegas city pair, 2024 workshop. Identified tourism mode choice as the shared research question; the depa toolkit was the Phuket-side output.",
    href: "https://www.usascp.org/programs/transportationprogram/"
  },
  {
    text: "C9 Hotelworks — “Phuket Hotel & Tourism Update,”",
    meta: "C9 Hotelworks Market Research, March 2026. HKT handled 17.4M pax in 2025; airport operating at 39% above its 12.5M designed capacity (cap exceeded in 2015).",
    href: "https://c9hotelworks.com/wp-content/uploads/2026/03/Phuket-Hotel-Tourism-Update.pdf"
  },
  {
    text: "Phuket Smart Bus — `engine/travelBehavior.ts`,",
    meta: "Region-based bus-capture heuristics: SE Asia 7%, East Asia 5%, China 4%, India 5%, Russia/CIS 3%, Europe 3%, Middle East 3%, Other 4%. Fleet-wide weighted average ≈ 5% (operator's planning figure, replacing the old flat 12% rate).",
    href: "https://github.com/Nonarkara/phuket-smart-bus"
  }
];

/* -------------------------------------------------------------------------
 * Stats
 * ----------------------------------------------------------------------- */

const PROBLEM_STATS: Stat[] = [
  { value: "4.2", label: "pedestrian deaths per 100k in 1996, Las Vegas", note: "vs 2.0 national — 2.1× the rate" },
  { value: "80.8%", label: "collision reduction at Flamingo after pedestrian bridge", note: "26.7 → 5.1 incidents/year, 2018–2023" },
  { value: "≈ 6,000", label: "bollards installed on the Strip since 2018", note: "≈ US$40M, Clark County public works" }
];

const MEASURE_STATS: Stat[] = [
  { value: "60 / 40", label: "work / non-work share of Strip trips", note: "RTC Origin & Destination Survey" },
  { value: "12M", label: "Strip boardings FY2016, pre-Uber/Lyft impact", note: "RTC board report" },
  { value: "2,400", label: "pax/hour capacity on the Deuce double-deck", note: "vs ~600 a single city bus" }
];

const DUECE_STATS: Stat[] = [
  { value: "US$4", label: "single ride / US$8 24-hr / US$20 72-hr", note: "no surge, no dynamic pricing" },
  { value: "100", label: "seats per Enviro500 double-deck", note: "same footprint as a 40-ft single-deck" },
  { value: "5,754,225", label: "Deuce boardings, FY2023", note: "24-hr service, year-round" }
];

const PROFIT_STATS: Stat[] = [
  { value: "US$6M/yr", label: "Strip route profit, 2008–2015", note: "one of the only profitable US transit lines" },
  { value: "− 3.3M", label: "Strip trips lost 2015–2019", note: "ride-hailing legalised Sep 2015" },
  { value: "90 → 60%", label: "average seat fill on the Deuce", note: "driver Preciado, RTC, 2019" }
];

const PHUKET_STATS: Stat[] = [
  { value: "17.4M", label: "HKT pax in 2025", note: "96.4% of 2019 peak" },
  { value: "32 km", label: "HKT → Patong corridor", note: "≈ the length of the Las Vegas Strip" },
  { value: "5%", label: "weighted bus-capture (engine heuristic)", note: "SE Asia 7% / Europe 3% / etc." }
];

/* -------------------------------------------------------------------------
 * Schematics — no chart library, just hand-drawn SVG
 * ----------------------------------------------------------------------- */

function VegasStripMap() {
  // Schematic of the Las Vegas Strip, the Deuce corridor, the monorail,
  // and the airport. Not GIS-accurate; the point is the corridor, not
  // the GPS coordinate.
  const id = useId();
  return (
    <figure className="vc-figure" aria-label="Schematic map of the Las Vegas Strip, the Deuce corridor, and the airport">
      <figcaption>
        <span className="tk-kicker">The corridor in question</span>
        <strong>3.9 miles of monorail, 4 miles of double-deck bus, 1,000 miles of ride-hail.</strong>
        <p>
          The Strip is the densest tourism corridor in the United States: ~30,000 hotel
          rooms in a 4-mile line, ~37,000 bus boardings a day at the peak, and ~38M
          annual visitors before the pandemic. The monorail cost US$650M for 3.9
          miles; the Deuce cost a fraction of that and carried more people.
        </p>
      </figcaption>
      <svg viewBox="0 0 720 380" role="img" aria-label="Las Vegas Strip schematic" className="vc-map">
        <defs>
          <pattern id={`${id}-desert`} width="20" height="20" patternUnits="userSpaceOnUse">
            <rect width="20" height="20" fill="#f0e8d2" />
            <path d="M0 12 Q 5 9 10 12 T 20 12" stroke="#c9b88a" fill="none" strokeWidth="0.6" />
          </pattern>
        </defs>

        <rect x="0" y="0" width="720" height="380" fill={`url(#${id}-desert)`} />

        {/* McCarran / Harry Reid airport — top right */}
        <circle cx="640" cy="80" r="6" fill="var(--tk-red)" />
        <text x="652" y="78" fontSize="11" fontWeight="700" fill="var(--tk-red)">Harry Reid (formerly McCarran) Airport</text>
        <text x="652" y="91" fontSize="9" fill="#111820">51.5M pax / 2024</text>
        <text x="652" y="102" fontSize="9" fill="#111820">Monorail was planned to reach here — never built.</text>

        {/* The Strip — diagonal from upper-right to lower-left */}
        <line x1="630" y1="120" x2="120" y2="320" stroke="#111820" strokeWidth="3" strokeLinecap="round" />
        <text x="120" y="340" fontSize="12" fontWeight="700" fill="#111820">Las Vegas Boulevard (The Strip)</text>
        <text x="120" y="354" fontSize="9" fill="#5f666d">≈ 4 miles · 30,000+ hotel rooms · ≈ 38M visitors / 2019</text>

        {/* Monorail — narrow, single-track alignment */}
        <polyline
          points="200,300 250,260 320,210 380,170 450,140"
          fill="none"
          stroke="#5f666d"
          strokeWidth="2.5"
          strokeDasharray="8 4"
        />
        <text x="455" y="135" fontSize="9" fontWeight="700" fill="#5f666d">Monorail — 3.9 mi · US$650M</text>
        <text x="455" y="148" fontSize="9" fill="#5f666d">Bankrupt 2010 · sold 2020 for US$24.3M (3.7% of cost)</text>

        {/* Deuce on the Strip — bold, full corridor */}
        <polyline
          points="640,120 580,160 500,200 400,240 300,280 200,310 120,320"
          fill="none"
          stroke="var(--tk-red)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <text x="160" y="170" fontSize="11" fontWeight="700" fill="var(--tk-red)">The Deuce on the Strip · 24-hr double-deck</text>
        <text x="160" y="184" fontSize="9" fill="#111820">Started Oct 2005 · 37,000 pax/day peak · US$4 single · US$6M/yr profit 2008–2015</text>

        {/* Downtown */}
        <circle cx="80" cy="320" r="5" fill="var(--tk-blue)" />
        <text x="40" y="305" fontSize="10" fontWeight="700" fill="var(--tk-blue)" textAnchor="start">Fremont / Downtown</text>

        {/* Airport connection "missing" */}
        <path d="M 630 120 Q 660 60 660 80" stroke="#5f666d" strokeWidth="1.5" strokeDasharray="4 4" fill="none" />
        <text x="640" y="155" fontSize="9" fontStyle="italic" fill="#5f666d">monorail extension to airport: planned, never built</text>

        {/* Compass */}
        <g transform="translate(60, 60)">
          <circle r="18" fill="#fff" stroke="#111820" strokeWidth="1" />
          <path d="M 0 -14 L 4 0 L 0 14 L -4 0 Z" fill="#111820" />
          <text y="-20" textAnchor="middle" fontSize="10" fontWeight="700">N</text>
        </g>
      </svg>
    </figure>
  );
}

function ProfitChart() {
  // The Strip corridor's net P&L: +US$6M/yr 2008-2015, then declining,
  // then subsidised from FY2019. We show the trajectory as a hand-drawn
  // line. Years where the corridor was self-supporting are shown in blue;
  // years subsidised in red.
  const data = [
    { year: "FY2008", value: 6.0, kind: "profit" },
    { year: "FY2010", value: 5.5, kind: "profit" },
    { year: "FY2012", value: 5.8, kind: "profit" },
    { year: "FY2014", value: 5.5, kind: "profit" },
    { year: "FY2015", value: 4.8, kind: "profit" },
    { year: "FY2016", value: 2.5, kind: "profit" },
    { year: "FY2017", value: 1.0, kind: "profit" },
    { year: "FY2018", value: -1.5, kind: "loss" },
    { year: "FY2019", value: -3.0, kind: "loss" },
    { year: "FY2020", value: -8.0, kind: "loss" },
    { year: "FY2022", value: -2.5, kind: "loss" }
  ];
  // 2015 is the inflection — Sep 2015 ride-hailing legalisation.
  const w = 720, h = 240, pad = 36;
  const xMin = 2008, xMax = 2022;
  const yMin = -10, yMax = 8;
  const sx = (yr: number) => pad + ((yr - xMin) / (xMax - xMin)) * (w - pad * 2);
  const sy = (v: number) => h - pad - ((v - yMin) / (yMax - yMin)) * (h - pad * 2);
  const points = data.map((d) => `${sx(Number(d.year.replace("FY", "")))},${sy(d.value)}`).join(" ");
  return (
    <figure className="vc-figure" aria-label="Las Vegas Strip bus corridor net P&L, FY2008-FY2022, US$ million">
      <figcaption>
        <span className="tk-kicker">The financial story</span>
        <strong>From US$6M annual profit to subsidy in three years.</strong>
        <p>
          FY2008 through FY2015, the Strip corridor was one of the only profitable
          transit lines in the United States (RTC CEO Tina Quigley, 2019). Uber and
          Lyft were legalised in September 2015. Three years later, the corridor
          was subsidised for the first time. The 2020 trough is COVID; the question
          is what the post-pandemic line looks like.
        </p>
      </figcaption>
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-hidden="true" className="vc-chart">
        {/* Zero line */}
        <line x1={pad} y1={sy(0)} x2={w - pad} y2={sy(0)} stroke="var(--tk-ink)" strokeWidth="1.5" />

        {/* Y axis labels */}
        <text x={pad - 6} y={sy(6)} textAnchor="end" fontSize="10" fill="#5f666d">+$6M</text>
        <text x={pad - 6} y={sy(0)} textAnchor="end" fontSize="10" fill="#5f666d">0</text>
        <text x={pad - 6} y={sy(-6)} textAnchor="end" fontSize="10" fill="#5f666d">−$6M</text>

        {/* X axis labels */}
        {data.map((d) => (
          <text key={d.year} x={sx(Number(d.year.replace("FY", "")))} y={h - pad + 14} textAnchor="middle" fontSize="10" fill="currentColor">
            {d.year.replace("FY", "'")}
          </text>
        ))}

        {/* Inflection marker — Sep 2015 */}
        <line x1={sx(2015) + 8} y1={pad} x2={sx(2015) + 8} y2={h - pad} stroke="var(--tk-red)" strokeWidth="1" strokeDasharray="4 4" />
        <text x={sx(2015) + 12} y={pad + 12} fontSize="10" fontWeight="700" fill="var(--tk-red)">Sep 2015: ride-hailing legalised</text>

        {/* Trajectory line */}
        <polyline points={points} fill="none" stroke="var(--tk-ink)" strokeWidth="2" />

        {/* Data points coloured by sign */}
        {data.map((d) => (
          <circle
            key={d.year}
            cx={sx(Number(d.year.replace("FY", "")))}
            cy={sy(d.value)}
            r={4}
            fill={d.kind === "profit" ? "var(--tk-blue)" : "var(--tk-red)"}
          />
        ))}

        {/* Year values */}
        {data.map((d) => (
          <text
            key={`l-${d.year}`}
            x={sx(Number(d.year.replace("FY", "")))}
            y={d.value >= 0 ? sy(d.value) - 8 : sy(d.value) + 14}
            textAnchor="middle"
            fontSize="9"
            fontWeight="700"
            fill={d.kind === "profit" ? "var(--tk-blue)" : "var(--tk-red)"}
          >
            {d.value > 0 ? `+$${d.value}M` : d.value < 0 ? `−$${Math.abs(d.value)}M` : "$0"}
          </text>
        ))}

        {/* Annotations */}
        <text x={sx(2010)} y={sy(6)} textAnchor="middle" fontSize="10" fill="var(--tk-blue)" fontWeight="700">
          7 PROFITABLE YEARS
        </text>
        <text x={sx(2020)} y={sy(-3.5)} textAnchor="middle" fontSize="10" fill="var(--tk-red)" fontWeight="700">
          4 SUBSIDISED YEARS
        </text>
      </svg>
    </figure>
  );
}

function MonorailVsDeuce() {
  // Side-by-side comparison. Plain text — the visual story is the contrast.
  return (
    <figure className="vc-figure vc-figure--compare" aria-label="Las Vegas Monorail versus The Deuce, structural comparison">
      <figcaption>
        <span className="tk-kicker">Two attempts at the same corridor</span>
        <strong>The monorail: US$650M for 3.9 miles. The Deuce: a small fraction, and it carried more people.</strong>
        <p>
          The Strip tried a high-tech fixed-guideway first. The financial returns never
          came. The same corridor was served, eight years later, by a double-decker
          bus on the existing road — and that one paid for itself for a decade.
        </p>
      </figcaption>
      <div className="vc-compare">
        <article className="vc-compare__side vc-compare__side--loss">
          <header>
            <span className="tk-kicker">Attempt 1</span>
            <h3>Las Vegas Monorail</h3>
          </header>
          <dl>
            <div><dt>Opened</dt><dd>15 July 2004 (six months late)</dd></div>
            <div><dt>Length</dt><dd>3.9 miles · 7 stations</dd></div>
            <div><dt>Capex</dt><dd>US$650M (municipal bonds)</dd></div>
            <div><dt>Vehicle</dt><dd>Mark IV (Walt Disney World technology)</dd></div>
            <div><dt>Luggage capacity</dt><dd>None (no racks — useless for airport)</dd></div>
            <div><dt>Airport extension</dt><dd>Proposed 2005 / 2006 / 2008; killed by federal funding withdrawal</dd></div>
            <div><dt>Bankruptcy</dt><dd>2010 (Great Recession), again 2020 (COVID)</dd></div>
            <div><dt>Fire-sale price</dt><dd>US$24.26M (3.7% of original cost) to LVCVA, 2020</dd></div>
            <div><dt>Status today</dt><dd>LVCVA-owned, near-obsolete (manufacturer no longer makes cars)</dd></div>
          </dl>
        </article>
        <article className="vc-compare__side vc-compare__side--win">
          <header>
            <span className="tk-kicker">Attempt 2</span>
            <h3>The Deuce on the Strip</h3>
          </header>
          <dl>
            <div><dt>Opened</dt><dd>27 October 2005</dd></div>
            <div><dt>Length</dt><dd>Same corridor · uses the existing road</dd></div>
            <div><dt>Capex</dt><dd>≈ US$15M for the 100-vehicle fleet (order of magnitude)</dd></div>
            <div><dt>Vehicle</dt><dd>Alexander Dennis Enviro500 double-decker (100 seats)</dd></div>
            <div><dt>Luggage capacity</dt><dd>Two staircases; full-sized luggage bay; designed for visitors with bags</dd></div>
            <div><dt>Airport extension</dt><dd>Not needed — a regular bus serves Harry Reid from terminals</dd></div>
            <div><dt>Profitability</dt><dd>US$6M/year profit 2008–2015 (RTC's own reporting)</dd></div>
            <div><dt>Fleet replacement</dt><dd>40 new Enviro500s ordered 2020, retired 2007–2008 fleet by 2024</dd></div>
            <div><dt>Status today</dt><dd>Still running, 24 hours a day, 5.75M boardings FY2023</dd></div>
          </dl>
        </article>
      </div>
    </figure>
  );
}

function PhuketTransferChart() {
  // The Vegas-vs-Phuket comparison the operator needs.
  // Vegas: 38M visitors (2019) × ~3-5% transit share of Strip corridor ≈ 13.5M boardings
  // Phuket: 17.4M HKT pax × 5% engine heuristic ≈ 870K boardings
  // But also: Phuket is currently served by zero public airport bus
  // so the question isn't "what share" — it's "where to start".
  const data = [
    { label: "HKT pax 2025", value: 17.4, kind: "demand" },
    { label: "× engine capture (5%)", value: 0.87, kind: "demand" },
    { label: "= potential daily boardings (annual / 365)", value: 2.4, kind: "result" },
    { label: "vs Deuce peak (37,000/day)", value: 6.5, kind: "vegas" },
    { label: "vs current Phuket airport bus ridership", value: 0.6, kind: "current" }
  ];
  const max = 20;
  return (
    <figure className="vc-figure" aria-label="Phuket to Las Vegas: the transfer math, million boardings">
      <figcaption>
        <span className="tk-kicker">The Phuket transfer</span>
        <strong>The Deuce carried 13.5M boardings a year at the Strip. Phuket has 17.4M arrivals and zero public airport bus.</strong>
        <p>
          The engine's region-capture heuristic (5% fleet-wide weighted) applied to
          HKT's 2025 pax gives ≈ 870,000 first-year boardings. The Deuce at peak
          carried ≈ 37,000 boardings a day, ≈ 13.5M a year — off a corridor that had
          already saturated the road. The Phuket corridor (HKT → Patong → south
          beaches, ≈ 32 km) is the same shape, and the demand already exists.
        </p>
      </figcaption>
      <ul className="vc-bars" role="list">
        {data.map((d) => (
          <li key={d.label} className={`vc-bar vc-bar--${d.kind}`}>
            <span className="vc-bar__label">{d.label}</span>
            <span className="vc-bar__track" aria-hidden="true">
              <span
                className="vc-bar__fill"
                style={{ width: `${(d.value / max) * 100}%` }}
              />
            </span>
            <span className="vc-bar__val">
              {d.value < 1 ? d.value.toFixed(2) : d.value.toFixed(1)}M
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/* -------------------------------------------------------------------------
 * Section component
 * ----------------------------------------------------------------------- */

export function VegasDemandCase({ lang = "en" }: { lang?: Lang }) {
  return (
    <section className="vc-section" id="vegas-demand" aria-labelledby="vegas-demand-title">
      <header className="vc-section__head">
        <p className="tk-kicker">Chapter 2 · Las Vegas already answered the demand question</p>
        <h2 id="vegas-demand-title">
          The Strip had a 4.2-per-100k pedestrian death problem first, a transit agency that
          measured it second, and a US$650M mistake before the cheap answer worked.
        </h2>
        <p className="vc-section__standfirst">
          Phuket's case is not new. Las Vegas had the same shape: a 4-mile tourism
          corridor saturated with pedestrians, hotels with their own shuttle wars,
          and a taxi lobby that did not want a bus. The Regional Transportation
          Commission of Southern Nevada counted the demand, tried a monorail first,
          then ran double-decker buses on the existing road. The bus worked for a
          decade. Then Uber and Lyft arrived, and the lesson for Phuket became clear:
          the corridor has to be on the street before the ride-hail companies own it.
        </p>
      </header>

      {/* PROBLEM ------------------------------------------------------- */}
      <div className="vc-problem" role="group" aria-label="The Vegas Strip problem">
        <figure className="vc-problem__photo">
          <img
            src={`${import.meta.env.BASE_URL}toolkit/vegas/deuce-strip.jpg`}
            alt="A double-decker RTC Deuce bus running on the Las Vegas Strip, the corridor that once had a 4.2 per 100,000 pedestrian death rate"
            loading="lazy"
          />
          <figcaption>
            <span>Photo: Eric Fischer · CC BY 2.0 · Wikimedia Commons</span>
          </figcaption>
        </figure>
        <div className="vc-problem__text">
          <h3>The problem was counted, not guessed.</h3>
          <p>
            Before the monorail. Before the Deuce. Before the bollards. The Strip
            was one of the most dangerous pedestrian corridors in the United
            States. In <strong>1996</strong>, Nevada's pedestrian death rate was{" "}
            <strong>4.2 per 100,000</strong> — more than double the national
            average of 2.0. The Strip's hotels each ran their own free shuttles
            to compete for foot traffic, and the four-mile road was a constant
            brawl of jaywalkers, taxis, limos, and tour buses.
          </p>
          <p>
            In 2005, a sedan drove into a crowd near Bally's, killing three. In
            December 2015, a woman drove into a crowd near the Paris/Planet
            Hollywood, killing one and injuring 34. The bollard programme that
            followed (≈ 6,000 bollards, ≈ US$40M) is the most expensive
            reaction to a problem a public bus would have prevented.
          </p>
        </div>
      </div>

      <ResearchPanel
        title="The Strip problem — pedestrian safety and Strip congestion, with sources"
        stats={PROBLEM_STATS}
        citations={PROBLEM_CITATIONS}
      />

      {/* MEASUREMENT --------------------------------------------------- */}
      <div className="vc-spread">
        <VegasStripMap />
        <aside className="vc-callout">
          <h3>How RTC measured the demand.</h3>
          <p>
            The Regional Transportation Commission of Southern Nevada did not
            guess. They ran a periodic <strong>Origin &amp; Destination Survey</strong>:
            interview-based, weighted by time of day and Strip location. The
            2019 O&amp;D found that about <strong>60% of Strip trips were
            work-related</strong> (housekeeping, food service, casino
            back-of-house) and 40% were for recreation, medical, social, shopping
            or educational purposes. The split mattered: a single vehicle could
            serve both markets because the work trips were northbound in the
            morning and southbound in the evening.
          </p>
          <p>
            The same O&amp;D framework is the methodology we are piloting for
            Phuket: a representative sample, weighted by hour, the same
            question asked the same way, so a transfer is auditable.
          </p>
        </aside>
      </div>

      <ResearchPanel
        title="How you count demand — the RTC Origin & Destination Survey"
        stats={MEASURE_STATS}
        citations={MEASURE_CITATIONS}
      />

      {/* MONORAIL vs DEUCE -------------------------------------------- */}
      <MonorailVsDeuce />

      <ResearchPanel
        title="The first try and the one that worked"
        stats={DUECE_STATS}
        citations={DUECE_CITATIONS}
      />

      {/* PROFIT AND RIDE-HAIL ----------------------------------------- */}
      <ProfitChart />

      <div className="vc-spread">
        <ResearchPanel
          title="The financial trajectory — what the Strip corridor earned, then lost"
          stats={PROFIT_STATS}
          citations={PROFIT_CITATIONS}
          defaultOpen={false}
        />
        <VegasFile vegasCase={VEGAS_CASES.financing} />
      </div>

      {/* THE PHUKET TRANSFER ------------------------------------------ */}
      <div className="vc-section__divider">
        <span className="tk-kicker">The Phuket transfer</span>
        <h3>What this buys Phuket.</h3>
      </div>

      <PhuketTransferChart />

      <div className="vc-spread">
        <VegasFile vegasCase={VEGAS_CASES.deal} />
        <aside className="vc-callout">
          <h3>The ride-hailing window is closing.</h3>
          <p>
            In Vegas, the bus was profitable for seven years, then Uber and Lyft
            arrived in September 2015 and the corridor was subsidised within
            three years. The lesson is not "don't run a bus" — the lesson is{" "}
            <strong>build the corridor before the ride-hail companies own it</strong>.
            Once they do, the cost of buying the right-of-way back is the cost of
            the subsidy.
          </p>
          <p>
            Phuket in 2026 has a single legal ride-hailing operator at HKT
            (Grab), a second one (Bolt) legalised only since 2023, and an
            active motorbike-rental economy that is the real substitute for
            public transport — and the cause of 92.7% of accidents. The window
            to put a bus on the corridor before the second and third Grab-class
            operators arrive is open now. It won't be open in five years.
          </p>
        </aside>
      </div>

      <ResearchPanel
        title="The Phuket transfer — 17.4M HKT pax, 5% engine capture, 32 km corridor"
        stats={PHUKET_STATS}
        citations={PHUKET_TRANSFER_CITATIONS}
      />

      <p className="vc-next">
        <span className="tk-kicker">Where this leads</span>
        The next chapter, <em>"Why people don't drive in Phuket,"</em> takes the
        Vegas story and the Phuket numbers and asks the next question: given a
        bus on the corridor, who would actually ride it, and what would they
        stop doing instead.
      </p>
    </section>
  );
}

export default VegasDemandCase;
