import { startTransition, useDeferredValue, useEffect, useEffectEvent, useState } from "react";
import type {
  Advisory,
  DecisionSummary,
  HealthPayload,
  Lang,
  LatLngTuple,
  Route,
  RouteId,
  Stop,
  VehiclePosition
} from "@shared/types";
import {
  getAdvisories,
  getDecisionSummary,
  getHealth,
  getRoutes,
  getStops,
  getVehicles
} from "./api";
import { ui, pick } from "./lib/i18n";
import { LanguageToggle } from "./components/LanguageToggle";
import { LiveMap } from "./components/LiveMap";
import { StopList } from "./components/StopList";
import { DecisionPanel } from "./components/DecisionPanel";
import { StopSpotlight } from "./components/StopSpotlight";
import { AdvisoryStack } from "./components/AdvisoryStack";
import { PassPanel } from "./components/PassPanel";
import { haversineDistanceMeters } from "./lib/geo";

const LIVE_POLL_MS = 12_000;
const PRIMARY_ROUTE_IDS: RouteId[] = ["rawai-airport", "patong-old-bus-station"];
const NEARBY_STOP_RADIUS_METERS = 700;

type AppView = "map" | "stops" | "pass";
type MapRouteFilter = RouteId | "all-core";

const LOCALE_MAP: Record<Lang, string> = {
  en: "en-GB", th: "th-TH", zh: "zh-CN", de: "de-DE", fr: "fr-FR", es: "es-ES"
};

function getInitialView(): AppView {
  if (typeof window === "undefined") return "map";
  if (window.location.pathname.startsWith("/stops") || window.location.pathname.startsWith("/ride")) return "stops";
  if (window.location.pathname.startsWith("/my-qr") || window.location.pathname.startsWith("/pass")) return "pass";
  return "map";
}

function getStoredLang(): Lang {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem("pksb-lang");
  if (stored && ["en", "th", "zh", "de", "fr", "es"].includes(stored)) return stored as Lang;
  return "en";
}

const VIEW_PATHS: Record<AppView, string> = { map: "/", stops: "/stops", pass: "/pass" };

function isPrimaryRoute(routeId: RouteId) {
  return PRIMARY_ROUTE_IDS.includes(routeId);
}

function findNearestStopMatch(
  routeStopsById: Partial<Record<RouteId, Stop[]>>,
  userLocation: LatLngTuple | null
) {
  if (!userLocation) return null;
  const candidates = PRIMARY_ROUTE_IDS.flatMap((routeId) =>
    (routeStopsById[routeId] ?? []).map((stop) => ({
      routeId,
      stop,
      distanceMeters: haversineDistanceMeters(userLocation, stop.coordinates)
    }))
  );
  if (candidates.length === 0) return null;
  return candidates.sort((l, r) => l.distanceMeters - r.distanceMeters)[0] ?? null;
}

function mergeRouteBounds(routes: Route[]) {
  if (routes.length === 0) return null;
  const [firstRoute] = routes;
  if (!firstRoute) return null;
  let minLat = firstRoute.bounds[0][0];
  let minLng = firstRoute.bounds[0][1];
  let maxLat = firstRoute.bounds[1][0];
  let maxLng = firstRoute.bounds[1][1];
  for (const route of routes) {
    minLat = Math.min(minLat, route.bounds[0][0]);
    minLng = Math.min(minLng, route.bounds[0][1]);
    maxLat = Math.max(maxLat, route.bounds[1][0]);
    maxLng = Math.max(maxLng, route.bounds[1][1]);
  }
  return [[minLat, minLng], [maxLat, maxLng]] as [LatLngTuple, LatLngTuple];
}

