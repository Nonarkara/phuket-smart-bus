/**
 * DesktopSatelliteBackdrop — replaces the Unsplash photo carousel behind the
 * phone mockup on the desktop landing page.
 *
 * The brief: an "ad board that doesn't want to give away too much that it's
 * an ad board" — atmosphere and utility first, branding second. In practice:
 * a live, pannable satellite map of the world (defaulting to Phuket) with a
 * MoMA-ruled layer switcher, plus a small ledger of real Phuket numbers in
 * the corner. Nothing here is decorative filler — every layer is a real,
 * publicly documented satellite product; every ledger number traces to an
 * engine function used elsewhere in this app.
 *
 * ── Tile sources, and why each one is safe to ship ──────────────────────
 *
 * NASA GIBS (primary, 14 layers): confirmed keyless via NASA's own docs
 * (wiki.earthdata.nasa.gov, nasa-gibs.github.io — no API key, no signup).
 * URL template: https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/
 *   {layer}/default/default/{matrixSet}/{z}/{y}/{x}.{ext}
 * "default/default" = style/time — GIBS resolves this to the best available
 * imagery for every layer, so there is no date bookkeeping to get wrong.
 *
 * GISTDA (bonus, conditional): Thailand's own space agency already has two
 * KEYED tile functions in engine/gistda.ts (THEOS-2 2m satellite, live
 * incident overlay) and one KEYLESS one (Andaman SST WMS). The keyed two
 * are exposed here but hide themselves via the SAME guard IncidentOverlay
 * already uses in V2LiveMap.tsx (`if (!key) return null`) — if
 * VITE_GISTDA_API_KEY isn't configured at build time, those two options
 * simply don't appear, rather than serving a broken/watermarked tile.
 *
 * JAXA/Himawari is deliberately NOT included: this sandbox's network
 * policy blocks reaching JAXA's P-Tree or NICT's Himawari domains, so
 * neither the exact tile format nor the commercial-use terms (P-Tree
 * requires registration; NICT's terms distinguish research from
 * commercial use) could be verified. Add it once someone with reachable
 * network confirms a working, licensed endpoint.
 *
 * ── Failure mode ─────────────────────────────────────────────────────────
 * This project already shipped one lesson the hard way this session: a
 * tile provider assumed keyless that started demanding a key in production,
 * with no fallback, so the whole map read "API KEY REQUIRED". Every layer
 * here watches its own `tileerror` event; after a few failures on the
 * active layer it silently falls back to the OSM base (proven keyless,
 * used elsewhere in this app) rather than showing a broken grid.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, WMSTileLayer, useMap } from "react-leaflet";
import { getEnvironmentSnapshot } from "../engine/environmentSimulator";
import { fetchPhuketPm25, giSatelliteTileUrl, giIncidentTileUrl, ANDAMAN_SST_WMS, ANDAMAN_SST_LAYER } from "../engine/gistda";

const GISTDA_KEY = import.meta.env.VITE_GISTDA_API_KEY ?? "";
const GIBS_BASE = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best";

type LayerDef = {
  id: string;
  label: string;
  group: string;
  /** What this actually is, shown on hover — the traceability CLAUDE.md asks for. */
  source: string;
  kind: "gibs" | "wms" | "osm";
  /** GIBS layer identifier, or the WMS layer name. */
  layerId?: string;
  ext?: "jpg" | "png";
  maxZoom?: number;
  /** Renders as a thin overlay on top of the active base rather than replacing it. */
  overlay?: boolean;
};

