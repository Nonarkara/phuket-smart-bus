import type { AirportGuidePayload, Lang, RouteId } from "@shared/types";
import { formatUpdateTime, pick } from "@/lib/i18n";

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
  onQueryChange: (value: string) => void;
  onFocusMatch: (routeId: RouteId, stopId: string) => void;
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

function getDepartureLabel(guide: AirportGuidePayload) {
  if (guide.nextDeparture.minutesUntil === 0) {
    return guide.nextDeparture.label;
  }

  if (guide.nextDeparture.minutesUntil === null) {
    return guide.nextDeparture.label;
  }

  return `${guide.nextDeparture.minutesUntil} min`;
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
  onQueryChange,
  onFocusMatch
}: Props) {
  return (
    <section className="airport-shell card">
      <div className="airport-shell__intro">
        <span className="hero__eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        <p>{body}</p>
      </div>

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

      {loading && !guide ? (
        <div className="airport-guide card airport-guide--loading">
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
        <div className={`airport-guide airport-guide--${guide.recommendation}`}>
          <div className="airport-guide__primary">
            <div className="airport-guide__header">
              <span className="airport-guide__tag">{getKindLabel(guide, lang)}</span>
              <span className="airport-guide__update">
                {formatUpdateTime(guide.checkedAt, lang)}
              </span>
            </div>
            <h3>{pick(guide.headline, lang)}</h3>
            <p>{pick(guide.summary, lang)}</p>

            {guide.bestMatch ? (
              <div className="airport-guide__match airport-guide__match--inline">
                <div>
                  <span>{destinationLabel}</span>
                  <strong>{pick(guide.bestMatch.areaLabel, lang)}</strong>
                  <small>
                    {getRouteLabel(guide.bestMatch.routeId, lang)}
                    {guide.bestMatch.travelMinutes !== null
                      ? lang === "th"
                        ? ` · ประมาณ ${guide.bestMatch.travelMinutes} นาที`
                        : ` · about ${guide.bestMatch.travelMinutes} min`
                      : ""}
                  </small>
                </div>
              </div>
            ) : null}

            <div className="airport-guide__stats" aria-label={title}>
              <article className="airport-stat airport-stat--primary">
                <span>{departureLabel}</span>
                <strong>{getDepartureLabel(guide)}</strong>
                <small>
                  {guide.nextDeparture.label} · {getRouteLabel(guide.nextDeparture.routeId, lang)}
                </small>
              </article>
              <article className="airport-stat">
                <span>{seatsLabel}</span>
                <strong>
                  {guide.nextDeparture.seats?.seatsLeft ?? "--"}
                </strong>
                <small>
                  {guide.nextDeparture.seats
                    ? pick(guide.nextDeparture.seats.confidenceLabel, lang)
                    : seatsPendingLabel}
                </small>
              </article>
              <article className="airport-stat">
                <span>{boardingLabel}</span>
                <strong>{pick(guide.airportBoardingLabel, lang)}</strong>
                <small>{getRouteLabel(guide.nextDeparture.routeId, lang)}</small>
              </article>
            </div>

            {guide.bestMatch ? (
              <div className="airport-guide__match">
                <div>
                  <span>{connectionLabel}</span>
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
            {guide.boardingNotes[0] ? (
              <p className="airport-guide__note">{pick(guide.boardingNotes[0], lang)}</p>
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
