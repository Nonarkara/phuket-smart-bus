/**
 * Legal Framework — PPP, concession contracts and the politics of approach.
 *
 * The skeptic's line is "you can't have cake and eat it too." The response:
 * you can, if the contract joins the ledgers. This section lays out the Thai
 * PPP framework, the concession structure, the risk allocation matrix, and
 * the political pathway from Governor to DLT.
 */

import { ResearchPanel, type Citation, type Stat } from "./ResearchPanel";

const PPP_CITATIONS: Citation[] = [
  {
    text: "World Bank Group — Public-Private Partnerships Reference Guide, Version 3,",
    meta: "2024. The standard reference for PPP structuring: risk allocation, payment mechanisms, contract design. Project-finance convention converges on 1.1×–1.5× DSCR covenants.",
    href: "https://ppp.worldbank.org/sites/default/files/2024-08/PPP%20Reference%20Guide%20Version%203.pdf"
  },
  {
    text: "Thailand — Act on Private Participation in State Undertaking B.E. 2562 (2019),",
    meta: "The Thai PPP Act. Establishes the legal framework for private-sector participation in public infrastructure, including transport. Administered by the PPP Committee under the Ministry of Finance.",
    href: "https://www.pppthailand.go.th/"
  },
  {
    text: "Office of Transport Policy and Planning (OTP) — Thailand clean-mobility funding mechanism,",
    meta: "OTP, 2017. Identifies the EV bus financing gap: ฿12m per vehicle capital, ฿0.9m annual operating cost, farebox insufficient alone. The structural case for supplementary public payment.",
    href: "https://www.otp.go.th/uploads/tiny_uploads/ProjectOTP/2560/Project17/4-DevelopmentofaFundingMechanism.pdf"
  },
  {
    text: "Social Finance UK — HMP Peterborough One Service Social Impact Bond,",
    meta: "2010. The first outcomes-only-payment contract, ever. No transit-specific version exists yet — cited for the structure, not the sector.",
    href: "https://www.socialfinance.org.uk/work/reducing-reoffending-in-peterborough"
  }
];

const CONCESSION_CITATIONS: Citation[] = [
  {
    text: "Asian Development Bank — Piloting Results-Based Lending for Programs,",
    meta: "2013–2019 pilot. 19 loans, 11 countries, $4.8bn committed — the closest regional precedent to what this feasibility study proposes.",
    href: "https://www.adb.org/documents/piloting-results-based-lending-programs-working-paper"
  },
  {
    text: "Federal Transit Administration — National Transit Database, Annual Database Fare Revenues,",
    meta: "2023. The primary source for US farebox recovery figures. US transit farebox recovery range 13–36%, 2019 vs 2023–24.",
    href: "https://www.transit.dot.gov/ntd/data-product/2023-annual-database-fare-revenues"
  },
  {
    text: "LSTA — Guidance on Green Loan Principles (GLP),",
    meta: "Loan Market Association / LSTA / APLMA, updated 2023. Clean transportation — electric buses included — is an explicitly eligible green-loan category.",
    href: "https://www.lsta.org/content/guidance-on-green-loan-principles-glp/"
  }
];

const LEGAL_STATS: Stat[] = [
  { value: "1.1×–1.5×", label: "typical DSCR covenant range, infrastructure project finance", note: "our mock covenant: 1.30×" },
  { value: "2019", label: "Thai PPP Act (B.E. 2562) enacted", note: "private participation in state undertakings" },
  { value: "฿12m", label: "OTP EV bus cost benchmark per vehicle", note: "annual operating cost: ฿0.9m" },
  { value: "13–36%", label: "US transit farebox recovery range, 2019 vs 2023–24", note: "farebox alone is not a conservative bet" }
];

type RiskAllocation = {
  risk: string;
  who_bears: "Public" | "Private" | "Shared";
  mechanism: string;
  mitigation: string;
};

