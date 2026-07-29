/**
 * The collaboration history — the full 2021–2025 journey.
 *
 * This is not a marketing timeline. It is the archival record of how a
 * U.S. Department of Transportation programme evolved from a diplomatic
 * introduction into a working research partnership, then into a working
 * system. Every phase carries a photo, a date, the people who were in the
 * room, and what the work actually produced.
 *
 * The programme was suspended in January 2025 by a U.S. foreign-assistance
 * review. The work continued — that is what this website is.
 */

import { useState } from "react";
import { ResearchPanel, type Citation, type Stat } from "./ResearchPanel";

const HISTORY_ASSET_ROOT = `${import.meta.env.BASE_URL}toolkit/history/`;

/* -------------------------------------------------------------------------
 * Sources
 * ----------------------------------------------------------------------- */

const HISTORY_CITATIONS: Citation[] = [
  {
    text: "U.S.-ASEAN Smart Cities Partnership — Smart Sustainable Mobility programme record,",
    meta: "USDOT / U.S. Department of State. The official programme page, including the four-city-pair structure and published toolkits.",
    href: "https://www.usascp.org/programs/transportationprogram/"
  },
  {
    text: "METRANS Transportation Consortium — University Partnership Programme,",
    meta: "USC / CSULB. Four city-pair toolkits published 2026; the Phuket–Las Vegas toolkit is the document this site translates into a working system.",
    href: "https://www.metrans.org/upp"
  },
  {
    text: "Transit Service Planning for Sustainable Tourism Travel — Insights from Phuket and Las Vegas,",
    meta: "USASCP Sustainable Mobility Programme toolkit, 23 pp. The $20k travel survey, $5k co-design workshop, eight personas, fifteen recommendations and impact–effort framework all originate here.",
    href: "https://www.metrans.org/upp"
  }
];

type PersonEntry = { name: string; org?: string; note?: string };
type TeamGroup = { team: string; caveat?: string; people: PersonEntry[] };

const PEOPLE_BY_TEAM: TeamGroup[] = [
  {
    team: "USDOT · Programme management",
    people: [
      { name: "Joseph Traini", org: "USDOT OST" },
      { name: "Stephanie Fischer", org: "Volpe" },
      { name: "Roshan Desai", org: "USDOT OST" },
      { name: "Anthony Jones", org: "Volpe" },
      { name: "Kate Casey", org: "OST" },
      { name: "Jonathan Robison", org: "Volpe" },
      { name: "Hoamy Tran", org: "Volpe" },
      { name: "Steven Wagner", org: "OST" }
    ]
  },
  {
    team: "Phuket, Thailand",
    people: [
      { name: "Non Arkaraprasertkul", org: "depa · Phuket partnership lead" },
      { name: "Pracha Asawateera" },
      { name: "Supakorn Siddhichai" },
      { name: "Ton Jaitrong", note: "colleague and friend · in memoriam" },
      { name: "Rutchanee Gullayanon" }
    ]
  },
  {
    team: "Las Vegas, USA",
    people: [
      { name: "Andrew Kjellman" },
      { name: "David Swallow" },
      { name: "Scott Mazick" }
    ]
  },
  {
    team: "Johor Bahru, Malaysia",
    people: [
      { name: "Nizam", org: "IRDA" },
      { name: "Maimunah", org: "IRDA" },
      { name: "Suhaimi Mohd Salleh", org: "IRDA" }
    ]
  },
  {
    team: "Jakarta, Indonesia",
    people: [
      { name: "Naya Pandya", org: "JakLingko" },
      { name: "Yasmin Hadi", org: "JSC Lab" },
      { name: "Agus Mubarok", org: "JSC Lab" }
    ]
  },
  {
    team: "Phnom Penh, Cambodia",
    caveat: "City affiliation inferred from distribution-list grouping — not stated directly in the source records.",
    people: [
      { name: "Vannak Seng" },
      { name: "Martin Saram" },
      { name: "Theam Deka" },
      { name: "Kimchhuon Man" },
      { name: "Phanin Ch" },
      { name: "Chanseka" }
    ]
  },
  {
    team: "Portland, USA",
    people: [
      { name: "Malu Wilkinson", org: "Metro" },
      { name: "April Bertelsen", org: "City of Portland" },
      { name: "Kelly Betteridge", org: "Metro" }
    ]
  },
  {
    team: "Los Angeles, USA",
    people: [
      { name: "Andrew Shavit", org: "Metro" },
      { name: "R. Chavez", org: "Metro" },
      { name: "Rubina Ghazarian", org: "City of Los Angeles" },
      { name: "Shirin Sadrpour", org: "City of Los Angeles" }
    ]
  },
  {
    team: "Boston · Research & university partners",
    people: [
      { name: "Marlon Boarnet", org: "USC" },
      { name: "Andre Comandon", org: "USC" },
      { name: "Tom O'Brien", org: "CSULB" },
      { name: "Tyler Reeb", org: "CSULB" }
    ]
  }
];

