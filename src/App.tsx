import { startTransition, useDeferredValue, useEffect, useEffectEvent, useState } from "react";
import type { Advisory, DecisionSummary, HealthPayload, Lang, Route, RouteId, Stop, VehiclePosition } from "@shared/types";
import { getAdvisories, getDecisionSummary, getHealth, getRoutes, getStops, getVehicles } from "./api";
import { ui, pick } from "./lib/i18n";
import { LanguageToggle } from "./components/LanguageToggle";
import { RouteRail } from "./components/RouteRail";
import { DecisionPanel } from "./components/DecisionPanel";
import { SourcePills } from "./components/SourcePills";
import { LiveMap } from "./components/LiveMap";
import { StopList } from "./components/StopList";
import { AdvisoryStack } from "./components/AdvisoryStack";
import { StopSpotlight } from "./components/StopSpotlight";
import { BrandLogo } from "./components/BrandLogo";

const LIVE_POLL_MS = 12_000;

export default function App() {
  const [lang, setLang] = useState<Lang>("en");
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<RouteId | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [vehicles, setVehicles] = useState<VehiclePosition[]>([]);
  const [advisories, setAdvisories] = useState<Advisory[]>([]);
  const [decisionSummary, setDecisionSummary] = useState<DecisionSummary | null>(null);
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [mapMode, setMapMode] = useState<"route" | "stop">("route");
  const [stopSearch, setStopSearch] = useState("");
  const [isBooting, setIsBooting] = useState(true);
  const [isDecisionLoading, setIsDecisionLoading] = useState(false);
  const deferredStopSearch = useDeferredValue(stopSearch);

  useEffect(() => {
    let alive = true;

    async function bootstrap() {
      setIsBooting(true);
      try {
        const [routeData, healthData] = await Promise.all([getRoutes(), getHealth()]);

        if (!alive) {
          return;
        }

        setRoutes(routeData);
        setHealth(healthData);
        setSelectedRouteId(routeData[0]?.id ?? null);
      } finally {
        if (alive) {
          setIsBooting(false);
        }
      }
    }

    void bootstrap();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedRouteId) {
      return;
    }

    let alive = true;

    async function loadRoute(routeId: RouteId) {
      const [stopData, vehicleData, advisoryData] = await Promise.all([
        getStops(routeId),
        getVehicles(routeId),
        getAdvisories(routeId)
      ]);

      if (!alive) {
        return;
      }

      const activeRoute = routes.find((route) => route.id === routeId);
      setStops(stopData);
      setVehicles(vehicleData.vehicles);
      setAdvisories(advisoryData.advisories);
      setSelectedStopId((current) =>
        stopData.some((stop) => stop.id === current) ? current : activeRoute?.defaultStopId ?? stopData[0]?.id ?? null
      );
    }

    void loadRoute(selectedRouteId);

    return () => {
      alive = false;
    };
  }, [routes, selectedRouteId]);

  useEffect(() => {
    if (!selectedRouteId || !selectedStopId) {
      return;
    }

    let alive = true;
    setIsDecisionLoading(true);

    async function loadDecisionSummary() {
      try {
        const summary = await getDecisionSummary(selectedRouteId, selectedStopId);

        if (alive) {
          setDecisionSummary(summary);
        }
      } finally {
        if (alive) {
          setIsDecisionLoading(false);
        }
      }
    }

    void loadDecisionSummary();

    return () => {
      alive = false;
    };
  }, [selectedRouteId, selectedStopId]);

  const refreshRouteSnapshot = useEffectEvent(async (routeId: RouteId) => {
    try {
      const [routeData, healthData, vehicleData, advisoryData] = await Promise.all([
        getRoutes(),
        getHealth(),
        getVehicles(routeId),
        getAdvisories(routeId)
      ]);

      if (selectedRouteId !== routeId) {
        return;
      }

      startTransition(() => {
        setRoutes(routeData);
        setHealth(healthData);
        setVehicles(vehicleData.vehicles);
        setAdvisories(advisoryData.advisories);
      });
    } catch {
      // Keep the most recent successful snapshot visible if background refresh fails.
    }
  });

  const refreshDecisionSnapshot = useEffectEvent(async (routeId: RouteId, stopId: string) => {
    try {
      const summary = await getDecisionSummary(routeId, stopId);

      if (selectedRouteId !== routeId || selectedStopId !== stopId) {
        return;
      }

      startTransition(() => {
        setDecisionSummary(summary);
      });
    } catch {
      // Preserve the last decision card instead of flashing an error on intermittent refresh failures.
    }
  });

  useEffect(() => {
    if (!selectedRouteId) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refreshRouteSnapshot(selectedRouteId);
    }, LIVE_POLL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [selectedRouteId]);

  useEffect(() => {
    if (!selectedRouteId || !selectedStopId) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refreshDecisionSnapshot(selectedRouteId, selectedStopId);
    }, LIVE_POLL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [selectedRouteId, selectedStopId]);

  const filteredStops = stops.filter((stop) => {
    const value = deferredStopSearch.trim().toLowerCase();

    if (!value) {
      return true;
    }

    return (
      stop.name.en.toLowerCase().includes(value) ||
      stop.name.th.toLowerCase().includes(value) ||
      stop.nearbyPlace.name.toLowerCase().includes(value)
    );
  });

  const activeRoute = routes.find((route) => route.id === selectedRouteId) ?? null;
  const selectedStop = stops.find((stop) => stop.id === selectedStopId) ?? null;
  const activeAdvisoryCount = advisories.filter((advisory) => advisory.active).length;
  const totalLiveVehicles = routes.reduce((sum, route) => sum + route.activeVehicles, 0);
  const mapStops =
    selectedStop && !filteredStops.some((stop) => stop.id === selectedStop.id)
      ? [...filteredStops, selectedStop]
      : filteredStops;
  const sourceStatuses = decisionSummary?.sourceStatuses ?? health?.sources ?? [];

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <BrandLogo className="brand-logo" />
          <span className="topbar__eyebrow">{pick(ui.appSubtitle, lang)}</span>
          <h1 className="sr-only">{pick(ui.appTitle, lang)}</h1>
          <p className="topbar__intro">{pick(ui.appBody, lang)}</p>
        </div>
        <LanguageToggle lang={lang} onChange={setLang} />
      </header>

      <main className="layout">
        <section className="map-stage card">
          <div className="map-stage__header">
            <div>
              <p className="hero__eyebrow">{pick(ui.mapHeroTitle, lang)}</p>
              <h2>{pick(ui.mapHeroTitle, lang)}</h2>
              <p>{pick(ui.mapHeroBody, lang)}</p>
            </div>
            <div className="map-stage__summary" aria-label={pick(ui.mapHeroTitle, lang)}>
              <strong>{totalLiveVehicles}</strong>
              <span>{pick(ui.mapLiveCountLabel, lang)}</span>
            </div>
          </div>
          <RouteRail
            lang={lang}
            routes={routes}
            activeRouteId={selectedRouteId}
            onSelect={(routeId) => {
              startTransition(() => {
                setSelectedRouteId(routeId);
                setDecisionSummary(null);
                setMapMode("route");
              });
            }}
          />
          <div className="map-stage__map">
            <LiveMap
              lang={lang}
              route={activeRoute}
              stops={mapStops}
              vehicles={vehicles}
              selectedStop={selectedStop}
              mode={mapMode}
              onModeChange={setMapMode}
            />
          </div>
          <div className="map-stage__footer">
            <SourcePills lang={lang} sources={sourceStatuses} />
          </div>
        </section>

        <section className="decision-section">
          <div className="section-heading">
            <div>
              <p className="hero__eyebrow">{pick(ui.heroTitle, lang)}</p>
              <h3>{pick(ui.heroTitle, lang)}</h3>
            </div>
            <p>{selectedStop ? pick(selectedStop.name, lang) : pick(ui.mapLoading, lang)}</p>
          </div>
          <DecisionPanel
            lang={lang}
            summary={decisionSummary}
            alertCount={activeAdvisoryCount}
            loading={isDecisionLoading || isBooting}
          />
        </section>

        <StopSpotlight
          lang={lang}
          stop={selectedStop}
          summary={decisionSummary}
          advisoryCount={activeAdvisoryCount}
          title={pick(ui.trackingTitle, lang)}
          body={pick(ui.trackingBody, lang)}
          nextBusLabel={pick(ui.nextBusLabel, lang)}
          liveBusesLabel={pick(ui.liveBusesLabel, lang)}
          activeAlertsLabel={pick(ui.activeAlertsLabel, lang)}
          nearbyLabel={pick(ui.nearby, lang)}
          walkLabel={pick(ui.walkLabel, lang)}
          routeDirectionLabel={pick(ui.routeDirectionLabel, lang)}
          openMapsLabel={pick(ui.openMaps, lang)}
          timetableTitle={pick(ui.timetableTitle, lang)}
          timetableFirstLabel={pick(ui.timetableFirst, lang)}
          timetableLastLabel={pick(ui.timetableLast, lang)}
          timetableWindowLabel={pick(ui.timetableWindow, lang)}
          timetableNextLabel={pick(ui.timetableNext, lang)}
          timetableUpdatedLabel={pick(ui.timetableUpdated, lang)}
          timetableSourceLabel={pick(ui.timetableSource, lang)}
          timetableOpenSourceLabel={pick(ui.timetableOpenSource, lang)}
          loading={isDecisionLoading || isBooting}
        />

        <section className="stops-section">
          <div className="section-heading">
            <h3>{pick(ui.stopTitle, lang)}</h3>
          </div>
          <StopList
            lang={lang}
            stops={filteredStops}
            selectedStopId={selectedStopId}
            onSelect={(stopId) =>
              startTransition(() => {
                setSelectedStopId(stopId);
                setMapMode("stop");
              })
            }
            searchValue={stopSearch}
            onSearchChange={setStopSearch}
            searchPlaceholder={pick(ui.searchPlaceholder, lang)}
            openMapsLabel={pick(ui.openMaps, lang)}
            nearbyLabel={pick(ui.nearby, lang)}
          />
        </section>

        <section className="advisory-section">
          <div className="section-heading">
            <h3>{pick(ui.advisoryTitle, lang)}</h3>
          </div>
          <AdvisoryStack
            lang={lang}
            advisories={advisories}
            emptyState={pick(ui.advisoryNone, lang)}
          />
        </section>
      </main>
    </div>
  );
}
