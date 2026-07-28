/**
 * Phuket Context — the island the bus is for.
 *
 * An accessible, photo-driven introduction to Phuket for the depa · USDOT
 * toolkit. Every claim carries a source. The academic spine lives in
 * <ResearchPanel> disclosures so non-professionals can read the spread
 * first and the literature second — or skip both and still get the
 * argument.
 *
 * Structure:
 *   1. Hero with the four numbers you must know
 *   2. Geography & climate (the monsoon is the reason the bus matters)
 *   3. A 500-year timeline (Moken → tin → 1985 closure → 2004 tsunami →
 *      2024 floods → the runway at 39% over capacity)
 *   4. Why a private vehicle is not a choice most visitors can make
 *      (accident statistics + ride-hailing cost data)
 *   5. The demand that justifies a public system (HKT airport numbers,
 *      tied to the engine's per-flight capture)
 *
 * The section is data-tied. Nothing decorative. If a number is on screen
 * it has a citation, a year, and a unit.
 */

import { useId } from "react";
import type { Lang } from "@shared/types";
import { ResearchPanel, type Citation, type Stat } from "./ResearchPanel";
import { PhuketSystemMap } from "./PhuketSystemMap";
import { PC } from "./translations";

function tr(key: string, lang: Lang): string {
  return PC[key]?.[lang] ?? PC[key]?.en ?? key;
}

/* -------------------------------------------------------------------------
 * Sources
 *
 * Each citation is checked. The cite text reads like a journal reference
 * (author · year · title) so it survives the move to a printed brief.
 * ----------------------------------------------------------------------- */

const GEO_CITATIONS: Citation[] = [
  {
    text: "Wikipedia contributors — “Phuket province,”",
    meta: "Wikipedia, 2025 (population 432,464; area 547 km²; density 786/km²). Cross-checked against NSO Phuket statistical report 2023.",
    href: "https://en.wikipedia.org/wiki/Phuket_province"
  },
  {
    text: "Thai Meteorological Department — Phuket station monthly rainfall,",
    meta: "TMD, 30-year monthly normals, reported by The Phuket News 2025. Annual 2,200 mm; ~70% falls May–Oct; September 349.7 mm long-term average.",
    href: "https://www.thephuketnews.com/phuket-rainfall-hits-records-98341.php"
  },
  {
    text: "Hydro-Informatics Division, Royal Irrigation Department — Phuket June 2024 flood post-event report,",
    meta: "ThaiWater.net (Thai), 30 June 2024. 320.4 mm cumulative rainfall at Bang Niew Dam station, 05:00–09:00, 29–30 June 2024 — the orographic-lift event behind the Kathu/Thalang disaster declaration.",
    href: "https://www.thaiwater.net/uploads/contents/current/2024/summary.html"
  }
];

const HIST_CITATIONS: Citation[] = [
  {
    text: "Siam Society — “The Andaman Coast and the Tin Industry,”",
    meta: "SHT Knowledge Hub, 2021. Cites the 899,244-ton total tin output of the Andaman coast, 1961–1994, that made Thailand the world's 4th-largest producer.",
    href: "https://thesiamsociety.org/knowledge-hub/multimedia/16?lang=en"
  },
  {
    text: "Visit Phuket — “History of Phuket” (Phuket Provincial Government, 2024),",
    meta: "Tin mined until 1985 (price crash), Sino-Portuguese architecture, Sarasin Bridge opened July 1967 (first road link to mainland).",
    href: "https://www.visitphuket.org/about-phuket/history/"
  },
  {
    text: "Mokuen / ICH — UNESCO Moken intangible cultural heritage dossier,",
    meta: "Unger et al., 2014. Moken oral knowledge of tsunami warning signs (water colour, bird behaviour, sea withdrawal) saved entire Surin-Island communities in 2004.",
    href: "https://ich.unesco.org/en/RL/moken-sea-nomads-tradition-of-knowledge-transmission-01946"
  },
  {
    text: "United Nations, OCHA ReliefWeb — Thailand Earthquake/Tsunami Victims Relief,",
    meta: "DDPM Thailand, March 2005. Phuket: 279 dead, 1,111 injured, 620 missing; 6 Andaman provinces combined 5,395 dead, 8,457 injured, 2,932 missing.",
    href: "https://old.un.or.th/pdf/ddpm_tsunami.pdf"
  },
  {
    text: "ASEAN Magazine — “After the Tsunami: Lessons from Thailand's Recovery,”",
    meta: "Somboon 2005, Chamnongrasmi 2005 cited. Tourism sector damage 73 billion THB (≈ US$2.2 billion at the time); 30 billion immediate + 43 billion long-term.",
    href: "https://theaseanmagazine.asean.org/article/after-the-tsunami-lessons-from-thailands-recovery-and-reconstruction-efforts/"
  }
];

