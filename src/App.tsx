import { startTransition, useDeferredValue, useEffect, useEffectEvent, useRef, useState } from "react";
import type {
  Advisory,
  DecisionSummary,
  EnvironmentSnapshot,
  HealthPayload,
  Lang,
  LatLngTuple,
  PriceComparison,
  Route,
  RouteId,
  Stop,
  VehiclePosition
} from "@shared/types";
import {
  getAdvisories,
  getCompare,
  getDecisionSummary,
  getEnvironment,
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
import { CompareView } from "./components/CompareView";
import { OpsConsole } from "./components/OpsConsole";
import { WelcomeSheet } from "./components/WelcomeSheet";
import { haversineDistanceMeters } from "./lib/geo";

const LIVE_POLL_MS = 12_000;
const PRIMARY_ROUTE_IDS: RouteId[] = [
  "rawai-airport", "patong-old-bus-station",
  "rassada-phi-phi", "rassada-ao-nang", "bang-rong-koh-yao", "chalong-racha"
];
const NEARBY_STOP_RADIUS_METERS = 700;

type AppView = "map" | "compare" | "more";
type MorePanel = "stops" | "pass" | null;
type MapRouteFilter = RouteId | "all-core";

const VIEW_PATHS: Record<AppView, string> = { map: "/", compare: "/compare", more: "/more" };

function getInitialView(): AppView | "ops" {
  if (typeof window === "undefined") return "map";
  const p = window.location.pathname;
  if (p.startsWith("/ops")) return "ops";
  if (p.startsWith("/compare")) return "compare";
  if (p.startsWith("/more") || p.startsWith("/stops") || p.startsWith("/pass") || p.startsWith("/ride")) return "more";
  return "map";
}

function getStoredLang(): Lang {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem("pksb-lang");
  if (stored && ["en", "th", "zh", "de", "fr", "es"].includes(stored)) return stored as Lang;
  return "en";
}

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

const FERRY_IDS = new Set<RouteId>(["rassada-phi-phi", "rassada-ao-nang", "bang-rong-koh-yao", "chalong-racha"]);

function mergeRouteBounds(routes: Route[]) {
  const landRoutes = routes.filter((r) => !FERRY_IDS.has(r.id));
  const boundsRoutes = landRoutes.length > 0 ? landRoutes : routes;
  if (boundsRoutes.length === 0) return null;
  const [firstRoute] = boundsRoutes;
  if (!firstRoute) return null;
  let minLat = firstRoute.bounds[0][0];
  let minLng = firstRoute.bounds[0][1];
  let maxLat = firstRoute.bounds[1][0];
  let maxLng = firstRoute.bounds[1][1];
  for (const route of boundsRoutes) {
    minLat = Math.min(minLat, route.bounds[0][0]);
    minLng = Math.min(minLng, route.bounds[0][1]);
    maxLat = Math.max(maxLat, route.bounds[1][0]);
    maxLng = Math.max(maxLng, route.bounds[1][1]);
  }
  return [[minLat, minLng], [maxLat, maxLng]] as [LatLngTuple, LatLngTuple];
}

// --- iOS 7 thin-line SVG icons ---
function MapIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>;
}
function CompareIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2v20M2 12h20"/><path d="M17 7l-5 5-5-5"/><path d="M7 17l5-5 5 5"/></svg>;
}
function MoreIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>;
}

const TAB_ICONS: Record<AppView, () => React.ReactNode> = {
  map: MapIcon,
  compare: CompareIcon,
  more: MoreIcon,
};

const TAB_LABELS: Record<AppView, keyof typeof ui> = {
  map: "navMap",
  compare: "navCompare",
  more: "navMore",
};

