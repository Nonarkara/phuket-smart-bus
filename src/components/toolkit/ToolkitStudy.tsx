import { useState, type CSSProperties } from "react";

const PAIN_POINTS = [
  {
    stage: "Land",
    pain: 2,
    friction: "The aircraft stops. The transport problem has not started yet.",
    observe: "Flight time, gate, baggage and customs release",
    experiment: "Predict the curb-ready wave, not just touchdown"
  },
  {
    stage: "Find",
    pain: 5,
    friction: "Which curb? Which direction? Is that bus actually ours?",
    observe: "Wrong turns, help requests and search time",
    experiment: "Live curb map plus one unmistakable stop marker"
  },
  {
    stage: "Trust",
    pain: 5,
    friction: "A timetable says 10:00. The empty road says something else.",
    observe: "Actual versus promised departure and abandonment",
    experiment: "A countdown driven by the operating clock"
  },
  {
    stage: "Fit",
    pain: 4,
    friction: "A bus arrives. Twenty-five seats turn hope into arithmetic.",
    observe: "Boarded, denied boarding and luggage constraint",
    experiment: "Occupancy estimate and demand-triggered extra duty"
  },
  {
    stage: "Choose",
    pain: 3,
    friction: "Cheap is not persuasive when the alternative feels certain.",
    observe: "Bus-versus-taxi choice, price, time and confidence",
    experiment: "Show total trade-off, not a lonely ฿100 fare"
  },
  {
    stage: "Recover",
    pain: 4,
    friction: "Rain, congestion or a missed connection breaks the neat journey.",
    observe: "Delay propagation and missed onward connections",
    experiment: "Weather-aware ETA and a visible recovery option"
  }
] as const;

const WHAT_IFS = [
  {
    id: "wave",
    tab: "Flight wave +30%",
    shock: "Several wide-body arrivals clear immigration together.",
    symptom: "The queue grows faster than the next two departures can absorb it.",
    test: "Replay the arrival bank against seats minute by minute.",
    move: "Stage an extra bus before the queue appears—not after the complaint arrives.",
    measure: "Wait time, denied boarding and incremental boarded passengers."
  },
  {
    id: "half",
    tab: "Demand is half",
    shock: "The simulator is enthusiastic. Reality is less impressed.",
    symptom: "New buses run below the utilisation promised to the lender.",
    test: "Pilot leased capacity for 90 days across high and low season.",
    move: "Do not purchase the next tranche until utilisation clears the gate.",
    measure: "Passenger revenue per bus-day and cash available for debt service."
  },
  {
    id: "rain",
    tab: "Monsoon +20 min",
    shock: "A wet road turns a tidy timetable into historical fiction.",
    symptom: "Passenger confidence falls before the bus physically fails.",
    test: "Compare scheduled ETA, live ETA and actual arrival by weather state.",
    move: "Add recovery time where delay propagates; explain it before people abandon.",
    measure: "ETA error, abandonment and missed connection rate."
  },
  {
    id: "charger",
    tab: "One charger fails",
    shock: "The fleet is electric. The charger is now the bus depot's single point of drama.",
    symptom: "A vehicle exists on the asset register but not on the road.",
    test: "Run a duty-cycle and charger-availability stress test.",
    move: "Keep a spare charging window and one serviceable backup duty.",
    measure: "Vehicle availability, missed trips and kWh per service-km."
  },
  {
    id: "contract",
    tab: "No public payment",
    shock: "The operator creates public value but receives fare revenue only.",
    symptom: "A socially good project can still miss a bank's coverage test.",
    test: "Separate fare cashflow from verified safety, carbon and access outcomes.",
    move: "Reduce scope, add equity, or contract a capped outcome payment.",
    measure: "DSCR with and without public-benefit revenue."
  }
] as const;

