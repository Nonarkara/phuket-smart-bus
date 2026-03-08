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
  loading: boolean;
};

function getBasisLabel(summary: DecisionSummary, lang: Lang) {
  switch (summary.nextBus.basis) {
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
  loading
}: Props) {
  if (loading || !stop || !summary) {
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

  return (
    <section className="spotlight card">
      <div className="spotlight__copy">
        <span className="hero__eyebrow">{title}</span>
        <h3>{pick(stop.name, lang)}</h3>
        <p>{body}</p>
      </div>

      <div className="spotlight__stats" aria-label={title}>
        <article className="spotlight-stat">
          <span>{nextBusLabel}</span>
          <strong>
            {summary.nextBus.minutesUntil === null
              ? summary.nextBus.label
              : `${summary.nextBus.minutesUntil} min`}
          </strong>
          <small>{getBasisLabel(summary, lang)}</small>
        </article>
        <article className="spotlight-stat">
          <span>{liveBusesLabel}</span>
          <strong>{summary.liveVehicles}</strong>
          <small>{pick(summary.routeStatus, lang)}</small>
        </article>
        <article className="spotlight-stat">
          <span>{activeAlertsLabel}</span>
          <strong>{advisoryCount}</strong>
          <small>{getAlertStateLabel(advisoryCount, summary, lang)}</small>
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
          <a href={summary.timetable.sourceUrl} target="_blank" rel="noreferrer">
            {timetableOpenSourceLabel}
          </a>
        </div>
        <div className="spotlight__timetable-grid">
          <article className="spotlight-timetable-card">
            <span>{timetableFirstLabel}</span>
            <strong>{summary.timetable.firstDepartureLabel ?? "--"}</strong>
          </article>
          <article className="spotlight-timetable-card">
            <span>{timetableLastLabel}</span>
            <strong>{summary.timetable.lastDepartureLabel ?? "--"}</strong>
          </article>
          <article className="spotlight-timetable-card">
            <span>{timetableWindowLabel}</span>
            <strong>{summary.timetable.serviceWindowLabel ?? "--"}</strong>
          </article>
        </div>
        <p className="spotlight__timetable-list">
          {timetableNextLabel}: {summary.timetable.nextDepartures.join(" · ") || "--"}
        </p>
        <p className="spotlight__timetable-meta">
          {timetableSourceLabel}: {pick(summary.timetable.sourceLabel, lang)}
        </p>
        <p className="spotlight__timetable-meta">
          {timetableUpdatedLabel}: {formatSourceDate(summary.timetable.sourceUpdatedAt, lang)}
        </p>
        <p className="spotlight__timetable-meta">{pick(summary.timetable.notes, lang)}</p>
      </div>
    </section>
  );
}
