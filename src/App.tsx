import { startTransition, useDeferredValue, useEffect, useEffectEvent, useState } from "react";
import type {
  Advisory,
  AirportGuidePayload,
  DecisionSummary,
  HealthPayload,
  Lang,
  Route,
  RouteId,
  Stop,
  VehiclePosition
} from "@shared/types";
import {
  getAdvisories,
  getAirportGuide,
  getDecisionSummary,
  getHealth,
  getRoutes,
  getStops,
  getVehicles
} from "./api";
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
import { AirportGuidePanel } from "./components/AirportGuidePanel";
import { AppNav, type AppView } from "./components/AppNav";

const LIVE_POLL_MS = 12_000;
const PRIMARY_ROUTE_IDS: RouteId[] = ["rawai-airport", "patong-old-bus-station"];

const VIEW_PATHS: Record<AppView, string> = {
  airport: "/",
  map: "/live-map",
  ride: "/ride"
};

function getInitialView(): AppView {
  if (typeof window === "undefined") {
    return "airport";
  }

  if (window.location.pathname.startsWith("/live-map")) {
    return "map";
  }

  if (window.location.pathname.startsWith("/ride")) {
    return "ride";
  }

  return "airport";
}

export default function App() {
  const [lang, setLang] = useState<Lang>("en");
  const [view, setView] = useState<AppView>(getInitialView);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<RouteId | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [vehicles, setVehicles] = useState<VehiclePosition[]>([]);
  const [advisories, setAdvisories] = useState<Advisory[]>([]);
  const [decisionSummary, setDecisionSummary] = useState<DecisionSummary | null>(null);
  const [airportGuide, setAirportGuide] = useState<AirportGuidePayload | null>(null);
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [mapMode, setMapMode] = useState<"route" | "stop">("route");
  const [stopSearch, setStopSearch] = useState("");
  const [airportQuery, setAirportQuery] = useState("");
  const [isBooting, setIsBooting] = useState(true);
  const [isDecisionLoading, setIsDecisionLoading] = useState(false);
  const [isGuideLoading, setIsGuideLoading] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [guideError, setGuideError] = useState<string | null>(null);
  const deferredStopSearch = useDeferredValue(stopSearch);
  const deferredAirportQuery = useDeferredValue(airportQuery);

  useEffect(() => {
    let alive = true;

    async function bootstrap() {
      setIsBooting(true);

      try {
        const [routeData, healthData] = await Promise.all([getRoutes(), getHealth()]);

        if (!alive) {
          return;
        }

        const primaryRoute = routeData.find((route) => PRIMARY_ROUTE_IDS.includes(route.id)) ?? routeData[0] ?? null;

        setBootError(null);
        setRoutes(routeData);
        setHealth(healthData);
        setSelectedRouteId(primaryRoute?.id ?? null);
      } catch {
        if (alive) {
          setBootError("bootstrap");
        }
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
      try {
        const [stopData, vehicleData, advisoryData] = await Promise.all([
          getStops(routeId),
          getVehicles(routeId),
          getAdvisories(routeId)
        ]);

        if (!alive) {
          return;
        }

        const activeRoute = routes.find((route) => route.id === routeId);
        setRouteError(null);
        setStops(stopData);
        setVehicles(vehicleData.vehicles);
        setAdvisories(advisoryData.advisories);
        setSelectedStopId((current) =>
          stopData.some((stop) => stop.id === current) ? current : activeRoute?.defaultStopId ?? stopData[0]?.id ?? null
        );
      } catch {
        if (alive) {
          setRouteError("route");
        }
      }
    }

    void loadRoute(selectedRouteId);

    return () => {
      alive = false;
    };
  }, [routes, selectedRouteId]);

  useEffect(() => {
    let alive = true;
    setIsGuideLoading(true);

    async function loadAirportGuide() {
      try {
        const guide = await getAirportGuide(deferredAirportQuery.trim());

        if (alive) {
          setGuideError(null);
          setAirportGuide(guide);
        }
      } catch {
        if (alive) {
          setGuideError("guide");
        }
      } finally {
        if (alive) {
          setIsGuideLoading(false);
        }
      }
    }

    void loadAirportGuide();

    return () => {
      alive = false;
    };
  }, [deferredAirportQuery]);

  useEffect(() => {
    function handlePopState() {
      setView(getInitialView());
    }

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

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
          setDecisionError(null);
          setDecisionSummary(summary);
        }
      } catch {
        if (alive) {
          setDecisionError("decision");
          setDecisionSummary(null);
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
      // Preserve the last visible route state if background refresh fails.
    }
  });

  const refreshAirportGuide = useEffectEvent(async (query: string) => {
    try {
      const guide = await getAirportGuide(query);

      startTransition(() => {
        setAirportGuide(guide);
      });
    } catch {
      // Keep the current airport recommendation card visible while retries continue.
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
    const intervalId = window.setInterval(() => {
      void refreshAirportGuide(deferredAirportQuery.trim());
    }, LIVE_POLL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [deferredAirportQuery]);

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

  const visibleRoutes = routes.filter((route) => PRIMARY_ROUTE_IDS.includes(route.id));
  const activeRoute = routes.find((route) => route.id === selectedRouteId) ?? null;
  const selectedStop = stops.find((stop) => stop.id === selectedStopId) ?? null;
  const activeAdvisoryCount = advisories.filter((advisory) => advisory.active).length;
  const totalLiveVehicles = visibleRoutes.reduce((sum, route) => sum + route.activeVehicles, 0);
  const mapStops =
    selectedStop && !filteredStops.some((stop) => stop.id === selectedStop.id)
      ? [...filteredStops, selectedStop]
      : filteredStops;
  const sourceStatuses = decisionSummary?.sourceStatuses ?? health?.sources ?? [];
  const statusMessage = bootError ?? routeError;

  function navigate(nextView: AppView) {
    setView(nextView);

    if (typeof window !== "undefined") {
      const nextPath = VIEW_PATHS[nextView];

      if (window.location.pathname !== nextPath) {
        window.history.pushState({ view: nextView }, "", nextPath);
      }
    }
  }

  function focusRouteStop(routeId: RouteId, stopId: string) {
    startTransition(() => {
      setSelectedRouteId(routeId);
      setSelectedStopId(stopId);
      setDecisionSummary(null);
      setDecisionError(null);
      setRouteError(null);
      setMapMode("stop");
      setStopSearch("");
      setView("ride");
    });

    if (typeof window !== "undefined") {
      window.history.pushState({ view: "ride" }, "", VIEW_PATHS.ride);
    }
  }

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

      {statusMessage ? (
        <div className="status-banner card" role="status">
          {pick(ui.loadingError, lang)}
        </div>
      ) : null}

      <AppNav
        lang={lang}
        view={view}
        airportLabel={pick(ui.navAirport, lang)}
        mapLabel={pick(ui.navMap, lang)}
        rideLabel={pick(ui.navRide, lang)}
        onChange={navigate}
      />

      {view === "airport" ? (
        <main className="page-shell">
          <AirportGuidePanel
            lang={lang}
            guide={airportGuide}
            loading={isGuideLoading || isBooting}
            errorMessage={guideError ? pick(ui.airportGuideFallbackBody, lang) : null}
            title={pick(ui.airportTitle, lang)}
            eyebrow={pick(ui.airportEyebrow, lang)}
            body={pick(ui.airportBody, lang)}
            searchPlaceholder={pick(ui.airportSearchPlaceholder, lang)}
            quickTitle={pick(ui.airportQuickTitle, lang)}
            departureLabel={pick(ui.airportDepartureLabel, lang)}
            seatsLabel={pick(ui.airportSeatsLabel, lang)}
            seatsPendingLabel={pick(ui.airportSeatsPending, lang)}
            boardingLabel={pick(ui.airportBoardingLabel, lang)}
            timesLabel={pick(ui.airportTimesLabel, lang)}
            connectionLabel={pick(ui.airportConnectionLabel, lang)}
            destinationLabel={pick(ui.airportDestinationLabel, lang)}
            focusActionLabel={pick(ui.airportFocusAction, lang)}
            fallbackTitle={pick(ui.airportGuideFallbackTitle, lang)}
            fallbackBody={pick(ui.airportGuideFallbackBody, lang)}
            query={airportQuery}
            onQueryChange={setAirportQuery}
            onFocusMatch={focusRouteStop}
          />

          <section className="action-strip card" aria-label={pick(ui.airportStoryTitle, lang)}>
            <button className="story-card__action is-primary" type="button" onClick={() => navigate("map")}>
              {pick(ui.airportStorySecondary, lang)}
            </button>
            <button className="story-card__action" type="button" onClick={() => navigate("ride")}>
              {pick(ui.airportStoryPrimary, lang)}
            </button>
          </section>
        </main>
      ) : null}

      {view === "map" ? (
        <main className="page-shell">
          <section className="map-stage card">
            <div className="section-heading map-stage__heading">
              <div>
                <p className="hero__eyebrow">{pick(ui.airportSecondaryTitle, lang)}</p>
                <h3>{pick(ui.mapHeroTitle, lang)}</h3>
              </div>
              <p>{pick(ui.airportSecondaryBody, lang)}</p>
            </div>
            <div className="map-stage__summary" aria-label={pick(ui.mapHeroTitle, lang)}>
              <strong>{totalLiveVehicles}</strong>
              <span>{pick(ui.mapLiveCountLabel, lang)}</span>
            </div>
            <RouteRail
              lang={lang}
              routes={visibleRoutes}
              activeRouteId={selectedRouteId}
              onSelect={(routeId) => {
                startTransition(() => {
                  setSelectedRouteId(routeId);
                  setDecisionSummary(null);
                  setDecisionError(null);
                  setRouteError(null);
                  setMapMode("route");
                  setStopSearch("");
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
        </main>
      ) : null}

      {view === "ride" ? (
        <main className="layout">
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
                  setDecisionError(null);
                  setMapMode("stop");
                })
              }
              searchValue={stopSearch}
              onSearchChange={setStopSearch}
              searchPlaceholder={pick(ui.searchPlaceholder, lang)}
              openMapsLabel={pick(ui.openMaps, lang)}
              nearbyLabel={pick(ui.nearby, lang)}
              emptyState={pick(ui.stopEmpty, lang)}
            />
          </section>

          <section className="decision-section">
            <div className="section-heading">
              <div>
                <p className="hero__eyebrow">{pick(ui.heroTitle, lang)}</p>
                <h3>{pick(ui.heroTitle, lang)}</h3>
              </div>
              <p>{selectedStop ? pick(selectedStop.name, lang) : pick(ui.journeyChooseStop, lang)}</p>
            </div>
            <DecisionPanel
              lang={lang}
              summary={decisionSummary}
              alertCount={activeAdvisoryCount}
              loading={isDecisionLoading || isBooting}
              errorMessage={decisionError ? pick(ui.decisionUnavailableBody, lang) : null}
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
            summaryUnavailableLabel={pick(ui.decisionUnavailableBody, lang)}
            loading={isDecisionLoading || isBooting}
          />

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
      ) : null}
    </div>
  );
}
