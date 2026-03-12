import type { ReactNode } from "react";
import type { AirportGuidePayload, Lang, RouteId, SeatAvailability } from "@shared/types";
import { formatUpdateTime, pick, ui } from "@/lib/i18n";

type Props = {
  lang: Lang;
  guide: AirportGuidePayload | null;
  loading: boolean;
  errorMessage: string | null;
  title: string;
  eyebrow: string;
  body: string;
  searchPlaceholder: string;
  quickTitle: string;
  departureLabel: string;
  seatsLabel: string;
  seatsPendingLabel: string;
  boardingLabel: string;
  timesLabel: string;
  connectionLabel: string;
  focusActionLabel: string;
  fallbackTitle: string;
  fallbackBody: string;
  query: string;
  previewMap: ReactNode;
  onQueryChange: (value: string) => void;
  onFocusMatch: (routeId: RouteId, stopId: string) => void;
  onFocusBoarding: (routeId: RouteId, stopId: string) => void;
};

function getKindLabel(guide: AirportGuidePayload, lang: Lang) {
  switch (guide.recommendation) {
    case "ready":
      return lang === "th" ? "พร้อมขึ้นรถ" : "Airport ready";
    case "direct":
      return lang === "th" ? "ตรงถึง" : "Direct";
    case "transfer":
      return lang === "th" ? "ต้องต่อรถ" : "Transfer";
    case "not_supported":
      return lang === "th" ? "นอกเส้นทาง" : "Outside lines";
  }
}

function getDepartureBasisLabel(guide: AirportGuidePayload, lang: Lang) {
  switch (guide.nextDeparture.basis) {
    case "live":
      return lang === "th" ? "รถคันนี้รายงานสด" : "Bus reporting live";
    case "fallback":
      return lang === "th" ? "รถจำลองจากตารางเวลา" : "Simulated from timetable";
    case "schedule":
      return lang === "th" ? "อิงเวลาตามตาราง" : "Based on the published schedule";
  }
}

function getDepartureLabel(guide: AirportGuidePayload, lang: Lang) {
  if (guide.nextDeparture.minutesUntil === null) {
    return guide.nextDeparture.label;
  }

  if (guide.nextDeparture.minutesUntil === 0) {
    return lang === "th" ? "ขึ้นรถได้เลย" : "Board now";
  }

  return lang === "th" ? `อีก ${guide.nextDeparture.minutesUntil} นาที` : `${guide.nextDeparture.minutesUntil} min`;
}

function getRouteLabel(routeId: RouteId, lang: Lang) {
  if (routeId === "rawai-airport") {
    return lang === "th" ? "สายสนามบิน" : "Airport Line";
  }

  if (routeId === "patong-old-bus-station") {
    return lang === "th" ? "สายป่าตอง" : "Patong Line";
  }

  return lang === "th" ? "ดราก้อน ไลน์" : "Dragon Line";
}

function getCabinMeta(seats: SeatAvailability | null, lang: Lang) {
  if (!seats) {
    return null;
  }

  const parts: string[] = [];

  if (seats.occupiedSeats !== null) {
    parts.push(lang === "th" ? `นั่งอยู่ ${seats.occupiedSeats} คน` : `${seats.occupiedSeats} seated`);
  }

  if (seats.passengerFlow) {
    parts.push(
      lang === "th"
        ? `ขึ้น ${seats.passengerFlow.boardingsRecent} · ลง ${seats.passengerFlow.alightingsRecent}`
        : `${seats.passengerFlow.boardingsRecent} on · ${seats.passengerFlow.alightingsRecent} off`
    );
  }

  return parts.length > 0 ? parts.join(" · ") : null;
}