const EVIDENCE_COLUMNS = [
  {
    label: "Know",
    tone: "solid",
    items: ["Published flights", "Official timetable", "฿100 fare", "25-seat capacity", "Road geometry"]
  },
  {
    label: "Model",
    tone: "stripe",
    items: ["3–7% bus intent", "20–45 min clearance", "60 min patience", "Destination shares", "Substitute-trip effect"]
  },
  {
    label: "Measure next",
    tone: "open",
    items: ["Actual boardings", "Denied boarding", "Door-to-door time", "Trip replaced", "True operating cost"]
  }
] as const;

const PROJECT_COST_THB = 40_000_000;
const DEBT_THB = 32_000_000;
const EQUITY_THB = PROJECT_COST_THB - DEBT_THB;
const TERM_YEARS = 8;
const ANNUAL_EV_OPEX_THB = 900_000 * 3;
const DSCR_COVENANT = 1.3;
const PEAK_DAY_ADDITIONAL_RIDERS = 316;

function annualDebtService(principal: number, annualRatePct: number, years: number) {
  const rate = annualRatePct / 100;
  return principal * rate / (1 - (1 + rate) ** -years);
}

function formatMillion(value: number, digits = 1) {
  return `฿${(value / 1_000_000).toFixed(digits)}m`;
}

function DemandWaveDrawing() {
  return (
    <svg viewBox="0 0 360 210" role="img" aria-labelledby="demand-wave-title demand-wave-desc">
      <title id="demand-wave-title">Flights become passenger demand waves</title>
      <desc id="demand-wave-desc">Arrival bars feed through a customs delay into a larger curb-ready passenger wave.</desc>
      <path className="tk-machine-drawing__rule" d="M24 178H336" />
      <path className="tk-machine-drawing__line" d="M34 64h82l22 18h74" />
      <path className="tk-machine-drawing__line" d="m92 45 18 19-18 19M57 52l10 12-10 12" />
      <text x="28" y="28">FLIGHTS LAND</text>
      <text x="224" y="28">CURB READY</text>
      {[38, 76, 114].map((x, index) => <rect key={x} className="tk-machine-drawing__muted" x={x} y={148 - index * 16} width="22" height={30 + index * 16} />)}
      {[230, 264, 298].map((x, index) => <rect key={x} className="tk-machine-drawing__signal" x={x} y={132 - index * 24} width="24" height={46 + index * 24} />)}
      <circle className="tk-machine-drawing__accent" cx="177" cy="82" r="26" />
      <text className="tk-machine-drawing__big" x="177" y="87" textAnchor="middle">20–45</text>
      <text x="177" y="119" textAnchor="middle">MIN CLEARANCE</text>
    </svg>
  );
}

function MovingBusDrawing() {
  return (
    <svg viewBox="0 0 360 210" role="img" aria-labelledby="moving-bus-title moving-bus-desc">
      <title id="moving-bus-title">The simulation positions buses on real road geometry</title>
      <desc id="moving-bus-desc">A clock advances along a curved road line, placing a bus between scheduled stops.</desc>
      <text x="26" y="28">SCHEDULE + CLOCK</text>
      <circle className="tk-machine-drawing__accent" cx="58" cy="72" r="28" />
      <path className="tk-machine-drawing__line" d="M58 53v19l14 9" />
      <text className="tk-machine-drawing__big" x="58" y="121" textAnchor="middle">30×</text>
      <path className="tk-machine-drawing__road" d="M112 168c44-6 36-91 93-92 56-1 50 79 130 45" />
      <circle className="tk-machine-drawing__stop" cx="117" cy="165" r="7" />
      <circle className="tk-machine-drawing__stop" cx="204" cy="76" r="7" />
      <circle className="tk-machine-drawing__stop" cx="332" cy="122" r="7" />
      <g className="tk-machine-drawing__bus" transform="translate(239 106) rotate(24)">
        <rect x="0" y="0" width="58" height="29" />
        <path d="M10 7h29M45 7h6" />
        <circle cx="13" cy="30" r="4" /><circle cx="46" cy="30" r="4" />
      </g>
      <text x="208" y="196" textAnchor="middle">3,944 ROAD POINTS · NOT A STRAIGHT LINE</text>
    </svg>
  );
}