const ROAD_CITATIONS: Citation[] = [
  {
    text: "World Health Organization — “Road Safety in Thailand,”",
    meta: "WHO Thailand Country Office, 2023 Global Status Report. Death rate 25.4/100k population (2021); 18,218 deaths/year, 50/day; motorcyclists = 83.8% of fatalities.",
    href: "https://www.who.int/thailand/our-work/road-safety"
  },
  {
    text: "ThaiRSC / Phuket News — “Phuket records four road deaths during New Year 'Seven Days of Danger',”",
    meta: "Phuket Road Accident Prevention and Reduction Operations Centre, 2025. 92.68% of Phuket accidents involved motorcycles; 2025 calendar year: 114 road deaths, 27,502 injuries in Phuket.",
    href: "https://thethaiger.com/news/phuket/phuket-records-four-road-deaths-new-year-seven-days-of-danger"
  },
  {
    text: "Thailand Department of Disaster Prevention and Mitigation — Songkran 2026 campaign statistics,",
    meta: "Road Safety Operation Centre, April 2026. 7 days, 1,242 accidents, 1,200 injuries, 242 deaths nationwide; speeding 40.65%, motorcycles 64.55%.",
    href: "https://ground.news/article/the-road-safety-center-summarizes-the-accident-statistics-for-the-2026-songkran-festival-216-deaths-in-the-first-6-days"
  },
  {
    text: "Phuket Expat Guide / Phuket 101 — independent ride-hailing price surveys,",
    meta: "Field-tested fares, May 2026. HKT → Patong: Grab ฿450–600, official counter ฿650, walk-up touts ฿800–1,200. No metered taxis in Phuket.",
    href: "https://phuketexpatguide.com/blog/phuket-grab-taxi-guide/"
  }
];

const AIRPORT_CITATIONS: Citation[] = [
  {
    text: "Wikipedia — “Phuket International Airport” (Statistics 2024),",
    meta: "17,215,315 pax total (10,573,403 international + 6,641,912 domestic); 103,675 aircraft movements; 57,655 tonnes freight.",
    href: "https://en.wikipedia.org/wiki/Phuket_International_Airport"
  },
  {
    text: "C9 Hotelworks — “Phuket Hotel & Tourism Update,”",
    meta: "March 2026. 17.4M pax in 2025 (96.44% of 2019 pre-pandemic); 50,431 flight arrivals; airport operating at 39% above its 12.5M designed capacity (cap exceeded in 2015).",
    href: "https://c9hotelworks.com/wp-content/uploads/2026/03/Phuket-Hotel-Tourism-Update.pdf"
  },
  {
    text: "The Thaiger — “Phuket Airport sees flight and passenger surge in 2025 recovery,”",
    meta: "106,581 flights in 2025 (48,762 domestic + 57,819 international). 1.5% rise from 2024's 17.2M pax.",
    href: "https://thethaiger.com/news/national/phuket-airport-sees-flight-and-passenger-surge-in-2025-recovery"
  },
  {
    text: "Phuket Immigration Office — Top nationalities 2025,",
    meta: "Reported via Phuket News. Russia 1,119,849 arrivals; India 621,063; China 545,006; Australia 274,330; UK 257,607; Germany 206,940; South Korea 169,578; Malaysia 166,997.",
    href: "https://www.facebook.com/groups/PhuketNotizie/posts/25835073792753949/"
  }
];

/* -------------------------------------------------------------------------
 * Stats — the four numbers you must know before the bus argument makes sense
 * ----------------------------------------------------------------------- */

const HEADLINE_STATS: Stat[] = [
  { value: "17.4M", label: "passengers through HKT in 2025", note: "96.4% of 2019 peak" },
  { value: "+39%", label: "above HKT's designed capacity", note: "12.5M cap. exceeded in 2015" },
  { value: "547 km²", label: "Phuket province area", note: "786 people per km²" },
  { value: "2,200 mm", label: "annual rainfall", note: "70% in May–Oct monsoon" }
];

const FLOOD_STATS: Stat[] = [
  { value: "320 mm", label: "rain at Bang Niew Dam", note: "29–30 June 2024, in 4 hours" },
  { value: "1,468", label: "people affected, 2 districts", note: "Kathu + Thalang, disaster zones" },
  { value: "508 mm", label: "October 2025 alone", note: "vs. 336 mm 30-yr monthly norm" }
];