const RISK_MATRIX: RiskAllocation[] = [
  {
    risk: "Demand shortfall (ridership below model)",
    who_bears: "Shared",
    mechanism: "Phased capital release: tranches unlock at utilisation gates. Operator bears first-loss; public outcome-payment tops up only at verified baseline gap.",
    mitigation: "90-day instrumented pilot before full drawdown. Real ticketing data replaces modelled demand."
  },
  {
    risk: "Route authority / concession denial",
    who_bears: "Public",
    mechanism: "DLT route licensing is a public-sector prerequisite. Without it, no private capital moves. The concession is the first gate, not the last.",
    mitigation: "Governor convenes DLT, OTP and operator before financing. Concession secured in Phase 0."
  },
  {
    risk: "Hotel-stop ban remains in force",
    who_bears: "Shared",
    mechanism: "Structural capture suppressor. Operator adapts with corridor stops + feeder; hotel lobby advocates for regulatory change. If ban lifts, capture jumps.",
    mitigation: "Model both scenarios. The corridor-with-feeder case must clear DSCR on its own; the ban-lifting is upside."
  },
  {
    risk: "Reliability / GPS failure",
    who_bears: "Private",
    mechanism: "Operator covenant: ≥98% telemetry completeness, published reliability. Miss the covenant, lose the next tranche.",
    mitigation: "Redundant tracking; driver accountability; maintenance schedule tied to availability KPI."
  },
  {
    risk: "EV charger failure / fleet downtime",
    who_bears: "Private",
    mechanism: "Asset risk. A vehicle on the register but not on the road earns nothing. Spare charging window and backup duty in the operating plan.",
    mitigation: "Charger redundancy; diesel hybrid backup during pilot; kWh-per-service-km monitoring."
  },
  {
    risk: "Fare revenue insufficient for debt service",
    who_bears: "Shared",
    mechanism: "Farebox covers operating cost + partial debt service. Capped public-outcome payment (CO₂, safety, access) fills the gap to 1.30× DSCR — but only for independently verified additional outcomes.",
    mitigation: "DSCR waterfall: fare → opex → debt service → outcome payment → equity."
  },
  {
    risk: "Political instability / concession renegotiation",
    who_bears: "Public",
    mechanism: "Contract length must exceed asset life (8-year term for 8-year asset). Stabilisation clause: fare adjustment formula indexed to CPI and fuel.",
    mitigation: "Contract published. Data shared. The transparency that makes renegotiation politically expensive."
  },
  {
    risk: "FX / interest rate stress",
    who_bears: "Shared",
    mechanism: "Green-loan floor (4%) with MLR stress (7.07%). Covenant tested at stressed rate, not current.",
    mitigation: "Interest-rate hedging instrument if available; Bank of Thailand MLR as the stress benchmark."
  }
];

const POLITICAL_PATHWAY = [
  {
    step: "1",
    actor: "Phuket Governor",
    action: "Convene the stakeholders",
    detail: "The Governor's Office coordinates DLT, OTP, PAO, PKCD, hotel associations and depa. The Governor cannot grant route authority but can make the room where it gets discussed.",
    timeline: "Phase 0 — before financing"
  },
  {
    step: "2",
    actor: "DLT (Bangkok)",
    action: "Grant or extend route concession",
    detail: "The binding legal gate. DLT issues route licences at the national level. An expansion of the Airport Line corridor, or a new beach-loop feeder, requires DLT approval. Prepare the public-need case with the USASCP survey data.",
    timeline: "Phase 0 — before financing"
  },
  {
    step: "3",
    actor: "OTP",
    action: "Endorse the funding mechanism",
    detail: "OTP's 2017 clean-mobility study already identified the EV bus financing gap. Endorsement from OTP gives the project a national-policy anchor and unlocks potential green-finance pathways.",
    timeline: "Phase 0 — concurrent"
  },
  {
    step: "4",
    actor: "CMLT",
    action: "Resolve the hotel-stop question",
    detail: "The hotel-stop ban is the single biggest regulatory capture suppressor. CMLT can coordinate an exception, a pilot relaxation, or a corridor-stop compromise. This is the political negotiation that changes the economics.",
    timeline: "Phase 1 — pilot design"
  },
  {
    step: "5",
    actor: "PAO + Municipalities",
    action: "Build the stops and shelters",
    detail: "Local government owns stop infrastructure. A corridor with safe, visible, information-bearing stops outperforms a corridor where the bus is invisible. This is the cheapest high-impact intervention.",
    timeline: "Phase 1 — concurrent"
  },
  {
    step: "6",
    actor: "Hotel associations + tourism board",
    action: "Advocate and educate",
    detail: "The Patong Hotel Association and THA Southern Chapter can distribute information, advocate for the hotel-stop relaxation, and — critically — tell guests the bus exists. The first-fifty-metres problem is an information problem.",
    timeline: "Phase 1 — concurrent"
  },
  {
    step: "7",
    actor: "Lender (Krungthai / green finance)",
    action: "Structure the phased facility",
    detail: "Capital released in tranches against utilisation and reliability gates. Mock covenant: 1.30× DSCR, ≥98% telemetry, monthly reconciliation. The lender monitors via the same telemetry this system already ingests.",
    timeline: "Phase 2 — after pilot"
  },
  {
    step: "8",
    actor: "Government (outcome payer)",
    action: "Contract the public benefit",
    detail: "Pay only for independently verified additional outcomes: CO₂ avoided, risky trips replaced, access provided. Capped annual payment sized to close the DSCR gap. This is the 'eat it too' structure.",
    timeline: "Phase 2 — concurrent"
  }
];

