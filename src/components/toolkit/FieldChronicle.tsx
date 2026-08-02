/**
 * FieldChronicle — the whole Field Notes story on one line.
 *
 * One route, strictly chronological. The journey (five workshops), the
 * fieldwork, the suspension, the friend the work is dedicated to, the last
 * workshop in Johor Bahru, the published toolkit and the running system are
 * stations on the same vertical line — not four stacked sections designed in
 * different eras. Every date, quote and figure survives from the archival
 * record; only the composition changed.
 *
 * Station kinds render differently but share the same rail:
 *   moment    — text station (origins, fieldwork, the pause)
 *   workshop  — photos + quotes + outputs
 *   memorial  — Ton Jaitong. Quiet on purpose.
 *   artifact  — the 23-page toolkit: cover, download, chapters, endnotes
 *   terminal  — the system, still running
 */

import type { ReactNode } from "react";
import { ResearchPanel, type Citation } from "./ResearchPanel";

const HISTORY = `${import.meta.env.BASE_URL}toolkit/history/`;
const FIELD = `${import.meta.env.BASE_URL}toolkit/field-notes/`;
const TOOLKIT_URL = `${import.meta.env.BASE_URL}toolkit-source.pdf`;
const BUS_URL = "https://bus.nonarkara.org/";
const PROGRAM_URL = "https://www.usascp.org/programs/transportationprogram/";
const UPP_URL = "https://www.metrans.org/upp";

/* -------------------------------------------------------------------------
 * Sources
 * ----------------------------------------------------------------------- */

const HISTORY_CITATIONS: Citation[] = [
  {
    text: "U.S.-ASEAN Smart Cities Partnership — Smart Sustainable Mobility programme record,",
    meta: "USDOT / U.S. Department of State. The official programme page, including the four-city-pair structure and published toolkits.",
    href: PROGRAM_URL
  },
  {
    text: "METRANS Transportation Consortium — University Partnership Programme,",
    meta: "USC / CSULB. Four city-pair toolkits published 2026; the Phuket–Las Vegas toolkit is the document this site translates into a working system.",
    href: UPP_URL
  },
  {
    text: "Transit Service Planning for Sustainable Tourism Travel — Insights from Phuket and Las Vegas,",
    meta: "USASCP Sustainable Mobility Programme toolkit, 23 pp. The $20k travel survey, $5k co-design workshop, eight personas, fifteen recommendations and impact–effort framework all originate here.",
    href: UPP_URL
  }
];

/* -------------------------------------------------------------------------
 * The people — 39 names, nine teams, from programme correspondence
 * ----------------------------------------------------------------------- */

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
      { name: "Ton Jaitong", org: "Team Leader, depa Southern Office", note: "colleague and friend · in memoriam" },
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

const NETWORK = [
  ["City pairs", "Phuket ↔ Las Vegas · Jakarta ↔ Los Angeles · Johor Bahru ↔ Portland · Phnom Penh ↔ Boston"],
  ["Universities", "USC / METRANS · CSULB · Chulalongkorn University · Institute of Technology of Cambodia · Universitas Indonesia · Universiti Teknologi Malaysia"],
  ["Phuket delivery network", "depa · Phuket City Development · Department of Land Transport Phuket · Phuket Mahanakorn · Phuket PAO · FTI · Patong Hotel Association · Thai Hotels Association Southern Chapter"],
  ["U.S. public partners", "U.S. Department of Transportation · U.S. Department of State · RTC Southern Nevada · participating city transport and public-works teams"]
] as const;

/* -------------------------------------------------------------------------
 * The role evolution — the seat at the table, year by year
 * ----------------------------------------------------------------------- */

const EVOLUTION_STAGES = [
  { year: "2021", role: "Participant and local facilitator", note: "Coordinated scheduling, assembled stakeholders, represented local priorities." },
  { year: "2022", role: "Stakeholder coordinator", note: "Led the Phuket-side review of the joint workplan. Every comment came from an operator, regulator or resident." },
  { year: "2023", role: "Lead representative", note: "Shaped Phuket's mobility narrative. Positioned the island as a living laboratory." },
  { year: "2024", role: "Strategic contributor", note: "Influenced methodology, stakeholder engagement, workshop content and project direction. The survey critique." },
  { year: "2025", role: "Senior partner", note: "Advocated programme continuity amid suspension. The work continued independently." }
];

