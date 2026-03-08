import type { Lang, Route, RouteId } from "@shared/types";
import { pick } from "@/lib/i18n";

type Props = {
  lang: Lang;
  routes: Route[];
  activeRouteId: RouteId | null;
  onSelect: (routeId: RouteId) => void;
};

export function RouteRail({ lang, routes, activeRouteId, onSelect }: Props) {
  return (
    <div className="route-rail" role="tablist" aria-label="Routes">
      {routes.map((route) => (
        <button
          key={route.id}
          className={route.id === activeRouteId ? "route-card is-active" : "route-card"}
          onClick={() => onSelect(route.id)}
          role="tab"
          type="button"
          aria-selected={route.id === activeRouteId}
        >
          <span className="route-card__line" style={{ backgroundColor: route.color }} />
          <span className="route-card__eyebrow">{pick(route.shortName, lang)}</span>
          <strong className="route-card__title">{pick(route.name, lang)}</strong>
          <span className="route-card__axis">{pick(route.axisLabel, lang)}</span>
          <span className="route-card__copy">{pick(route.overview, lang)}</span>
          <div className="route-card__meta">
            <span>
              {route.activeVehicles} {lang === "th" ? "ออนไลน์" : "live"}
            </span>
            <span>
              {route.stopCount} {lang === "th" ? "ป้าย" : "stops"}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}
