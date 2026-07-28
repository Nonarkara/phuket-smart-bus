/**
 * The short argument that earns the long research.
 *
 * Rehearsal first: demand → justify → feasibility → law/PPP → fleet →
 * on-demand → people → digital safety → feeders → price/scale.
 * Then the Jakarta→Johor love story and the dedication to Ton Jaitong.
 */

import type { Lang } from "@shared/types";
import { LANDING } from "./translations";

const HISTORY = `${import.meta.env.BASE_URL}toolkit/history/`;
const FIELD = `${import.meta.env.BASE_URL}toolkit/field-notes/`;

function tr(key: string, lang: Lang): string {
  return LANDING[key]?.[lang] ?? LANDING[key]?.en ?? key;
}

export function LandingPage({ lang = "en" }: { lang?: Lang }) {
  const BEATS = [
    { number: "01", label: tr("beat01Label", lang), status: "Observed", title: tr("beat01Title", lang), body: tr("beat01Body", lang), proof: tr("beat01Proof", lang), href: "https://bus.nonarkara.org/", link: tr("beat01Link", lang) },
    { number: "02", label: tr("beat02Label", lang), status: "Proposed", title: tr("beat02Title", lang), body: tr("beat02Body", lang), proof: tr("beat02Proof", lang), href: "#feasibility", link: tr("beat02Link", lang) },
    { number: "03", label: tr("beat03Label", lang), status: "Due diligence", title: tr("beat03Title", lang), body: tr("beat03Body", lang), proof: tr("beat03Proof", lang), href: "#feasibility", link: tr("beat03Link", lang) },
    { number: "04", label: tr("beat04Label", lang), status: "Due diligence", title: tr("beat04Title", lang), body: tr("beat04Body", lang), proof: tr("beat04Proof", lang), href: "#feasibility", link: tr("beat04Link", lang) },
    { number: "05", label: tr("beat05Label", lang), status: "Modelled", title: tr("beat05Title", lang), body: tr("beat05Body", lang), proof: tr("beat05Proof", lang), href: "https://bus.nonarkara.org/ops", link: tr("beat05Link", lang) },
    { number: "06", label: tr("beat06Label", lang), status: "Modelled", title: tr("beat06Title", lang), body: tr("beat06Body", lang), proof: tr("beat06Proof", lang), href: "https://bus.nonarkara.org/ops", link: tr("beat06Link", lang) },
    { number: "07", label: tr("beat07Label", lang), status: "Build-ready", title: tr("beat07Title", lang), body: tr("beat07Body", lang), proof: tr("beat07Proof", lang), href: "https://bus.nonarkara.org/ops", link: tr("beat07Link", lang) },
    { number: "08", label: tr("beat08Label", lang), status: "Proposed", title: tr("beat08Title", lang), body: tr("beat08Body", lang), proof: tr("beat08Proof", lang), href: "#proof", link: tr("beat08Link", lang) },
    { number: "09", label: tr("beat09Label", lang), status: "Proposed", title: tr("beat09Title", lang), body: tr("beat09Body", lang), proof: tr("beat09Proof", lang), href: "#method", link: tr("beat09Link", lang) },
    { number: "10", label: tr("beat10Label", lang), status: "Modelled", title: tr("beat10Title", lang), body: tr("beat10Body", lang), proof: tr("beat10Proof", lang), href: "#feasibility", link: tr("beat10Link", lang) },
  ];

  const REHEARSAL = [
    tr("rehearsal01", lang),
    tr("rehearsal02", lang),
    tr("rehearsal03", lang),
    tr("rehearsal04", lang),
    tr("rehearsal05", lang),
    tr("rehearsal06", lang),
    tr("rehearsal07", lang),
    tr("rehearsal08", lang),
    tr("rehearsal09", lang),
    tr("rehearsal10", lang),
  ];

  const HEADLINE_STATS = [
    { value: "17.5m", label: tr("statPaxMovements", lang), note: tr("statPaxNote", lang) },
    { value: "20", label: tr("statDepartures", lang), note: tr("statDeparturesNote", lang) },
    { value: "25", label: tr("statSeats", lang), note: tr("statSeatsNote", lang) },
    { value: "90 days", label: tr("statPilot", lang), note: tr("statPilotNote", lang) }
  ];

  const SIGNAL_CHAIN: [string, string][] = [
    [tr("actorPassenger", lang), tr("signalPassengerAction", lang)],
    [tr("actorDriver", lang), tr("signalDriverAction", lang)],
    [tr("actorVehicle", lang), tr("signalVehicleAction", lang)],
    [tr("actorOperator", lang), tr("signalOperatorAction", lang)],
    [tr("actorLender", lang), tr("signalLenderAction", lang)],
  ];

  return (
    <section className="lp-landing" id="landing" aria-labelledby="lp-title">
      <header className="lp-hero">
        <p className="tk-kicker lp-hero__kicker">{tr("heroKicker", lang)}</p>
        <h1 id="lp-title" className="lp-hero__title">
          {tr("heroTitle", lang)}
        </h1>
        <p className="lp-hero__sub">
          {tr("heroSub", lang)}
        </p>
        <div className="lp-hero__status" aria-label="Evidence status legend">
          <span><b>{tr("statusObserved", lang)}</b> {tr("statusObservedNote", lang)}</span>
          <span><b>{tr("statusModelled", lang)}</b> {tr("statusModelledNote", lang)}</span>
          <span><b>{tr("statusProposed", lang)}</b> {tr("statusProposedNote", lang)}</span>
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
          <a className="lp-btn lp-btn--primary" href="#rehearsal">
            {tr("followWholeSystem", lang)} <span>↓</span>
          </a>
          <a className="lp-btn" href="https://bus.nonarkara.org/">
            {tr("tryPassengerScreen", lang)} <span>↗</span>
          </a>
        </div>
      </header>

      <section className="lp-rehearsal" id="rehearsal" aria-labelledby="lp-rehearsal-title">
        <header className="lp-rehearsal__head">
          <p className="tk-kicker">{tr("rehearsalKicker", lang)}</p>
          <h2 id="lp-rehearsal-title">{tr("rehearsalTitle", lang)}</h2>
        </header>
        <ol className="lp-rehearsal__spine" aria-label="Build sequence">
          {REHEARSAL.map((step, index) => (
            <li key={step}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{step}</strong>
            </li>
          ))}
        </ol>
      </section>

      <section className="lp-journey" aria-labelledby="lp-journey-title">
        <div className="lp-journey__copy">
          <p className="tk-kicker">{tr("journeyKicker", lang)}</p>
          <h2 id="lp-journey-title">{tr("journeyTitle", lang)}</h2>
          <p>{tr("journeyBody", lang)}</p>
        </div>
        <div className="lp-journey__photos" role="list">
          <figure role="listitem">
            <img src={`${HISTORY}jakarta-2022.jpg`} alt="" loading="lazy" />
            <figcaption>{tr("journeyJakarta", lang)}</figcaption>
          </figure>
          <figure role="listitem">
            <img src={`${HISTORY}jakarta-ton-2022-detail.jpg`} alt="" loading="lazy" />
            <figcaption>{tr("journeyTonCap", lang)}</figcaption>
          </figure>
          <figure role="listitem">
            <img src={`${HISTORY}johor-2025.jpg`} alt="" loading="lazy" />
            <figcaption>{tr("journeyJohor", lang)}</figcaption>
          </figure>
        </div>
      </section>

      <section className="lp-ton" aria-labelledby="lp-ton-title">
        <figure>
          <img
            src={`${FIELD}jakarta-ton-2022.jpg`}
            alt="Ton Jaitong with colleagues at the Jakarta workshop in December 2022"
            loading="lazy"
          />
          <figcaption>Jakarta · December 2022</figcaption>
        </figure>
        <div>
          <p className="tk-kicker">{tr("tonKicker", lang)}</p>
          <h2 id="lp-ton-title">{tr("tonTitle", lang)}</h2>
          <p className="lp-ton__lead">{tr("tonLead", lang)}</p>
          <p>{tr("tonBody", lang)}</p>
        </div>
      </section>

      <section className="lp-signal" aria-labelledby="lp-signal-title">
        <div className="lp-signal__intro">
          <p className="tk-kicker">{tr("signalKicker", lang)}</p>
          <h2 id="lp-signal-title">{tr("signalTitle", lang)}</h2>
          <p>
            {tr("signalBody", lang)}
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
          <p className="tk-kicker">{tr("fiveMinKicker", lang)}</p>
          <h2 id="lp-arg-title">{tr("fiveMinTitle", lang)}</h2>
          <p className="lp-arg__sub">
            {tr("fiveMinSub", lang)}
          </p>
        </header>

        <ol className="lp-cards" role="list">
          {BEATS.map((beat) => (
            <li key={beat.number} className="lp-card">
              <div className="lp-card__head">
                <span className="lp-card__num">{beat.number}</span>
                <span className="lp-card__label">{beat.label}</span>
                <span className={`lp-card__status lp-card__status--${beat.status.toLowerCase().replace(/\s+/g, "-")}`}>
                  {beat.status}
                </span>
              </div>
              <h3 className="lp-card__title">{beat.title}</h3>
              <p className="lp-card__body">{beat.body}</p>
              <div className="lp-card__proof">
                <span className="tk-kicker">{tr("proofKicker", lang)}</span>
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
          <p className="tk-kicker">{tr("handoverKicker", lang)}</p>
          <h2 id="lp-handover-title">{tr("handoverTitle", lang)}</h2>
          <p>
            {tr("handoverBody", lang)}
          </p>
        </div>
        <div className="lp-handover__buttons">
          <a className="lp-btn lp-btn--primary" href="#phuket">{tr("handoverOpenResearch", lang)} <span>↓</span></a>
          <a className="lp-btn" href="https://bus.nonarkara.org/ops">{tr("handoverRunConsole", lang)} <span>↗</span></a>
        </div>
        <ol className="lp-handover__chapters" role="list" aria-label="Full research chapters">
          <li><span>01</span><div><strong>{tr("chapter01Name", lang)}</strong><em>{tr("chapter01Desc", lang)}</em></div></li>
          <li><span>02</span><div><strong>{tr("chapter02Name", lang)}</strong><em>{tr("chapter02Desc", lang)}</em></div></li>
          <li><span>03</span><div><strong>{tr("chapter03Name", lang)}</strong><em>{tr("chapter03Desc", lang)}</em></div></li>
          <li><span>04</span><div><strong>{tr("chapter04Name", lang)}</strong><em>{tr("chapter04Desc", lang)}</em></div></li>
          <li><span>05</span><div><strong>{tr("chapter05Name", lang)}</strong><em>{tr("chapter05Desc", lang)}</em></div></li>
          <li><span>06</span><div><strong>{tr("chapter06Name", lang)}</strong><em>{tr("chapter06Desc", lang)}</em></div></li>
        </ol>
      </section>
    </section>
  );
}

export default LandingPage;