/* -------------------------------------------------------------------------
 * What four years actually taught (from the programme archive)
 * ----------------------------------------------------------------------- */

const LESSONS = [
  ["01", "Stay long enough", "Repeated contact created the trust needed for useful disagreement. One workshop can introduce people; it cannot produce institutional memory."],
  ["02", "Name the stubborn problem", "Peer learning became productive when each city pair stopped discussing 'smart mobility' in general and chose one shared problem."],
  ["03", "Mix the room", "Operators, regulators, universities, tourism businesses and civic organisations each hold a different piece of the same trip."],
  ["04", "Do not worship the survey", "A questionnaire can measure an answer without understanding it. Observation, interviews and operational data explain the why."],
  ["05", "Local knowledge is data", "Rules on hotel stops, informal services and institutional relationships change what is feasible. A generic best practice cannot see them."],
  ["06", "Co-design before the conclusion", "Stakeholders should shape the question, test the personas and rank the actions—not clap politely at the final slide."],
  ["07", "Universities are bridges", "They supplied method, continuity and the useful habit of documenting why a decision was made."],
  ["08", "Leave an instrument behind", "Toolkits and webinars extend memory. A working simulator goes further: it lets the next team challenge the assumptions directly."]
] as const;

/* -------------------------------------------------------------------------
 * The toolkit document — chapters, quotes and endnotes, as printed
 * ----------------------------------------------------------------------- */

const CHAPTERS = [
  {
    n: "01",
    title: "Introduction",
    pages: "p.1–2",
    summary: "What the U.S.-ASEAN Smart Cities Mobility Program is, who ran it, and the five things every tourist city wants: less traffic, more safety, lower emissions, cheaper rides, and cheaper buses to run."
  },
  {
    n: "02",
    title: "Sustainable Tourism Travel: Defining the Problem",
    pages: "p.3–4",
    summary: "Why Phuket and Las Vegas are different problems, not the same problem twice — how visitors arrive, where they come from, who regulates the buses — laid out side by side in one table."
  },
  {
    n: "03",
    title: "Methods for Identifying, Understanding, and Engaging Stakeholders",
    pages: "p.5–12",
    summary: "The toolkit's actual method, step by step: find out who the stakeholders are, survey real travelers (with real Phuket prices), build rider personas, then run workshops that rank ideas by impact against effort."
  },
  {
    n: "04",
    title: "Results from a Case Study in Phuket, Thailand",
    pages: "p.12–19",
    summary: "What the Phuket case study found: who's in charge of what, a map of where riders actually go, eight rider personas, and fifteen recommendations ranked by how much they'd help versus how hard they'd be."
  },
  {
    n: "05",
    title: "Lessons Learned and Recommendations",
    pages: "p.18–21",
    summary: "What the research team would tell the next city: keep the stakeholder list open to changes, don't cut corners on the survey, and good teamwork alone won't save a bus service without real data on demand."
  }
];

const PULL_QUOTES = [
  {
    text: "In Phuket, the emergence of Phuket Smart Bus as a privately led initiative reflected unmet demand for higher-quality public transport that was not being addressed through conventional public-sector mechanisms.",
    location: "Lessons from Governance Roles, p.20"
  },
  {
    text: "Institutional collaboration alone is insufficient without adequate data and demand intelligence.",
    location: "Lessons Learned, p.21"
  }
];

const ENDNOTES = [
  {
    n: 1,
    text: "Alexander, L., Jiang, S., Murga, M., & González, M. C. (2015) “Origin–destination trips by purpose and time of day inferred from mobile phone data.” Transportation Research Part C: Emerging Technologies, 58, 240–250. Toole, J. L., Colak, S., Sturt, B., Alexander, L. P., Evsukoff, A., & González, M. C. (2015) “The path most traveled: Travel demand estimation using big data resources.” Transportation Research Part C: Emerging Technologies, 58, 162–177."
  },
  {
    n: 2,
    text: "See, e.g., M. Boarnet, “Land Use, Travel Behavior, and Disaggregate Travel Data,” in Geography of Urban Transportation, 4th ed., G. Giuliano and S. Hanson, Guilford Press, 2017; and M. Boarnet, “Longer View: A Broader Context for Land Use and Travel Behavior, and a Research Agenda,” Journal of the American Planning Association, vol. 77, no. 3, 2011, pp. 197–213; Pronello, C., & Camusso, C. (2011) “Users’ needs and attitudes towards sustainable urban mobility.” Transport Policy, 18(1), 60–65; Stopher, P. R., & Greaves, S. P. (2007) “Household travel surveys: Where are we going?” Transportation Research Part A, 41(5), 367–381."
  },
  {
    n: 3,
    text: "Airports of Thailand Public Company Limited (AOT). Annual Report 2024. Bangkok, Thailand, 2024; Airports of Thailand Public Company Limited (AOT). Annual Report 2025. Bangkok, Thailand, 2025."
  }
];

