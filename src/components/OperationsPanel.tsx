import type { Lang, OperationsOverviewPayload, PassengerFlowEvent, RouteId } from "@shared/types";
import { formatUpdateTime, pick, ui } from "@/lib/i18n";

type Props = {
  lang: Lang;
  overview: OperationsOverviewPayload | null;
  loading: boolean;
};

function getRouteAccent(routeId: RouteId) {
  if (routeId === "rawai-airport") {
    return "#16b8b0";
  }

  if (routeId === "patong-old-bus-station") {
    return "#ffcc33";
  }

  return "#db0000";
}

function getEventLabel(event: PassengerFlowEvent, lang: Lang) {
  return event.eventType === "boarding" ? pick(ui.opsRecentBoarding, lang) : pick(ui.opsRecentAlighting, lang);
}

export function OperationsPanel({ lang, overview, loading }: Props) {
  if (loading && !overview) {
    return (
      <section className="operations-panel card">
        <div className="skeleton skeleton--headline" />
        <div className="skeleton skeleton--body" />
        <div className="skeleton skeleton--body short" />
      </section>
    );
  }

  if (!overview) {
    return null;
  }

  return (
    <section className="operations-panel card">
      <div className="section-heading operations-panel__heading">
        <div>
          <p className="hero__eyebrow">{pick(ui.opsTitle, lang)}</p>
          <h3>{pick(ui.opsTitle, lang)}</h3>
        </div>
        <p>{pick(ui.opsBody, lang)}</p>
      </div>

      <div className="operations-panel__routes">
        {overview.routes.map((route) => (
          <article className="operations-route-card" key={route.routeId}>
            <span
              className="operations-route-card__line"
              style={{ backgroundColor: getRouteAccent(route.routeId) }}
            />
            <div className="operations-route-card__header">
              <div>
                <span className="operations-route-card__eyebrow">{pick(route.axisLabel, lang)}</span>
                <strong>{pick(route.shortName, lang)}</strong>
              </div>
              <span className="operations-route-card__count">
                {route.vehiclesOnline} {lang === "th" ? "คัน" : "vehicles"}
              </span>
            </div>
            <div className="operations-route-card__stats">
              <div>
                <span>{pick(ui.opsGpsLabel, lang)}</span>
                <strong>{route.gpsDevicesLive}</strong>
              </div>
              <div>
                <span>{pick(ui.opsCameraLabel, lang)}</span>
                <strong>{route.seatCamerasLive}</strong>
              </div>
              <div>
                <span>{pick(ui.opsSeatsLabel, lang)}</span>
                <strong>{route.seatsLeftVisible ?? "--"}</strong>
              </div>
              <div>
                <span>{pick(ui.opsBoardingsLabel, lang)}</span>
                <strong>{route.boardingsLastHour}</strong>
              </div>
              <div>
                <span>{pick(ui.opsAlightingsLabel, lang)}</span>
                <strong>{route.alightingsLastHour}</strong>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="operations-events">
        <div className="operations-events__header">
          <strong>{pick(ui.opsRecentTitle, lang)}</strong>
          <span>{formatUpdateTime(overview.checkedAt, lang)}</span>
        </div>

        {overview.recentEvents.length === 0 ? (
          <p className="operations-events__empty">{pick(ui.opsRecentEmpty, lang)}</p>
        ) : (
          <div className="operations-events__list">
            {overview.recentEvents.map((event) => (
              <article className="operations-event" key={event.id}>
                <div>
                  <span className="operations-event__type">{getEventLabel(event, lang)}</span>
                  <strong>{event.passengers}</strong>
                </div>
                <div>
                  <strong>
                    {event.stopName ? pick(event.stopName, lang) : pick(ui.opsRecentUnknownStop, lang)}
                  </strong>
                  <small>{formatUpdateTime(event.updatedAt, lang)}</small>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
