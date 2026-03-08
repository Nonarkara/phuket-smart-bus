import type { Lang } from "@shared/types";

export type AppView = "airport" | "map" | "ride";

type Props = {
  lang: Lang;
  view: AppView;
  airportLabel: string;
  mapLabel: string;
  rideLabel: string;
  onChange: (view: AppView) => void;
};

const items: AppView[] = ["airport", "map", "ride"];

export function AppNav({
  lang,
  view,
  airportLabel,
  mapLabel,
  rideLabel,
  onChange
}: Props) {
  const labels = {
    airport: airportLabel,
    map: mapLabel,
    ride: rideLabel
  } as const;

  return (
    <nav className="app-nav card" aria-label={lang === "th" ? "การนำทาง" : "Navigation"}>
      {items.map((item) => (
        <button
          key={item}
          className={view === item ? "app-nav__button is-active" : "app-nav__button"}
          type="button"
          onClick={() => onChange(item)}
          aria-current={view === item ? "page" : undefined}
        >
          {labels[item]}
        </button>
      ))}
    </nav>
  );
}