export default function App() {
  const [isOps, setIsOps] = useState(() => getInitialView() === "ops");
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" && window.innerWidth < 768
  );

  useEffect(() => {
    function onResize() { setIsMobile(window.innerWidth < 768); }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function goOps() {
    setIsOps(true);
    window.history.pushState({}, "", "/ops");
  }
  function goTourist() {
    setIsOps(false);
    window.history.pushState({}, "", "/");
  }

  // Full-screen ops dashboard
  if (isOps) return <OpsConsole onToggle={goTourist} />;

  // Mobile: render tourist app directly, no frame
  if (isMobile) return <TouristApp onToggle={goOps} />;

  // Desktop: smartphone frame + side panel
  return (
    <div className="desktop-shell">
      <div className="desktop-shell__side desktop-shell__side--left" />
      <div className="phone-frame">
        <div className="phone-frame__notch" />
        <div className="phone-frame__screen">
          <TouristApp onToggle={goOps} />
        </div>
        <div className="phone-frame__home" />
      </div>
      <div className="desktop-shell__side desktop-shell__side--right">
        <div className="desktop-shell__brand">
          <h2 className="desktop-shell__title">Phuket Smart Bus</h2>
          <p className="desktop-shell__subtitle">Real-time transit for Phuket Island</p>
        </div>
        <button className="desktop-shell__ops-btn" type="button" onClick={goOps}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
          Operator Console
        </button>
        <p className="desktop-shell__hint">Open in your phone for the best experience</p>
      </div>
    </div>
  );
}

function TouristApp({ onToggle }: { onToggle: () => void }) {
  const [lang, setLang] = useState<Lang>(getStoredLang);
  const [view, setView] = useState<AppView>(() => {
    const init = getInitialView();
    return init === "ops" ? "map" : init;
  });
  const [morePanel, setMorePanel] = useState<MorePanel>(null);
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
  const [comparisons, setComparisons] = useState<PriceComparison[]>([]);
  const [environment, setEnvironment] = useState<EnvironmentSnapshot | null>(null);
  const [requestSent, setRequestSent] = useState(false);
  const deferredStopSearch = useDeferredValue(stopSearch);
  const nearestStopMatch = findNearestStopMatch(routeStopsById, userLocation);
  const pollInFlightRef = useRef({ routes: false, decision: false });

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
    getCompare().then((data) => { if (alive) setComparisons(data); }).catch(() => {});
    getEnvironment().then((data) => { if (alive) setEnvironment(data); }).catch(() => {});
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
    function handlePopState() {
      const init = getInitialView();
      if (init !== "ops") setView(init);
    }
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
    if (pollInFlightRef.current.routes) return;
    pollInFlightRef.current.routes = true;
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
    finally { pollInFlightRef.current.routes = false; }
  });

  const refreshDecisionSnapshot = useEffectEvent(async (routeId: RouteId, stopId: string) => {
    if (pollInFlightRef.current.decision) return;
    pollInFlightRef.current.decision = true;
    try {
      const summary = await getDecisionSummary(routeId, stopId);
      if (selectedRouteId !== routeId || selectedStopId !== stopId) return;
      startTransition(() => setDecisionSummary(summary));
    } catch { /* preserve last card */ }
    finally { pollInFlightRef.current.decision = false; }
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
  const allVehicles = Object.values(routeVehiclesById).flat() as VehiclePosition[];

  function handleRequestBus() {
    if (!userLocation) return;
    fetch("/api/demand-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat: userLocation[0], lng: userLocation[1] })
    }).catch(() => {});
    setRequestSent(true);
    setTimeout(() => setRequestSent(false), 30_000); // reset after 30s
  }

  // --- Navigation ---
  function navigate(nextView: AppView) {
    if (nextView === "map") {
      startTransition(() => { setMapMode("route"); setMapRouteFilter("all-core"); });
    }
    if (nextView === "more") {
      setMorePanel("stops");
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
      setMorePanel("stops");
      setView("more");
    });
    if (typeof window !== "undefined") window.history.pushState({ view: "more" }, "", "/more");
  }

  return (
    <div className="app-shell">
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
              {/* Floating language toggle */}
              <div className="map-lang">
                <LanguageToggle lang={lang} onChange={persistLang} />
              </div>
              {/* Weather pill */}
              {environment ? (
                <div className="map-weather">
                  {environment.tempC}°C · AQI {environment.aqi}
                  {environment.rainProb > 20 ? ` · Rain ${environment.rainProb}%` : ""}
                </div>
              ) : null}
              {/* Live count badge */}
              <div className="map-badge">
                <span className="map-badge__pulse" />
                {totalLiveVehicles} {pick(ui.mapLiveCountLabel, lang)}
              </div>
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
            </div>
            {/* Welcome bottom sheet — outside map-container, inside map-view */}
            <WelcomeSheet
              lang={lang}
              vehicles={allVehicles}
              comparisons={comparisons}
              allStops={stops}
              onNavigateToStop={(stopId) => {
                startTransition(() => {
                  setSelectedStopId(stopId);
                  setMapMode("stop");
                });
              }}
            />
            {/* Request bus button */}
            {userLocation && !requestSent ? (
              <button className="request-bus-btn" type="button" onClick={handleRequestBus}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l2 2"/></svg>
                {pick(ui.requestBus, lang)}
              </button>
            ) : requestSent ? (
              <button className="request-bus-btn request-bus-btn--sent" type="button" disabled>
                ✓ {pick(ui.requestSent, lang)}
              </button>
            ) : null}
          </main>
        ) : null}

        {/* ===== COMPARE ===== */}
        {view === "compare" ? (
          <main className="stops-view">
            <div className="stops-view__header">
              <LanguageToggle lang={lang} onChange={persistLang} />
            </div>
            <CompareView lang={lang} comparisons={comparisons} />
          </main>
        ) : null}

        {/* ===== MORE (Stops + Pass) ===== */}
        {view === "more" ? (
          <main className="stops-view">
            <div className="stops-view__header">
              <div className="more-tabs">
                <button
                  className={morePanel === "stops" ? "more-tab is-active" : "more-tab"}
                  type="button"
                  onClick={() => setMorePanel("stops")}
                >{pick(ui.navStops, lang)}</button>
                <button
                  className={morePanel === "pass" ? "more-tab is-active" : "more-tab"}
                  type="button"
                  onClick={() => setMorePanel("pass")}
                >{pick(ui.navPass, lang)}</button>
              </div>
              <LanguageToggle lang={lang} onChange={persistLang} />
            </div>

            {morePanel === "stops" ? (
              <div className="stops-layout">
                <section className="stops-section grouped-section">
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
                <section className="detail-section grouped-section">
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
              </div>
            ) : null}

            {morePanel === "pass" ? (
              <PassPanel lang={lang} now={clockNow} />
            ) : null}
          </main>
        ) : null}
      </div>

      {/* --- Bottom Navigation — 3 tabs --- */}
      <nav className="bottom-nav" aria-label="Navigation">
        {(["map", "compare", "more"] as AppView[]).map((tab) => {
          const Icon = TAB_ICONS[tab];
          return (
            <button
              key={tab}
              className={view === tab ? "bottom-nav__tab is-active" : "bottom-nav__tab"}
              type="button"
              onClick={() => navigate(tab)}
              aria-current={view === tab ? "page" : undefined}
            >
              <span className="bottom-nav__icon"><Icon /></span>
              <span className="bottom-nav__label">{pick(ui[TAB_LABELS[tab]], lang)}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