const PEOPLE_COUNT = PEOPLE_BY_TEAM.reduce((sum, t) => sum + t.people.length, 0);

type Phase = {
  id: string;
  period: string;
  city: string;
  verb: string;
  title: string;
  summary: string;
  detail: string;
  photos: { src: string; alt: string; caption: string }[];
  quotes?: { who: string; text: string }[];
  outputs?: string[];
};

const PHASES: Phase[] = [
  {
    id: "origins",
    period: "Nov 2021 – Feb 2022",
    city: "Virtual · partnership formation",
    verb: "Begin",
    title: "A workplan, built by the people who would have to use it.",
    summary: "USDOT proposed a Phuket–Las Vegas peer-city pilot focused on Mobility-as-a-Service, first-mile/last-mile connectivity and tourism mobility. Dr Non coordinated Phuket stakeholder review of the draft workplan — every comment came from someone who operates, regulates or depends on transport on the island.",
    detail: "On 19 November 2021, Roshan Desai (USDOT) informed Phuket officials of the partnership. The January 2022 kick-off established the peer-city structure. By 28 January, Roshan circulated a draft workplan. On 20 February, Non delivered consolidated comments: 'I made sure to speak with all key stakeholders in order to compile these comments.' Roshan thanked him — the workplan was jointly revised, not imposed.",
    photos: [],
    quotes: [
      { who: "Roshan Desai, USDOT — after the January 2022 kick-off", text: "The presentations and remarks delivered gave us all a better understanding of how to effectively move this partnership forward." },
      { who: "Dr Non, to USDOT — 20 February 2022", text: "I made sure to speak with all key stakeholders in order to compile these comments." }
    ],
    outputs: [
      "Phuket–Las Vegas peer-city pairing established",
      "Joint workplan, revised by both cities",
      "Five stakeholder groups mapped: regulatory, local government, operators, tourism, civil society"
    ]
  },
  {
    id: "jakarta",
    period: "5–7 December 2022",
    city: "Jakarta, Indonesia",
    verb: "Meet",
    title: "The first time everyone was in the same room.",
    summary: "The first in-person Smart Mobility Workshop brought together all eight USASCP city pairs. Phuket was represented by Dr Non and Pracha Asawateera. The toolkit was still loose paper, argument and possibility — but the network was real.",
    detail: "USDOT described the workshop's objectives: advancing city-pair workplans, strengthening understanding of smart mobility, creating networking opportunities among ASEAN and U.S. officials, and accelerating implementation. Non and Pracha presented Phuket's mobility challenges, smart-city ambitions and the partnership's goals. Non positioned Phuket as a tourism-intensive city and a testbed for innovative mobility solutions — a living laboratory. Ahead of Jakarta, Non supplied biography information, staff profiles and descriptions of Phuket Smart City initiatives. The workshop attachments included formal invitation letters, agendas, city presentation templates and participant briefing packages.",
    photos: [
      { src: `${HISTORY_ASSET_ROOT}jakarta-2022.jpg`, alt: "USDOT Smart Mobility Workshop participants in Jakarta, December 2022", caption: "Jakarta · December 2022 · the first in-person workshop" },
      { src: `${HISTORY_ASSET_ROOT}jakarta-ton-2022-detail.jpg`, alt: "Ton Jaitrong with colleagues at the Jakarta workshop", caption: "Ton Jaitrong (centre) at the Jakarta workshop — the friend and colleague this toolkit is dedicated to" }
    ],
    outputs: [
      "Eight city-pair network established in person",
      "Phuket positioned as a tourism-mobility testbed",
      "Implementation activities planned for 2023"
    ]
  },
  {
    id: "los-angeles",
    period: "July 2023",
    city: "Los Angeles, USA",
    verb: "Plan",
    title: "From introductions to workplans — and the first personas.",
    summary: "The programme matured. USDOT hosted a multi-day workshop in Los Angeles with sessions on public engagement, multimodal integration and the 'Complete Trip' framework. The breakout exercises on traveller personas directly shaped the survey work that followed in Phuket.",
    detail: "Roshan stated the objective was to 'continue conversations begun in Jakarta, advance city-pair workplans and strengthen relationships between U.S. and ASEAN cities.' Agenda materials covered stakeholder participation, community engagement, transit coordination and user experience. The Complete Trip Framework explored mobility from trip planning through navigation, transfers, accessibility, payments and final-destination arrival. Breakout exercises asked participants to analyse business travelers, tourists, transportation preferences, modal choices, accessibility concerns and mobility data gaps. These discussions substantially influenced the eight personas that later emerged from the Phuket survey.",
    photos: [
      { src: `${HISTORY_ASSET_ROOT}los-angeles-2023.jpg`, alt: "USDOT Smart Mobility Workshop in Los Angeles, July 2023", caption: "Los Angeles · July 2023 · transit service design on a flipchart" },
      { src: `${HISTORY_ASSET_ROOT}la-bike-tour-2023.jpg`, alt: "LA bike tour during the USDOT workshop, 2023", caption: "Los Angeles · July 2023 · bike tour — first-mile/last-mile is not an abstract concept" }
    ],
    outputs: [
      "Workplans advanced from concept to methodology",
      "Traveler-persona framework introduced — the seed of the eight Phuket personas",
      "Complete Trip Framework adopted as analytical lens"
    ]
  },
  {
    id: "phuket-workshop",
    period: "March 2024",
    city: "Phuket, Thailand",
    verb: "Test",
    title: "The workshop came home — and the cable car was on the table.",
    summary: "USDOT hosted a major workshop in Phuket with the Governor, the Sustainable Tourism Development Foundation, the Phuket Industry Association, Grab, e-scooter operators and tourism stakeholders. Topics ranged from tourism mobility to cable car concepts, ridesharing and micromobility. depa was allocated dedicated time — the agency had become a central institutional partner.",
    detail: "Roshan coordinated workshop agendas, transportation logistics, speaker invitations and site visits. Email records show planned participation by the Phuket Governor, the Phuket Sustainable Foundation, the Phuket Industry Association, Grab, e-scooter operators, tourism stakeholders and public agencies. Topics included tourism mobility, smart mobility for tourism, cable car concepts, ridesharing, micromobility and sustainability. Roshan specifically allocated time for 'DEPA's role in Thailand and Phuket around mobility and transportation' — depa had become the central Thai institutional partner.",
    photos: [
      { src: `${HISTORY_ASSET_ROOT}phuket-2023.jpg`, alt: "Phuket city systems field workshop, 2024", caption: "Phuket · March 2024 · back on the island" }
    ],
    quotes: [
      { who: "Roshan Desai, USDOT — workshop agenda allocation", text: "DEPA's role in Thailand and Phuket around mobility and transportation." }
    ],
    outputs: [
      "Stakeholder roster expanded: Governor, tourism, industry, operators",
      "Cable car concept surfaced as a candidate intervention",
      "depa positioned as the programme's Thai institutional anchor"
    ]
  },
  {
    id: "boston",
    period: "September 2024",
    city: "Boston, USA",
    verb: "Sift",
    title: "The toolkit takes shape — and the survey critique lands.",
    summary: "The Boston workshop was the fourth of the programme, focused on final toolkits, operational recommendations and project implementation. By this point, the project had evolved from conceptual planning into evidence-based transit research. Dr Non's most consequential intervention came here: a systematic critique of the proposed survey methodology that pushed qualitative methods, ethnographic observation and stakeholder engagement into the research design.",
    detail: "Roshan described Boston as the fourth workshop, focused heavily on final toolkits, operational recommendations, project implementation and city-pair deliverables. Non was deeply involved in travel planning and workshop participation, managing itinerary conflicts with Smart City Expo Miami and Shanghai commitments. USDOT regarded his participation as strategically important because of his 'expertise and knowledge.' The major intellectual contribution: Non argued that Phuket residents were suffering survey fatigue, that existing studies lacked actionable insights, and that qualitative methods — ethnographic observation, focus groups, user shadowing and stakeholder interviews — should complement questionnaires. This shaped the mixed-methods design that produced the eight personas.",
    photos: [
      { src: `${HISTORY_ASSET_ROOT}boston-2024.jpg`, alt: "Boston tour with USDOT, September 2024", caption: "Boston · September 2024 · a wider cohort, a harder standard" },
      { src: `${HISTORY_ASSET_ROOT}boston-2024-detail.jpg`, alt: "Boston workshop session, 2024", caption: "Boston · September 2024 · the toolkit takes its final shape" }
    ],
    quotes: [
      { who: "Dr Non — survey methodology critique, Boston 2024", text: "Phuket residents were suffering survey fatigue. Existing studies lacked actionable insights. Qualitative methods — ethnographic observation, focus groups, user shadowing — should complement questionnaires. Stakeholder engagement was essential. Incentives could improve participation." }
    ],
    outputs: [
      "Mixed-methods survey design finalised (quantitative + qualitative)",
      "Toolkit structure agreed: stakeholders → survey → personas → co-design → recommendations",
      "Phuket–Las Vegas partnership elevated to full research collaboration"
    ]
  },
  {
    id: "survey",
    period: "Late 2024",
    city: "Phuket · the fieldwork",
    verb: "Measure",
    title: "The $20k survey, the $5k workshop, and eight real people.",
    summary: "Following Boston, a strong partnership among depa, RTC Southern Nevada, Chulalongkorn University, USC/METRANS and USDOT executed the fieldwork. A Cochran-sized travel survey (~$20,000) along the PKCD bus corridor, a co-design workshop (~$5,000) with regulators and operators, and clustering analysis produced eight distinct personas — four current riders, four non-riders — and fifteen ranked recommendations.",
    detail: "The travel survey cost approximately $20,000, including $4,000 for survey design and development, $8,000 for the survey fee and $8,000 for respondent incentives. The co-design workshop cost approximately $5,000, including $1,500 for pre-workshop preparation and $3,500 for direct implementation. The workshop convened the Department of Land Transport Phuket, Phuket City Development (PKCD), Phuket Mahanakorn, the Phuket PAO, the Federation of Thai Industries, the Patong Hotel Association and the Thai Hotels Association Southern Chapter. The impact–effort framework produced fifteen recommendations spanning boarding convenience, service frequency, timetable transparency, driver training, digital integration, route design and first–last mile connectivity.",
    photos: [],
    outputs: [
      "Travel survey: ~$20,000, Cochran-sized, 500 m origin–destination buffers",
      "Co-design workshop: ~$5,000, 7 stakeholder organisations, 15 recommendations",
      "8 personas (4 users + 4 non-users) clustered from survey data",
      "Impact–effort framework: 4 quick wins, 6 major projects, 3 fill-ins, 2 hard slogs"
    ]
  },
  {
    id: "suspension",
    period: "27 January 2025",
    city: "Distributed · the pause",
    verb: "Pause",
    title: "The programme was suspended. The work was not.",
    summary: "On 27 January 2025, Roshan informed participants that new U.S. Executive Orders required a review of foreign assistance programmes. All USDOT Smart Mobility Program activities were immediately paused; the planned Cambodia workshop was postponed. Dr Non responded diplomatically but firmly, emphasising the value of the collaboration and the willingness to provide evidence supporting its resumption. The work continued — independently, in Phuket, as this system.",
    detail: "Roshan informed participants that new U.S. Executive Orders required review of foreign assistance programs; all USDOT Smart Mobility Program activities were immediately paused; meetings and workshops were suspended; the planned Cambodia workshop was postponed. Non responded by emphasising the value of ASEAN-U.S. collaboration, the importance of mobility innovation, the willingness to provide evidence supporting the programme, and the desire to see the partnership resume. The suspension effectively closed the official chapter — but the toolkit was complete, the method was proven, and the system you are reading was built from it.",
    photos: [],
    quotes: [
      { who: "Roshan Desai, USDOT — 27 January 2025", text: "New U.S. Executive Orders require review of foreign assistance programs. All USDOT Smart Mobility Program activities are immediately paused." }
    ],
    outputs: [
      "Official programme activities paused (January 2025)",
      "Four toolkits published via METRANS (2026) — the deliverable survived the pause",
      "Phuket Smart Bus system built independently from the toolkit's method"
    ]
  },
  {
    id: "continues",
    period: "2025 – present",
    city: "Phuket · the system",
    verb: "Continue",
    title: "The report became a bus. The bus is still running.",
    summary: "The programme paused, but the method did not. The Phuket Smart Bus system — this website — was built from the toolkit's findings, the survey's personas and the engine's demand-supply chain. The 2025 Johor Bahru reunion and 2026 follow-up show the network is still alive. The work continues with Ton in it.",
    detail: "In August 2025, a USDOT reunion in Johor Bahru brought the network back together — the conversation had moved from 'what cities could do' to 'what our systems can already demonstrate.' A 2026 follow-up continued the thread. The Phuket Smart Bus system connects flights to queues, buses, passengers, revenue, savings and CO₂ — every number traces back to the demand-supply chain the toolkit was built to understand. This is what 'more than a report' looks like.",
    photos: [
      { src: `${HISTORY_ASSET_ROOT}johor-2025.jpg`, alt: "USDOT reunion in Johor Bahru, August 2025", caption: "Johor Bahru · August 2025 · the reunion — the network is still alive" },
      { src: `${HISTORY_ASSET_ROOT}johor-2026.jpg`, alt: "Johor Bahru follow-up, 2026", caption: "Johor Bahru · 2026 · the work continues" }
    ],
    outputs: [
      "Phuket Smart Bus: a working system, not a slide deck",
      "Network reunions: Johor Bahru 2025 and 2026",
      "This website — the toolkit, operationalised"
    ]
  }
];

