/**
 * CriticalReading — the academic-honesty panel.
 *
 * For the careful reader (a PhD, a lender's analyst, a journalist) the
 * most useful page on a research site is the one that admits what it
 * does not know. This panel answers the questions a referee would ask:
 *
 *   1. What does the model not capture?
 *   2. Which assumptions are load-bearing and what evidence would
 *      change them?
 *   3. What counter-arguments did we hear, and how did we answer them?
 *   4. What questions remain open and would require a pilot to answer?
 *
 * The point is not to look humble. The point is to be useful — a
 * lender who can read the limitations is more likely to underwrite
 * the pilot than a lender who can only read the headline.
 */

type Limitation = {
  number: string;
  what: string;
  why: string;
  what_changes_it: string;
};

const LIMITATIONS: Limitation[] = [
  {
    number: "01",
    what: "The simulator does not model the in-vehicle experience.",
    why: "Time, cost, and safety are captured. The way a passenger actually feels about a 95-minute ride — comfortable seats, working air-con, polite driver — is not in any of the model inputs. It is, however, in the re-ride decision.",
    what_changes_it: "A 90-day instrumented pilot that records repeat-boarding rate per customer, not just first-boarding count."
  },
  {
    number: "02",
    what: "The 5% fleet-wide capture rate is a heuristic, not a measurement.",
    why: "It averages SE-Asia 7%, China 4%, Europe 3%, India 5%, Russia/CIS 3% — defensible stereotypes from observable Phuket ground-transport behaviour, but never a measured ridership number. The day PKSB shares a week of real boarding counts, this number becomes calibrated and every ฿ figure sharpens with it.",
    what_changes_it: "PKSB boarding counts by nationality, with ticket-type and time of day, for at least one full week of typical operations."
  },
  {
    number: "03",
    what: "The Vegas comparison is structurally right but numerically stale.",
    why: "Vegas in 2005 had 38M visitors, a 4-mile Strip, zero ride-hailing, and a $6M/yr profitable corridor by year 3. Phuket in 2025 has 17.4M arrivals, a 32-km airport corridor, an entrenched Grab monopoly, and no public airport bus. The transfer is real but the coefficients are not 1:1 — Phuket is colder than Vegas was at launch, and the policy environment is different.",
    what_changes_it: "A Phuket-specific Origin & Destination survey of 2,000+ arriving passengers, weighted by hour and nationality."
  },
  {
    number: "04",
    what: "The financial model ignores tax, working capital, residual value, and insurance.",
    why: "The feasibility study says so on the page, but it is worth repeating: this is a diligence instrument, not a credit offer. The headline payback is illustrative.",
    what_changes_it: "A bank-grade model with PKT-specific tax treatment, residual-value assumptions for the EV fleet, and an insurance schedule."
  },
  {
    number: "05",
    what: "The monsoon and accident data are the most likely place for the future to break the model.",
    why: "Climate is shifting. The 2,200 mm/year rainfall normal is from the 30-year TMD record. The 320 mm in 4 hours in June 2024 was an orographic-lift event whose frequency distribution is not yet in the simulator.",
    what_changes_it: "Annual updates of the rainfall distribution and a 5-year forward look at road-flooding frequency."
  }
];

const COUNTER_ARGUMENTS: { argument: string; response: string }[] = [
  {
    argument: "Why buses? Phuket is small enough for cars, and the tourists will rent motorbikes anyway.",
    response: "WHO road-death data: Thailand is 9th highest globally; 83.8% of deaths are motorcyclists. In Phuket 92.7% of accidents involve a motorbike. The bus is the option that does not transfer a 25.4-per-100k mortality risk to its rider. The tourist will rent a motorbike only if no safe alternative exists."
  },
  {
    argument: "Just subsidise Grab — it works today, no capex.",
    response: "Subsidising Grab makes the dependency permanent. Vegas proved the bus works first; the subsidy came after Uber ate the margin. Phuket in 2025 has one legal ride-hail operator at HKT (Grab) and a second (Bolt) since 2023. The window to put a bus on the corridor before the ride-hail companies own it is open now; it will not be open in five years."
  },
  {
    argument: "Light rail is what a real city would do.",
    response: "Las Vegas built a US$650M monorail for 3.9 miles of Strip. It went bankrupt twice and sold for US$24.3M in 2020. The same corridor, same year, was served by a 100-seat double-decker bus on the existing road that paid for itself for a decade. The vehicle that fits the corridor wins, not the one that wins design awards."
  },
  {
    argument: "17.4M passengers per year sounds like a lot, but the airport bus only serves one corridor.",
    response: "The airport corridor is the spine. Once it runs, the same vehicles can serve Rawai, Patong, the old town and the convention centre at off-peak hours. Capex for the bus is a sunk cost; the marginal revenue of a second corridor is high."
  },
  {
    argument: "The Phuket municipality does not have the budget for this.",
    response: "Correct. The capital is private — and the route authority is a concession, not a purchase. The bankability test is whether farebox cashflow plus a capped public-outcome payment clears the lender's 1.30× DSCR. The feasibility study is the diligence instrument, not a credit offer."
  }
];

