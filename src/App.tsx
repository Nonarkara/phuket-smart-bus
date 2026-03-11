import { startTransition, useDeferredValue, useEffect, useEffectEvent, useState } from "react";
import type {
  Advisory,
  AirportGuidePayload,
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
import { LocationBanner } from "./components/LocationBanner";
import { PassPanel } from "./components/PassPanel";
import { haversineDistanceMeters } from "./lib/geo";

const LIVE_POLL_MS = 12_000;
const PRIMARY_ROUTE_IDS: RouteId[] = ["rawai-airport", "patong-old-bus-station"];
const AIRPORT_MATCH_RADIUS_METERS = 650;
const NEARBY_STOP_RADIUS_METERS = 700;

const VIEW_PATHS: Record<AppView, string> = {
  airport: "/",
  map: "/live-map",
  ride: "/ride",
  qr: "/my-qr"
};

type LocationState = "requesting" | "granted" | "denied" | "unsupported" | "error";
type MapRouteFilter = RouteId | "all-core";

type NearestStopMatch = {
  routeId: RouteId;
  stop: Stop;
  distanceMeters: number;
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

  if (window.location.pathname.startsWith("/my-qr")) {
    return "qr";
  }

  return "airport";
}

function isPrimaryRoute(routeId: RouteId) {
  return PRIMARY_ROUTE_IDS.includes(routeId);
}

function getRouteLabel(routeId: RouteId, lang: Lang) {
  if (routeId === "rawai-airport") {
    return lang === "th" ? "สายสนามบิน" : "Airport Line";
  }

  return lang === "th" ? "สายป่าตอง" : "Patong Line";
}

function formatDistanceLabel(distanceMeters: number, lang: Lang) {
  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters / 10) * 10} m`;
  }

  return lang === "th"
    ? `${(distanceMeters / 1000).toFixed(1)} กม.`
    : `${(distanceMeters / 1000).toFixed(1)} km`;
}

function findNearestStopMatch(
  routeStopsById: Partial<Record<RouteId, Stop[]>>,
  userLocation: LatLngTuple | null
) {
  if (!userLocation) {
    return null;
  }

  const candidates = PRIMARY_ROUTE_IDS.flatMap((routeId) =>
    (routeStopsById[routeId] ?? []).map((stop) => ({
      routeId,
      stop,
      distanceMeters: haversineDistanceMeters(userLocation, stop.coordinates)
    }))
  );

  if (candidates.length === 0) {
    return null;
  }

  return candidates.sort((left, right) => left.distanceMeters - right.distanceMeters)[0] ?? null;
}

function mergeRouteBounds(routes: Route[]) {
  if (routes.length === 0) {
    return null;
  }

  const [firstRoute] = routes;

  if (!firstRoute) {
    return null;
  }

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

  return [
    [minLat, minLng],
    [maxLat, maxLng]
  ] as [LatLngTuple, LatLngTuple];
}

function formatPhuketTime(value: number, lang: Lang) {
  const locale = lang === "th" ? "th-TH" : "en-GB";

  return new Intl.DateTimeFormat(locale, {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(value);
}

function formatPhuketDate(value: number, lang: Lang) {
  const locale = lang === "th" ? "th-TH" : "en-GB";

  return new Intl.DateTimeFormat(locale, {
    timeZone: "Asia/Bangkok",
    weekday: "short",
    day: "numeric",
    month: "short"
  }).format(value);
}

export default function App() {
  const [lang, setLang] = useState<Lang>("en");
  const [view, setView] = useState<AppView>(getInitialView);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<RouteId | null>(null);
  const [mapRouteFilter, setMapRouteFilter] = useState<MapRouteFilter>("all-core");
  const [decisionSummary, setDecisionSummary] = useState<DecisionSummary | null>(null);
  const [airportGuide, setAirportGuide] = useState<AirportGuidePayload | null>(null);
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [routeStopsById, setRouteStopsById] = useState<Partial<Record<RouteId, Stop[]>>>({});
  const [routeVehiclesById, setRouteVehiclesById] = useState<Partial<Record<RouteId, VehiclePosition[]>>>({});
  const [routeAdvisoriesById, setRouteAdvisoriesById] = useState<Partial<Record<RouteId, Advisory[]>>>({});
  const [userLocation, setUserLocation] = useState<LatLngTuple | null>(null);
  const [locationState, setLocationState] = useState<LocationState>("requesting");
  const [hasAppliedLocation, setHasAppliedLocation] = useState(false);
  const [mapMode, setMapMode] = useState<"route" | "stop">("route");
  const [stopSearch, setStopSearch] = useState("");
  const [airportQuery, setAirportQuery] = useState("");
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [isBooting, setIsBooting] = useState(true);
  const [isDecisionLoading, setIsDecisionLoading] = useState(false);
  const [isGuideLoading, setIsGuideLoading] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [guideError, setGuideError] = useState<string | null>(null);
  const deferredStopSearch = useDeferredValue(stopSearch);
  const deferredAirportQuery = useDeferredValue(airportQuery);
  const nearestStopMatch = findNearestStopMatch(routeStopsById, userLocation);
  const isAirportLocation =
    nearestStopMatch?.stop.name.en === "Phuket Airport" &&
    nearestStopMatch.distanceMeters <= AIRPORT_MATCH_RADIUS_METERS;

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
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setLocationState("unsupported");
      return;
    }

    let alive = true;
    setLocationState("requesting");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!alive) {
          return;
        }

        setLocationState("granted");
        setUserLocation([position.coords.latitude, position.coords.longitude]);
      },
      (error) => {
        if (!alive) {
          return;
        }

        setLocationState(error.code === error.PERMISSION_DENIED ? "denied" : "error");
      },
      {
        enableHighAccuracy: true,
        timeout: 10_000,
        maximumAge: 60_000
      }
    );

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setClockNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
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
        setRouteStopsById((current) => ({
          ...current,
          [routeId]: stopData
        }));
        setRouteVehiclesById((current) => ({
          ...current,
          [routeId]: vehicleData.vehicles
        }));
        setRouteAdvisoriesById((current) => ({
          ...current,
          [routeId]: advisoryData.advisories
        }));
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
    const primaryRouteIds = routes.filter((route) => isPrimaryRoute(route.id)).map((route) => route.id);
    const missingRouteIds = primaryRouteIds.filter(
      (routeId) =>
        !(routeId in routeStopsById) ||
        !(routeId in routeVehiclesById) ||
        !(routeId in routeAdvisoriesById)
    );

    if (missingRouteIds.length === 0) {
      return;
    }

    let alive = true;

    async function primeRouteStops() {
      try {
        const entries = await Promise.all(
          missingRouteIds.map(async (routeId) => {
            const [stopData, vehicleData, advisoryData] = await Promise.all([
              getStops(routeId),
              getVehicles(routeId),
              getAdvisories(routeId)
            ]);

            return {
              routeId,
              stopData,
              vehicleData: vehicleData.vehicles,
              advisoryData: advisoryData.advisories
            };
          })
        );

        if (!alive) {
          return;
        }

        setRouteStopsById((current) => ({
          ...current,
          ...Object.fromEntries(entries.map((entry) => [entry.routeId, entry.stopData]))
        }));
        setRouteVehiclesById((current) => ({
          ...current,
          ...Object.fromEntries(entries.map((entry) => [entry.routeId, entry.vehicleData]))
        }));
        setRouteAdvisoriesById((current) => ({
          ...current,
          ...Object.fromEntries(entries.map((entry) => [entry.routeId, entry.advisoryData]))
        }));
      } catch {
        // Keep the app usable even if one stop list takes longer to load.
      }
    }

    void primeRouteStops();

    return () => {
      alive = false;
    };
  }, [routeAdvisoriesById, routeStopsById, routeVehiclesById, routes]);

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

  useEffect(() => {
    if (locationState !== "granted" || !nearestStopMatch || hasAppliedLocation) {
      return;
    }

    if (isAirportLocation) {
      startTransition(() => {
        setSelectedRouteId(nearestStopMatch.routeId);
        setSelectedStopId(nearestStopMatch.stop.id);
        setDecisionError(null);
        setRouteError(null);
      });
      setHasAppliedLocation(true);
      return;
    }

    if (nearestStopMatch.distanceMeters <= NEARBY_STOP_RADIUS_METERS) {
      focusRouteStop(nearestStopMatch.routeId, nearestStopMatch.stop.id);
      setHasAppliedLocation(true);
    }
  }, [hasAppliedLocation, isAirportLocation, locationState, nearestStopMatch]);

  const refreshPrimaryRoutes = useEffectEvent(async (routeIds: RouteId[]) => {
    try {
      const [routeData, healthData, entries] = await Promise.all([
        getRoutes(),
        getHealth(),
        Promise.all(
          routeIds.map(async (routeId) => {
            const [vehicleData, advisoryData] = await Promise.all([getVehicles(routeId), getAdvisories(routeId)]);

            return {
              routeId,
              vehicles: vehicleData.vehicles,
              advisories: advisoryData.advisories
            };
          })
        )
      ]);

      startTransition(() => {
        setRoutes(routeData);
        setHealth(healthData);
        setRouteVehiclesById((current) => ({
          ...current,
          ...Object.fromEntries(entries.map((entry) => [entry.routeId, entry.vehicles]))
        }));
        setRouteAdvisoriesById((current) => ({
          ...current,
          ...Object.fromEntries(entries.map((entry) => [entry.routeId, entry.advisories]))
        }));
      });
    } catch {
      // Preserve the last visible network state if background refresh fails.
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
    const pollingRouteIds = routes.filter((route) => isPrimaryRoute(route.id)).map((route) => route.id);

    if (pollingRouteIds.length === 0) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refreshPrimaryRoutes(pollingRouteIds);
    }, LIVE_POLL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [refreshPrimaryRoutes, routes]);

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

  const stops = selectedRouteId ? routeStopsById[selectedRouteId] ?? [] : [];
  const vehicles = selectedRouteId ? routeVehiclesById[selectedRouteId] ?? [] : [];
  const advisories = selectedRouteId ? routeAdvisoriesById[selectedRouteId] ?? [] : [];
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
  const airportRoute = routes.find((route) => route.id === "rawai-airport") ?? null;
  const airportStops = routeStopsById["rawai-airport"] ?? [];
  const airportVehicles = routeVehiclesById["rawai-airport"] ?? [];
  const activeRoute = routes.find((route) => route.id === selectedRouteId) ?? null;
  const selectedStop = stops.find((stop) => stop.id === selectedStopId) ?? null;
  const airportPreviewStop =
    airportStops.find((stop) => stop.id === airportGuide?.boardingWalk.focusStopId) ??
    airportStops.find((stop) => stop.name.en === "Phuket Airport") ??
    null;
  const activeAdvisoryCount = advisories.filter((advisory) => advisory.active).length;
  const mapVisibleRoutes =
    mapMode === "stop"
      ? activeRoute
        ? [activeRoute]
        : visibleRoutes
      : mapRouteFilter === "all-core"
        ? visibleRoutes
        : visibleRoutes.filter((route) => route.id === mapRouteFilter);
  const mapVisibleStops =
    mapMode === "stop"
      ? stops
      : mapVisibleRoutes.flatMap((route) => routeStopsById[route.id] ?? []);
  const mapVisibleVehicles = mapVisibleRoutes.flatMap((route) => routeVehiclesById[route.id] ?? []);
  const mapBounds =
    mapMode === "stop" && activeRoute ? activeRoute.bounds : mergeRouteBounds(mapVisibleRoutes);
  const totalLiveVehicles =
    mapVisibleVehicles.length > 0
      ? mapVisibleVehicles.length
      : mapVisibleRoutes.reduce((sum, route) => sum + route.activeVehicles, 0);
  const sourceStatuses = decisionSummary?.sourceStatuses ?? health?.sources ?? [];
  const statusMessage = bootError ?? routeError;
  const phuketTimeLabel = formatPhuketTime(clockNow, lang);
  const phuketDateLabel = formatPhuketDate(clockNow, lang);
  let mapToolbarEyebrow = pick(ui.mapNetworkLabel, lang);
  let mapToolbarTitle = pick(ui.mapAllLinesTitle, lang);
  let mapToolbarMeta =
    lang === "th"
      ? "กำลังแสดงสองสายหลักพร้อมกัน"
      : "Both main lines are visible now.";

  if (mapMode === "stop" && selectedStop) {
    mapToolbarEyebrow = pick(ui.mapSelectionLabel, lang);
    mapToolbarTitle = pick(selectedStop.name, lang);
    mapToolbarMeta =
      lang === "th"
        ? `${vehicles.length} คันที่กำลังรายงานใกล้ป้ายนี้`
        : `${vehicles.length} vehicles reporting near this stop`;
  } else if (mapRouteFilter !== "all-core") {
    mapToolbarEyebrow = pick(ui.mapFocusLabel, lang);
    mapToolbarTitle = getRouteLabel(mapRouteFilter, lang);
    mapToolbarMeta =
      lang === "th"
        ? `${totalLiveVehicles} คันที่เห็นบนเส้นทางนี้`
        : `${totalLiveVehicles} vehicles visible on this line`;
  }

  const airportMapPreview =
    airportRoute && airportPreviewStop ? (
      <LiveMap
        lang={lang}
        routes={[airportRoute]}
        stops={[airportPreviewStop]}
        vehicles={airportVehicles}
        userLocation={userLocation}
        selectedStop={airportPreviewStop}
        mode="stop"
        bounds={airportRoute.bounds}
        toolbarEyebrow={pick(ui.airportMapEyebrow, lang)}
        toolbarTitle={pick(ui.airportMapTitle, lang)}
        toolbarMeta={pick(ui.airportMapBody, lang)}
        highlightStopIds={[airportPreviewStop.id]}
        highlightVehicleId={airportGuide?.nextDeparture.liveBusId ?? null}
        animationDurationMs={LIVE_POLL_MS}
        showModeToggle={false}
        testId="airport-map-preview"
        onModeChange={() => {}}
      />
    ) : null;

  function navigate(nextView: AppView) {
    if (nextView === "map") {
      startTransition(() => {
        setMapMode("route");
        setMapRouteFilter("all-core");
      });
    }

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

  function openNearestMatch() {
    if (!nearestStopMatch) {
      return;
    }

    if (isAirportLocation) {
      navigate("airport");
      return;
    }

    if (nearestStopMatch.distanceMeters <= NEARBY_STOP_RADIUS_METERS) {
      focusRouteStop(nearestStopMatch.routeId, nearestStopMatch.stop.id);
      return;
    }

    navigate("map");
  }

  let locationHeadline: string | null = null;
  let locationBody: string | null = null;
  let locationActionLabel: string | null = null;

  if (locationState === "requesting") {
    locationHeadline = pick(ui.locationRequestTitle, lang);
    locationBody = pick(ui.locationRequestBody, lang);
  } else if (locationState === "granted" && nearestStopMatch) {
    const distanceLabel = formatDistanceLabel(nearestStopMatch.distanceMeters, lang);

    if (isAirportLocation) {
      locationHeadline = pick(ui.locationAirportTitle, lang);
      locationBody = pick(ui.locationAirportBody, lang);
    } else if (nearestStopMatch.distanceMeters <= NEARBY_STOP_RADIUS_METERS) {
      locationHeadline = pick(ui.locationNearStopTitle, lang);
      locationBody =
        lang === "th"
          ? `${pick(nearestStopMatch.stop.name, lang)} อยู่ห่างประมาณ ${distanceLabel} บน${getRouteLabel(nearestStopMatch.routeId, lang)}`
          : `${pick(nearestStopMatch.stop.name, lang)} is about ${distanceLabel} away on the ${getRouteLabel(
              nearestStopMatch.routeId,
              lang
            )}`;
      locationActionLabel = pick(ui.locationOpenStop, lang);
    } else {
      locationHeadline = pick(ui.locationFarTitle, lang);
      locationBody =
        lang === "th"
          ? `${pick(nearestStopMatch.stop.name, lang)} อยู่ห่างประมาณ ${distanceLabel} ให้เปิดแผนที่สดเพื่อตรวจดูสองเส้นทางหลักก่อนออกเดินทาง`
          : `${pick(nearestStopMatch.stop.name, lang)} is about ${distanceLabel} away. Open the live map to inspect the two main lines before heading there.`;
      locationActionLabel = pick(ui.locationOpenMap, lang);
    }
  } else if (locationState === "denied") {
    locationHeadline = pick(ui.locationDeniedTitle, lang);
    locationBody = pick(ui.locationDeniedBody, lang);
  } else if (locationState === "unsupported" || locationState === "error") {
    locationHeadline = pick(ui.locationUnsupportedTitle, lang);
    locationBody = pick(ui.locationUnsupportedBody, lang);
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
        <div className="topbar__meta">
          <div className="clock-chip" aria-live="polite" aria-label={pick(ui.clockLabel, lang)}>
            <span className="clock-chip__label">{pick(ui.clockLabel, lang)}</span>
            <strong>{phuketTimeLabel}</strong>
            <small>
              {phuketDateLabel} · {pick(ui.clockMeta, lang)}
            </small>
          </div>
          <LanguageToggle lang={lang} onChange={setLang} />
        </div>
      </header>

      <AppNav
        lang={lang}
        view={view}
        airportLabel={pick(ui.navAirport, lang)}
        mapLabel={pick(ui.navMap, lang)}
        rideLabel={pick(ui.navRide, lang)}
        qrLabel={pick(ui.navQr, lang)}
        onChange={navigate}
      />

      <div className="app-content">
      {statusMessage ? (
        <div className="status-banner card" role="status">
          {pick(ui.loadingError, lang)}
        </div>
      ) : null}

      {locationHeadline && locationBody ? (
        <LocationBanner
          eyebrow={pick(ui.locationEyebrow, lang)}
          headline={locationHeadline}
          body={locationBody}
          actionLabel={locationActionLabel}
          onAction={locationActionLabel ? openNearestMatch : null}
        />
      ) : null}

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
            focusActionLabel={pick(ui.airportFocusAction, lang)}
            fallbackTitle={pick(ui.airportGuideFallbackTitle, lang)}
            fallbackBody={pick(ui.airportGuideFallbackBody, lang)}
            query={airportQuery}
            previewMap={airportMapPreview}
            onQueryChange={setAirportQuery}
            onFocusMatch={focusRouteStop}
            onFocusBoarding={focusRouteStop}
          />
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
              activeRouteId={mapRouteFilter}
              onSelect={(routeId) => {
                const nextMapRouteFilter = mapRouteFilter === routeId ? "all-core" : routeId;

                startTransition(() => {
                  setMapRouteFilter(nextMapRouteFilter);
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
                routes={mapVisibleRoutes}
                stops={mapVisibleStops}
                vehicles={mapVisibleVehicles}
                userLocation={userLocation}
                selectedStop={selectedStop}
                mode={mapMode}
                bounds={mapBounds}
                toolbarEyebrow={mapToolbarEyebrow}
                toolbarTitle={mapToolbarTitle}
                toolbarMeta={mapToolbarMeta}
                animationDurationMs={LIVE_POLL_MS}
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

      {view === "qr" ? (
        <main className="page-shell">
          <PassPanel lang={lang} now={clockNow} />
        </main>
      ) : null}

      <footer className="page-footer" aria-label={pick(ui.footerTitle, lang)}>
        <span className="page-footer__eyebrow">{pick(ui.footerEyebrow, lang)}</span>
        <strong>{pick(ui.footerTitle, lang)}</strong>
        <p>{pick(ui.footerBody, lang)}</p>
        <small>{pick(ui.footerCopyright, lang)}</small>
      </footer>
      </div>
    </div>
  );
}
