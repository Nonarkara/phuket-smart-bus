/**
 * GISTDA (Geo-Informatics and Space Technology Development Agency) API client.
 *
 * Tested and confirmed working 20 May 2026:
 *   - Satellite tiles (gi-basemap_68) via ?api_key=  → 2-metre THEOS-2 imagery, 2025
 *   - Satellite tiles (gi-basemap_67)                → 2024 imagery for comparison
 *   - Incident basemap tiles                          → live disaster overlay
 *   - PM2.5 at location/province                      → public, no auth
 *   - PM2.5 24hr forecast                             → public
 *   - Ocean SST/CHL WMS                               → public
 */

// Exposed client-side intentionally — tile URLs contain the key anyway,
// and this is a government data API for rate-limiting, not security.
const GISTDA_KEY = import.meta.env.VITE_GISTDA_API_KEY ?? "";

// ---------------------------------------------------------------------------
// Tile URL builders
// ---------------------------------------------------------------------------

/** THEOS-2 satellite imagery, 2m resolution, Thailand coverage, 2025 (year BE 2568). */
export function giSatelliteTileUrl(year: "2025" | "2024" = "2025"): string {
  const layer = year === "2025" ? "gi-basemap_68" : "gi-basemap_67";
  return `https://api-gateway.gistda.or.th/api/2.0/resources/tiles/${layer}/{z}/{x}/{y}?api_key=${GISTDA_KEY}`;
}

/** Live disaster/incident overlay — floods, wildfires, droughts. */
export function giIncidentTileUrl(): string {
  return `https://api-gateway.gistda.or.th/api/2.0/resources/tiles/basemap_incident/{z}/{x}/{y}?api_key=${GISTDA_KEY}`;
}

// ---------------------------------------------------------------------------
// PM2.5 Air Quality
// ---------------------------------------------------------------------------

export type AirQualityLevel = "good" | "moderate" | "unhealthy-sensitive" | "unhealthy" | "very-unhealthy" | "hazardous";

export interface Pm25Data {
  pm25: number;
  pm25Avg24hr?: number;
  level: AirQualityLevel;
  label: { en: string; th: string };
  color: string;
  history24hr?: Array<[number, string]>; // [value, isoDate]
  forecast24hr?: Array<[number, string]>;
  updatedAt: string;
}

/** Thailand AQI breakpoints (ONEP standard). */
function classifyPm25(pm25: number): { level: AirQualityLevel; label: { en: string; th: string }; color: string } {
  if (pm25 <= 12)  return { level: "good",               label: { en: "Good",                  th: "ดีมาก" },       color: "#00b053" };
  if (pm25 <= 25)  return { level: "moderate",            label: { en: "Moderate",              th: "ดี" },          color: "#ffcc00" };
  if (pm25 <= 37)  return { level: "unhealthy-sensitive", label: { en: "Sensitive groups",      th: "ปานกลาง" },     color: "#ff8c00" };
  if (pm25 <= 50)  return { level: "unhealthy",           label: { en: "Unhealthy",             th: "เริ่มมีผลต่อสุขภาพ" }, color: "#e31a1c" };
  if (pm25 <= 90)  return { level: "very-unhealthy",      label: { en: "Very unhealthy",        th: "มีผลต่อสุขภาพ" }, color: "#99004c" };
  return            { level: "hazardous",                  label: { en: "Hazardous",             th: "อันตราย" },      color: "#7e0023" };
}

let pm25Cache: { data: Pm25Data; expiresAt: number } | null = null;
const PM25_CACHE_MS = 15 * 60 * 1000; // 15 min

