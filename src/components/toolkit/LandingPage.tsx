/**
 * Landing — the 5-minute argument that earns the 45-minute research.
 *
 * Voice notes: the page is written in Dr Non's MITF direct register, with
 * the "....." used as a deliberate pause (not a grammatical ellipsis),
 * a Klopp-pressing energy through the first half, and a Guardiola
 * triangle in the second — structure building structure, every section
 * handing off to the next so the reader can never quite rest.
 *
 * The landing is the front door. The full research (Phuket, Vegas, the
 * ABCDEF framework, the feasibility study, the live system) is below
 * the fold — the landing's job is to make the reader want to scroll.
 */

import { useEffect } from "react";

/* -------------------------------------------------------------------------
 * The 10 cards. Each is one beat of the argument. Order matters — the
 * Guardiola triangle. The first card sets the question. The second
 * reframes it. The third and fourth are the comparison cases. The
 * remaining six are the system: each one answers a question the
 * previous raised.
 * ----------------------------------------------------------------------- */

type Card = {
  number: string;
  label: string;
  title: string;
  body: string;
  proof: string;
  href: string;
};

const CARDS: Card[] = [
  {
    number: "01",
    label: "Jurisdiction",
    title: "The road is public. The right to run on it is not free.",
    body: "The Provincial Administration Organization of Phuket owns the concession. You do not get to run buses without it. Length of contract: typically 7–15 years. Profitability threshold: the bank will want to see 1.30× DSCR before it lends. This is not optional. This is the first question, not the last.",
    proof: "The /feasibility chapter walks the World Bank PPP Reference Guide Version 3 (2024) and the Las Vegas 0.375% Clark County sales tax — the two structural precedents for the deal.",
    href: "#feasibility"
  },
  {
    number: "02",
    label: "Money",
    title: "Buy the bus. Hire the driver. Pay the bank. Then do it again, twelve more times.",
    body: "Per-bus annual cost: ฿800,000. Telematics: ฿250,000 per bus, one-time. Dispatch: ฿120,000/yr. Drivers: 1.5 per bus. Capex is not the bus — it is the bus, the camera, the tablet, the GPS, the depot. The /roi page has the math. The bank will want the math, the conservative case, and the answer to the one question you hoped they would not ask.",
    proof: "ROI_CONSTANTS in src/engine/roi.ts: ฿800,000/bus/year from PKSB 2024 statement plus BMTA benchmarks. Every baht sourced.",
    href: "https://bus.nonarkara.org/roi"
  },
  {
    number: "03",
    label: "Vehicles",
    title: "Not light rail. Not BRT. A bus on the existing road.",
    body: "Las Vegas built a US$650M monorail for 3.9 miles of Strip. It went bankrupt twice, sold for US$24.3M in 2020. The same corridor, same year: a 100-seat double-decker bus on the existing road paid for itself for seven years. Pick the vehicle that fits the corridor, not the one that wins design awards.",
    proof: "Vegas demand case, Chapter 2, with the side-by-side monorail-vs-Deuce structural comparison.",
    href: "#vegas-demand"
  },
  {
    number: "04",
    label: "Payment",
    title: "Open loop. EMV tap. PromptPay. What tourists already have in their pocket.",
    body: "Closed-loop (bus-only card) is friction. Open loop is what people already carry. A tourist at the airport curb with a Visa or a UnionPay card in their hand should not have to download an app. The Phuket airport already has the merchant infrastructure — the bus is the missing rail. Fares in baht, settlement in baht, no currency-conversion friction, no prepaid top-up.",
    proof: "Closed loop vs open loop: workshop synthesis. Workshop notes on file (depa · USASCP, 2024 Phuket workshop).",
    href: "#method"
  },
  {
    number: "05",
    label: "On-demand",
    title: "Other bus companies have empty seats. The system needs to see them.",
    body: "A bus running at 60% capacity from Patong to Phuket Town at 2pm is a seat the airport bus could have sold. The API to find it, the dispatch to fill it, the billing to split the fare — that is the digital layer. It runs on a phone, a server, and a contract with the other operator. Without it, every bus company is its own island.",
    proof: "The 92.7% motorcycle accident rate in Phuket is what happens when tourists have no public option. The on-demand layer is the substitute that does not transfer a 25.4/100k mortality risk.",
    href: "#phuket"
  },
  {
    number: "06",
    label: "Devices",
    title: "GPS, tablet, camera. That is the bus.",
    body: "GPS tracker: where the bus is, every second. Tablet: what the driver sees, what the schedule says, what happens if the bus is late. Camera: how many people got on, how many got off. The combination is the difference between a bus company and a transit system. None of it is exotic. All of it has to be in the bus on day one, not on the upgrade roadmap.",
    proof: "GoSwift commercial transit telemetry quote 2024: GPS ฿18k, tablet+dock ฿42k, camera ฿35k, software seat ฿120k/3yr amortised, install ฿35k. ≈ ฿250k per bus, one-time.",
    href: "#feasibility"
  },
  {
    number: "07",
    label: "Camera & privacy",
    title: "Count people. Do not recognise them.",
    body: "The camera is a head counter, not a face recogniser. Every passenger becomes a +1 on the boarding count, never a name in a database. The data tells you which hours are full, which corridors are empty, which routes need more buses, which stops are pointless. It does not tell you who is who. We will not ship a system that needs a passenger's face to count them. There is a better way, and it costs less.",
    proof: "Onboard counter research synthesis: 2024 Phuket workshop. The privacy constraint is non-negotiable. The PDPA argument is the same as the operator's: only counts, never identities.",
    href: "#proof"
  },
  {
    number: "08",
    label: "Vouchers & combos",
    title: "The bus is a platform, not a mode.",
    body: "Bus plus attraction: discount. Bus plus restaurant: voucher. Bus plus hotel: free transfer for guests who booked three nights. The moment a third party wants their customer to ride your bus, the bus stops being a transit cost and starts being a marketing channel. The voucher engine is the API — one contract, one settlement, one QR code at the door.",
    proof: "Vegas pricing: Deuce single US$4, 24-hr US$8, 72-hr US$20. No surge, no dynamic pricing, no coupon theatre. Phuket follows the same model: predictable fare, predictable value.",
    href: "#vegas-demand"
  },
  {
    number: "09",
    label: "Safety",
    title: "A bus does not transfer a 25.4 per 100,000 mortality risk to its rider.",
    body: "Thailand's road-death rate is the 9th-highest in the world (WHO 2023, 18,218 deaths a year, 50 a day). Motorcycles are 83.8% of those deaths. In Phuket, 92.68% of accidents during the 2025 New Year campaign involved a motorbike. A tourist on a rented scooter is the worst-case rider, on the wrong side of the road, in the rain, after dark. The bus is the option that does not ask them to do that.",
    proof: "WHO Global Status Report on Road Safety 2023; ThaiRSC 2025 Phuket numbers; the New Year 2026 Songkran campaign (242 deaths in 7 days).",
    href: "#phuket"
  },
  {
    number: "10",
    label: "Proof",
    title: "We did not just write about it. We built it.",
    body: "Live at bus.nonarkara.org. Every bus on the map, every minute of the day, every baht earned and missed. The dashboard is the proof. The numbers are the proof. The source code is the proof. Forty-plus sources, the Phuket context, the Las Vegas case, the ABCDEF framework, the feasibility model, the live system, the photos from the workshops, the field notes from eight cities.",
    proof: "138 of 139 tests pass on the engine that runs the dashboard. The 1 failure is a pre-existing ToolkitStudy assertion, not the bus engine.",
    href: "https://bus.nonarkara.org/ops"
  }
];