function DecisionLedgerDrawing() {
  return (
    <svg viewBox="0 0 360 210" role="img" aria-labelledby="decision-ledger-title decision-ledger-desc">
      <title id="decision-ledger-title">A fleet decision changes passengers, revenue and public value</title>
      <desc id="decision-ledger-desc">Three extra buses flow through the simulation to more served passengers and fare revenue.</desc>
      <text x="24" y="28">OPERATING MOVE</text>
      <rect className="tk-machine-drawing__accent" x="24" y="51" width="90" height="104" />
      <text className="tk-machine-drawing__hero" x="69" y="100" textAnchor="middle">+3</text>
      <text x="69" y="126" textAnchor="middle">BUSES</text>
      <path className="tk-machine-drawing__line" d="M130 103h52m-13-13 13 13-13 13" />
      <text x="202" y="54">MODEL ANSWERS</text>
      <rect className="tk-machine-drawing__signal" x="202" y="72" width="134" height="35" />
      <rect className="tk-machine-drawing__signal" x="202" y="117" width="105" height="35" />
      <text className="tk-machine-drawing__value" x="212" y="95">+316 PAX</text>
      <text className="tk-machine-drawing__value" x="212" y="140">+฿31,600</text>
      <path className="tk-machine-drawing__rule" d="M24 178H336" />
      <text x="24" y="198">SAME FLIGHTS · SAME DEMAND · DIFFERENT DUTIES</text>
    </svg>
  );
}

export function TryLiveSystem({ busUrl }: { busUrl: string }) {
  const operationsUrl = `${busUrl}ops`;
  const toolkitConsoleUrl = `${operationsUrl}?view=toolkit`;
  const experiments = [
    {
      number: "01",
      title: "Ride it like a passenger",
      copy: "Choose a route. Watch the countdown. Compare the ฿100 bus with the expensive certainty of a taxi.",
      href: busUrl,
      action: "Open passenger view"
    },
    {
      number: "02",
      title: "Run the whole day",
      copy: "Watch flight waves create queues, buses absorb seats and the operating totals climb together.",
      href: operationsUrl,
      action: "Open operations view"
    },
    {
      number: "03",
      title: "Challenge the model",
      copy: "Read every finding beside the assumption, operating signal and decision it produced. Then try to prove it wrong.",
      href: toolkitConsoleUrl,
      action: "Open toolkit console"
    }
  ];

  const mechanics = [
    ["01", "Demand arrives in waves", "Touchdown is not demand. The engine delays each arrival through a 20–45 minute clearance model before passengers reach the curb.", <DemandWaveDrawing />],
    ["02", "The clock moves the fleet", "Published duties meet a 30× operating clock. Each active bus is placed along the actual road polyline between timed stops.", <MovingBusDrawing />],
    ["03", "A decision changes the ledger", "Add capacity and the engine rebuilds duty chains. Served passengers, lost demand, fare revenue and CO₂ respond to the same intervention.", <DecisionLedgerDrawing />]
  ] as const;

  return (
    <section className="tk-try-system" id="try-system">
      <div className="tk-try-system__intro">
        <div><span className="tk-kicker">Your turn · the real working system</span><h2>Do not just read the case. Drive it.</h2></div>
        <div><p>The toolkit explains our thinking. <strong>bus.nonarkara.org</strong> lets you test whether that thinking survives contact with a moving day. No login. No video pretending to be software.</p><a className="tk-try-system__door" href={busUrl}><span>bus.nonarkara.org</span><strong>Open the live system</strong><b>↗</b></a></div>
      </div>

      <div className="tk-try-system__experiments" aria-label="Three experiments to try in the Phuket Smart Bus system">
        {experiments.map((experiment) => (
          <a href={experiment.href} key={experiment.number}>
            <span>{experiment.number}</span><h3>{experiment.title}</h3><p>{experiment.copy}</p><strong>{experiment.action} ↗</strong>
          </a>
        ))}
      </div>

      <section className="tk-live-console" id="working-console" aria-labelledby="working-console-title">
        <header>
          <div><span className="tk-kicker">The research, now operational</span><h2 id="working-console-title">This is what “more than a report” looks like.</h2></div>
          <div><p>The archive explains how the partnership reached its conclusions. The console shows what those conclusions became: a thesis, falsifiable questions, operating assumptions, ranked actions, known gaps and the data needed next.</p><a href={toolkitConsoleUrl}>Open the full toolkit console <b>↗</b></a></div>
        </header>
        <div className="tk-live-console__frame">
          <div className="tk-live-console__bar"><span><i /> LIVE WORKING SYSTEM</span><strong>bus.nonarkara.org/ops?view=toolkit</strong><a href={toolkitConsoleUrl}>Open full screen ↗</a></div>
          <iframe
            src={toolkitConsoleUrl}
            title="Interactive Phuket Smart Bus toolkit and operations console"
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
        <footer><span>Read</span><strong>Research finding</strong><b>→</b><span>Translate</span><strong>Measurable assumption</strong><b>→</b><span>Operate</span><strong>Signal + decision</strong></footer>
      </section>

      <div className="tk-machine">
        <div className="tk-machine__heading"><span className="tk-kicker">Open the bonnet</span><h2>Three mechanics worth kicking.</h2><p>The screen is only the last inch. Here is the machinery underneath it.</p></div>
        <div className="tk-machine__drawings">
          {mechanics.map(([number, title, copy, drawing]) => (
            <article key={number}><div>{drawing}</div><span>{number}</span><h3>{title}</h3><p>{copy}</p></article>
          ))}
        </div>
        <div className="tk-machine__handoff"><strong>Today</strong><span>schedule simulation</span><b>→</b><strong>Next</strong><span>direct GPS + seat cameras</span><b>→</b><strong>Same interface</strong><span>real operating decisions</span></div>
      </div>
    </section>
  );
}