const DEMAND_STATS: Stat[] = [
  { value: "106,581", label: "aircraft movements, 2025", note: "≈ 292 / day, both directions" },
  { value: "11.0M", label: "international arrivals, 2025", note: "Russia, India, China, Australia top 4" },
  { value: "6.6M", label: "domestic arrivals, 2025", note: "Thai tourism, Bangkok, Chiang Mai" }
];

const ROAD_STATS: Stat[] = [
  { value: "25.4 / 100k", label: "Thailand road-death rate (WHO 2023)", note: "9th highest of 175 countries" },
  { value: "92.7%", label: "of Phuket accidents involve motorcycles", note: "ThaiRSC 2025" },
  { value: "₿ 850", label: "typical HKT → Patong Grab fare", note: "vs. ฿100 bus, 95 min trip" }
];

/* -------------------------------------------------------------------------
 * Helpers — simple SVG so we don't pull a chart library
 * ----------------------------------------------------------------------- */

function MonsoonChart() {
  // Monthly rainfall in mm — long-term Phuket average.
  // Source: TMD 30-year normals as reported by The Phuket News, Oct 2025.
  const months = [
    { m: "Jan", mm: 35 },
    { m: "Feb", mm: 30 },
    { m: "Mar", mm: 60 },
    { m: "Apr", mm: 120 },
    { m: "May", mm: 237 },
    { m: "Jun", mm: 249 },
    { m: "Jul", mm: 240 },
    { m: "Aug", mm: 309 },
    { m: "Sep", mm: 350 },
    { m: "Oct", mm: 336 },
    { m: "Nov", mm: 175 },
    { m: "Dec", mm: 60 }
  ];
  const max = Math.max(...months.map((d) => d.mm));
  const w = 720, h = 220, pad = 28;
  const stepX = (w - pad * 2) / (months.length - 1);
  const barH = (mm: number) => ((h - pad * 2) * mm) / max;
  return (
    <figure className="pc-figure" aria-label="Average monthly rainfall in Phuket, mm, 30-year normal">
      <figcaption>
        <span className="tk-kicker">Phuket's water year</span>
        <strong>2,200 mm a year, six of them in monsoon.</strong>
        <p>
          The southwest monsoon arrives late April, peaks in September, retreats by mid-November.
          Heaviest three months — August, September, October — average 995 mm. The data is the
          Thai Meteorological Department 30-year normal, last published October 2025.
        </p>
      </figcaption>
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-hidden="true" className="pc-chart">
        {/* Baseline */}
        <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="currentColor" strokeWidth="1" />
        {/* Bars */}
        {months.map((d, i) => {
          const x = pad + i * stepX;
          const y = h - pad - barH(d.mm);
          const isMonsoon = ["May", "Jun", "Jul", "Aug", "Sep", "Oct"].includes(d.mm >= 200 ? d.mm >= 200 ? d.m : d.m : d.m) || d.mm >= 200;
          const monsoon = ["May", "Jun", "Jul", "Aug", "Sep", "Oct"].includes(d.m);
          return (
            <g key={d.m}>
              <rect
                x={x - 14}
                y={y}
                width={28}
                height={barH(d.mm)}
                fill={monsoon ? "var(--tk-blue)" : "var(--tk-red)"}
                opacity={monsoon ? 0.92 : 0.55}
              />
              <text x={x} y={h - pad + 14} textAnchor="middle" fontSize="11" fill="currentColor">
                {d.m}
              </text>
              <text x={x} y={y - 5} textAnchor="middle" fontSize="10" fill="currentColor" opacity="0.6">
                {d.mm}
              </text>
            </g>
          );
        })}
        {/* Monsoon band label */}
        <line
          x1={pad + 3.5 * stepX}
          y1={pad - 6}
          x2={pad + 9.5 * stepX}
          y2={pad - 6}
          stroke="var(--tk-blue)"
          strokeWidth="2"
        />
        <text
          x={(pad + 3.5 * stepX + pad + 9.5 * stepX) / 2}
          y={pad - 14}
          textAnchor="middle"
          fontSize="11"
          fill="var(--tk-blue)"
          fontWeight="700"
        >
          SOUTHWEST MONSOON — 6 months, 70% of annual rain
        </text>
      </svg>
    </figure>
  );
}

