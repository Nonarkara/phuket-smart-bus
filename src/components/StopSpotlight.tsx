import type { DecisionSummary, Lang, Stop } from "@shared/types";
import { formatSourceDate, pick } from "@/lib/i18n";

type Props = {
  lang: Lang;
  stop: Stop | null;
  summary: DecisionSummary | null;
  advisoryCount: number;
  title: string;
  body: string;
  nextBusLabel: string;
  liveBusesLabel: string;
  activeAlertsLabel: string;
  nearbyLabel: string;
  walkLabel: string;
  routeDirectionLabel: string;
  openMapsLabel: string;
  timetableTitle: string;
  timetableFirstLabel: string;
  timetableLastLabel: string;
  timetableWindowLabel: string;
  timetableNextLabel: string;
  timetableUpdatedLabel: string;
  timetableSourceLabel: string;
  timetableOpenSourceLabel: string;
  summaryUnavailableLabel: string;
  loading: boolean;
};

function getBasisLabel(basis: DecisionSummary["nextBus"]["basis"], lang: Lang) {
  switch (basis) {
    case "live":
      return lang === "th" ? "อิง ETA สด" : "Using live ETA";
    case "schedule":
      return lang === "th" ? "อิงตารางเวลา" : "Using schedule";
    case "fallback":
      return lang === "th" ? "ใช้ข้อมูลสำรอง" : "Using fallback";
  }
}

function getAlertStateLabel(advisoryCount: number, summary: DecisionSummary, lang: Lang) {
  if (advisoryCount > 0) {
    return pick(summary.headline, lang);
  }

  return lang === "th" ? "ปกติ" : "Normal";
}

export function StopSpotlight({
  lang,
  stop,
  summary,
  advisoryCount,
  title,
  body,
  nextBusLabel,
  liveBusesLabel,
  activeAlertsLabel,
  nearbyLabel,
  walkLabel,
  routeDirectionLabel,
  openMapsLabel,
  timetableTitle,
  timetableFirstLabel,
  timetableLastLabel,
  timetableWindowLabel,
  timetableNextLabel,
  timetableUpdatedLabel,
  timetableSourceLabel,
  timetableOpenSourceLabel,
  summaryUnavailableLabel,
  loading
}: Props) {
  if (loading || !stop) {
    return (
      <section className="spotlight card">
        <div className="spotlight__copy">
          <span className="hero__eyebrow">{title}</span>
          <div className="skeleton skeleton--headline" />
          <div className="skeleton skeleton--body" />
        </div>
      </section>
    );
  }

  const nextBus = summary?.nextBus ?? stop.nextBus;
  const timetable = summary?.timetable ?? stop.timetable;
  const routeStatus = summary ? pick(summary.routeStatus, lang) : summaryUnavailableLabel;
  const alertState = summary ? getAlertStateLabel(advisoryCount, summary, lang) : summaryUnavailableLabel;

  return (
    <section className="spotlight card">
      <div className="spotlight__copy">
        <span className="hero__eyebrow">{title}</span>
        <h3>{pick(stop.name, lang)}</h3>
        <p>{summary ? body : summaryUnavailableLabel}</p>
      </div>

      <div className="spotlight__stats" aria-label={title}>
        <article className="spotlight-stat">
          <span>{nextBusLabel}</span>
          <strong>
            {nextBus.minutesUntil === null
              ? nextBus.label
              : `${nextBus.minutesUntil} min`}
          </strong>
          <small>{getBasisLabel(nextBus.basis, lang)}</small>
        </article>
        <article className="spotlight-stat">
          <span>{liveBusesLabel}</span>
          <strong>{summary ? summary.liveVehicles : "--"}</strong>
          <small>{routeStatus}</small>
        </article>
        <article className="spotlight-stat">
          <span>{activeAlertsLabel}</span>
          <strong>{advisoryCount}</strong>
          <small>{alertState}</small>
        </article>
      </div>

      <div className="spotlight__footer">
        <div className="spotlight__meta">
          <strong>{pick(stop.routeDirection, lang)}</strong>
          <p>
            {routeDirectionLabel}: {pick(stop.direction, lang)}
          </p>
          <p>
            {nearbyLabel}: {stop.nearbyPlace.name}
          </p>
          <p>
            {walkLabel}: {stop.nearbyPlace.walkMinutes} min · {stop.nearbyPlace.distanceMeters} m
          </p>
        </div>
        <a className="spotlight__action" href={stop.nearbyPlace.mapUrl} target="_blank" rel="noreferrer">
          {openMapsLabel}
        </a>
      </div>

      <div className="spotlight__timetable">
        <div className="spotlight__timetable-head">
          <strong>{timetableTitle}</strong>
          <a href={timetable.sourceUrl} target="_blank" rel="noreferrer">
            {timetableOpenSourceLabel}
          </a>
        </div>
        <div className="spotlight__timetable-grid">
          <article className="spotlight-timetable-card">
            <span>{timetableFirstLabel}</span>
            <strong>{timetable.firstDepartureLabel ?? "--"}</strong>
          </article>
          <article className="spotlight-timetable-card">
            <span>{timetableLastLabel}</span>
            <strong>{timetable.lastDepartureLabel ?? "--"}</strong>
          </article>
          <article className="spotlight-timetable-card">
            <span>{timetableWindowLabel}</span>
            <strong>{timetable.serviceWindowLabel ?? "--"}</strong>
          </article>
        </div>
        <p className="spotlight__timetable-list">
          {timetableNextLabel}: {timetable.nextDepartures.join(" · ") || "--"}
        </p>
        <p className="spotlight__timetable-meta">
          {timetableSourceLabel}: {pick(timetable.sourceLabel, lang)}
        </p>
        <p className="spotlight__timetable-meta">
          {timetableUpdatedLabel}: {formatSourceDate(timetable.sourceUpdatedAt, lang)}
        </p>
        <p className="spotlight__timetable-meta">{pick(timetable.notes, lang)}</p>
      </div>
    </section>
  );
}
