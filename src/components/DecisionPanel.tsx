import type { DecisionSummary, Lang } from "@shared/types";
import { formatUpdateTime, pick, ui } from "@/lib/i18n";

type Props = {
  lang: Lang;
  summary: DecisionSummary | null;
  alertCount: number;
  loading: boolean;
  errorMessage: string | null;
};

function getBasisLabel(summary: DecisionSummary, lang: Lang) {
  switch (summary.nextBus.basis) {
    case "live":
      return lang === "th" ? "ETA สด" : "Live ETA";
    case "schedule":
      return lang === "th" ? "เช็กจากตาราง" : "Schedule check";
    case "fallback":
      return lang === "th" ? "ค่าประมาณสำรอง" : "Fallback estimate";
  }
}

function getLiveChipLabel(count: number, lang: Lang) {
  return lang === "th" ? `${count} คันออนไลน์` : `${count} live`;
}

function getAlertChipLabel(count: number, lang: Lang) {
  return lang === "th" ? `${count} คำเตือน` : `${count} alerts`;
}

function getSeatChipLabel(count: number, lang: Lang) {
  return lang === "th" ? `${count} ที่นั่งว่าง` : `${count} seats left`;
}

export function DecisionPanel({ lang, summary, alertCount, loading, errorMessage }: Props) {
  if (loading && !summary) {
    return (
      <section className="decision-panel card">
        <div className="skeleton skeleton--headline" />
        <div className="skeleton skeleton--body" />
        <div className="skeleton skeleton--body short" />
      </section>
    );
  }

  if (!summary) {
    return (
      <section className="decision-panel card is-live_unavailable">
        <div className="decision-panel__header">
          <span className="decision-panel__label">{pick(ui.decisionUnavailableTitle, lang)}</span>
        </div>
        <h2 className="decision-panel__headline">{pick(ui.decisionUnavailableTitle, lang)}</h2>
        <p className="decision-panel__summary">
          {errorMessage ?? pick(ui.decisionUnavailableBody, lang)}
        </p>
      </section>
    );
  }

  return (
    <section className={`decision-panel card is-${summary.level}`}>
      <div className="decision-panel__header">
        <span className="decision-panel__label">{pick(summary.routeStatus, lang)}</span>
        <span className="decision-panel__update">
          {formatUpdateTime(summary.updatedAt, lang)}
        </span>
      </div>
      <div className="decision-panel__chips" aria-label="Status summary">
        <span className="decision-chip">{getLiveChipLabel(summary.liveVehicles, lang)}</span>
        <span className="decision-chip">{getAlertChipLabel(alertCount, lang)}</span>
        <span className="decision-chip">{getBasisLabel(summary, lang)}</span>
        {summary.seatAvailability?.seatsLeft !== null ? (
          <span className="decision-chip">
            {getSeatChipLabel(summary.seatAvailability.seatsLeft, lang)}
          </span>
        ) : null}
      </div>
      <h2 className="decision-panel__headline">{pick(summary.headline, lang)}</h2>
      <p className="decision-panel__summary">{pick(summary.summary, lang)}</p>
      <div className="decision-panel__next-bus">
        <span className="decision-panel__minutes">
          {summary.nextBus.minutesUntil === null ? "--" : summary.nextBus.minutesUntil}
        </span>
        <div>
          <strong>{summary.nextBus.label}</strong>
          <p>
            {pick(summary.nextBus.notes, lang)}
            {summary.seatAvailability?.seatsLeft !== null
              ? lang === "th"
                ? ` · เหลือประมาณ ${summary.seatAvailability.seatsLeft} ที่นั่ง`
                : ` · about ${summary.seatAvailability.seatsLeft} seats left`
              : ""}
          </p>
        </div>
      </div>
      <div className="decision-panel__timetable">
        <div className="decision-panel__timetable-row">
          <span>{pick(ui.timetableWindow, lang)}</span>
          <strong>{summary.timetable.serviceWindowLabel ?? "--"}</strong>
        </div>
        <div className="decision-panel__timetable-row">
          <span>{pick(ui.timetableNext, lang)}</span>
          <strong>{summary.timetable.nextDepartures.join(" · ") || "--"}</strong>
        </div>
      </div>
      <ul className="decision-panel__reasons">
        {summary.reasons.slice(0, 2).map((reason, index) => (
          <li key={`${summary.level}-${index}`}>{pick(reason, lang)}</li>
        ))}
      </ul>
    </section>
  );
}