function formatPhuketTime(value: number, lang: Lang) {
  return new Intl.DateTimeFormat(LOCALE_MAP[lang], {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(value);
}

export default function App() {
  const [lang, setLang] = useState<Lang>(getStoredLang);
  const [view, setView] = useState<AppView>(getInitialView);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<RouteId | null>(null);
  const [mapRouteFilter, setMapRouteFilter] = useState<MapRouteFilter>("all-core");
  const [decisionSummary, setDecisionSummary] = useState<DecisionSummary | null>(null);
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [routeStopsById, setRouteStopsById] = useState<Partial<Record<RouteId, Stop[]>>>({});
  const [routeVehiclesById, setRouteVehiclesById] = useState<Partial<Record<RouteId, VehiclePosition[]>>>({});
  const [routeAdvisoriesById, setRouteAdvisoriesById] = useState<Partial<Record<RouteId, Advisory[]>>>({});
  const [userLocation, setUserLocation] = useState<LatLngTuple | null>(null);
  const [locationState, setLocationState] = useState<"requesting" | "granted" | "denied" | "unsupported" | "error">("requesting");
  const [hasAppliedLocation, setHasAppliedLocation] = useState(false);
  const [mapMode, setMapMode] = useState<"route" | "stop">("route");
  const [stopSearch, setStopSearch] = useState("");
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [isBooting, setIsBooting] = useState(true);
  const [isDecisionLoading, setIsDecisionLoading] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const deferredStopSearch = useDeferredValue(stopSearch);
  const nearestStopMatch = findNearestStopMatch(routeStopsById, userLocation);

  function persistLang(next: Lang) {
    setLang(next);
    window.localStorage.setItem("pksb-lang", next);
  }

  // --- Bootstrap ---
  useEffect(() => {
    let alive = true;
    async function bootstrap() {
      setIsBooting(true);
      try {
        const [routeData, healthData] = await Promise.all([getRoutes(), getHealth()]);
        if (!alive) return;
        const primaryRoute = routeData.find((r) => PRIMARY_ROUTE_IDS.includes(r.id)) ?? routeData[0] ?? null;
        setBootError(null);
        setRoutes(routeData);
        setHealth(healthData);
        setSelectedRouteId(primaryRoute?.id ?? null);
      } catch {
        if (alive) setBootError("bootstrap");
      } finally {
        if (alive) setIsBooting(false);
      }
    }
    void bootstrap();
    return () => { alive = false; };
  }, []);

  // --- Geolocation ---
  useEffect(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setLocationState("unsupported");
      return;
    }
    let alive = true;
    setLocationState("requesting");
    navigator.geolocation.getCurrentPosition(
      (pos) => { if (alive) { setLocationState("granted"); setUserLocation([pos.coords.latitude, pos.coords.longitude]); } },
      (err) => { if (alive) setLocationState(err.code === err.PERMISSION_DENIED ? "denied" : "error"); },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 }
    );
    return () => { alive = false; };
  }, []);

  // --- Clock ---
  useEffect(() => {
    const id = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // --- Load route data ---
  useEffect(() => {
    if (!selectedRouteId) return;
    let alive = true;
    async function loadRoute(routeId: RouteId) {
      try {
        const [stopData, vehicleData, advisoryData] = await Promise.all([
          getStops(routeId), getVehicles(routeId), getAdvisories(routeId)
        ]);
        if (!alive) return;
        const activeRoute = routes.find((r) => r.id === routeId);
        setRouteError(null);
        setRouteStopsById((c) => ({ ...c, [routeId]: stopData }));
        setRouteVehiclesById((c) => ({ ...c, [routeId]: vehicleData.vehicles }));
        setRouteAdvisoriesById((c) => ({ ...c, [routeId]: advisoryData.advisories }));
        setSelectedStopId((c) =>
          stopData.some((s) => s.id === c) ? c : activeRoute?.defaultStopId ?? stopData[0]?.id ?? null
        );
      } catch { if (alive) setRouteError("route"); }
    }
    void loadRoute(selectedRouteId);
    return () => { alive = false; };
  }, [routes, selectedRouteId]);

  // --- Prime missing routes ---
  useEffect(() => {
    const primaryRouteIds = routes.filter((r) => isPrimaryRoute(r.id)).map((r) => r.id);
    const missing = primaryRouteIds.filter(
      (id) => !(id in routeStopsById) || !(id in routeVehiclesById) || !(id in routeAdvisoriesById)
    );
    if (missing.length === 0) return;
    let alive = true;
    async function prime() {
      try {
        const entries = await Promise.all(
          missing.map(async (routeId) => {
            const [stopData, vehicleData, advisoryData] = await Promise.all([
              getStops(routeId), getVehicles(routeId), getAdvisories(routeId)
            ]);
            return { routeId, stopData, vehicleData: vehicleData.vehicles, advisoryData: advisoryData.advisories };
          })
        );
        if (!alive) return;
        setRouteStopsById((c) => ({ ...c, ...Object.fromEntries(entries.map((e) => [e.routeId, e.stopData])) }));
        setRouteVehiclesById((c) => ({ ...c, ...Object.fromEntries(entries.map((e) => [e.routeId, e.vehicleData])) }));
        setRouteAdvisoriesById((c) => ({ ...c, ...Object.fromEntries(entries.map((e) => [e.routeId, e.advisoryData])) }));
      } catch { /* keep usable */ }
    }
    void prime();
    return () => { alive = false; };
  }, [routeAdvisoriesById, routeStopsById, routeVehiclesById, routes]);

  // --- popstate ---
  useEffect(() => {
    function handlePopState() { setView(getInitialView()); }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // --- Decision summary ---
  useEffect(() => {
    if (!selectedRouteId || !selectedStopId) return;
    let alive = true;
    setIsDecisionLoading(true);
    async function load() {
      try {
        const summary = await getDecisionSummary(selectedRouteId!, selectedStopId!);
        if (alive) { setDecisionError(null); setDecisionSummary(summary); }
      } catch { if (alive) { setDecisionError("decision"); setDecisionSummary(null); } }
      finally { if (alive) setIsDecisionLoading(false); }
    }
    void load();
    return () => { alive = false; };
  }, [selectedRouteId, selectedStopId]);

  // --- Auto-apply location ---
  useEffect(() => {
    if (locationState !== "granted" || !nearestStopMatch || hasAppliedLocation) return;
    if (nearestStopMatch.distanceMeters <= NEARBY_STOP_RADIUS_METERS) {
      focusRouteStop(nearestStopMatch.routeId, nearestStopMatch.stop.id);
      setHasAppliedLocation(true);
    }
  }, [hasAppliedLocation, locationState, nearestStopMatch]);

  // --- Polling ---
  const refreshPrimaryRoutes = useEffectEvent(async (routeIds: RouteId[]) => {
    try {
      const [routeData, healthData, entries] = await Promise.all([
        getRoutes(), getHealth(),
        Promise.all(routeIds.map(async (routeId) => {
          const [vehicleData, advisoryData] = await Promise.all([getVehicles(routeId), getAdvisories(routeId)]);
          return { routeId, vehicles: vehicleData.vehicles, advisories: advisoryData.advisories };
        }))
      ]);
      startTransition(() => {
        setRoutes(routeData);
        setHealth(healthData);
        setRouteVehiclesById((c) => ({ ...c, ...Object.fromEntries(entries.map((e) => [e.routeId, e.vehicles])) }));
        setRouteAdvisoriesById((c) => ({ ...c, ...Object.fromEntries(entries.map((e) => [e.routeId, e.advisories])) }));
      });
    } catch { /* preserve last state */ }
  });

  const refreshDecisionSnapshot = useEffectEvent(async (routeId: RouteId, stopId: string) => {
    try {
      const summary = await getDecisionSummary(routeId, stopId);
      if (selectedRouteId !== routeId || selectedStopId !== stopId) return;
      startTransition(() => setDecisionSummary(summary));
    } catch { /* preserve last card */ }
  });

  useEffect(() => {
    const pollingRouteIds = routes.filter((r) => isPrimaryRoute(r.id)).map((r) => r.id);
    if (pollingRouteIds.length === 0) return;
    const id = window.setInterval(() => void refreshPrimaryRoutes(pollingRouteIds), LIVE_POLL_MS);
    return () => window.clearInterval(id);
  }, [refreshPrimaryRoutes, routes]);

  useEffect(() => {
    if (!selectedRouteId || !selectedStopId) return;
    const id = window.setInterval(() => void refreshDecisionSnapshot(selectedRouteId, selectedStopId), LIVE_POLL_MS);
    return () => window.clearInterval(id);
  }, [selectedRouteId, selectedStopId]);

  // --- Derived state ---
  const stops = selectedRouteId ? routeStopsById[selectedRouteId] ?? [] : [];
  const vehicles = selectedRouteId ? routeVehiclesById[selectedRouteId] ?? [] : [];
  const advisories = selectedRouteId ? routeAdvisoriesById[selectedRouteId] ?? [] : [];
  const filteredStops = stops.filter((stop) => {
    const v = deferredStopSearch.trim().toLowerCase();
    if (!v) return true;
    return stop.name.en.toLowerCase().includes(v) || stop.name.th.toLowerCase().includes(v) || stop.nearbyPlace.name.toLowerCase().includes(v);
  });
  const visibleRoutes = routes.filter((r) => PRIMARY_ROUTE_IDS.includes(r.id));
  const activeRoute = routes.find((r) => r.id === selectedRouteId) ?? null;
  const selectedStop = stops.find((s) => s.id === selectedStopId) ?? null;
  const activeAdvisoryCount = advisories.filter((a) => a.active).length;
  const mapVisibleRoutes =
    mapMode === "stop"
      ? activeRoute ? [activeRoute] : visibleRoutes
      : mapRouteFilter === "all-core"
        ? visibleRoutes
        : visibleRoutes.filter((r) => r.id === mapRouteFilter);
  const mapVisibleStops = mapMode === "stop" ? stops : mapVisibleRoutes.flatMap((r) => routeStopsById[r.id] ?? []);
  const mapVisibleVehicles = mapVisibleRoutes.flatMap((r) => routeVehiclesById[r.id] ?? []);
  const mapBounds = mapMode === "stop" && activeRoute ? activeRoute.bounds : mergeRouteBounds(mapVisibleRoutes);
  const totalLiveVehicles = mapVisibleVehicles.length > 0
    ? mapVisibleVehicles.length
    : mapVisibleRoutes.reduce((sum, r) => sum + r.activeVehicles, 0);

  const phuketTime = formatPhuketTime(clockNow, lang);

  // --- Navigation ---
  function navigate(nextView: AppView) {
    if (nextView === "map") {
      startTransition(() => { setMapMode("route"); setMapRouteFilter("all-core"); });
    }
    setView(nextView);
    if (typeof window !== "undefined") {
      const nextPath = VIEW_PATHS[nextView];
      if (window.location.pathname !== nextPath) window.history.pushState({ view: nextView }, "", nextPath);
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
      setView("stops");
    });
    if (typeof window !== "undefined") window.history.pushState({ view: "stops" }, "", VIEW_PATHS.stops);
  }

  return (
    <div className="app-shell">
      {/* --- Minimal Header --- */}
      <header className="topbar">
        <strong className="topbar__brand">{pick(ui.appTitle, lang)}</strong>
        <div className="topbar__right">
          <span className="topbar__time">{phuketTime}</span>
          <LanguageToggle lang={lang} onChange={persistLang} />
        </div>
      </header>

      {/* --- Content --- */}
      <div className="app-content">
        {bootError || routeError ? (
          <div className="status-banner" role="status">{pick(ui.loadingError, lang)}</div>
        ) : null}

        {/* ===== LIVE MAP ===== */}
        {view === "map" ? (
          <main className="map-view">
            <div className="map-container">
              <LiveMap
                lang={lang}
                routes={mapVisibleRoutes}
                stops={mapVisibleStops}
                vehicles={mapVisibleVehicles}
                userLocation={userLocation}
                selectedStop={selectedStop}
                mode={mapMode}
                bounds={mapBounds}
                animationDurationMs={LIVE_POLL_MS}
                onModeChange={setMapMode}
              />
              {/* Floating route pills */}
              <div className="map-pills">
                <button
                  className={mapRouteFilter === "all-core" ? "map-pill is-active" : "map-pill"}
                  type="button"
                  onClick={() => startTransition(() => { setMapRouteFilter("all-core"); setMapMode("route"); })}
                >
                  {pick(ui.routeAll, lang)}
                </button>
                {visibleRoutes.map((route) => {
                  const count = routeVehiclesById[route.id]?.length ?? route.activeVehicles;
                  return (
                    <button
                      key={route.id}
                      className={mapRouteFilter === route.id ? "map-pill is-active" : "map-pill"}
                      style={{ "--pill-color": route.color } as React.CSSProperties}
                      type="button"
                      onClick={() => {
                        const next = mapRouteFilter === route.id ? "all-core" : route.id;
                        startTransition(() => {
                          setMapRouteFilter(next);
                          setSelectedRouteId(route.id);
                          setMapMode("route");
                        });
                      }}
                    >
                      <span className="map-pill__dot" />
                      {pick(route.shortName, lang)}
                      <span className="map-pill__count">{count}</span>
                    </button>
                  );
                })}
              </div>
              {/* Live count badge */}
              <div className="map-badge">
                <span className="map-badge__pulse" />
                {totalLiveVehicles} {pick(ui.mapLiveCountLabel, lang)}
              </div>
            </div>
          </main>
        ) : null}

        {/* ===== STOPS ===== */}
        {view === "stops" ? (
          <main className="stops-layout">
            <section className="stops-section">
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
            <section className="detail-section">
              <DecisionPanel
                lang={lang}
                summary={decisionSummary}
                alertCount={activeAdvisoryCount}
                loading={isDecisionLoading || isBooting}
                errorMessage={decisionError ? pick(ui.decisionUnavailableBody, lang) : null}
              />
              <StopSpotlight
                lang={lang}
                stop={selectedStop}
                summary={decisionSummary}
                advisoryCount={activeAdvisoryCount}
                title={pick(ui.ridePageTitle, lang)}
                body=""
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
              <AdvisoryStack
                lang={lang}
                advisories={advisories}
                emptyState={pick(ui.advisoryNone, lang)}
              />
            </section>
          </main>
        ) : null}

        {/* ===== PASS ===== */}
        {view === "pass" ? (
          <main className="pass-view">
            <PassPanel lang={lang} now={clockNow} />
          </main>
        ) : null}
      </div>

      {/* --- Bottom Navigation --- */}
      <nav className="bottom-nav" aria-label="Navigation">
        {(["map", "stops", "pass"] as AppView[]).map((tab) => (
          <button
            key={tab}
            className={view === tab ? "bottom-nav__tab is-active" : "bottom-nav__tab"}
            type="button"
            onClick={() => navigate(tab)}
            aria-current={view === tab ? "page" : undefined}
          >
            <span className="bottom-nav__icon">
              {tab === "map" ? "🗺" : tab === "stops" ? "🚏" : "🎫"}
            </span>
            <span className="bottom-nav__label">{pick(ui[tab === "map" ? "navMap" : tab === "stops" ? "navStops" : "navPass"], lang)}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