function getDriverMeta(seats: SeatAvailability | null, lang: Lang) {
  if (!seats?.driverAttention) {
    return null;
  }

  const confidence =
    seats.driverAttention.confidence !== null
      ? lang === "th"
        ? ` · มั่นใจ ${Math.round(seats.driverAttention.confidence * 100)}%`
        : ` · ${Math.round(seats.driverAttention.confidence * 100)}% confidence`
      : "";

  return `${pick(seats.driverAttention.label, lang)}${confidence}`;
}

function formatThaiBaht(value: number, lang: Lang) {
  const locale = lang === "th" ? "th-TH" : "en-US";

  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0
  }).format(value);
}

export function AirportGuidePanel({
  lang,
  guide,
  loading,
  errorMessage,
  title,
  eyebrow,
  body,
  searchPlaceholder,
  quickTitle,
  departureLabel,
  seatsLabel,
  seatsPendingLabel,
  boardingLabel,
  timesLabel,
  connectionLabel,
  focusActionLabel,
  fallbackTitle,
  fallbackBody,
  query,
  previewMap,
  onQueryChange,
  onFocusMatch,
  onFocusBoarding
}: Props) {
  const cabinMeta = getCabinMeta(guide?.nextDeparture.seats ?? null, lang);
  const driverMeta = getDriverMeta(guide?.nextDeparture.seats ?? null, lang);

  return (
    <section className="airport-shell card">
      <div className="airport-shell__intro">
        <span className="hero__eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        <p>{body}</p>
      </div>

      {loading && !guide ? (
        <div className="airport-arrival airport-arrival--loading">
          <div className="skeleton skeleton--headline" />
          <div className="skeleton skeleton--body" />
          <div className="skeleton skeleton--body short" />
        </div>
      ) : null}

      {!loading && !guide ? (
        <div className="airport-guide airport-guide--fallback">
          <span className="airport-guide__tag">{fallbackTitle}</span>
          <h3>{fallbackTitle}</h3>
          <p>{errorMessage ?? fallbackBody}</p>
        </div>
      ) : null}

      {guide ? (
        <div className="airport-arrival">
          <article className="airport-hero">
            <div className="airport-hero__header">
              <div className="airport-hero__fare">
                <span className="airport-hero__eyebrow">{pick(ui.airportSavingsTitle, lang)}</span>
                <strong>{formatThaiBaht(guide.fareComparison.busFareThb, lang)} THB</strong>
                <p>
                  {pick(ui.airportBusFareLabel, lang)} · ~
                  {formatThaiBaht(guide.fareComparison.taxiFareEstimateThb, lang)} THB{" "}
                  {pick(ui.airportTaxiFareLabel, lang).toLowerCase()}
                </p>
              </div>

              <div className="airport-hero__departure">
                <span className="airport-hero__eyebrow">{departureLabel}</span>
                <strong>{getDepartureLabel(guide, lang)}</strong>
                <p>
                  {guide.nextDeparture.label} · {getRouteLabel(guide.nextDeparture.routeId, lang)}
                  {guide.nextDeparture.liveLicensePlate ? ` · ${guide.nextDeparture.liveLicensePlate}` : ""}
                </p>
              </div>
            </div>

            <p className="airport-hero__summary">{pick(guide.fareComparison.savingsCopy, lang)}</p>

            <div className="airport-hero__metrics">
              <div className="airport-hero__metric">
                <span>{seatsLabel}</span>
                <strong>{guide.nextDeparture.seats?.seatsLeft ?? "--"}</strong>
                <small>
                  {guide.nextDeparture.seats
                    ? pick(guide.nextDeparture.seats.confidenceLabel, lang)
                    : seatsPendingLabel}
                </small>
              </div>
              <div className="airport-hero__metric">
                <span>{pick(ui.airportWeatherTitle, lang)}</span>
                <strong>{guide.weatherSummary.maxRainProbability}%</strong>
                <small>{pick(guide.weatherSummary.conditionLabel, lang)}</small>
              </div>
              <div className="airport-hero__metric">
                <span>{boardingLabel}</span>
                <strong>{pick(guide.airportBoardingLabel, lang)}</strong>
                <small>{pick(guide.boardingWalk.secondaryInstruction, lang)}</small>
              </div>
            </div>

            {cabinMeta || driverMeta ? (
              <div className="airport-hero__meta">
                {cabinMeta ? <small>{cabinMeta}</small> : null}
                {driverMeta ? <small>{driverMeta}</small> : null}
              </div>
            ) : null}

            <div className="airport-hero__footer">
              <div className="airport-hero__footer-copy">
                <strong>{pick(ui.airportSavingsHeadline, lang)}</strong>
                <small>
                  {getDepartureBasisLabel(guide, lang)} · {pick(guide.weatherSummary.recommendation, lang)}
                </small>
              </div>
              <button
                className="airport-guide__action"
                type="button"
                onClick={() => onFocusBoarding(guide.nextDeparture.routeId, guide.boardingWalk.focusStopId)}
              >
                {pick(ui.airportBoardingAction, lang)}
              </button>
            </div>
          </article>

          <article className="airport-walk-strip">
            <span className="airport-walk-strip__label">{pick(ui.airportWalkTitle, lang)}</span>
            <strong>{pick(guide.boardingWalk.primaryInstruction, lang)}</strong>
          </article>

          {previewMap ? <div className="airport-map-preview">{previewMap}</div> : null}
        </div>
      ) : null}

      <label className="airport-search">
        <span className="sr-only">{title}</span>
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
        />
      </label>

      {guide && query.trim() ? (
        <div className={`airport-guide airport-guide--${guide.recommendation}`}>
          <div className="airport-guide__primary">
            <div className="airport-guide__header">
              <span className="airport-guide__tag">{getKindLabel(guide, lang)}</span>
              <span className="airport-guide__update">{formatUpdateTime(guide.checkedAt, lang)}</span>
            </div>

            <h3>{pick(guide.headline, lang)}</h3>
            <p>{pick(guide.summary, lang)}</p>

            {guide.bestMatch ? (
              <div className="airport-guide__match">
                <div>
                  <span>{connectionLabel}</span>
                  <strong>{pick(guide.bestMatch.areaLabel, lang)}</strong>
                  <small>
                    {getRouteLabel(guide.bestMatch.routeId, lang)} · {pick(guide.bestMatch.stopName, lang)}
                    {guide.bestMatch.travelMinutes !== null
                      ? lang === "th"
                        ? ` · ประมาณ ${guide.bestMatch.travelMinutes} นาที`
                        : ` · about ${guide.bestMatch.travelMinutes} min`
                      : ""}
                  </small>
                </div>
                <button
                  className="airport-guide__action"
                  type="button"
                  onClick={() => onFocusMatch(guide.bestMatch!.routeId, guide.bestMatch!.stopId)}
                >
                  {focusActionLabel}
                </button>
              </div>
            ) : null}
          </div>

          <div className="airport-guide__secondary">
            <div className="airport-guide__times">
              <span>{timesLabel}</span>
              <strong>{guide.followingDepartures.join(" · ") || "--"}</strong>
            </div>
            {guide.boardingNotes[2] ? (
              <p className="airport-guide__note">{pick(guide.boardingNotes[2], lang)}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {guide?.quickDestinations.length ? (
        <div className="airport-quick">
          <strong>{quickTitle}</strong>
          <div className="airport-quick__grid">
            {guide.quickDestinations.map((item) => (
              <button
                key={item.id}
                className="airport-quick-card"
                type="button"
                onClick={() => onQueryChange(pick(item.label, lang))}
              >
                <strong>{pick(item.label, lang)}</strong>
                <small>
                  {item.travelMinutes === null
                    ? getRouteLabel(item.routeId, lang)
                    : lang === "th"
                      ? `${getRouteLabel(item.routeId, lang)} · ${item.travelMinutes} นาที`
                      : `${getRouteLabel(item.routeId, lang)} · ${item.travelMinutes} min`}
                </small>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