const OPEN_QUESTIONS: { question: string; where_it_lands: string }[] = [
  {
    question: "What is the actual capture rate per nationality, not the heuristic stereotype?",
    where_it_lands: "Replaces every bus-capture assumption in the engine. Changes revenue and DSCR by ±30%."
  },
  {
    question: "How many buses are required to clear every hour of the day, not just the peak?",
    where_it_lands: "The current model identifies the worst hour (12:00) but assumes off-peak hours can absorb the same duty. A full 24-hour staffing model is a 90-day pilot output."
  },
  {
    question: "What is the demand elasticity to fare? Is ฿100 the right price?",
    where_it_lands: "If ฿100 captures 5% and ฿150 captures 4%, revenue is higher. If ฿100 captures 5% and ฿150 captures 3%, revenue is lower. Unknown without a price test."
  },
  {
    question: "Will Bolt or a third operator arrive in Phuket before the bus launches?",
    where_it_lands: "A second ride-hail competitor halves the bus's first-mover corridor advantage. The window is open now; the bus must launch before the second operator does."
  },
  {
    question: "What is the marginal CO₂ saved per additional rider, and who pays for it?",
    where_it_lands: "The current /roi model uses APTA factors (0.21 car kg/pax-km, 0.06 bus). Carbon credits are an open revenue line. Without them, CO₂ is a benefit with no balance-sheet entry."
  }
];

export function CriticalReading() {
  return (
    <section className="cr-section" aria-labelledby="cr-title">
      <header className="cr-section__head">
        <p className="tk-kicker">Critical reading · the honest version</p>
        <h2 id="cr-title">What this research does not claim, what it might have got wrong, and the questions that still need a pilot.</h2>
        <p>
          A research site is most useful when it shows its own limits. This
          page is for the reader who already trusts the headline and wants
          to know where the seams are. Five limitations. Five
          counter-arguments. Five open questions. Each one points to the
          specific evidence that would close it.
        </p>
      </header>

      <div className="cr-block">
        <h3 className="cr-block__title">Limitations · what the model does not capture</h3>
        <ol className="cr-list" role="list">
          {LIMITATIONS.map((l) => (
            <li key={l.number} className="cr-limit">
              <span className="cr-limit__num">{l.number}</span>
              <div>
                <h4>{l.what}</h4>
                <p className="cr-limit__why">{l.why}</p>
                <p className="cr-limit__changes">
                  <span className="tk-kicker">What closes the gap</span>
                  {l.what_changes_it}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="cr-block">
        <h3 className="cr-block__title">Counter-arguments · steelmanned and answered</h3>
        <p className="cr-block__lede">
          The most useful review is the one that disagrees first. Each
          objection below is a real argument the team has heard, in
          workshops in Jakarta, Los Angeles, Phuket and Boston. The
          response is the team's best answer; the reader is invited to
          test both.
        </p>
        <ol className="cr-counter" role="list">
          {COUNTER_ARGUMENTS.map((c, i) => (
            <li key={i} className="cr-counter__item">
              <div className="cr-counter__against">
                <span className="tk-kicker">Objection {String(i + 1).padStart(2, "0")}</span>
                <p>“{c.argument}”</p>
              </div>
              <div className="cr-counter__answer">
                <span className="tk-kicker">Our response</span>
                <p>{c.response}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="cr-block">
        <h3 className="cr-block__title">Open questions · for the pilot to answer</h3>
        <ol className="cr-open" role="list">
          {OPEN_QUESTIONS.map((q, i) => (
            <li key={i} className="cr-open__item">
              <span className="cr-open__num">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <h4>{q.question}</h4>
                <p className="cr-open__land">
                  <span className="tk-kicker">Where it lands</span>
                  {q.where_it_lands}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <p className="cr-signoff">
        <strong>If you find an error,</strong> open a thread, send a
        message, write a postcard. The team that built this would
        rather know.
      </p>
    </section>
  );
}

export default CriticalReading;