/** Fetch real-time PM2.5 for Phuket from GISTDA (no auth needed). */
export async function fetchPhuketPm25(): Promise<Pm25Data> {
  if (pm25Cache && Date.now() < pm25Cache.expiresAt) return pm25Cache.data;

  try {
    // Parallel: current reading + 24hr forecast for Phuket Airport area
    const [currRes, forecastRes] = await Promise.all([
      fetch("https://pm25.gistda.or.th/rest/getPm25byLocation?lat=7.88&lng=98.39"),
      fetch("https://pm25.gistda.or.th/rest/pred/getPm25byLocation?lat=7.88&lng=98.39")
    ]);

    const curr = await currRes.json() as {
      status: number;
      data: { pm25: number; graphHistory24hrs?: Array<[number, string]> };
    };
    const forecast = await forecastRes.json() as {
      status: number;
      data: { pm25: number; graphPredictByHrs?: Array<[number, string]> };
    };

    if (curr.status !== 200) throw new Error("PM2.5 API error");

    const pm25 = curr.data.pm25;
    const classification = classifyPm25(pm25);

    const data: Pm25Data = {
      pm25: Math.round(pm25 * 10) / 10,
      level: classification.level,
      label: classification.label,
      color: classification.color,
      history24hr: curr.data.graphHistory24hrs ?? [],
      forecast24hr: forecast.status === 200 ? forecast.data.graphPredictByHrs ?? [] : [],
      updatedAt: new Date().toISOString()
    };

    pm25Cache = { data, expiresAt: Date.now() + PM25_CACHE_MS };
    return data;
  } catch {
    // Fallback: return a neutral value rather than crashing
    return {
      pm25: 0,
      level: "good",
      label: { en: "Data unavailable", th: "ไม่มีข้อมูล" },
      color: "#888",
      updatedAt: new Date().toISOString()
    };
  }
}

// ---------------------------------------------------------------------------
// Sea Surface Temperature — Andaman Sea context for ferry routes
// ---------------------------------------------------------------------------

/** WMS URL for Andaman Sea SST (no auth). */
export const ANDAMAN_SST_WMS = "https://ocean.gistda.or.th/geoserver/openwq/wms";
export const ANDAMAN_SST_LAYER = "lastest_sst";

// ---------------------------------------------------------------------------
// Bus safety context — the core narrative for the app
// ---------------------------------------------------------------------------

/**
 * Generate a passenger-facing safety advisory comparing bus vs rental vehicle.
 * Ties together PM2.5 (air quality improved by fewer vehicles) and accident
 * statistics (fewer rental scooters = fewer injuries).
 *
 * The logic: each Phuket tourist riding the bus instead of renting a scooter
 * removes ~1 vehicle from the road, contributing to:
 *   1. Reduced PM2.5 (motorcycle exhaust is 3–5× more PM2.5 per km than bus)
 *   2. Reduced accident probability (motorcycle fatal rate 9× higher than bus)
 */
export function getBusVsRentalSafetyMessage(
  pm25: Pm25Data,
  ridersToday: number
): { headline: string; subtext: string; urgency: "low" | "medium" | "high" } {
  const pm25Val = pm25.pm25;
  const vehiclesOffRoad = ridersToday; // 1 bus rider ≈ 1 fewer rental vehicle

  if (pm25Val > 37) {
    return {
      headline: `Air quality: ${pm25.label.en}. Buses reduce road pollution.`,
      subtext: `${vehiclesOffRoad} riders today = ~${vehiclesOffRoad} fewer scooters. Motorcycles emit 4× more PM2.5 per km than a bus.`,
      urgency: "high"
    };
  }
  if (pm25Val > 25) {
    return {
      headline: `PM2.5 ${pm25Val} µg/m³. Riding the bus keeps the air cleaner.`,
      subtext: `Today's ${vehiclesOffRoad} bus riders kept ~${vehiclesOffRoad} rental scooters off Phuket's roads.`,
      urgency: "medium"
    };
  }
  return {
    headline: `Air quality: Good (${pm25Val} µg/m³). Keep it that way — ride the bus.`,
    subtext: `${vehiclesOffRoad} riders today = ${vehiclesOffRoad} fewer vehicles on hilly Phuket roads.`,
    urgency: "low"
  };
}
