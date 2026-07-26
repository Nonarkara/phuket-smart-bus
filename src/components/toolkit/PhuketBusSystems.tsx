/**
 * Phuket Bus Systems — the actual transit landscape.
 *
 * This is the chapter that answers: "What buses already run in Phuket?"
 * The answer is messier than visitors expect. Three formal operators, a
 * government competitor, an informal songthaew network, a ride-hailing
 * monopoly and a regulatory regime that forbids buses from stopping at
 * hotels. Every claim is sourced.
 */

import { ResearchPanel, type Citation, type Stat } from "./ResearchPanel";

const BUS_CITATIONS: Citation[] = [
  {
    text: "Phuket Provincial Government — “Phuket Highlights 2024,”",
    meta: "Phuket.go.th, 2024. Documents the Dragon Line EV bus service (6 vehicles, ~230 boardings/day), the Airport Line and existing ridership evidence.",
    href: "https://www.phuket.go.th/webpk/file_data/hilight/hilight2567.pdf"
  },
  {
    text: "Phuket Smart Bus — official PKSB timetable (effective 18 Jan 2025),",
    meta: "Rawai Beach ↔ Phuket Airport: ~25 departures/day each direction. First southbound 08:15, last 23:30. First northbound 05:30, last 19:30. ~95 min trip, ฿100 flat fare.",
    href: "https://bus.nonarkara.org/"
  },
  {
    text: "The Thaiger / RTPS — Orange Line Route 8411 reporting,",
    meta: "Government-operated Airport ↔ Phuket Town service. ฿85–100 fare, every 60–90 min, 08:00–21:00, 80 min trip. Stops: Airport, Boat Lagoon, Central/Big C, Pearl Village, Bus Terminal 1.",
    href: "https://thethaiger.com/"
  },
  {
    text: "Digital Economy Promotion Agency (depa) — Phuket Smart City record,",
    meta: "depa supports the smart-city platform underpinning PKCD/PKSB operations, including the digital payment and tracking infrastructure piloted on the Airport Line.",
    href: "https://www.depa.or.th/"
  }
];

const REGULATORY_CITATIONS: Citation[] = [
  {
    text: "Department of Land Transport (DLT) — route licensing regime,",
    meta: "DLT is responsible for public bus route planning, operator licensing and regulatory oversight. Route concessions are issued at the national level, not provincial.",
    href: "https://www.dlt.go.th/"
  },
  {
    text: "Office of Transport Policy and Planning (OTP) — Thailand clean-mobility funding mechanism,",
    meta: "OTP, 2017. EV bus cost benchmark: ฿12m per vehicle. Annual operating cost benchmark: ฿0.9m. Identifies the financing gap for clean bus deployment.",
    href: "https://www.otp.go.th/uploads/tiny_uploads/ProjectOTP/2560/Project17/4-DevelopmentofaFundingMechanism.pdf"
  },
  {
    text: "Commission for the Management of Land Traffic (CMLT) — inter-agency coordination,",
    meta: "CMLT provides the inter-agency coordination mechanism on land traffic management, enforcement alignment and resolution of operational issues affecting routes and service delivery.",
    href: "https://www.cmlt.go.th/"
  }
];

const OPERATOR_STATS: Stat[] = [
  { value: "3", label: "formal bus operators in Phuket", note: "PKCD/PKSB · Phuket Mahanakorn · Orange Line" },
  { value: "~25", label: "daily Airport Line departures (each direction)", note: "PKSB timetable, effective Jan 2025" },
  { value: "฿100", label: "flat fare, Airport ↔ Rawai (95 min)", note: "vs ฿600–1,200 Grab/taxi" },
  { value: "~230/day", label: "Dragon Line average boardings", note: "Phuket provincial report, 2024" }
];

type Operator = {
  name: string;
  abbr: string;
  type: "Private smart-city" | "Private legacy" | "Government";
  fleet: string;
  routes: string;
  fare: string;
  coverage: string;
  status: string;
  notes: string;
};

