import type { Lang, Route, RouteId } from "@shared/types";
import { localizedText } from "@shared/localizedText";
import { pick } from "@/lib/i18n";

type Props = {
  lang: Lang;
  routes: Route[];
  activeRouteId: RouteId | "all-core";
  onSelect: (routeId: RouteId) => void;
};

export function RouteRail({ lang, routes, activeRouteId, onSelect }: Props) {
  return (
    <div className="route-rail" role="group" aria-label={pick(localizedText("Map focus", "โฟกัสแผนที่"), lang)}>
      {routes.map((route) => (
        <button
          key={route.id}
          className={route.id === activeRouteId ? "route-card is-active" : "route-card"}
          onClick={() => onSelect(route.id)}
          type="button"
          aria-pressed={route.id === activeRouteId}
        >
          <span className="route-card__line" style={{ backgroundColor: route.color }} />
          <span className="route-card__eyebrow">{pick(route.axisLabel, lang)}</span>
          <strong className="route-card__title">{pick(route.shortName, lang)}</strong>
          <span className="route-card__copy">{pick(route.name, lang)}</span>
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