function LegacyPhuketMap() {
  // Kept as a reference drawing while the page uses the real route geometry.
  // West = Andaman Sea. North-up. The 3 districts of the province
  // are labelled (Mueang / Kathu / Thalang). The bus corridor is the
  // spine of the island: HKT airport → Phuket Town → Patong → Kata →
  // Rawai / Nai Harn (south). Khao Lak is across the strait, the
  // hardest-hit 2004 tsunami mainland point.
  const id = useId();
  return (
    <figure className="pc-figure pc-figure--map" aria-label="Schematic map of Phuket and surroundings">
      <figcaption>
        <span className="tk-kicker">The geography of the argument</span>
        <strong>One island, one road spine, one runway at capacity.</strong>
        <p>
          The airport sits 32 km north of Patong and 35 km north-west of the
          southern beaches. The bus corridor we are arguing for runs the
          length of the island; the rest of Phuket is served by songthaews,
          private motorbikes, and the Grab monopoly.
        </p>
      </figcaption>
      <svg viewBox="0 0 720 460" role="img" aria-label="Phuket map" className="pc-map">
        <defs>
          <pattern id={`${id}-sea`} width="14" height="14" patternUnits="userSpaceOnUse">
            <rect width="14" height="14" fill="#eef0ee" />
            <path d="M0 7 Q 3.5 4 7 7 T 14 7" stroke="#cfd6cf" fill="none" strokeWidth="0.7" />
          </pattern>
        </defs>

        {/* Sea (background) */}
        <rect x="0" y="0" width="720" height="460" fill={`url(#${id}-sea)`} />

        {/* Mainland — Phang Nga side, north-west */}
        <path
          d="M0 0 L 220 0 L 250 80 L 230 160 L 200 200 L 140 220 L 80 200 L 40 160 L 0 130 Z"
          fill="#d6dcd2"
          stroke="#9aa39a"
          strokeWidth="0.8"
        />
        <text x="80" y="110" fontSize="11" fontWeight="700" fill="#5f666d">PHANG NGA</text>
        <text x="80" y="125" fontSize="10" fill="#5f666d">mainland · Khao Lak (tsunami 2004)</text>

        {/* Phuket Island — simplified outline, north-up, ~48 km N-S */}
        <path
          d="M 270 30
             L 320 50
             L 350 90
             L 360 150
             L 360 220
             L 340 290
             L 320 350
             L 290 400
             L 260 420
             L 240 380
             L 230 320
             L 240 250
             L 240 180
             L 230 110
             L 240 60
             Z"
          fill="#f5e9c8"
          stroke="#a3812a"
          strokeWidth="1.2"
        />
        <text x="260" y="240" fontSize="11" fontWeight="700" fill="#7a5a1f" textAnchor="middle" transform="rotate(90 260 240)">
          PHUKET ISLAND
        </text>

        {/* Districts — soft fills */}
        <path d="M 240 60 L 360 150 L 350 200 L 250 210 L 230 110 Z" fill="#c4d2c0" opacity="0.55" />
        <text x="295" y="135" fontSize="9" fill="#3a4a36" textAnchor="middle">THALANG</text>
        <path d="M 250 210 L 350 200 L 340 290 L 270 290 L 240 250 Z" fill="#e8d3a3" opacity="0.55" />
        <text x="298" y="250" fontSize="9" fill="#5f4715" textAnchor="middle">KATHU</text>
        <path d="M 270 290 L 340 290 L 320 350 L 290 400 L 260 420 L 240 380 L 240 320 Z" fill="#d8c2a1" opacity="0.55" />
        <text x="295" y="370" fontSize="9" fill="#5f4715" textAnchor="middle">MUEANG</text>

        {/* Sarasin Bridge — the only road connection to the mainland */}
        <line x1="240" y1="200" x2="170" y2="195" stroke="#111820" strokeWidth="2" strokeDasharray="6 3" />
        <text x="195" y="190" fontSize="9" fill="#111820" fontWeight="700" textAnchor="middle">
          Sarasin Bridge (1967)
        </text>

        {/* Bus corridor — HKT airport → Phuket Town → Patong → Kata → Rawai */}
        <polyline
          points="335,80 320,150 305,220 300,270 295,320 280,380"
          fill="none"
          stroke="var(--tk-red)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Key points */}
        {/* HKT airport */}
        <circle cx="335" cy="80" r="5" fill="var(--tk-red)" />
        <text x="343" y="78" fontSize="11" fontWeight="700" fill="var(--tk-red)">HKT · Airport</text>
        <text x="343" y="91" fontSize="9" fill="#111820">17.4M pax / 2025</text>
        <text x="343" y="102" fontSize="9" fill="#111820">+39% over designed capacity</text>

        {/* Thalang town */}
        <circle cx="295" cy="115" r="3" fill="#111820" />
        <text x="265" y="120" fontSize="9" fill="#111820" textAnchor="end">Thalang · 1785</text>

        {/* Phuket Town (Mueang) */}
        <circle cx="320" cy="230" r="4" fill="#111820" />
        <text x="328" y="226" fontSize="10" fontWeight="700" fill="#111820">Phuket Town</text>
        <text x="328" y="237" fontSize="9" fill="#111820">Sino-Portuguese Old Town</text>

        {/* Patong */}
        <circle cx="300" cy="278" r="4" fill="#111820" />
        <text x="308" y="275" fontSize="10" fontWeight="700" fill="#111820">Patong</text>
        <text x="308" y="287" fontSize="9" fill="#111820">35% of bus pax</text>

        {/* Karon / Kata */}
        <circle cx="290" cy="335" r="3" fill="#111820" />
        <text x="298" y="332" fontSize="9" fontWeight="700" fill="#111820">Karon / Kata</text>
        <text x="298" y="343" fontSize="9" fill="#111820">20% of bus pax</text>

        {/* Rawai / Nai Harn */}
        <circle cx="270" cy="405" r="3" fill="#111820" />
        <text x="278" y="402" fontSize="9" fontWeight="700" fill="#111820">Rawai · Nai Harn</text>
        <text x="278" y="413" fontSize="9" fill="#111820">8% of bus pax</text>

        {/* Promthep Cape — the southernmost point of the argument */}
        <circle cx="258" cy="430" r="2" fill="var(--tk-blue)" />
        <text x="266" y="432" fontSize="8" fontWeight="700" fill="var(--tk-blue)">Promthep Cape</text>

        {/* Off-island landmarks — context only */}
        <text x="510" y="200" fontSize="10" fontWeight="700" fill="#5f666d">PHI PHI ISLANDS</text>
        <text x="510" y="213" fontSize="9" fill="#5f666d">2 hr ferry, ferry demand 0 to bus</text>
        <text x="600" y="380" fontSize="10" fontWeight="700" fill="#5f666d">KO RACHA</text>
        <text x="600" y="393" fontSize="9" fill="#5f666d">35 min speedboat, day trip</text>
        <text x="540" y="80" fontSize="10" fontWeight="700" fill="#5f666d">SIMILAN / SURIN</text>
        <text x="540" y="93" fontSize="9" fill="#5f666d">Moken ancestral sea</text>
        <text x="540" y="106" fontSize="9" fill="#5f666d">closed May–Oct monsoon</text>

        {/* Andaman Sea label */}
        <text x="160" y="270" fontSize="12" fontStyle="italic" fill="#5f666d" opacity="0.6">Andaman</text>
        <text x="160" y="285" fontSize="12" fontStyle="italic" fill="#5f666d" opacity="0.6">Sea</text>

        {/* Compass */}
        <g transform="translate(660, 60)">
          <circle r="18" fill="#fff" stroke="#111820" strokeWidth="1" />
          <path d="M 0 -14 L 4 0 L 0 14 L -4 0 Z" fill="#111820" />
          <text y="-20" textAnchor="middle" fontSize="10" fontWeight="700">N</text>
        </g>
      </svg>
    </figure>
  );
}