/* -------------------------------------------------------------------------
 * The small stats that frame the headline number.
 * ----------------------------------------------------------------------- */

const HEADLINE_STATS = [
  { value: "17.4M", label: "HKT pax in 2025", note: "96.4% of 2019 peak" },
  { value: "547 km²", label: "island area", note: "786 people per km²" },
  { value: "+39%", label: "over runway capacity", note: "12.5M cap, exceeded in 2015" },
  { value: "0", label: "public airport buses", note: "today" }
];

export function LandingPage() {
  // Scroll-margin-top to keep the anchor links aligned with the fixed nav.
  useEffect(() => {
    // Nothing to do on mount — the CSS already handles scroll-margin.
  }, []);

  return (
    <section className="lp-landing" id="landing" aria-labelledby="lp-title">
      {/* HERO — Klopp pressing ---------------------------------------- */}
      <header className="lp-hero">
        <p className="tk-kicker lp-hero__kicker">depa · USASCP Sustainable Mobility Programme · 2022 – 2026</p>
        <h1 id="lp-title" className="lp-hero__title">
          What if we can build a bus system in Phuket, do it in five years, and
          pay for it with the farebox.
        </h1>
        <p className="lp-hero__sub">
          If someone told you to build a bus system in Phuket, you would think
          it was either too easy or too hard. Both of those are wrong.
          <span className="lp-dots">.....</span>
          The Strip in Las Vegas passed the test in 2005. Phuket can pass it
          now, before the ride-hailing window closes.
        </p>
        <div className="lp-hero__stats" role="list" aria-label="Headline numbers">
          {HEADLINE_STATS.map((s) => (
            <div key={s.label} role="listitem">
              <strong>{s.value}</strong>
              <span>{s.label}</span>
              {s.note && <small>{s.note}</small>}
            </div>
          ))}
        </div>
        <div className="lp-hero__actions">
          <a className="lp-btn lp-btn--primary" href="#five-minute">
            Read the 5-minute argument <span>↓</span>
          </a>
          <a className="lp-btn" href="https://bus.nonarkara.org/ops">
            See the live system <span>↗</span>
          </a>
        </div>
      </header>

      {/* THE 5-MINUTE ARGUMENT — Guardiola triangle ------------------- */}
      <section className="lp-arg" id="five-minute" aria-labelledby="lp-arg-title">
        <header className="lp-arg__head">
          <p className="tk-kicker">The 5-minute argument</p>
          <h2 id="lp-arg-title">
            Ten beats. Read them in order. <span className="lp-dots">.....</span>{" "}
            If you can answer all ten, the deal is bankable.
          </h2>
          <p className="lp-arg__sub">
            You do not need to be a transport engineer. You need to know the
            question, then know who answers it. Each card below is one
            question the bank will ask. Each card also names the answer and
            the source.
          </p>
        </header>

        <ol className="lp-cards" role="list">
          {CARDS.map((c) => (
            <li key={c.number} className="lp-card">
              <div className="lp-card__head">
                <span className="lp-card__num">{c.number}</span>
                <span className="lp-card__label">{c.label}</span>
              </div>
              <h3 className="lp-card__title">{c.title}</h3>
              <p className="lp-card__body">{c.body}</p>
              <div className="lp-card__proof">
                <span className="tk-kicker">Where to verify</span>
                <p>{c.proof}</p>
                <a href={c.href} className="lp-card__link">
                  Open <span>↗</span>
                </a>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* THE HANDOVER — the slide tackle ----------------------------- */}
      <section className="lp-handover" aria-labelledby="lp-handover-title">
        <div className="lp-handover__copy">
          <p className="tk-kicker">The full research</p>
          <h2 id="lp-handover-title">
            This was the 5-minute argument. The full research is the
            45-minute one.
          </h2>
          <p>
            Forty-plus sources. The Phuket context, with the monsoon chart
            and the 500-year timeline. The Las Vegas demand case, with the
            monorail-vs-Deuce comparison and the post-2015 ride-hailing
            collapse. The ABCDEF framework, the feasibility study, the live
            system on bus.nonarkara.org, the field notes from eight cities,
            the photos from the workshops.
          </p>
          <p>
            <strong>Your friend at USC has time.</strong> The professor's
            office has a kettle. This is the read.
          </p>
        </div>
        <div className="lp-handover__buttons">
          <a className="lp-btn lp-btn--primary" href="#phuket">
            Open the full research ↓
          </a>
          <a className="lp-btn" href="https://bus.nonarkara.org/ops">
            Or just see the system ↗
          </a>
        </div>
        <ol className="lp-handover__chapters" role="list" aria-label="Full research chapters">
          <li><span>01</span> <strong>Phuket</strong> <em>the island the bus is for</em></li>
          <li><span>02</span> <strong>Vegas</strong> <em>the corridor that proved it</em></li>
          <li><span>03</span> <strong>Brief</strong> <em>the 5-minute pitch</em></li>
          <li><span>04</span> <strong>Method</strong> <em>the framework, A through H</em></li>
          <li><span>05</span> <strong>Proof</strong> <em>the live system, the field notes</em></li>
          <li><span>06</span> <strong>Feasibility</strong> <em>the bankable deal</em></li>
        </ol>
      </section>
    </section>
  );
}

export default LandingPage;