const LAYERS: LayerDef[] = [
  { id: "true-color", label: "True colour", group: "Earth", source: "NASA VIIRS/Suomi NPP, daily", kind: "gibs", layerId: "VIIRS_SNPP_CorrectedReflectance_TrueColor", ext: "jpg", maxZoom: 9 },
  { id: "true-color-modis", label: "True colour (MODIS)", group: "Earth", source: "NASA MODIS/Terra, daily", kind: "gibs", layerId: "MODIS_Terra_CorrectedReflectance_TrueColor", ext: "jpg", maxZoom: 9 },
  { id: "blue-marble", label: "Blue Marble", group: "Earth", source: "NASA composite reference imagery", kind: "gibs", layerId: "BlueMarble_NextGeneration", ext: "jpg", maxZoom: 8 },
  { id: "night-lights", label: "Night lights", group: "Earth", source: "NASA VIIRS Day/Night Band, near-real-time", kind: "gibs", layerId: "VIIRS_SNPP_DayNightBand_ENCC", ext: "jpg", maxZoom: 8 },
  { id: "ndvi", label: "Vegetation (NDVI)", group: "Land", source: "NASA MODIS/Terra, 8-day composite", kind: "gibs", layerId: "MODIS_Terra_NDVI_8Day", ext: "png", maxZoom: 7 },
  { id: "land-temp", label: "Land temperature", group: "Land", source: "NASA MODIS/Terra, daytime LST", kind: "gibs", layerId: "MODIS_Terra_Land_Surface_Temp_Day", ext: "png", maxZoom: 7 },
  { id: "snow", label: "Snow cover", group: "Land", source: "NASA MODIS/Terra", kind: "gibs", layerId: "MODIS_Terra_Snow_Cover", ext: "png", maxZoom: 8 },
  { id: "fires", label: "Fires & thermal", group: "Land", source: "NASA VIIRS thermal anomalies, near-real-time", kind: "gibs", layerId: "VIIRS_SNPP_Thermal_Anomalies_375m_All", ext: "png", maxZoom: 8 },
  { id: "sst", label: "Sea temperature (world)", group: "Ocean", source: "NASA/JPL GHRSST MUR, daily", kind: "gibs", layerId: "GHRSST_L4_MUR_Sea_Surface_Temperature", ext: "png", maxZoom: 7 },
  { id: "sst-andaman", label: "Sea temperature (Andaman)", group: "Ocean", source: "GISTDA regional SST, live WMS", kind: "wms" },
  { id: "chlorophyll", label: "Ocean chlorophyll", group: "Ocean", source: "NASA MODIS/Terra", kind: "gibs", layerId: "MODIS_Terra_Chlorophyll_A", ext: "png", maxZoom: 7 },
  { id: "sea-ice", label: "Sea ice", group: "Ocean", source: "NASA AMSR2, 12 km", kind: "gibs", layerId: "AMSR2_Sea_Ice_Concentration_12km", ext: "png", maxZoom: 6 },
  { id: "precip", label: "Precipitation", group: "Atmosphere", source: "NASA IMERG, near-real-time global rain rate", kind: "gibs", layerId: "IMERG_Precipitation_Rate", ext: "png", maxZoom: 6 },
  { id: "aerosol", label: "Aerosols", group: "Atmosphere", source: "NASA MODIS/Terra optical depth", kind: "gibs", layerId: "MODIS_Terra_Aerosol", ext: "png", maxZoom: 6 },
  { id: "coastlines", label: "Coastlines", group: "Reference", source: "NASA reference overlay", kind: "gibs", layerId: "Coastlines_15m", ext: "png", maxZoom: 8, overlay: true },
  // Conditional — only appear when VITE_GISTDA_API_KEY is configured at build time.
  ...(GISTDA_KEY
    ? [
        { id: "thai-2m", label: "Thailand 2m (THEOS-2)", group: "Thailand", source: "GISTDA THEOS-2 satellite, 2025", kind: "wms" as const },
        { id: "incidents", label: "Live incidents", group: "Thailand", source: "GISTDA disaster overlay, live", kind: "wms" as const, overlay: true },
      ]
    : []),
];

const DEFAULT_CENTER: [number, number] = [7.95, 98.5];

/** Night in Bangkok time (UTC+7) → the night-lights layer is the more
 *  striking, more truthful default; daytime → true colour. Living, not
 *  decorative — the choice is a fact about the current hour, not a flourish. */