const OPERATORS: Operator[] = [
  {
    name: "Phuket City Development Smart Bus",
    abbr: "PKCD / PKSB",
    type: "Private smart-city",
    fleet: "10 Airport Line vehicles (กข 1001–1010) + 7 Patong Line (กค 2001–2007) + 3 Dragon Line (กง 3001–3003)",
    routes: "Airport Line (Rawai ↔ HKT, ~95 min), Patong Line (Patong ↔ Old Town), Dragon Line (Old Town loop)",
    fare: "฿100 flat, Airport Line · ฿40–100 zone-based on other lines",
    coverage: "North–south spine: Airport → Thalang → Phuket Town → Kata/Karon → Rawai. East–west: Patong ↔ Old Town.",
    status: "Operational. The system this website simulates.",
    notes: "Operated by Phuket City Development (PKCD), supported by depa's smart-city platform. The Airport Line is the corridor the USASCP toolkit studied. 20 vehicles total; the same 10 rotate through both Airport Line directions."
  },
  {
    name: "Phuket Mahanakorn",
    abbr: "PMN",
    type: "Private legacy",
    fleet: "Conventional buses (diesel), route-dependent",
    routes: "Local Phuket Town routes, feeder services",
    fare: "฿15–30, zone-based",
    coverage: "Phuket Town urban core and immediate surroundings. Not airport-connected.",
    status: "Operational but declining ridership. Serves the resident base-load.",
    notes: "The legacy local operator. Personas 1–2 and 7 from the USASCP survey are PMN's core riders: low-income students, bus-friendly freelancers and mid-income residents."
  },
  {
    name: "Orange Line (Route 8411)",
    abbr: "ORANGE",
    type: "Government",
    fleet: "~3 simulated vehicles in this system; government-operated",
    routes: "Airport ↔ Phuket Town (Bus Terminal 1), via Boat Lagoon, Central/Big C, Pearl Village",
    fare: "฿85–100",
    coverage: "Airport → Highway 402 → Phuket Town. Does NOT serve Patong, Kata, Karon or Rawai directly.",
    status: "Operational. The government competitor on the airport corridor.",
    notes: "Government-operated, every 60–90 min, 08:00–21:00, 80 min trip. Cheaper than PKSB but does not reach the west-coast beaches where 60%+ of tourists stay. This is the structural gap the toolkit identified."
  }
];

const COMPETITORS = [
  { mode: "Grab", cost: "฿450–600", note: "HKT → Patong. Legal monopoly inside airport terminal. Only ride-hailing app with official HKT pickup authorisation." },
  { mode: "Bolt", cost: "฿360–480", note: "20–30% cheaper than Grab but cannot pick up inside the airport terminal. Legal since 2023." },
  { mode: "Official airport taxi", cost: "฿650", note: "Fixed-fare counter. Green-plate, government-regulated." },
  { mode: "Walk-up touts", cost: "฿800–1,200", note: "Unregulated. The tout economy the absence of clear public transit creates." },
  { mode: "Songthaew", cost: "฿30–50", note: "Red truck, local routes. Cheap but no airport service, no fixed schedule, no English information." },
  { mode: "Motorbike taxi", cost: "฿150–300", note: "Informal. The mode 92.7% of Phuket accidents involve." }
];