const CONTRACT_TYPES = [
  {
    type: "Gross cost contract",
    structure: "Government pays operator a fixed fee per km or per trip. Operator keeps no fare risk.",
    pros: "Operator incentive aligned with service delivery, not ticket sales. Simpler for public sector to budget.",
    cons: "No upside for operator if ridership exceeds target. Government bears all demand risk.",
    fit: "Better when demand is uncertain and the priority is service coverage."
  },
  {
    type: "Net cost contract",
    structure: "Operator keeps fare revenue; government may top up if revenue falls below a floor.",
    pros: "Operator has skin in the game on ridership. Demand-risk transfer.",
    cons: "Operator may cut service to unprofitable hours. Revenue-risk can starve maintenance.",
    fit: "Better when demand is established and the operator has demand-management tools."
  },
  {
    type: "Management contract",
    structure: "Government owns assets; operator manages for a fee plus performance bonus.",
    pros: "Asset risk stays public. Easier to switch operators.",
    cons: "Weakest demand incentive. Bonus structure must be carefully designed.",
    fit: "Transitional — when the public sector is building capacity to operate directly."
  },
  {
    type: "Concession (BOT/BOOT)",
    structure: "Operator finances, builds, owns and operates for a fixed term, then transfers. Revenue from fares + public payment.",
    pros: "Maximum private capital at risk. Strongest incentive to perform.",
    cons: "Complex to structure. Requires stable political and regulatory environment.",
    fit: "The structure this feasibility study proposes — phased, outcome-paid, with an 8-year term."
  }
];

