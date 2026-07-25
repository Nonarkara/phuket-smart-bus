/**
 * The short argument that earns the long research.
 *
 * The page begins with the passenger task, then follows the signal through
 * operations, public authority and finance. Claims are labelled so a reader
 * can distinguish what is observed, what the simulator calculates and what
 * still needs a pilot.
 */

type Beat = {
  number: string;
  label: string;
  status: "Observed" | "Modelled" | "Build-ready" | "Proposed" | "Due diligence";
  title: string;
  body: string;
  proof: string;
  href: string;
  link: string;
};

const BEATS: Beat[] = [
  {
    number: "01",
    label: "Passenger promise",
    status: "Observed",
    title: "First answer the person standing outside arrivals.",
    body: "When is the next bus? Where does it leave? How long to Patong? The phone screen reads the published airport timetable and keeps those answers above everything else.",
    proof: "The live countdown is calculated from the same departure array used by the fleet simulator.",
    href: "https://bus.nonarkara.org/",
    link: "Try the passenger screen"
  },
  {
    number: "02",
    label: "Requested drop-off",
    status: "Proposed",
    title: "A hotel name becomes an operating instruction.",
    body: "The passenger names a hotel, beach or area. The request reaches the driver tablet, which confirms a safe pull-over on the serviced corridor. Flexible does not mean stopping blindly in traffic.",
    proof: "The prototype captures the destination today. Driver acknowledgement and safe-stop rules are pilot requirements.",
    href: "https://bus.nonarkara.org/",
    link: "Test the destination flow"
  },
  {
    number: "03",
    label: "Payment",
    status: "Proposed",
    title: "Sell one ride simply. Sell three days without inventing another wallet.",
    body: "The prototype offers a ฿100 single ride and a mock 72-hour pass. Production should hand card entry to a hosted payment page and add PromptPay or EMV only after the operator chooses settlement, refunds and fraud rules.",
    proof: "No live card is charged. The page demonstrates the transaction and boarding-token contract, not a finished acquiring agreement.",
    href: "https://bus.nonarkara.org/",
    link: "Walk through the mock checkout"
  },
  {
    number: "04",
    label: "Authority",
    status: "Due diligence",
    title: "The app can be built before the concession. The service cannot.",
    body: "Before fleet finance comes route authority, curb access, fare approval, insurance, data responsibilities and a contract long enough to repay the assets. Software does not make those questions disappear. It makes them visible sooner.",
    proof: "The feasibility chapter separates the operating case from the approvals and contracts still requiring legal review.",
    href: "#feasibility",
    link: "Inspect the feasibility case"
  },
  {
    number: "05",
    label: "Fleet duties",
    status: "Modelled",
    title: "One bus is two directions, a layover and a promise to come back.",
    body: "The same airport fleet rotates southbound and northbound. The engine follows each duty along real road geometry, accounts for the turnaround and keeps demand separate in both directions.",
    proof: "Published timetable + 3,944-point route geometry + one simulated clock. No decorative vehicle dots.",
    href: "https://bus.nonarkara.org/ops",
    link: "Watch the fleet move"
  },
  {
    number: "06",
    label: "Devices",
    status: "Build-ready",
    title: "GPS tells us where. A tablet tells the driver why. A counter tells us how full.",
    body: "Start with three instruments, not a shopping catalogue: vehicle position, a driver task screen and anonymous boarding/alighting counts. Each feed has a job and an ingest path already waiting in the production backend.",
    proof: "Telemetry, seat, driver-attention and passenger-flow types and endpoints already exist in this repository.",
    href: "#proof",
    link: "Trace research into code"
  },
  {
    number: "07",
    label: "Privacy",
    status: "Proposed",
    title: "Count people. Do not identify them.",
    body: "An overhead or doorway counter should emit boarding and alighting events, confidence and device health—not faces. Keep images on the device where possible; transmit counts; set retention to the minimum needed for calibration.",
    proof: "This is the privacy design constraint for the pilot. A vendor and PDPA review still have to prove the implementation.",
    href: "#proof",
    link: "Read the evidence discipline"
  },
  {
    number: "08",
    label: "Dispatch",
    status: "Proposed",
    title: "The clever bit is not more buses. It is the right bus in the right hour.",
    body: "Flight arrivals create waves. Destination requests reveal where they want to go. Seats and boarding counts reveal what the fleet can absorb. Dispatch changes only when the measured gap survives all three checks.",
    proof: "The operations console shows inbound and airport-bound demand separately so one direction cannot hide the other.",
    href: "https://bus.nonarkara.org/ops",
    link: "Open missed money by hour"
  },
  {
    number: "09",
    label: "Partners",
    status: "Proposed",
    title: "A voucher is useful only when somebody can settle it.",
    body: "Hotels, attractions and restaurants can subsidise or bundle rides, but the operational questions come first: who issued the benefit, who redeemed it, what journey occurred and who owes whom at the end of the day.",
    proof: "The token can carry an offer ID. Partner contracts, reconciliation and abuse controls remain outside this prototype.",
    href: "#method",
    link: "See the system method"
  },
  {
    number: "10",
    label: "Finance",
    status: "Modelled",
    title: "Do not finance the conclusion. Finance the next test.",
    body: "The current model is a conditional case, not a purchase order. Instrument a 90-day pilot, measure reliability, boarding, denied demand, trip cost and repayment coverage, then release fleet capital only when the agreed gates hold.",
    proof: "The finance chapter exposes the modelled DSCR and support gap; the pilot is designed to replace assumptions with records.",
    href: "#feasibility",
    link: "Stress-test the deal"
  }
];