const REGULATORY_LAYERS = [
  {
    level: "National",
    body: "Department of Land Transport (DLT)",
    role: "Route planning, operator licensing, regulatory oversight. Bus routes are concessioned at the national level, not provincial.",
    constraint: "A Phuket operator cannot launch a new route without DLT approval — a process that can take months and requires demonstrating public need."
  },
  {
    level: "National",
    body: "Office of Transport Policy and Planning (OTP)",
    role: "National public transport policy and strategic planning. Sets EV bus cost benchmarks (฿12m/vehicle) and identifies financing gaps.",
    constraint: "OTP's funding mechanism study (2017) is the closest thing to a national clean-bus financing framework — but it is advisory, not a budget line."
  },
  {
    level: "National",
    body: "Commission for the Management of Land Traffic (CMLT)",
    role: "Inter-agency coordination, enforcement alignment, operational issue resolution.",
    constraint: "The hotel-stop ban — buses may not stop directly at major hotels — is enforced through CMLT-aligned channels. It is a structural capture suppressor."
  },
  {
    level: "Provincial",
    body: "Phuket Provincial Governor's Office",
    role: "Coordinates public agencies, supports cross-sector alignment.",
    constraint: "The Governor can convene but cannot override national DLT route licensing. Political authority is real but legally bounded."
  },
  {
    level: "Provincial",
    body: "Phuket Provincial Administration Organization (PAO)",
    role: "Local governmental organisation. Co-design workshop participant in the USASCP toolkit.",
    constraint: "PAO controls some local infrastructure (stops, shelters) but not route authority or fare approval."
  },
  {
    level: "Industry",
    body: "Patong Hotel Association / THA Southern Chapter",
    role: "Tourism-sector coordination. Hotel stop advocacy, information dissemination, service feedback.",
    constraint: "Hotels want door-adjacent stops. DLT forbids them. The political question: can the hotel lobby change the regulation, or must the bus adapt to it?"
  }
];