function DesignJourney() {
  return (
    <div className="tk-pain-map" role="img" aria-label="Hypothesis map of pain across the airport-to-bus journey">
      <div className="tk-pain-map__axis"><span>low friction</span><strong>Hypothesis strength</strong><span>high friction</span></div>
      <div className="tk-pain-map__plot">
        {PAIN_POINTS.map((point) => (
          <article key={point.stage}>
            <div className="tk-pain-map__mark" style={{ height: `${point.pain * 18}%`, "--pain": point.pain } as CSSProperties}><b>{point.pain}/5</b></div>
            <h3>{point.stage}</h3>
            <p>{point.friction}</p>
            <dl><dt>Watch</dt><dd>{point.observe}</dd><dt>Try</dt><dd>{point.experiment}</dd></dl>
          </article>
        ))}
      </div>
      <p className="tk-study-note">These are research priorities, not survey results. The score says where to look first; field observation decides whether it survives.</p>
    </div>
  );
}

function EvidenceLadder() {
  return (
    <div className="tk-evidence-ladder">
      {EVIDENCE_COLUMNS.map((column, index) => (
        <div className={`tk-evidence-ladder__column tk-evidence-ladder__column--${column.tone}`} key={column.label}>
          <span>0{index + 1}</span><h3>{column.label}</h3>
          <ul>{column.items.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      ))}
      <div className="tk-evidence-ladder__verdict"><strong>Do not confuse them.</strong><span>Facts can support a loan. Assumptions can design a pilot. Missing measurements can stop both.</span></div>
    </div>
  );
}

function WhatIfStudio() {
  const [activeId, setActiveId] = useState<(typeof WHAT_IFS)[number]["id"]>("half");
  const active = WHAT_IFS.find((item) => item.id === activeId) ?? WHAT_IFS[0];
  return (
    <div className="tk-whatif">
      <div className="tk-whatif__tabs" aria-label="Choose a what-if scenario">
        {WHAT_IFS.map((item) => (
          <button key={item.id} type="button" aria-pressed={active.id === item.id} onClick={() => setActiveId(item.id)}>{item.tab}</button>
        ))}
      </div>
      <div className="tk-whatif__story" aria-live="polite">
        <div><span>Shock</span><strong>{active.shock}</strong></div>
        <div><span>Pain</span><strong>{active.symptom}</strong></div>
        <div><span>Cheap test</span><strong>{active.test}</strong></div>
        <div className="tk-whatif__move"><span>Operating move</span><strong>{active.move}</strong><small>Prove it with: {active.measure}</small></div>
      </div>
    </div>
  );
}

export function DesignThinkingStudy() {
  return (
    <section className="tk-section tk-design-study" id="pain-map">
      <div className="tk-section__intro">
        <span className="tk-kicker">Design thinking, with its shoes on</span>
        <h2>Start with the awkward minute.</h2>
        <p>“People need transport” is too vague to build. We break the journey into moments, locate uncertainty, write down what would prove us wrong, then build the cheapest experiment that changes an operating decision.</p>
      </div>
      <DesignJourney />
      <div className="tk-study-split">
        <div><span className="tk-kicker">Evidence hygiene</span><h2>Know. Model. Measure.</h2><p>A confident dashboard can hide three very different things. Good design gives each one its own visual grammar—and its own permission level.</p></div>
        <EvidenceLadder />
      </div>
      <div className="tk-whatif-intro"><span className="tk-kicker">What-if theatre, minus the theatre</span><h2>Break it here, cheaply.</h2><p>The point of a scenario is not to predict the future. It is to expose which assumption can bankrupt the idea, embarrass the operator or strand a passenger.</p></div>
      <WhatIfStudio />
    </section>
  );
}

function FeasibilityBridge() {
  const steps = [
    ["Market", "17.5m", "HKT passenger movements · AOT 2025", "Observed"],
    ["Local proof", "230/day", "Dragon Line average · Phuket report", "Observed"],
    ["Operating proof", "6 EV", "Patong route buses already launched", "Observed"],
    ["Expansion case", "+316", "passengers on a peak model day with +3 buses", "Modelled"],
    ["Decision", "90 days", "instrumented pilot before full drawdown", "Proposed"]
  ];
  return (
    <div className="tk-feasibility-bridge" aria-label="Evidence bridge from market demand to financing decision">
      <div className="tk-feasibility-bridge__rail">
        {steps.map(([label, value, note, status], index) => (
          <div className="tk-feasibility-bridge__step" key={label}>
            <span>{status}</span><strong>{value}</strong><h3>{label}</h3><small>{note}</small>{index < steps.length - 1 && <b>→</b>}
          </div>
        ))}
      </div>
      <p className="tk-study-note">Two official movement totals differ: AOT reports 106,585 for 2025; AEROTHAI's monthly series sums to 107,157. The 0.5% gap is small—but reconciling definitions belongs in diligence, not under the carpet.</p>
    </div>
  );
}

function FinanceLab() {
  const [realisationPct, setRealisationPct] = useState(70);
  const [interestPct, setInterestPct] = useState(4);
  // Keep the credit memo tied to its disclosed peak-day reference case.
  // The live scenario varies by simulation weekday; a loan case must not.
  const annualPeakFare = PEAK_DAY_ADDITIONAL_RIDERS * 100 * 365;
  const realisedFare = annualPeakFare * realisationPct / 100;
  const cashForDebt = realisedFare - ANNUAL_EV_OPEX_THB;
  const debtService = annualDebtService(DEBT_THB, interestPct, TERM_YEARS);
  const dscr = Math.max(0, cashForDebt / debtService);
  const targetCash = debtService * DSCR_COVENANT;
  const supportGap = Math.max(0, targetCash - cashForDebt);
  const barMax = Math.max(annualPeakFare, targetCash, 1);
  const sensitivities = [50, 70, 100].map((pct) => {
    const cash = annualPeakFare * pct / 100 - ANNUAL_EV_OPEX_THB;
    return { pct, dscr: Math.max(0, cash / debtService) };
  });

  return (
    <div className="tk-finance-lab">
      <div className="tk-finance-lab__controls">
        <label><span>Demand realised <strong>{realisationPct}%</strong></span><input type="range" min="40" max="100" step="5" value={realisationPct} onInput={(event) => setRealisationPct(Number(event.currentTarget.value))} /></label>
        <label><span>Interest stress <strong>{interestPct.toFixed(2)}%</strong></span><input type="range" min="4" max="8.5" step="0.25" value={interestPct} onInput={(event) => setInterestPct(Number(event.currentTarget.value))} /></label>
      </div>
      <div className="tk-finance-lab__plot" aria-label="Annual cash waterfall and debt service coverage">
        {[
          ["Peak-model fare upside", annualPeakFare, "gross"],
          [`Fare at ${realisationPct}%`, realisedFare, "realised"],
          ["Cash after EV operating cost", cashForDebt, "cash"],
          ["Annual debt service", debtService, "debt"],
          ["Cash needed for 1.30× DSCR", targetCash, "target"]
        ].map(([label, rawValue, tone]) => {
          const value = Number(rawValue);
          return <div className={`tk-finance-bar tk-finance-bar--${tone}`} key={String(label)}><span>{label}</span><i style={{ width: `${Math.max(2, value / barMax * 100)}%` }} /><strong>{formatMillion(value, 2)}</strong></div>;
        })}
      </div>
      <div className="tk-finance-lab__answer">
        <div><span>Coverage</span><strong>{dscr.toFixed(2)}×</strong><small>{dscr >= DSCR_COVENANT ? "Clears the mock 1.30× covenant." : "Does not yet clear the mock covenant."}</small></div>
        <div><span>Outcome-payment gap</span><strong>{supportGap > 0 ? formatMillion(supportGap, 2) : "฿0"}</strong><small>{supportGap > 0 ? "Annual capped support needed to reach 1.30×." : "Fare cashflow carries the tested debt case."}</small></div>
      </div>
      <div className="tk-dscr-sensitivity" aria-label="Debt service coverage at three demand realisation levels">
        {sensitivities.map((item) => <div key={item.pct}><span>{item.pct}% demand</span><i style={{ height: `${Math.min(100, item.dscr / 2 * 100)}%` }} /><strong>{item.dscr.toFixed(2)}×</strong><small>{item.dscr >= DSCR_COVENANT ? "cover" : "gap"}</small></div>)}
        <b style={{ bottom: `${DSCR_COVENANT / 2 * 100}%` }}>1.30× lender gate</b>
      </div>
      <p className="tk-study-note">Illustrative, pre-tax and deliberately simple. Peak-day fare upside is annualised then discounted by the demand slider. It excludes working capital, residual value, tax, insurance, charger electricity and any fare change. This is a diligence instrument—not a credit offer.</p>
    </div>
  );
}

function MockCreditMemo() {
  const terms = [
    ["Borrower", "Phuket Smart Bus or ring-fenced project SPV · subject to lender KYC"],
    ["Purpose", "Three electric buses, charging allowance, GPS, passenger counting and driver training"],
    ["Project cost", `${formatMillion(PROJECT_COST_THB, 0)} · 3 × ฿12m OTP benchmark + ฿4m project allowance`],
    ["Capital stack", `${formatMillion(DEBT_THB, 0)} senior term loan + ${formatMillion(EQUITY_THB, 0)} sponsor equity`],
    ["Tenor / test", `${TERM_YEARS} years · modelled at 4.00% green-loan floor and 7.07% MLR stress`],
    ["Drawdown", "20% on order; balance in tranches after GPS, route permit, charger and utilisation gates"],
    ["Repayment source", "Incremental farebox cashflow; capped public-outcome payment only for independently verified additional benefit"],
    ["Mock covenant", "Minimum 1.30× DSCR, ≥98% telemetry completeness, published reliability and monthly passenger reconciliation"],
    ["Recommendation", "Conditional proceed to a 90-day instrumented pilot and lender diligence. Not full credit approval." ]
  ];
  return (
    <article className="tk-credit-memo">
      <header><span>Mock executive summary · discussion draft</span><strong>Phuket demand-responsive EV bus expansion</strong><b>CONDITIONAL PROCEED</b></header>
      <div className="tk-credit-memo__thesis"><p><strong>The opportunity:</strong> Phuket has airport scale, an operating bus company and existing EV service proof.</p><p><strong>The problem:</strong> the simulator's demand is not collateral. Instrumented ridership and cost evidence must turn it into one.</p></div>
      <dl>{terms.map(([term, value]) => <div key={term}><dt>{term}</dt><dd>{value}</dd></div>)}</dl>
      <footer><strong>What the credit committee should ask:</strong><span>Who pays when demand is 70% of model? What asset is recoverable? Which public outcomes are independently auditable? What happens when one charger fails?</span></footer>
    </article>
  );
}

function DeliveryPlan() {
  const phases = [
    ["0–30 days", "Instrument", "GPS, counts, trip cost, denied boarding, baseline"],
    ["31–90", "Pilot", "Lease or flex three peak duties; compare matched days"],
    ["Month 4", "Credit gate", "Independent model reconciliation and asset quotes"],
    ["Months 5–12", "Tranche 1", "Deploy buses; report reliability and DSCR monthly"],
    ["Year 2", "Scale or stop", "Release next capital only if outcomes survive reality"]
  ];
  return <div className="tk-delivery-plan" aria-label="Phased delivery and financing plan">{phases.map(([time, title, copy], index) => <div key={title}><span>{time}</span><b>{index + 1}</b><strong>{title}</strong><small>{copy}</small></div>)}</div>;
}

export function FeasibilityStudy() {
  return (
    <section className="tk-section tk-feasibility" id="feasibility">
      <div className="tk-section__intro tk-section__intro--dark">
        <span className="tk-kicker">Mini feasibility study · July 2026</span>
        <h2>Can Phuket make this real?</h2>
        <p>Technically: yes. Operationally: pilot it. Financially: conditional. The honest proposal is not “buy buses because buses are good.” It is “buy measured capacity in stages because a visible demand gap can repay part of the asset—and contract the public value separately.”</p>
      </div>
      <FeasibilityBridge />
      <div className="tk-feasibility__intro"><span className="tk-kicker">The bankability test</span><h2>A good project can still be a bad loan.</h2><p>The sliders expose the two variables a credit committee will attack first: how much modeled demand becomes cash, and what the money costs.</p></div>
      <FinanceLab />
      <MockCreditMemo />
      <div className="tk-feasibility__intro"><span className="tk-kicker">Signed, sealed, delivered—in tranches</span><h2>Five gates. One escape hatch.</h2><p>If evidence fails, stop. A smaller loss teaches more than a fully financed mistake.</p></div>
      <DeliveryPlan />
      <div className="tk-feasibility__sources">
        <a href="https://www.airportthai.co.th/wp-content/uploads/2026/06/ANNUAL-REPORT-2025.pdf"><strong>AOT 2025 report</strong><span>17.5m HKT passengers · 106,585 movements ↗</span></a>
        <a href="https://www.phuket.go.th/webpk/file_data/hilight/hilight2567.pdf"><strong>Phuket 2024 highlights</strong><span>Dragon Line ridership · six EV buses ↗</span></a>
        <a href="https://www.otp.go.th/uploads/tiny_uploads/ProjectOTP/2560/Project17/4-DevelopmentofaFundingMechanism.pdf"><strong>OTP clean-mobility study</strong><span>฿12m EV bus · ฿0.9m annual operating benchmark ↗</span></a>
        <a href="https://sme.krungthai.com/sme/productListAction.action?cateId=14&cateMenu=PRODUCT&command=getDetail&itemId=438"><strong>Krungthai ESG loan</strong><span>from 4% · up to 10 years · eligibility applies ↗</span></a>
        <a href="https://www.bot.or.th/content/dam/bot/documents/en/our-roles/monetary-policy/mpc-publication/monetary-policy-report/MPR_2026_Q1.pdf"><strong>Bank of Thailand</strong><span>7.07% average MLR · April 2026 ↗</span></a>
      </div>
    </section>
  );
}