/* -------------------------------------------------------------------------
 * The stations
 * ----------------------------------------------------------------------- */

type Photo = { src: string; alt: string; caption: string };
type Quote = { who: string; text: string };

type Station = {
  id: string;
  kind: "moment" | "workshop" | "memorial" | "artifact" | "terminal";
  date: string;
  verb?: string;
  place: string;
  title: string;
  summary?: string;
  detail?: string;
  photos?: Photo[];
  quotes?: Quote[];
  outputs?: string[];
};

const STATIONS: Station[] = [
  {
    id: "origins",
    kind: "moment",
    date: "Nov 2021",
    verb: "Begin",
    place: "Virtual · the pairing",
    title: "A workplan, built by the people who would have to use it.",
    summary: "USDOT proposed a Phuket–Las Vegas peer-city pilot focused on Mobility-as-a-Service, first-mile/last-mile connectivity and tourism mobility. Dr Non coordinated Phuket stakeholder review of the draft workplan — every comment came from someone who operates, regulates or depends on transport on the island.",
    detail: "On 19 November 2021, Roshan Desai (USDOT) informed Phuket officials of the partnership. The January 2022 kick-off established the peer-city structure. By 28 January, Roshan circulated a draft workplan. On 20 February, Non delivered consolidated comments: 'I made sure to speak with all key stakeholders in order to compile these comments.' Roshan thanked him — the workplan was jointly revised, not imposed.",
    photos: [
      { src: `${FIELD}singapore-2022.jpg`, alt: "The U.S.-ASEAN Smart Cities Partnership booth in Singapore, 2022", caption: "Singapore · 2022 · the partnership's public face — the U.S.-ASEAN Smart Cities booth" }
    ],
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
    kind: "workshop",
    date: "Dec 2022",
    verb: "Meet",
    place: "Jakarta, Indonesia",
    title: "The first time everyone was in the same room.",
    summary: "The first in-person Smart Mobility Workshop brought together all eight USASCP city pairs. Phuket was represented by Dr Non and Pracha Asawateera, with Ton Jaitong at the table. The toolkit was still loose paper, argument and possibility — but the network was real.",
    detail: "USDOT described the workshop's objectives: advancing city-pair workplans, strengthening understanding of smart mobility, creating networking opportunities among ASEAN and U.S. officials, and accelerating implementation. Non and Pracha presented Phuket's mobility challenges, smart-city ambitions and the partnership's goals. Non positioned Phuket as a tourism-intensive city and a testbed for innovative mobility solutions — a living laboratory. Ahead of Jakarta, Non supplied biography information, staff profiles and descriptions of Phuket Smart City initiatives. The workshop attachments included formal invitation letters, agendas, city presentation templates and participant briefing packages.",
    photos: [
      { src: `${HISTORY}jakarta-2022.jpg`, alt: "USDOT Smart Mobility Workshop participants in Jakarta, December 2022", caption: "Jakarta · December 2022 · the first in-person workshop" }
    ],
    outputs: [
      "Eight city-pair network established in person",
      "Phuket positioned as a tourism-mobility testbed",
      "Implementation activities planned for 2023"
    ]
  },
  {
    id: "los-angeles",
    kind: "workshop",
    date: "Jul 2023",
    verb: "Plan",
    place: "Los Angeles, USA",
    title: "From introductions to workplans — and the first personas.",
    summary: "The programme matured. USDOT hosted a multi-day workshop in Los Angeles with sessions on public engagement, multimodal integration and the 'Complete Trip' framework. The breakout exercises on traveller personas directly shaped the survey work that followed in Phuket.",
    detail: "Roshan stated the objective was to 'continue conversations begun in Jakarta, advance city-pair workplans and strengthen relationships between U.S. and ASEAN cities.' Agenda materials covered stakeholder participation, community engagement, transit coordination and user experience. The Complete Trip Framework explored mobility from trip planning through navigation, transfers, accessibility, payments and final-destination arrival. Breakout exercises asked participants to analyse business travelers, tourists, transportation preferences, modal choices, accessibility concerns and mobility data gaps. These discussions substantially influenced the eight personas that later emerged from the Phuket survey.",
    photos: [
      { src: `${HISTORY}los-angeles-2023.jpg`, alt: "USDOT Smart Mobility Workshop in Los Angeles, July 2023", caption: "Los Angeles · July 2023 · transit service design on a flipchart" },
      { src: `${HISTORY}la-bike-tour-2023.jpg`, alt: "LA bike tour during the USDOT workshop, 2023", caption: "Los Angeles · July 2023 · bike tour — first-mile/last-mile is not an abstract concept" }
    ],
    outputs: [
      "Workplans advanced from concept to methodology",
      "Traveler-persona framework introduced — the seed of the eight Phuket personas",
      "Complete Trip Framework adopted as analytical lens"
    ]
  },
  {
    id: "phuket-workshop",
    kind: "workshop",
    date: "Mar 2024",
    verb: "Test",
    place: "Phuket, Thailand",
    title: "The workshop came home — and the cable car was on the table.",
    summary: "USDOT hosted a major workshop in Phuket with the Governor, the Sustainable Tourism Development Foundation, the Phuket Industry Association, Grab, e-scooter operators and tourism stakeholders. Topics ranged from tourism mobility to cable car concepts, ridesharing and micromobility. depa was allocated dedicated time — the agency had become a central institutional partner.",
    detail: "Roshan coordinated workshop agendas, transportation logistics, speaker invitations and site visits. Email records show planned participation by the Phuket Governor, the Phuket Sustainable Foundation, the Phuket Industry Association, Grab, e-scooter operators, tourism stakeholders and public agencies. Topics included tourism mobility, smart mobility for tourism, cable car concepts, ridesharing, micromobility and sustainability. Roshan specifically allocated time for 'DEPA's role in Thailand and Phuket around mobility and transportation' — depa had become the central Thai institutional partner.",
    photos: [
      { src: `${HISTORY}phuket-2023.jpg`, alt: "Phuket city systems field workshop, 2024", caption: "Phuket · March 2024 · back on the island" }
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
    kind: "workshop",
    date: "Sep 2024",
    verb: "Sift",
    place: "Boston, USA",
    title: "The toolkit takes shape — and the survey critique lands.",
    summary: "The Boston workshop was the fourth of the programme, focused on final toolkits, operational recommendations and project implementation. By this point, the project had evolved from conceptual planning into evidence-based transit research. Dr Non's most consequential intervention came here: a systematic critique of the proposed survey methodology that pushed qualitative methods, ethnographic observation and stakeholder engagement into the research design.",
    detail: "Roshan described Boston as the fourth workshop, focused heavily on final toolkits, operational recommendations, project implementation and city-pair deliverables. Non was deeply involved in travel planning and workshop participation, managing itinerary conflicts with Smart City Expo Miami and Shanghai commitments. USDOT regarded his participation as strategically important because of his 'expertise and knowledge.' The major intellectual contribution: Non argued that Phuket residents were suffering survey fatigue, that existing studies lacked actionable insights, and that qualitative methods — ethnographic observation, focus groups, user shadowing and stakeholder interviews — should complement questionnaires. This shaped the mixed-methods design that produced the eight personas.",
    photos: [
      { src: `${HISTORY}boston-2024.jpg`, alt: "Boston tour with USDOT, September 2024", caption: "Boston · September 2024 · a wider cohort, a harder standard" },
      { src: `${HISTORY}boston-2024-detail.jpg`, alt: "Boston workshop session, 2024", caption: "Boston · September 2024 · the toolkit takes its final shape" }
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
    kind: "moment",
    date: "Late 2024",
    verb: "Measure",
    place: "Phuket · the fieldwork",
    title: "The $20k survey, the $5k workshop, and eight real people.",
    summary: "Following Boston, a strong partnership among depa, RTC Southern Nevada, Chulalongkorn University, USC/METRANS and USDOT executed the fieldwork. A Cochran-sized travel survey (~$20,000) along the PKCD bus corridor, a co-design workshop (~$5,000) with regulators and operators, and clustering analysis produced eight distinct personas — four current riders, four non-riders — and fifteen ranked recommendations.",
    detail: "The travel survey cost approximately $20,000, including $4,000 for survey design and development, $8,000 for the survey fee and $8,000 for respondent incentives. The co-design workshop cost approximately $5,000, including $1,500 for pre-workshop preparation and $3,500 for direct implementation. The workshop convened the Department of Land Transport Phuket, Phuket City Development (PKCD), Phuket Mahanakorn, the Phuket PAO, the Federation of Thai Industries, the Patong Hotel Association and the Thai Hotels Association Southern Chapter. The impact–effort framework produced fifteen recommendations spanning boarding convenience, service frequency, timetable transparency, driver training, digital integration, route design and first–last mile connectivity.",
    outputs: [
      "Travel survey: ~$20,000, Cochran-sized, 500 m origin–destination buffers",
      "Co-design workshop: ~$5,000, 7 stakeholder organisations, 15 recommendations",
      "8 personas (4 users + 4 non-users) clustered from survey data",
      "Impact–effort framework: 4 quick wins, 6 major projects, 3 fill-ins, 2 hard slogs"
    ]
  },
  {
    id: "suspension",
    kind: "moment",
    date: "27 Jan 2025",
    verb: "Pause",
    place: "Distributed · the pause",
    title: "The programme was suspended. The work was not.",
    summary: "On 27 January 2025, Roshan informed participants that new U.S. Executive Orders required a review of foreign-assistance programmes. All USDOT Smart Mobility Program activities were immediately paused; the planned Cambodia workshop was postponed. Dr Non responded diplomatically but firmly, emphasising the value of the collaboration and the willingness to provide evidence supporting its resumption. The work continued — independently, in Phuket, as this system.",
    detail: "Roshan informed participants that new U.S. Executive Orders required review of foreign assistance programs; all USDOT Smart Mobility Program activities were immediately paused; meetings and workshops were suspended; the planned Cambodia workshop was postponed. Non responded by emphasising the value of ASEAN-U.S. collaboration, the importance of mobility innovation, the willingness to provide evidence supporting the programme, and the desire to see the partnership resume. The suspension effectively closed the official chapter — but the toolkit was complete, the method was proven, and the system you are reading was built from it.",
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
    id: "ton",
    kind: "memorial",
    date: "2025",
    place: "In memoriam",
    title: "The work continues with him in it."
  },
  {
    id: "johor",
    kind: "workshop",
    date: "Aug 2025",
    verb: "Reunite",
    place: "Johor Bahru, Malaysia",
    title: "The last workshop — the network outlived the programme.",
    summary: "Seven months after the suspension, USDOT and the city teams reassembled in Johor Bahru — the first reunion, and the last full workshop. The conversation had changed: less 'what could cities do', more 'what do our systems already demonstrate'. Johor showed its Intelligent Operations Centre wall; the Phuket seat carried a working bus engine in a browser tab. It was also the first time the room met without Ton.",
    detail: "The August 2025 reunion brought the network back together on Johor's own ground — IRDA hosting, the city's operations centre running live traffic detection on the wall while visitors compared notes on what had actually shipped since Boston. The agenda that once traded workplans now traded working systems. A follow-up in 2026 continued the thread.",
    photos: [
      { src: `${HISTORY}johor-2025.jpg`, alt: "USDOT reunion in Johor Bahru, August 2025", caption: "Johor Bahru · August 2025 · the reunion" },
      { src: `${FIELD}johor-usdot-2025.jpg`, alt: "Johor Bahru's screen wall welcoming the U.S. Department of Transportation, 2025", caption: "Johor Bahru · 2025 · the city welcomes USDOT" },
      { src: `${FIELD}johor-ops-2025.jpg`, alt: "Inside Johor Bahru's Intelligent Operations Centre during the USDOT visit, August 2025", caption: "Johor Bahru · 12 August 2025 · inside the Intelligent Operations Centre" }
    ],
    outputs: [
      "The eight-city network reconvened after the suspension — on its own initiative",
      "Agenda shifted from workplans to working systems",
      "2026 follow-up agreed — the thread continues"
    ]
  },
  {
    id: "toolkit-ship",
    kind: "artifact",
    date: "2026",
    verb: "Ship",
    place: "METRANS · the toolkit",
    title: "The 23-page toolkit leaves the room."
  },
  {
    id: "system",
    kind: "terminal",
    date: "Now",
    verb: "Run",
    place: "Phuket · bus.nonarkara.org",
    title: "The report became a bus. The bus is still running.",
    summary: "The programme paused, but the method did not. The Phuket Smart Bus system — this website — was built from the toolkit's findings, the survey's personas and the engine's demand-supply chain: flights land, queues form, buses move, revenue and CO₂ follow. Every number traces back to the chain the toolkit was built to understand. This is what 'more than a report' looks like.",
    photos: [
      { src: `${HISTORY}johor-2026.jpg`, alt: "Johor Bahru follow-up meeting, 2026", caption: "Johor Bahru · 2026 · the follow-up — the network still meets" }
    ]
  }
];

const STATS = [
  { value: "5", label: "in-person workshops", note: "Jakarta · LA · Phuket · Boston · Johor Bahru" },
  { value: "~$25k", label: "field research investment", note: "$20k travel survey + $5k co-design workshop" },
  { value: "4", label: "published toolkits via METRANS", note: "the deliverable survived the suspension" },
  { value: String(PEOPLE_COUNT), label: "people on the manifest", note: "nine teams · one network" }
];

/* -------------------------------------------------------------------------
 * Station renderers
 * ----------------------------------------------------------------------- */

function Photos({ photos }: { photos: Photo[] }) {
  return (
    <div className="fc-photos" data-n={photos.length}>
      {photos.map((photo) => (
        <figure key={photo.src}>
          <img src={photo.src} alt={photo.alt} loading="lazy" />
          <figcaption>{photo.caption}</figcaption>
        </figure>
      ))}
    </div>
  );
}

function Quotes({ quotes }: { quotes: Quote[] }) {
  return (
    <div className="fc-quotes">
      {quotes.map((quote) => (
        <blockquote key={quote.text}>
          <p>“{quote.text}”</p>
          <cite>— {quote.who}</cite>
        </blockquote>
      ))}
    </div>
  );
}

function Outputs({ outputs }: { outputs: string[] }) {
  return (
    <div className="fc-outputs">
      <span className="tk-kicker">What it produced</span>
      <ul>
        {outputs.map((output) => (
          <li key={output}>{output}</li>
        ))}
      </ul>
    </div>
  );
}

function FullRecord({ detail }: { detail: string }) {
  return (
    <details className="fc-more">
      <summary>Full record</summary>
      <p>{detail}</p>
    </details>
  );
}

function MemorialBody() {
  return (
    <div className="fc-memorial">
      <figure>
        <img
          src={`${HISTORY}jakarta-ton-2022-detail.jpg`}
          alt="Ton Jaitong with colleagues at the Jakarta workshop, December 2022"
          loading="lazy"
        />
        <figcaption>Ton Jaitong (centre) · Jakarta, December 2022 · the first workshop</figcaption>
      </figure>
      <div className="fc-memorial__copy">
        <p className="tk-kicker">For Ton</p>
        <h3>The work continues with him in it.</h3>
        <p className="fc-memorial__lead">
          This system — and the toolkit it grew from — is dedicated to our friend and colleague{" "}
          <strong>Ton Jaitong</strong>, Team Leader at depa's Southern Office, who died suddenly last year.
        </p>
        <p>
          Ton was at the table in Jakarta in December 2022 and helped quietly in the background ever since. In
          remote communities he worked with farmers to build their capacity in smart farming — practical work,
          done close to the people it was meant to serve.
        </p>
        <p>
          That is the standard this project holds itself to. Technology must leave someone more capable than
          before. A system should not merely remember the people who built it — it should carry their way of
          working forward.
        </p>
      </div>
    </div>
  );
}

function ArtifactBody() {
  return (
    <div className="fc-artifact">
      <p className="fc-station__summary">
        <em>Transit Service Planning for Sustainable Tourism Travel — Insights from Phuket and Las Vegas</em> is
        the real document: published under the U.S.-ASEAN Smart Cities Mobility Program, led by the U.S.
        Department of Transportation, researched with METRANS at USC and Chulalongkorn University's
        Transportation Institute. Every persona, every cost figure, every recommendation on this site traces
        back to it. Read our translation elsewhere on this site — or open the original here.
      </p>
      <div className="fc-artifact__download">
        <a className="lp-btn lp-btn--primary" href={TOOLKIT_URL} download>
          Download the toolkit (PDF, 5.8 MB) <span>↓</span>
        </a>
        <span className="fc-artifact__meta">23 pages · US-ASEAN Smart Cities Mobility Program · METRANS UPP, 2026</span>
      </div>
      <div className="fc-artifact__body">
        <figure className="fc-artifact__cover">
          <img
            src={`${import.meta.env.BASE_URL}toolkit/toolkit-cover.jpg`}
            alt="Cover page of the printed toolkit: Transit Service Planning for Sustainable Tourism Travel — Insights from Phuket and Las Vegas"
            loading="lazy"
          />
          <figcaption>The actual cover, page 1 of 23.</figcaption>
        </figure>
        <ol className="fc-chapters">
          {CHAPTERS.map((c) => (
            <li key={c.n}>
              <span className="fc-chapters__n">{c.n}</span>
              <div>
                <strong>{c.title}</strong>
                <small>{c.pages}</small>
                <p>{c.summary}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
      <Quotes quotes={PULL_QUOTES.map((q) => ({ who: q.location, text: q.text }))} />
      <details className="fc-more">
        <summary>Endnotes, as printed</summary>
        <p className="fc-artifact__endnote-intro">
          The toolkit cites three sources directly. We cite far more (every fact on this site carries its own
          source), but these three are the toolkit's own bibliography — reproduced exactly, not summarised.
        </p>
        <ol className="fc-endnotes">
          {ENDNOTES.map((e) => (
            <li key={e.n}>
              <span>{e.n}</span>
              <p>{e.text}</p>
            </li>
          ))}
        </ol>
      </details>
      <p className="fc-artifact__credit">
        The research, the survey design, the personas, the fifteen recommendations — that work belongs to the
        USASCP team, RTC Southern Nevada, Chulalongkorn University, and the Phuket stakeholders who sat through
        the workshops. This site is what happened after: turning a finished report into a system you can run.
        Both things can be true. Read the report. Then watch the bus move.
      </p>
    </div>
  );
}

function TerminalBody({ station }: { station: Station }) {
  return (
    <>
      {station.summary && <p className="fc-station__summary">{station.summary}</p>}
      <div className="fc-terminal__actions">
        <a className="lp-btn lp-btn--primary" href={BUS_URL}>Open the live system <span>↗</span></a>
        <a className="lp-btn" href={`${BUS_URL}ops`}>Watch the fleet move <span>↗</span></a>
      </div>
      {station.photos && <Photos photos={station.photos} />}
    </>
  );
}

function StationBlock({ station }: { station: Station }): ReactNode {
  return (
    <article
      className={`fc-station fc-station--${station.kind}`}
      id={station.id === "toolkit-ship" ? "toolkit-document" : undefined}
    >
      <div className="fc-station__rail">
        <span className="fc-station__marker" aria-hidden="true" />
        <time className="fc-station__date">{station.date}</time>
        {station.verb && <span className="fc-station__verb">{station.verb}</span>}
        <small className="fc-station__place">{station.place}</small>
      </div>
      <div className="fc-station__body">
        {station.kind === "memorial" ? (
          <MemorialBody />
        ) : station.kind === "artifact" ? (
          <>
            <h3 className="fc-station__title">{station.title}</h3>
            <ArtifactBody />
          </>
        ) : station.kind === "terminal" ? (
          <>
            <h3 className="fc-station__title">{station.title}</h3>
            <TerminalBody station={station} />
          </>
        ) : (
          <>
            <h3 className="fc-station__title">{station.title}</h3>
            {station.summary && <p className="fc-station__summary">{station.summary}</p>}
            {station.photos && <Photos photos={station.photos} />}
            {station.quotes && <Quotes quotes={station.quotes} />}
            {station.outputs && <Outputs outputs={station.outputs} />}
            {station.detail && <FullRecord detail={station.detail} />}
          </>
        )}
      </div>
    </article>
  );
}

/* -------------------------------------------------------------------------
 * The chronicle
 * ----------------------------------------------------------------------- */

export function FieldChronicle() {
  return (
    <section className="fc-section" id="history" aria-labelledby="history-title">
      <header className="fc-section__head">
        <p className="tk-kicker">Field notes · 2021 → now</p>
        <h2 id="history-title">The whole story, on one line.</h2>
        <p className="fc-section__standfirst">
          Phuket was paired with Las Vegas in late 2021. What followed — five workshops across four countries,
          a 23-page toolkit, the working system this site runs on, and the loss of a friend along the way —
          reads best in order. So here it is, in order: every station on the same line, from the first email to
          the bus that is moving right now.
        </p>
        <div className="fc-stats" role="list" aria-label="Collaboration headline figures">
          {STATS.map((s) => (
            <div key={s.label} role="listitem">
              <strong>{s.value}</strong>
              <span>{s.label}</span>
              {s.note && <small>{s.note}</small>}
            </div>
          ))}
        </div>
      </header>

      {/* The route — one line, eleven stations, chronological */}
      <div className="fc-route">
        {STATIONS.map((station) => (
          <StationBlock key={station.id} station={station} />
        ))}
      </div>

      {/* The seat at the table, year by year */}
      <div className="fc-roles">
        <div className="fc-roles__intro">
          <span className="tk-kicker">The seat at the table</span>
          <p>Dr Non's role evolved across the same line — from coordinating schedules to shaping the research methodology the toolkit still uses.</p>
        </div>
        <ol>
          {EVOLUTION_STAGES.map((stage) => (
            <li key={stage.year}>
              <span>{stage.year}</span>
              <strong>{stage.role}</strong>
              <p>{stage.note}</p>
            </li>
          ))}
        </ol>
      </div>

      {/* The people manifest */}
      <div className="fc-people">
        <div className="fc-people__intro">
          <span className="tk-kicker">The people</span>
          <h3>Programmes are made by people who answer the next email.</h3>
          <p>{PEOPLE_COUNT} names across nine teams, compiled from programme correspondence and workshop distribution
          lists. Not a logo wall — actual humans who showed up, more than once, and did the work.</p>
        </div>
        <div className="fc-teams">
          {PEOPLE_BY_TEAM.map((team) => (
            <article key={team.team} className="fc-team">
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
              {team.caveat && <p className="fc-team__caveat">{team.caveat}</p>}
            </article>
          ))}
        </div>
        <div className="fc-network">
          {NETWORK.map(([label, members]) => (
            <div key={label}>
              <strong>{label}</strong>
              <p>{members}</p>
            </div>
          ))}
        </div>
        <p className="fc-people__gap">
          <strong>What's still missing.</strong> No formal participant roster, no registration spreadsheet, no
          single document mapping every city pair to every name. This list is what actually survived in programme
          correspondence — complete enough to credit real people, not complete enough to call final. If you were
          in the room and aren't here, tell us.
        </p>
      </div>

      {/* What four years actually taught */}
      <div className="fc-lessons" id="programme">
        <div className="fc-lessons__intro">
          <span className="tk-kicker">What four years actually taught</span>
          <h3>Eight lessons the next city pair can steal.</h3>
          <p>
            Distilled from inside the email chains, workshops and living documents. The public record is at the{" "}
            <a href={PROGRAM_URL}>official programme page ↗</a> and the{" "}
            <a href={UPP_URL}>four published toolkits ↗</a>.
          </p>
        </div>
        <ol>
          {LESSONS.map(([number, title, copy]) => (
            <li key={number}>
              <span>{number}</span>
              <strong>{title}</strong>
              <p>{copy}</p>
            </li>
          ))}
        </ol>
      </div>

      <ResearchPanel
        title="Sources, programme records and the published toolkit"
        stats={[]}
        citations={HISTORY_CITATIONS}
      >
        <p>
          The chronicle above is compiled from programme correspondence, workshop agendas, the published USASCP
          programme record and the 23-page Phuket–Las Vegas toolkit. The programme was suspended on 27 January 2025
          by a U.S. foreign-assistance review; the four city-pair toolkits were nevertheless published via METRANS
          in 2026. This website is the independent continuation — the toolkit, operationalised.
        </p>
      </ResearchPanel>
    </section>
  );
}

export default FieldChronicle;
