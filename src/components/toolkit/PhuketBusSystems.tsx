/**
 * Phuket Bus Systems — who runs buses on the island.
 *
 * This is the chapter that answers: "What buses already run in Phuket?"
 * The answer is messier than visitors expect. Three formal operators, a
 * government competitor, an informal songthaew network, a ride-hailing
 * monopoly and a regulatory regime that forbids buses from stopping at
 * hotels. Every claim is sourced.
 */

import type { Lang } from "@shared/types";
import { ResearchPanel, type Citation, type Stat } from "./ResearchPanel";
import { PB } from "./translations";

function tr(key: string, lang: Lang): string {
  return PB[key]?.[lang] ?? PB[key]?.en ?? key;
}

// Citations are bibliographic references to external documents — kept
// in their original language per standard i18n practice for source titles.
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

type Operator = {
  name: string;
  abbr: string;
  type: string;
  fleet: string;
  routes: string;
  fare: string;
  coverage: string;
  status: string;
  notes: string;
};

export function PhuketBusSystems({ lang = "en" }: { lang?: Lang }) {
  const operatorStats: Stat[] = [
    { value: "3", label: tr("pbStat1Label", lang), note: tr("pbStat1Note", lang) },
    { value: "~25", label: tr("pbStat2Label", lang), note: tr("pbStat2Note", lang) },
    { value: "฿100", label: tr("pbStat3Label", lang), note: tr("pbStat3Note", lang) },
    { value: "~230/day", label: tr("pbStat4Label", lang), note: tr("pbStat4Note", lang) }
  ];

  const operators: Operator[] = [
    {
      name: tr("pbOp1Name", lang),
      abbr: "PKCD / PKSB",
      type: tr("pbOpTypeSmartCity", lang),
      fleet: tr("pbOp1Fleet", lang),
      routes: tr("pbOp1Routes", lang),
      fare: tr("pbOp1Fare", lang),
      coverage: tr("pbOp1Coverage", lang),
      status: tr("pbOp1Status", lang),
      notes: tr("pbOp1Notes", lang)
    },
    {
      name: tr("pbOp2Name", lang),
      abbr: "PMN",
      type: tr("pbOpTypeLegacy", lang),
      fleet: tr("pbOp2Fleet", lang),
      routes: tr("pbOp2Routes", lang),
      fare: tr("pbOp2Fare", lang),
      coverage: tr("pbOp2Coverage", lang),
      status: tr("pbOp2Status", lang),
      notes: tr("pbOp2Notes", lang)
    },
    {
      name: tr("pbOp3Name", lang),
      abbr: "ORANGE",
      type: tr("pbOpTypeGovt", lang),
      fleet: tr("pbOp3Fleet", lang),
      routes: tr("pbOp3Routes", lang),
      fare: tr("pbOp3Fare", lang),
      coverage: tr("pbOp3Coverage", lang),
      status: tr("pbOp3Status", lang),
      notes: tr("pbOp3Notes", lang)
    }
  ];

  const competitors = [
    { mode: "Grab", cost: "฿450–600", note: tr("pbCh1Note", lang) },
    { mode: "Bolt", cost: "฿360–480", note: tr("pbCh2Note", lang) },
    { mode: tr("pbCh3Mode", lang), cost: "฿650", note: tr("pbCh3Note", lang) },
    { mode: tr("pbCh4Mode", lang), cost: "฿800–1,200", note: tr("pbCh4Note", lang) },
    { mode: "Songthaew", cost: "฿30–50", note: tr("pbCh5Note", lang) },
    { mode: tr("pbCh6Mode", lang), cost: "฿150–300", note: tr("pbCh6Note", lang) }
  ];

  const regulatoryLayers = [
    { level: tr("pbLevelNational", lang), body: "Department of Land Transport (DLT)", role: tr("pbReg1Role", lang), constraint: tr("pbReg1Constraint", lang) },
    { level: tr("pbLevelNational", lang), body: "Office of Transport Policy and Planning (OTP)", role: tr("pbReg2Role", lang), constraint: tr("pbReg2Constraint", lang) },
    { level: tr("pbLevelNational", lang), body: "Commission for the Management of Land Traffic (CMLT)", role: tr("pbReg3Role", lang), constraint: tr("pbReg3Constraint", lang) },
    { level: tr("pbLevelProvincial", lang), body: tr("pbReg4Body", lang), role: tr("pbReg4Role", lang), constraint: tr("pbReg4Constraint", lang) },
    { level: tr("pbLevelProvincial", lang), body: tr("pbReg5Body", lang), role: tr("pbReg5Role", lang), constraint: tr("pbReg5Constraint", lang) },
    { level: tr("pbLevelIndustry", lang), body: tr("pbReg6Body", lang), role: tr("pbReg6Role", lang), constraint: tr("pbReg6Constraint", lang) }
  ];

  return (
    <section className="pb-section" id="bus-systems" aria-labelledby="bus-systems-title">
      <header className="pb-section__head">
        <p className="tk-kicker">{tr("pbKicker", lang)}</p>
        <h2 id="bus-systems-title">{tr("pbTitle", lang)}</h2>
        <p className="pb-section__standfirst">
          {tr("pbStandfirst", lang)}
        </p>
      </header>

      {/* Stats */}
      <div className="pb-stats" role="list" aria-label={tr("pbStatsAria", lang)}>
        {operatorStats.map((s) => (
          <div key={s.label} role="listitem">
            <strong>{s.value}</strong>
            <span>{s.label}</span>
            {s.note && <small>{s.note}</small>}
          </div>
        ))}
      </div>

      {/* Operator cards */}
      <div className="pb-operators">
        <h3 className="pb-subhead">{tr("pbOperatorsSubhead", lang)}</h3>
        {operators.map((op) => (
          <article key={op.abbr} className={`pb-operator pb-operator--${op.type.toLowerCase().replace(/\s+/g, "-")}`}>
            <header>
              <span className="pb-operator__type">{op.type}</span>
              <h4>{op.name}</h4>
              <strong>{op.abbr}</strong>
            </header>
            <dl>
              <div><dt>{tr("pbDtFleet", lang)}</dt><dd>{op.fleet}</dd></div>
              <div><dt>{tr("pbDtRoutes", lang)}</dt><dd>{op.routes}</dd></div>
              <div><dt>{tr("pbDtFare", lang)}</dt><dd>{op.fare}</dd></div>
              <div><dt>{tr("pbDtCoverage", lang)}</dt><dd>{op.coverage}</dd></div>
              <div><dt>{tr("pbDtStatus", lang)}</dt><dd>{op.status}</dd></div>
            </dl>
            <p className="pb-operator__notes">{op.notes}</p>
          </article>
        ))}
      </div>

      {/* What tourists use instead */}
      <div className="pb-competitors">
        <h3 className="pb-subhead">{tr("pbCompetitorsSubhead", lang)}</h3>
        <p className="pb-intro-note">
          {tr("pbCompetitorsIntro", lang)}
        </p>
        <div className="pb-competitor-table" role="table" aria-label={tr("pbChAria", lang)}>
          <div className="pb-competitor-row pb-competitor-row--head" role="row">
            <span role="columnheader">{tr("pbChMode", lang)}</span>
            <span role="columnheader">{tr("pbChFare", lang)}</span>
            <span role="columnheader">{tr("pbChWhat", lang)}</span>
          </div>
          {competitors.map((c) => (
            <div className="pb-competitor-row" role="row" key={c.mode}>
              <strong role="cell">{c.mode}</strong>
              <span role="cell">{c.cost}</span>
              <span role="cell">{c.note}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Who licenses routes */}
      <div className="pb-regulatory">
        <h3 className="pb-subhead">{tr("pbRegSubhead", lang)}</h3>
        <p className="pb-intro-note">
          {tr("pbRegIntro", lang)}
        </p>
        <div className="pb-regulatory-grid">
          {regulatoryLayers.map((layer) => (
            <article key={layer.body} className={`pb-reg-layer pb-reg-layer--${layer.level.toLowerCase()}`}>
              <span className="pb-reg-layer__level">{layer.level}</span>
              <h4>{layer.body}</h4>
              <p className="pb-reg-layer__role">{layer.role}</p>
              <p className="pb-reg-layer__constraint"><strong>{tr("pbConstraintLabel", lang)}</strong>{layer.constraint}</p>
            </article>
          ))}
        </div>
      </div>

      {/* The structural gap */}
      <div className="pb-gap">
        <div>
          <span className="tk-kicker">{tr("pbGapKicker", lang)}</span>
          <h3>{tr("pbGapTitle", lang)}</h3>
          <p>
            {tr("pbGapBody1", lang)}
          </p>
          <p>
            {tr("pbGapBody2", lang)}
          </p>
        </div>
        <div className="pb-gap__visual">
          <div className="pb-route-compare">
            <div className="pb-route-compare__option pb-route-compare__option--pksb">
              <span className="tk-kicker">{tr("pbPksbLabel", lang)}</span>
              <strong>฿100</strong>
              <small>{tr("pbPksbNote", lang)}</small>
            </div>
            <div className="pb-route-compare__option pb-route-compare__option--orange">
              <span className="tk-kicker">{tr("pbOrangeLabel", lang)}</span>
              <strong>~฿500</strong>
              <small>{tr("pbOrangeNote", lang)}</small>
            </div>
          </div>
        </div>
      </div>

      <ResearchPanel
        title={tr("pbRp1Title", lang)}
        stats={operatorStats}
        citations={BUS_CITATIONS}
      >
        <p>
          {tr("pbRp1Body", lang)}
        </p>
      </ResearchPanel>

      <ResearchPanel
        title={tr("pbRp2Title", lang)}
        stats={[]}
        citations={REGULATORY_CITATIONS}
      >
        <p>
          {tr("pbRp2Body", lang)}
        </p>
      </ResearchPanel>
    </section>
  );
}

export default PhuketBusSystems;