export function PhuketBusSystems() {
  return (
    <section className="pb-section" id="bus-systems" aria-labelledby="bus-systems-title">
      <header className="pb-section__head">
        <p className="tk-kicker">The transit landscape</p>
        <h2 id="bus-systems-title">What buses already run in Phuket.</h2>
        <p className="pb-section__standfirst">
          The answer is messier than visitors expect. Three formal operators, a government competitor on the airport
          corridor, an informal songthaew network, and a ride-hailing monopoly. The regulatory regime forbids buses
          from stopping at hotels — a structural capture suppressor that taxis exploit. Understanding the landscape
          is step zero before any expansion argument.
        </p>
      </header>

      {/* Stats */}
      <div className="pb-stats" role="list" aria-label="Phuket bus system headline figures">
        {OPERATOR_STATS.map((s) => (
          <div key={s.label} role="listitem">
            <strong>{s.value}</strong>
            <span>{s.label}</span>
            {s.note && <small>{s.note}</small>}
          </div>
        ))}
      </div>

      {/* Operator cards */}
      <div className="pb-operators">
        <h3 className="pb-subhead">The three formal operators</h3>
        {OPERATORS.map((op) => (
          <article key={op.abbr} className={`pb-operator pb-operator--${op.type.toLowerCase().replace(/\s+/g, "-")}`}>
            <header>
              <span className="pb-operator__type">{op.type}</span>
              <h4>{op.name}</h4>
              <strong>{op.abbr}</strong>
            </header>
            <dl>
              <div><dt>Fleet</dt><dd>{op.fleet}</dd></div>
              <div><dt>Routes</dt><dd>{op.routes}</dd></div>
              <div><dt>Fare</dt><dd>{op.fare}</dd></div>
              <div><dt>Coverage</dt><dd>{op.coverage}</dd></div>
              <div><dt>Status</dt><dd>{op.status}</dd></div>
            </dl>
            <p className="pb-operator__notes">{op.notes}</p>
          </article>
        ))}
      </div>

      {/* Competitor landscape */}
      <div className="pb-competitors">
        <h3 className="pb-subhead">The substitute ecosystem</h3>
        <p className="pb-intro-note">
          The bus does not compete in an empty market. It competes against six modes, each with a different price,
          convenience and risk profile. The ฿100 bus wins on price; it loses on door-to-door convenience. The
          question the USASCP toolkit asked: can service quality close the gap?
        </p>
        <div className="pb-competitor-table" role="table" aria-label="Competitor modes and fares, HKT to Patong">
          <div className="pb-competitor-row pb-competitor-row--head" role="row">
            <span role="columnheader">Mode</span>
            <span role="columnheader">Fare (HKT → Patong)</span>
            <span role="columnheader">What it actually is</span>
          </div>
          {COMPETITORS.map((c) => (
            <div className="pb-competitor-row" role="row" key={c.mode}>
              <strong role="cell">{c.mode}</strong>
              <span role="cell">{c.cost}</span>
              <span role="cell">{c.note}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Regulatory landscape */}
      <div className="pb-regulatory">
        <h3 className="pb-subhead">The regulatory stack — who can say yes to what</h3>
        <p className="pb-intro-note">
          Thailand's transport governance is centralised. The DLT in Bangkok controls route licensing; the Governor
          in Phuket convenes but cannot overrule. The hotel-stop ban is enforced through CMLT channels. Any expansion
          plan has to navigate this stack — not around it.
        </p>
        <div className="pb-regulatory-grid">
          {REGULATORY_LAYERS.map((layer) => (
            <article key={layer.body} className={`pb-reg-layer pb-reg-layer--${layer.level.toLowerCase()}`}>
              <span className="pb-reg-layer__level">{layer.level}</span>
              <h4>{layer.body}</h4>
              <p className="pb-reg-layer__role">{layer.role}</p>
              <p className="pb-reg-layer__constraint"><strong>Constraint: </strong>{layer.constraint}</p>
            </article>
          ))}
        </div>
      </div>

      {/* The structural gap */}
      <div className="pb-gap">
        <div>
          <span className="tk-kicker">The structural gap</span>
          <h3>The Orange Line is cheaper. The Orange Line doesn't go to the beaches.</h3>
          <p>
            The government's Orange Line (Route 8411) runs Airport → Phuket Town for ฿85–100. It is the cheapest
            formal option. But it stops at Bus Terminal 1 in Phuket Town — not at Patong, Kata, Karon or Rawai,
            where 60%+ of tourists stay. A tourist arriving at HKT and heading to Patong faces: the ฿85 Orange
            Line to Bus Terminal 1, then a ฿400+ songthaew or Grab to Patong. Total: ~฿500 and two transfers.
          </p>
          <p>
            PKSB's Airport Line goes directly to Patong for ฿100. That is the structural advantage — and the
            structural question: can the direct service capture enough of the 17.4M annual HKT passengers to
            justify the fleet? The USASCP survey found the answer is yes, if the service is reliable, information
            is clear and the last-mile connection is solved. The engine models exactly that.
          </p>
        </div>
        <div className="pb-gap__visual">
          <div className="pb-route-compare">
            <div className="pb-route-compare__option pb-route-compare__option--pksb">
              <span className="tk-kicker">PKSB Airport Line</span>
              <strong>฿100</strong>
              <small>HKT → Patong direct · 95 min · 0 transfers</small>
            </div>
            <div className="pb-route-compare__option pb-route-compare__option--orange">
              <span className="tk-kicker">Orange Line + transfer</span>
              <strong>~฿500</strong>
              <small>HKT → Bus Terminal 1 → songthaew → Patong · ~120 min · 2 transfers</small>
            </div>
          </div>
        </div>
      </div>

      <ResearchPanel
        title="Sources: operators, fares, fleet rosters and regulatory bodies"
        stats={OPERATOR_STATS}
        citations={BUS_CITATIONS}
      >
        <p>
          Fleet rosters (กข 1001–1010, กค 2001–2007, กง 3001–3003) and the Airport Line timetable are from the
          official PKSB schedule effective 18 January 2025, built into this repository's <code>engine/config.ts</code>.
          Dragon Line ridership (~230/day) is from the Phuket Provincial Government's 2024 highlights document.
          Orange Line details are from RTPS and local news reporting. The regulatory structure is summarised from
          the USASCP toolkit's governance section (pp. 13–14).
        </p>
      </ResearchPanel>

      <ResearchPanel
        title="The regulatory stack — DLT, OTP, CMLT and the hotel-stop ban"
        stats={[]}
        citations={REGULATORY_CITATIONS}
      >
        <p>
          Thailand's public transport governance is centralised under the Ministry of Transport. The DLT controls
          route licensing nationally; the Governor and PAO have implementation but not licensing authority. The
          hotel-stop ban — buses may not stop directly at major hotels — is the most consequential regulatory
          constraint on capture: it hands door-to-door advantage to taxis and ride-hailing by law, not just by
          market dynamics. Any PPP or concession structure must address this explicitly.
        </p>
      </ResearchPanel>
    </section>
  );
}

export default PhuketBusSystems;