const EVOLUTION_STAGES = [
  { year: "2021", role: "Participant and local facilitator", note: "Coordinated scheduling, assembled stakeholders, represented local priorities." },
  { year: "2022", role: "Stakeholder coordinator", note: "Led the Phuket-side review of the joint workplan. Every comment came from an operator, regulator or resident." },
  { year: "2023", role: "Lead representative", note: "Shaped Phuket's mobility narrative. Positioned the island as a living laboratory." },
  { year: "2024", role: "Strategic contributor", note: "Influenced methodology, stakeholder engagement, workshop content and project direction. The survey critique." },
  { year: "2025", role: "Senior partner", note: "Advocated programme continuity amid suspension. The work continued independently." }
];

const HISTORY_STATS: Stat[] = [
  { value: "4 years", label: "of continuous collaboration (2021–2025)", note: "five phases: begin → meet → plan → test → sift" },
  { value: "5", label: "in-person workshops", note: "Jakarta, Los Angeles, Phuket, Boston, Johor Bahru" },
  { value: "~$25k", label: "field research investment", note: "$20k travel survey + $5k co-design workshop" },
  { value: "4", label: "published toolkits via METRANS", note: "the deliverable survived the suspension" }
];

function PhaseCard({ phase, index }: { phase: Phase; index: number }) {
  const [expanded, setExpanded] = useState(index < 2);
  return (
    <article className={`th-phase ${expanded ? "is-open" : ""}`}>
      <button
        type="button"
        className="th-phase__head"
        aria-expanded={expanded}
        aria-controls={`th-phase-body-${phase.id}`}
        onClick={() => setExpanded(!expanded)}
      >
        <span className="th-phase__period">{phase.period}</span>
        <span className="th-phase__verb">{phase.verb}</span>
        <div className="th-phase__meta">
          <strong>{phase.city}</strong>
          <h3>{phase.title}</h3>
        </div>
        <span className="th-phase__toggle" aria-hidden="true">{expanded ? "−" : "+"}</span>
      </button>
      {expanded && (
        <div className="th-phase__body" id={`th-phase-body-${phase.id}`}>
          <p className="th-phase__summary">{phase.summary}</p>
          <p className="th-phase__detail">{phase.detail}</p>

          {phase.photos.length > 0 && (
            <div className={`th-phase__photos th-phase__photos--${phase.photos.length === 1 ? "single" : "double"}`}>
              {phase.photos.map((photo) => (
                <figure key={photo.src}>
                  <img src={photo.src} alt={photo.alt} loading="lazy" />
                  <figcaption>{photo.caption}</figcaption>
                </figure>
              ))}
            </div>
          )}

          {phase.quotes && phase.quotes.length > 0 && (
            <div className="th-phase__quotes">
              {phase.quotes.map((quote) => (
                <blockquote key={quote.text}>
                  <p>“{quote.text}”</p>
                  <cite>— {quote.who}</cite>
                </blockquote>
              ))}
            </div>
          )}

          {phase.outputs && phase.outputs.length > 0 && (
            <div className="th-phase__outputs">
              <span className="tk-kicker">What it produced</span>
              <ul>
                {phase.outputs.map((output) => (
                  <li key={output}>{output}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

export function CollaborationHistory() {
  return (
    <section className="th-section" id="history" aria-labelledby="history-title">
      <header className="th-section__head">
        <p className="tk-kicker">The collaboration · 2021–2025</p>
        <h2 id="history-title">How a diplomatic initiative became a working system.</h2>
        <p className="th-section__standfirst">
          The U.S.-ASEAN Smart Cities Partnership paired Phuket with Las Vegas in late 2021. Over four years,
          five in-person workshops, a $25,000 field-research investment and one consequential methodological critique,
          the partnership produced a toolkit, a set of personas and — ultimately — the bus system this website runs on.
          The official programme was suspended in January 2025. The work continued. This is the archival record.
        </p>
        <div className="th-stats" role="list" aria-label="Collaboration headline figures">
          {HISTORY_STATS.map((s) => (
            <div key={s.label} role="listitem">
              <strong>{s.value}</strong>
              <span>{s.label}</span>
              {s.note && <small>{s.note}</small>}
            </div>
          ))}
        </div>
      </header>

      {/* Spine — the five verbs in sequence */}
      <div className="th-spine" aria-label="Collaboration phases">
        {PHASES.map((phase, index) => (
          <div key={phase.id} className="th-spine__node">
            <span>{phase.period.split("–")[0].trim()}</span>
            <strong>{phase.verb}</strong>
            <small>{phase.city.split("·")[0].trim()}</small>
            {index < PHASES.length - 1 && <b aria-hidden="true">→</b>}
          </div>
        ))}
      </div>

      {/* Phase cards — collapsible */}
      <div className="th-phases">
        {PHASES.map((phase, index) => (
          <PhaseCard key={phase.id} phase={phase} index={index} />
        ))}
      </div>

      {/* Role evolution */}
      <div className="th-evolution">
        <div>
          <span className="tk-kicker">Role evolution</span>
          <h3>From participant to senior partner.</h3>
          <p>Dr Non's contribution evolved across four years — from coordinating schedules to shaping the research methodology the toolkit still uses.</p>
        </div>
        <ol>
          {EVOLUTION_STAGES.map((stage) => (
            <li key={stage.year}>
              <span>{stage.year}</span>
              <div>
                <strong>{stage.role}</strong>
                <p>{stage.note}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* People */}
      <div className="th-people">
        <div className="th-people__intro">
          <span className="tk-kicker">The people</span>
          <h3>Programmes are made by people who answer the next email.</h3>
          <p>{PEOPLE_COUNT} names across nine teams, compiled from programme correspondence and workshop distribution
          lists. Not a logo wall — actual humans who showed up, more than once, and did the work.</p>
        </div>
        <div className="th-people__teams">
          {PEOPLE_BY_TEAM.map((team) => (
            <article key={team.team} className="th-team">
              <h4>{team.team}</h4>
              <ul>
                {team.people.map((p) => (
                  <li key={p.name}>
                    <strong>{p.name}</strong>
                    {p.org && <span>{p.org}</span>}
                    {p.note && <small>{p.note}</small>}
                  </li>
                ))}
              </ul>
              {team.caveat && <p className="th-team__caveat">{team.caveat}</p>}
            </article>
          ))}
        </div>
        <p className="th-people__gap">
          <strong>What's still missing.</strong> No formal participant roster, no registration spreadsheet, no
          single document mapping every city pair to every name. This list is what actually survived in programme
          correspondence — complete enough to credit real people, not complete enough to call final. If you were
          in the room and aren't here, tell us.
        </p>
      </div>

      <ResearchPanel
        title="Sources, programme records and the published toolkit"
        stats={[]}
        citations={HISTORY_CITATIONS}
      >
        <p>
          The history above is compiled from programme correspondence, workshop agendas, the published USASCP
          programme record and the 23-page Phuket–Las Vegas toolkit. The programme was suspended on 27 January 2025
          by a U.S. foreign-assistance review; the four city-pair toolkits were nevertheless published via METRANS
          in 2026. This website is the independent continuation — the toolkit, operationalised.
        </p>
      </ResearchPanel>
    </section>
  );
}

export default CollaborationHistory;