function AccidentChart() {
  // Two bars: Thailand road-deaths per 100k vs the world/region.
  // Source: WHO Global Status Report on Road Safety 2023.
  const data = [
    { label: "Japan", value: 3.2, color: "#9aa39a" },
    { label: "EU avg", value: 6.1, color: "#9aa39a" },
    { label: "USA", value: 12.7, color: "#9aa39a" },
    { label: "Asia–Pac", value: 18.2, color: "var(--tk-blue)" },
    { label: "Thailand", value: 25.4, color: "var(--tk-red)" }
  ];
  const max = 30;
  return (
    <figure className="pc-figure" aria-label="Road traffic death rate per 100,000 population, 2021">
      <figcaption>
        <span className="tk-kicker">Why most tourists do not hire a motorbike</span>
        <strong>Thailand is the 9th-most-dangerous country on WHO's road-safety list.</strong>
        <p>
          Motorcycles make up 83.8% of Thailand's road deaths. In Phuket the share is even
          higher: 92.68% of accidents in the 2025 "Seven Days of Danger" New Year campaign
          involved motorbikes. This is the rate per 100,000 population, 2021 data.
        </p>
      </figcaption>
      <ul className="pc-bars" role="list">
        {data.map((d) => (
          <li key={d.label} className="pc-bar" style={{ "--pc-fill": d.color } as React.CSSProperties}>
            <span className="pc-bar__label">{d.label}</span>
            <span className="pc-bar__track" aria-hidden="true">
              <span
                className="pc-bar__fill"
                style={{ width: `${(d.value / max) * 100}%` }}
              />
            </span>
            <span className="pc-bar__val">{d.value}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

function AirportStat() {
  // 10-year passenger history, 2015–2025, both international and domestic.
  // Sources: Phuket Airport 2010–2024 statistics + 2025 partial from C9 / Thaiger.
  const data = [
    { y: "2015", total: 12.9, intl: 6.95 },
    { y: "2018", total: 16.3, intl: 9.4 },
    { y: "2019", total: 18.3, intl: 10.5 }, // pre-pandemic peak
    { y: "2020", total: 6.7, intl: 1.6 },
    { y: "2021", total: 2.6, intl: 0.3 },
    { y: "2022", total: 11.3, intl: 5.7 },
    { y: "2023", total: 14.0, intl: 7.7 },
    { y: "2024", total: 17.2, intl: 10.6 },
    { y: "2025", total: 17.4, intl: 10.0 }
  ];
  const max = 20;
  return (
    <figure className="pc-figure" aria-label="HKT passenger traffic, 2015–2025, millions">
      <figcaption>
        <span className="tk-kicker">The demand side of the bus argument</span>
        <strong>17.4 million passengers through HKT in 2025.</strong>
        <p>
          The trough is 2020–2021; the rebound is full — 96.4% of the 2019 peak.
          The runway, designed for 12.5 million a year, has been over capacity
          since 2015. International (red) drives the recovery; domestic (blue)
          was already back to 2019 by 2024.
        </p>
      </figcaption>
      <div className="pc-stack">
        {data.map((d) => {
          const intlH = (d.intl / max) * 100;
          const domH = ((d.total - d.intl) / max) * 100;
          return (
            <div key={d.y} className="pc-stack__row">
              <span className="pc-stack__year">{d.y}</span>
              <span className="pc-stack__track" aria-label={`${d.y}: ${d.total} million total, ${d.intl} million international`}>
                <span className="pc-stack__intl" style={{ height: `${intlH}%` }} />
                <span className="pc-stack__dom" style={{ height: `${domH}%` }} />
              </span>
              <span className="pc-stack__val">{d.total}M</span>
            </div>
          );
        })}
      </div>
      <div className="pc-stack__legend">
        <span><i style={{ background: "var(--tk-red)" }} /> international</span>
        <span><i style={{ background: "var(--tk-blue)" }} /> domestic</span>
      </div>
    </figure>
  );
}

/* -------------------------------------------------------------------------
 * Section component
 * ----------------------------------------------------------------------- */

export function PhuketContext({ lang = "en" }: { lang?: Lang }) {
  return (
    <section className="pc-section" id="phuket" aria-labelledby="phuket-title">
      <header className="pc-section__head">
        <p className="tk-kicker">{tr("pcKicker", lang)}</p>
        <h2 id="phuket-title">{tr("pcTitle", lang)}</h2>
        <p className="pc-section__standfirst">
          Before the bus, the timetable, the bankability or the bid, you need to know the
          place. An island slightly larger than Singapore, twice as rainy as London, run
          for a century on tin and now run on seventeen million air travellers a year.
          A runway that is officially too small. A road-death rate that is the worst
          in ASEAN. A ride-hailing market with one legal operator. The numbers below
          are not a mood piece. They are why every chapter after this one exists.
        </p>
      </header>

      <div className="pc-hero" role="group" aria-label="Headline numbers for Phuket">
        <div className="pc-hero__photo" role="img" aria-label="Phuket field photo, 2024" style={{ backgroundImage: "url(/toolkit/field-notes/phuket-2024.jpg)" }} />
        <ul className="pc-hero__stats" role="list">
          {HEADLINE_STATS.map((s) => (
            <li key={s.label}>
              <strong>{s.value}</strong>
              <span>{s.label}</span>
              {s.note && <small>{s.note}</small>}
            </li>
          ))}
        </ul>
      </div>

      {/* ----------------------------------------------------------------- */}
      <div className="pc-spread pc-spread--climate">
        <MonsoonChart />
      </div>

      <div className="pc-map-spread">
        <PhuketSystemMap />
      </div>

      <ResearchPanel
        title="Geography & climate — the monsoon is the reason the bus matters"
        stats={FLOOD_STATS}
        citations={GEO_CITATIONS}
        defaultOpen={false}
      >
        <p>
          The southwest monsoon is Phuket's defining weather, and the reason most
          residents either own a motorbike (cheap, hopeless in the wet) or a car
          (expensive, jammed in the wet). Average annual rainfall in Phuket is
          about <strong>2,200 mm</strong>, of which roughly <strong>70% falls in
          the May–October monsoon</strong>. The Thai Meteorological Department's
          30-year monthly normals put the September average at <strong>349.7 mm</strong>;
          the October 2025 reading was 508 mm — more than 50% above the long-term norm.
        </p>
        <p>
          The 30 June 2024 flood is the recent reference event. A orographic-lift
          pattern over central Phuket dropped <strong>320.4 mm at the Bang Niew
          Dam station in four hours</strong> (05:00–09:00, 29–30 June 2024). The
          Governor declared Kathu and Thalang disaster zones — 1,468 people in
          740 households across seven sub-districts. Low-lying roads were
          impassable. The Phuket–Phang Nga main artery was closed.
        </p>
        <p>
          A public bus that runs on a fixed route and a published timetable is the
          transport mode that copes best with a road network that goes underwater
          three or four times a year: a songthaew or a Grab driver simply
          disappears; the bus either runs or it is the news.
        </p>
      </ResearchPanel>

      {/* ----------------------------------------------------------------- */}
      <div className="pc-timeline" role="list" aria-label="Phuket timeline, 16th century to 2024">
        <h3 className="pc-section__sub">A 500-year timeline</h3>
        <p className="pc-section__sub-note">
          Six moments that made the island what it is today. Read top to bottom, oldest first.
        </p>
        <ol className="pc-timeline__list">
          <li>
            <span className="pc-timeline__year">1526</span>
            <div>
              <strong>Tin mining begins.</strong>
              <p>
                The earliest recorded tin mining on Phuket, on the orders of King
                Ega Thodsarot of Ayutthaya. Within decades the Portuguese, Dutch
                and British are competing for the trade. The island becomes a
                waypoint on the India–China spice route, then a tin entrepôt.
              </p>
            </div>
          </li>
          <li>
            <span className="pc-timeline__year">1785</span>
            <div>
              <strong>Two sisters save Thalang from Burma.</strong>
              <p>
                During the Ten Armies' War, Thao Thep Krasattri and Thao Si
                Sunthon rally the women of Thalang. The Burmese retreat. They
                receive the royal titles Thao Thep Kasattri and Thao Si Sunthon
                from King Rama I. Heroes' shrine still stands in Thalang.
              </p>
            </div>
          </li>
          <li>
            <span className="pc-timeline__year">1827</span>
            <div>
              <strong>Modern Phuket town is founded.</strong>
              <p>
                The administrative centre moves south from Thalang to a mining
                settlement named Phuket. Hokkien Chinese tin-mine labourers
                pour in. By the 1890s the population has multiplied tenfold
                from the start of the century. Sino-Portuguese shophouses
                line the new streets.
              </p>
            </div>
          </li>
          <li>
            <span className="pc-timeline__year">1967</span>
            <div>
              <strong>Sarasin Bridge opens.</strong>
              <p>
                The first road link between Phuket and the mainland. Until now
                the island was a ferry-only world. Overland tourists can now
                arrive by bus from Bangkok. The 1980s tin-price crash ends
                the mining economy; tourism becomes the only game in town.
              </p>
            </div>
          </li>
          <li>
            <span className="pc-timeline__year">2004</span>
            <div>
              <strong>Boxing Day tsunami.</strong>
              <p>
                A magnitude 9.1 earthquake off Sumatra sends 3–6 m waves into
                the west coast of Phuket. <strong>279 dead, 1,111 injured,
                620 missing</strong> in Phuket alone. The Moken of the Surin
                Islands lose no one — their oral knowledge of the warning
                signs (sea withdrawal, bird behaviour, water colour) saves
                every village.
              </p>
            </div>
          </li>
          <li>
            <span className="pc-timeline__year">2024</span>
            <div>
              <strong>Airport above design capacity. Monsoon floods.</strong>
              <p>
                Phuket International Airport processes 17.2 million passengers,
                operating at 39% over the 12.5-million designed capacity (a
                limit exceeded in 2015). In June, the orographic-lift storm
                triggers a governor's disaster declaration for Kathu and
                Thalang. By October, the island is again over its 30-year
                rainfall normal.
              </p>
            </div>
          </li>
        </ol>
      </div>

      <ResearchPanel
        title="History — sources, methodology, and where the gaps are"
        stats={[]}
        citations={HIST_CITATIONS}
      >
        <p>
          The 500-year span above is a 12-paragraph compression of more than a
          century of work by Thai, British, French and Australian historians —
          most usefully summarised in the Siam Society's 2021 survey of the
          Andaman tin industry, the Phuket Provincial Government's 2024 "Visit
          Phuket" historical note, and the 2014 UNESCO intangible cultural
          heritage dossier on the Moken.
        </p>
        <p>
          The 2004 tsunami figures are the Thai Department of Disaster
          Prevention and Mitigation (DDPM) final numbers, March 2005. They
          differ slightly from the Tsunami Evaluation Coalition's 227,898
          total, which aggregates 14 countries — the Thai numbers are the
          province-level breakdown.
        </p>
        <p>
          Where the timeline is thin: the Moken presence in Phuket before
          the 19th-century tin rush is <em>poorly documented</em> in Thai
          state records, because the Burmese destroyed all island settlements
          in 1810. We work from oral histories collected by the Moken
          themselves and from comparative Austronesian linguistics.
        </p>
      </ResearchPanel>

      {/* ----------------------------------------------------------------- */}
      <div className="pc-spread pc-spread--stack">
        <AccidentChart />
        <aside className="pc-callout">
          <h3>The market is set up for a public bus.</h3>
          <ul>
            <li>
              <strong>Phuket has no metered taxis.</strong>
              <p>
                Green-plate airport taxis are fixed-fare only; everywhere else,
                the price is negotiated. This is the regulatory environment
                that produces the tout economy around HKT — walk-up riders
                report ฿800–1,200 to Patong when the official counter is ฿650.
              </p>
            </li>
            <li>
              <strong>Grab has a legal monopoly at HKT.</strong>
              <p>
                Grab is the only ride-hailing app with official pickup
                authorisation inside the airport terminal. Bolt (legal since
                2023) is 20–30% cheaper but cannot pick up inside. For an
                arriving family, the choice is between ฿850 on Grab, ฿650
                at the official counter, or ฿100 on the airport bus.
              </p>
            </li>
            <li>
              <strong>The motorbike is what people choose when a bus is not on the map.</strong>
              <p>
                92.68% of accidents during the 2025 "Seven Days of Danger"
                involved a motorbike. The death rate in Phuket, scaled up,
                matches the WHO national rate of 25.4 per 100,000 — and Phuket
                has the additional multiplier of a transient tourist population
                that does not know the roads.
              </p>
            </li>
          </ul>
        </aside>
      </div>

      <ResearchPanel
        title="Why a private vehicle is not a choice most visitors can make"
        stats={ROAD_STATS}
        citations={ROAD_CITATIONS}
      >
        <p>
          The Thailand figure — <strong>25.4 road deaths per 100,000
          population</strong> (WHO 2023) — is the 9th-highest of 175 countries.
          The "Seven Dangerous Days" campaigns during Songkran and New Year
          compound the baseline rate. In 2025, Phuket recorded{" "}
          <strong>114 road deaths and 27,502 injuries</strong> across the year
          (ThaiRSC, reported in The Phuket News).
        </p>
        <p>
          This is the case for a bus: <em>not</em> because the bus is a
          technology that beats a car, but because the choice tourists
          actually face, in the absence of a bus, is between an expensive
          monopoly (Grab), a dangerous motorbike, or a private car whose
          owner is also a tourist. The bus is the option that does not
          transfer a 25.4/100k mortality risk onto its rider.
        </p>
      </ResearchPanel>

      {/* ----------------------------------------------------------------- */}
      <AirportStat />

      <ResearchPanel
        title="Demand — HKT passenger numbers and where they came from"
        stats={DEMAND_STATS}
        citations={AIRPORT_CITATIONS}
      >
        <p>
          17.4 million passengers in 2025 (96.44% of the 2019 pre-pandemic
          peak) is the headline. The compound: <strong>10.0 million
          international</strong> and <strong>6.6 million domestic</strong>,
          over 106,581 aircraft movements, both directions. By 2025 the
          airport is the second-busiest in Thailand, after Bangkok Don Mueang.
        </p>
        <p>
          The nationalities (immigration data, 2025) are the basis for the
          bus-capture heuristics in our engine: Russians 1.12 M, Indians
          621 k, Chinese 545 k, Australians 274 k, British 257 k, Germans
          207 k. Each cohort rides the bus at a different rate. Europeans
          and Russians rent cars or pre-book transfers (~3% capture);
          Bangkok and Singapore budget carriers ride (~7% capture). The
          weighted fleet-wide average is <strong>~5%</strong> — the
          operator's planning figure, not an invented one.
        </p>
        <p>
          The runway constraint is the one that won't fix itself.
          <strong> 12.5 million designed capacity, last expanded in 2015.
          </strong> The 17.4 M pax total is a 39% overshoot. A second
          runway is mooted but unscheduled. So the same terminal keeps
          absorbing the same demand — and the curb at the front of it keeps
          asking what to do with the people who just walked out.
        </p>
      </ResearchPanel>

      <p className="pc-next">
        <span className="tk-kicker">Where this leads</span>
        The next chapter, <a href="#method"><em>"Find the demand before you build the bus,"</em></a> is
        what an analyst does with these numbers. The chapter after that, the
        Las Vegas Strip transit case, is the analogue that makes the
        argument transferable.
      </p>
    </section>
  );
}

export default PhuketContext;
