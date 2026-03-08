import type { Lang, Stop } from "@shared/types";
import { pick } from "@/lib/i18n";

type Props = {
  lang: Lang;
  stops: Stop[];
  selectedStopId: string | null;
  onSelect: (stopId: string) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  openMapsLabel: string;
  nearbyLabel: string;
  emptyState: string;
};

export function StopList({
  lang,
  stops,
  selectedStopId,
  onSelect,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  openMapsLabel,
  nearbyLabel,
  emptyState
}: Props) {
  return (
    <section className="stop-list card">
      <input
        className="stop-list__search"
        type="search"
        aria-label={searchPlaceholder}
        value={searchValue}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder={searchPlaceholder}
      />
      <div className="stop-list__items">
        {stops.length === 0 ? <div className="empty-card stop-list__empty">{emptyState}</div> : null}
        {stops.map((stop) => (
          <article
            className={stop.id === selectedStopId ? "stop-card is-active" : "stop-card"}
            key={stop.id}
          >
            <button className="stop-card__body" onClick={() => onSelect(stop.id)} type="button">
              <div className="stop-card__heading">
                <strong>{pick(stop.name, lang)}</strong>
                <span>
                  {stop.nextBus.minutesUntil === null ? stop.nextBus.label : `${stop.nextBus.minutesUntil} min`}
                </span>
              </div>
              <p className="stop-card__direction">{pick(stop.direction, lang)}</p>
              <p className="stop-card__meta">
                {nearbyLabel}: {stop.nearbyPlace.name}
              </p>
            </button>
            <div className="stop-card__footer">
              <span>
                {stop.nearbyPlace.walkMinutes} min walk · {stop.nearbyPlace.distanceMeters} m
              </span>
              <a href={stop.nearbyPlace.mapUrl} target="_blank" rel="noreferrer">
                {openMapsLabel}
              </a>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