function defaultLayerId(): string {
  const bkkHour = (new Date().getUTCHours() + 7) % 24;
  return bkkHour >= 19 || bkkHour < 6 ? "night-lights" : "true-color";
}

function buildGibsUrl(layer: LayerDef): string {
  return `${GIBS_BASE}/${layer.layerId}/default/default/GoogleMapsCompatible_Level${layer.maxZoom}/{z}/{y}/{x}.${layer.ext}`;
}

/** Watches the active tile layer for repeated load failures and reports
 *  back so the parent can fall back to the guaranteed-working OSM base —
 *  the lesson from this session's CARTO incident, applied defensively. */
function FailWatcher({ activeId, onFail }: { activeId: string; onFail: (id: string) => void }) {
  const map = useMap();
  const failCountRef = useRef(0);
  const idRef = useRef(activeId);
  idRef.current = activeId;

  useEffect(() => {
    failCountRef.current = 0;
    const onTileError = () => {
      failCountRef.current += 1;
      if (failCountRef.current >= 4) onFail(idRef.current);
    };
    map.on("tileerror", onTileError);
    return () => { map.off("tileerror", onTileError); };
  }, [map, activeId, onFail]);

  return null;
}

function ActiveTile({ layer }: { layer: LayerDef }) {
  if (layer.kind === "osm") {
    return (
      <TileLayer
        key="osm-fallback"
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        opacity={layer.overlay ? 0.6 : 1}
      />
    );
  }
  if (layer.kind === "wms") {
    if (layer.id === "sst-andaman") {
      return (
        <WMSTileLayer
          key={layer.id}
          url={ANDAMAN_SST_WMS}
          params={{ layers: ANDAMAN_SST_LAYER, format: "image/png", transparent: true } as never}
          attribution="GISTDA"
          opacity={0.85}
        />
      );
    }
    // GISTDA XYZ (not strictly WMS, but same "keyed government tile" family).
    const url = layer.id === "thai-2m" ? giSatelliteTileUrl() : giIncidentTileUrl();
    return <TileLayer key={layer.id} url={url} attribution="GISTDA" opacity={layer.overlay ? 0.75 : 1} />;
  }
  return (
    <TileLayer
      key={layer.id}
      url={buildGibsUrl(layer)}
      attribution="NASA EOSDIS GIBS"
      maxNativeZoom={layer.maxZoom}
      opacity={layer.overlay ? 0.7 : 1}
    />
  );
}

/** MoMA-ruled layer switcher: flat chips, hairline dividers, monospace caps,
 *  no shadow/gradient/radius — the same Axiom language the /ops console
 *  uses, adapted for a light-on-photo overlay so it reads over any layer. */