export function LegalFramework() {
  return (
    <section className="lf-section" id="legal" aria-labelledby="legal-title">
      <header className="lf-section__head">
        <p className="tk-kicker">PPP, concessions and the politics of approach</p>
        <h2 id="legal-title">Can you have cake and eat it too? Yes — if the contract joins the ledgers.</h2>
        <p className="lf-section__standfirst">
          The skeptics are right about one thing: a farebox-only deal is a bet against the last decade of
          transit finance. The operator sells rides; the city gets safety, cleaner air and less congestion for free.
          If government wants those benefits and the bank wants a repayment story, the contract has to join
          both ledgers. That's not a slogan — it's a structure, and it's spelled out below.
        </p>
      </header>

      {/* Stats */}
      <div className="lf-stats" role="list" aria-label="Legal and financial headline figures">
        {LEGAL_STATS.map((s) => (
          <div key={s.label} role="listitem">
            <strong>{s.value}</strong>
            <span>{s.label}</span>
            {s.note && <small>{s.note}</small>}
          </div>
        ))}
      </div>

      {/* The thesis */}
      <div className="lf-thesis">
        <div>
          <span className="tk-kicker">The thesis</span>
          <h3>Two ledgers, one contract.</h3>
          <p>
            Fare revenue lands on the bus company's books. Safer roads, lower emissions and reduced congestion
            mostly do not. The standard approach — pretend the public benefits will pay for themselves — is the
            bet that fails. The joined-ledger approach: fare covers operating cost and partial debt service; a
            capped public-outcome payment, released only against independently verified additional benefit, fills
            the gap to the lender's coverage test.
          </p>
        </div>
        <div className="lf-ledger-diagram">
          <div className="lf-ledger">
            <span>Operator ledger</span>
            <strong>Fares</strong>
            <strong>Utilisation</strong>
            <strong>Reliability</strong>
            <small>Directly monetisable</small>
          </div>
          <div className="lf-ledger__join">+</div>
          <div className="lf-ledger">
            <span>Public ledger</span>
            <strong>CO₂ avoided</strong>
            <strong>Safer mobility</strong>
            <strong>Road space</strong>
            <small>Measured public value</small>
          </div>
          <div className="lf-ledger__join">=</div>
          <div className="lf-ledger lf-ledger--answer">
            <span>Financeable service</span>
            <strong>One outcome contract</strong>
            <small>Phased capital · verified delivery · shared data</small>
          </div>
        </div>
      </div>

      {/* Risk matrix */}
      <div className="lf-risk">
        <h3 className="lf-subhead">Risk allocation matrix — who bears what, and why</h3>
        <p className="lf-intro-note">
          A credible PPP is not a risk-transfer exercise. It is a risk-assignment exercise: each risk goes to the
          party best able to manage it, with a mechanism to monitor and a mitigation if it breaks. The matrix below
          is the draft for diligence — not the final contract.
        </p>
        <div className="lf-risk-table" role="table" aria-label="Risk allocation matrix">
          <div className="lf-risk-row lf-risk-row--head" role="row">
            <span role="columnheader">Risk</span>
            <span role="columnheader">Who bears</span>
            <span role="columnheader">Mechanism</span>
            <span role="columnheader">Mitigation</span>
          </div>
          {RISK_MATRIX.map((r) => (
            <div className="lf-risk-row" role="row" key={r.risk}>
              <strong role="cell">{r.risk}</strong>
              <span role="cell" className={`lf-risk-bearer lf-risk-bearer--${r.who_bears.toLowerCase()}`}>{r.who_bears}</span>
              <span role="cell">{r.mechanism}</span>
              <span role="cell">{r.mitigation}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Contract types */}
      <div className="lf-contracts">
        <h3 className="lf-subhead">Contract structures — which one fits Phuket?</h3>
        <p className="lf-intro-note">
          Four standard structures. Each allocates risk and incentive differently. The toolkit's recommendation is
          a phased concession (BOOT) with outcome payment — but the choice depends on what the public sector wants
          to own and what the operator can bear.
        </p>
        <div className="lf-contract-grid">
          {CONTRACT_TYPES.map((c) => (
            <article key={c.type} className="lf-contract-card">
              <h4>{c.type}</h4>
              <p className="lf-contract-structure">{c.structure}</p>
              <div className="lf-contract-pros">
                <span className="tk-kicker">Pro</span>
                <p>{c.pros}</p>
              </div>
              <div className="lf-contract-cons">
                <span className="tk-kicker">Con</span>
                <p>{c.cons}</p>
              </div>
              <div className="lf-contract-fit">
                <span className="tk-kicker">Fit</span>
                <p>{c.fit}</p>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* Political pathway */}
      <div className="lf-pathway">
        <h3 className="lf-subhead">The political pathway — eight steps from Governor to lender</h3>
        <p className="lf-intro-note">
          This is not a theoretical list. It is the sequence of decisions and conversations that has to happen,
          in order, before a bus is financed. Each step has an actor, an action and a timeline. Skip one and the
          deal stalls — not because the numbers are wrong, but because the authority was not secured.
        </p>
        <ol className="lf-pathway-list">
          {POLITICAL_PATHWAY.map((p) => (
            <li key={p.step} className="lf-pathway-step">
              <span className="lf-pathway-step__num">{p.step}</span>
              <div className="lf-pathway-step__body">
                <div className="lf-pathway-step__head">
                  <strong>{p.actor}</strong>
                  <span>{p.action}</span>
                  <small>{p.timeline}</small>
                </div>
                <p>{p.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <ResearchPanel
        title="The PPP framework, concession law and outcome-payment precedents"
        stats={LEGAL_STATS}
        citations={PPP_CITATIONS}
      >
        <p>
          Thailand's PPP Act (B.E. 2562 / 2019) provides the legal framework. The World Bank PPP Reference Guide
          (v3, 2024) provides the structuring convention: risk allocation, payment mechanisms, contract design.
          The closest regional precedent for outcome-based payment is ADB's results-based lending pilot (2013–2019):
          19 loans, 11 countries, $4.8bn committed. No transit-specific outcomes-only contract exists yet —
          Peterborough (2010) was a prison. We cite the adjacent fields, not a precedent we don't have.
        </p>
      </ResearchPanel>

      <ResearchPanel
        title="Farebox recovery, green loans and the 'is this financeable?' question"
        stats={[]}
        citations={CONCESSION_CITATIONS}
      >
        <p>
          US transit farebox recovery ranges 13–36% (NTD, 2019 vs 2023–24). A farebox-only deal is a bet against
          that reality. Green Loan Principles (LSTA/APLMA, 2023) explicitly include electric buses as an eligible
          category — so the cost of capital can be lower if the asset is clean. The mock 1.30× DSCR covenant sits
          at the practitioner base case (1.1×–1.5×), not an invented safety margin.
        </p>
      </ResearchPanel>
    </section>
  );
}

export default LegalFramework;