/**
 * RejectedAlternatives — the paths the team considered and discarded.
 *
 * A research site earns trust by showing the road not taken. Every
 * "obvious" alternative was considered in the workshops. Each one
 * failed a specific test: too expensive, too slow to build, no path
 * to scale, no policy authority, or no farebox. This panel is the
 * full set, with the one-line reason each was rejected and the
 * source for that reason.
 *
 * The point is not "we considered everything" — that is theatre. The
 * point is: when a reader proposes one of these as if it were new,
 * the answer is here in one line. Saves a meeting.
 */

type Rejected = {
  number: string;
  name: string;
  pitch: string;
  why_it_sounded_good: string;
  what_kills_it: string;
  source: string;
};

const REJECTED: Rejected[] = [
  {
    number: "01",
    name: "Light rail / monorail on the airport corridor",
    pitch: "The 'real' transit solution. A dedicated right-of-way, 80 km/h vehicles, the brand image of a city.",
    why_it_sounded_good: "Tourists know what a monorail looks like. It photographs well. It also signals municipal seriousness to lenders.",
    what_kills_it: "Las Vegas built a US$650M monorail for 3.9 miles of Strip. It went bankrupt twice and sold for US$24.3M in 2020. Capex per rider is ~30× the bus. The corridor is 32 km — same as a city bus does today. Vehicle that fits the corridor wins, not the one that wins design awards.",
    source: "Las Vegas Monorail bankruptcy filings 2010, 2020; FTA Capital Cost Database"
  },
  {
    number: "02",
    name: "Subsidise Grab / ride-hail instead of building a bus",
    pitch: "No capex. The system already works. Just top up the fare so it is cheaper than the taxi.",
    why_it_sounded_good: "Politicians like subsidies — they are visible, they cost less in year 1, and they don't require a procurement process.",
    what_kills_it: "Subsidising ride-hail makes the dependency permanent. Vegas proved the bus works first; the subsidy came after Uber ate the margin. Phuket has one legal ride-hail operator (Grab) and a second (Bolt since 2023). The window to put a bus on the corridor before the ride-hail companies own it is open now. It will not be open in five years.",
    source: "Las Vegas RTC Deuce P&L 2010–2018; Phuket PAO ride-hail licensing records 2023"
  },
  {
    number: "03",
    name: "Do nothing — let the market solve it",
    pitch: "Phuket has worked without an airport bus for 20 years. The tourists manage.",
    why_it_sounded_good: "It is the default. No procurement, no risk, no political exposure. Every year without a decision is a year without a failure.",
    what_kills_it: "WHO road-death data: Thailand is 9th highest globally; 83.8% of road deaths are motorcyclists. In Phuket 92.7% of accidents involve a motorbike. The status quo transfers a 25.4-per-100k mortality risk to the tourist who rents one. 'Let the market solve it' means 'let the tourist die on a 125cc scooter'. The market does not price that risk correctly.",
    source: "WHO Global Status Report on Road Safety 2023; Phuket Provincial Police accident data 2022"
  },
  {
    number: "04",
    name: "Electric tuk-tuk network on the corridor",
    pitch: "Local, low-capex, zero-emission, friendly. The Thailand brand.",
    why_it_sounded_good: "Tuk-tuks are an icon. They are electric-compatible at small scale. The driver economics are better than buses (one driver, one vehicle, no duty cycle).",
    what_kills_it: "Three-seat vehicles on a 32-km airport corridor cannot carry the demand. At 6 trips/day each, the tuk-tuk fleet would need ~600 vehicles to clear the worst hour — versus 10 buses. No farebox scale. Range anxiety on the airport leg. The brand is right, the unit economics are not.",
    source: "Phuket PAO airport passenger throughput 2024; tuk-tuk range tests (TOA 2023)"
  },
  {
    number: "05",
    name: "Public operator (PAO runs the bus themselves)",
    pitch: "Keep the fare inside the public sector. No private profit, no concession.",
    why_it_sounded_good: "It is the moral position. The bus serves the public, so the public should run it. Eliminates the 'private operator earns from public service' framing that critics use.",
    what_kills_it: "Bangkok's BMTA — the same structure — needs a ฿40B bailout roughly every five years. Public operators do not have the balance sheet to issue bonds for the fleet, do not have the operating expertise to run a 25-vehicle EV duty cycle, and do not have the procurement speed to install chargers on a 12-month timeline. The capital is private. The route authority is a concession, not a purchase. The bankability test is whether farebox cashflow plus a capped public-outcome payment clears the lender's 1.30× DSCR.",
    source: "BMTA annual reports 2018–2024; World Bank PPP Reference Guide v3, 2024"
  }
];

export function RejectedAlternatives() {
  return (
    <section className="ra-section" aria-labelledby="ra-title">
      <header className="ra-section__head">
        <p className="tk-kicker">What got rejected · the road not taken</p>
        <h2 id="ra-title">Five alternatives considered, five reasons rejected. Saves a meeting.</h2>
        <p>
          Every "obvious" alternative below was raised in the workshops —
          in Jakarta, Los Angeles, Phuket and Boston. Each one failed a
          specific test: too expensive, too slow to build, no path to
          scale, no policy authority, or no farebox. When a reader
          proposes one of these as if it were new, the answer is here
          in one line.
        </p>
      </header>

      <ol className="ra-list" role="list">
        {REJECTED.map((r) => (
          <li key={r.number} className="ra-item">
            <header className="ra-item__head">
              <span className="ra-item__num">{r.number}</span>
              <h3>{r.name}</h3>
            </header>

            <div className="ra-item__body">
              <div className="ra-item__col">
                <span className="tk-kicker">The pitch</span>
                <p>{r.pitch}</p>
              </div>

              <div className="ra-item__col">
                <span className="tk-kicker">Why it sounded good</span>
                <p>{r.why_it_sounded_good}</p>
              </div>

              <div className="ra-item__col ra-item__col--kill">
                <span className="tk-kicker">What kills it</span>
                <p>{r.what_kills_it}</p>
              </div>
            </div>

            <p className="ra-item__source">
              <span className="tk-kicker">Sourced from</span>
              {r.source}
            </p>
          </li>
        ))}
      </ol>

      <p className="ra-signoff">
        <strong>The decision rule.</strong> If an alternative does not
        move the bus-capture rate by at least 2 percentage points
        relative to status quo, it is noise. Every option above fails
        that test. The bus passes it.
      </p>
    </section>
  );
}

export default RejectedAlternatives;