function LayerBar({
  activeId,
  overlayIds,
  onSelect,
  onToggleOverlay,
}: {
  activeId: string;
  overlayIds: Set<string>;
  onSelect: (id: string) => void;
  onToggleOverlay: (id: string) => void;
}) {
  const groups = useMemo(() => {
    const byGroup = new Map<string, LayerDef[]>();
    for (const l of LAYERS) {
      const list = byGroup.get(l.group) ?? [];
      list.push(l);
      byGroup.set(l.group, list);
    }
    return [...byGroup.entries()];
  }, []);
  const active = LAYERS.find((l) => l.id === activeId);

  return (
    <div className="satbg__layerbar" role="toolbar" aria-label="Satellite and world data layers">
      {groups.map(([group, layers]) => (
        <div className="satbg__group" key={group}>
          <span className="satbg__group-label">{group}</span>
          <div className="satbg__chips">
            {layers.map((l) => {
              const isOn = l.overlay ? overlayIds.has(l.id) : activeId === l.id;
              return (
                <button
                  key={l.id}
                  type="button"
                  className={`satbg__chip ${isOn ? "is-active" : ""}`}
                  title={l.source}
                  aria-pressed={isOn}
                  onClick={() => (l.overlay ? onToggleOverlay(l.id) : onSelect(l.id))}
                >
                  {l.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {active && <span className="satbg__source" title={active.source}>Source: {active.source}</span>}
    </div>
  );
}

/** The small real-numbers ledger — every field traces to an engine function
 *  used elsewhere in this app (PhuketConditionsStrip uses the same model).
 *  Air quality is a genuine live GISTDA fetch; weather/sea are the same
 *  labelled seasonal model the rest of the product uses — never presented
 *  as more "live" than they are. */
function AmbientLedger() {
  const [env, setEnv] = useState(() => getEnvironmentSnapshot());
  const [pm25, setPm25] = useState<{ value: number; label: string; live: boolean }>({ value: env.pm25, label: "seasonal model", live: false });
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => {
      setEnv(getEnvironmentSnapshot());
      setNow(new Date());
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchPhuketPm25().then((data) => {
      if (cancelled) return;
      if (data.label.en !== "Data unavailable") setPm25({ value: data.pm25, label: "live · GISTDA", live: true });
    });
    const id = setInterval(() => {
      fetchPhuketPm25().then((data) => {
        if (cancelled || data.label.en === "Data unavailable") return;
        setPm25({ value: data.pm25, label: "live · GISTDA", live: true });
      });
    }, 15 * 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const bkkTime = now.toLocaleTimeString("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" });
  const flag = env.maritimeFlag ?? "green";

  return (
    <div className="satbg__ledger" aria-label="Phuket right now">
      <span className="satbg__ledger-time">{bkkTime} <small>BKK</small></span>
      <span className="satbg__ledger-item">{env.tempC.toFixed(0)}°C · {env.conditionLabel}<small> seasonal model</small></span>
      <span className="satbg__ledger-item">PM2.5 {pm25.value.toFixed(0)} µg/m³<small> {pm25.label}</small></span>
      <span className={`satbg__ledger-item satbg__ledger-item--flag-${flag}`}>
        Sea: {flag} flag{env.waveHeightM != null ? ` · ${env.waveHeightM.toFixed(1)}m` : ""}<small> seasonal model</small>
      </span>
    </div>
  );
}

export function DesktopSatelliteBackdrop() {
  const [activeId, setActiveId] = useState(defaultLayerId);
  const [overlayIds, setOverlayIds] = useState<Set<string>>(new Set());
  const [failedIds, setFailedIds] = useState<Set<string>>(new Set());

  const handleFail = (id: string) => {
    setFailedIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  };
  const active = failedIds.has(activeId)
    ? ({ id: "osm-fallback", label: "OpenStreetMap", group: "Earth", source: "OpenStreetMap contributors (fallback)", kind: "osm" } as LayerDef)
    : LAYERS.find((l) => l.id === activeId) ?? LAYERS[0]!;
  const activeOverlays = LAYERS.filter((l) => l.overlay && overlayIds.has(l.id) && !failedIds.has(l.id));

  const toggleOverlay = (id: string) => {
    setOverlayIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="satbg">
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={7}
        minZoom={2}
        maxZoom={9}
        className="satbg__map"
        zoomControl={false}
        attributionControl={false}
        scrollWheelZoom={true}
        worldCopyJump={true}
      >
        <ActiveTile layer={active} />
        {activeOverlays.map((l) => <ActiveTile key={l.id} layer={l} />)}
        <FailWatcher activeId={activeId} onFail={handleFail} />
      </MapContainer>
      <div className="satbg__scrim" aria-hidden="true" />
      <AmbientLedger />
      <LayerBar activeId={activeId} overlayIds={overlayIds} onSelect={setActiveId} onToggleOverlay={toggleOverlay} />
    </div>
  );
}

// Leaflet's default icon paths break under bundlers; not used here (no
// markers on this map), but importing L keeps the type import honest.
void L.version;

export default DesktopSatelliteBackdrop;