const HEADLINE_STATS = [
  { value: "17.5m", label: "HKT passenger movements", note: "observed · AOT 2025" },
  { value: "20", label: "airport departures in the timetable", note: "observed · current fixture" },
  { value: "25", label: "seats per airport bus", note: "modelled capacity" },
  { value: "90 days", label: "instrumented pilot", note: "proposed decision" }
];

const SIGNAL_CHAIN = [
  ["Passenger", "destination + pass"],
  ["Driver", "safe drop-off request"],
  ["Vehicle", "GPS + anonymous count"],
  ["Operator", "queue, load + dispatch"],
  ["Lender / city", "verified outcome"]
] as const;

export function LandingPage() {
  return (
    <section className="lp-landing" id="landing" aria-labelledby="lp-title">
      <header className="lp-hero">
        <p className="tk-kicker lp-hero__kicker">depa · USASCP Sustainable Mobility Programme · research translated into a working system</p>
        <h1 id="lp-title" className="lp-hero__title">
          What if an airport passenger can find the bus, name the hotel and get a ticket in one minute?
        </h1>
        <p className="lp-hero__sub">
          Good. Now follow that tiny decision all the way through the driver,
          the fleet, the city and the bank. The passenger gets one simple screen.
          The system gets evidence it can use.
        </p>
        <div className="lp-hero__status" aria-label="Evidence status legend">
          <span><b>Observed</b> cited or published record</span>
          <span><b>Modelled</b> calculated by this repository</span>
          <span><b>Proposed</b> still needs a decision or pilot</span>
        </div>
        <div className="lp-hero__stats" role="list" aria-label="Headline evidence">
          {HEADLINE_STATS.map((stat) => (
            <div key={stat.label} role="listitem">
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
              <small>{stat.note}</small>
            </div>
          ))}
        </div>
        <div className="lp-hero__actions">
          <a className="lp-btn lp-btn--primary" href="https://bus.nonarkara.org/">
            Try the passenger screen <span>↗</span>
          </a>
          <a className="lp-btn" href="#five-minute">
            Follow the whole system <span>↓</span>
          </a>
        </div>
      </header>

      <section className="lp-signal" aria-labelledby="lp-signal-title">
        <div className="lp-signal__intro">
          <p className="tk-kicker">One screen · five consequences</p>
          <h2 id="lp-signal-title">A ticket is not the end of the journey. It is the first useful signal.</h2>
          <p>
            The design stays simple because the machinery behind it is explicit.
            Each handoff creates a record, and each record answers a different decision.
          </p>
        </div>
        <ol className="lp-signal__chain" aria-label="Passenger action to verified outcome">
          {SIGNAL_CHAIN.map(([actor, signal], index) => (
            <li key={actor}>
              <small>{String(index + 1).padStart(2, "0")}</small>
              <strong>{actor}</strong>
              <span>{signal}</span>
              {index < SIGNAL_CHAIN.length - 1 && <b aria-hidden="true">→</b>}
            </li>
          ))}
        </ol>
      </section>

      <section className="lp-arg" id="five-minute" aria-labelledby="lp-arg-title">
        <header className="lp-arg__head">
          <p className="tk-kicker">The five-minute build sequence</p>
          <h2 id="lp-arg-title">Ten questions. In order. Then we are ready to test—not ready to buy buses.</h2>
          <p className="lp-arg__sub">
            Read the label on every card. “Observed” is evidence. “Modelled” is
            a calculation. “Proposed” is work still owed. Mixing those three is
            how a sensible pilot turns into a very expensive press release.
          </p>
        </header>

        <ol className="lp-cards" role="list">
          {BEATS.map((beat) => (
            <li key={beat.number} className="lp-card">
              <div className="lp-card__head">
                <span className="lp-card__num">{beat.number}</span>
                <span className="lp-card__label">{beat.label}</span>
                <span className={`lp-card__status lp-card__status--${beat.status.toLowerCase().replace("-", "-").replace(" ", "-")}`}>
                  {beat.status}
                </span>
              </div>
              <h3 className="lp-card__title">{beat.title}</h3>
              <p className="lp-card__body">{beat.body}</p>
              <div className="lp-card__proof">
                <span className="tk-kicker">What proves it—or still has to</span>
                <p>{beat.proof}</p>
                <a href={beat.href} className="lp-card__link">
                  {beat.link} <span>↗</span>
                </a>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="lp-handover" aria-labelledby="lp-handover-title">
        <div className="lp-handover__copy">
          <p className="tk-kicker">The full research</p>
          <h2 id="lp-handover-title">That was the front door. The evidence room is downstairs.</h2>
          <p>
            The long read keeps the Phuket context, Las Vegas comparison,
            fieldwork, method, causal tests, live model, feasibility study and
            the people who made the work possible. Dense material gets room to
            breathe. The argument above tells you why each chapter exists.
          </p>
        </div>
        <div className="lp-handover__buttons">
          <a className="lp-btn lp-btn--primary" href="#phuket">Open the full research <span>↓</span></a>
          <a className="lp-btn" href="https://bus.nonarkara.org/ops">Run the operations console <span>↗</span></a>
        </div>
        <ol className="lp-handover__chapters" role="list" aria-label="Full research chapters">
          <li><span>01</span><div><strong>Phuket</strong><em>the place and the problem</em></div></li>
          <li><span>02</span><div><strong>Vegas</strong><em>the comparison and its limits</em></div></li>
          <li><span>03</span><div><strong>Brief</strong><em>the conditional recommendation</em></div></li>
          <li><span>04</span><div><strong>Method</strong><em>how findings become instruments</em></div></li>
          <li><span>05</span><div><strong>Proof</strong><em>the working system and ledger</em></div></li>
          <li><span>06</span><div><strong>Feasibility</strong><em>the pilot, finance and exit doors</em></div></li>
        </ol>
      </section>
    </section>
  );
}

export default LandingPage;
