import type { Advisory, AdvisorySeverity, DataSourceStatus, EnvironmentSnapshot, WeatherForecastHour, WeatherIntelligence } from "@shared/types";
import { text } from "./i18n";
import { getBangkokNowMinutes } from "./time";
import trafficFixture from "../data/fixtures/traffic_advisories.json";

// --- Deterministic seeded random ---
function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function daySeed(now: Date) {
  return now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
}

// --- Phuket seasonal climate model ---
// Nov-Feb: cool/dry, Mar-Apr: hot, May-Oct: monsoon
function getSeasonalParams(month: number) {
  if (month >= 11 || month <= 2) {
    return { tempBase: 29, tempRange: 3, rainBase: 10, rainRange: 20, windBase: 8, windRange: 8, aqiBase: 35, aqiRange: 15, monsoon: false };
  }
  if (month >= 3 && month <= 4) {
    return { tempBase: 32, tempRange: 3, rainBase: 20, rainRange: 25, windBase: 8, windRange: 10, aqiBase: 50, aqiRange: 25, monsoon: false };
  }
  // May-Oct monsoon
  return { tempBase: 28, tempRange: 3, rainBase: 55, rainRange: 35, windBase: 12, windRange: 15, aqiBase: 30, aqiRange: 15, monsoon: true };
}

function hourTemperatureModifier(hour: number) {
  // Cooler early morning, peak at 14:00, cool evening
  if (hour < 6) return -3;
  if (hour < 9) return -1;
  if (hour < 12) return 1;
  if (hour < 15) return 2;
  if (hour < 18) return 1;
  if (hour < 21) return -1;
  return -2;
}

export function getSeasonalMultiplier(month: number): number {
  // High season: Nov-Apr (tourism peak)
  const multipliers: Record<number, number> = {
    1: 1.45, 2: 1.4, 3: 1.3, 4: 1.15,
    5: 0.75, 6: 0.65, 7: 0.6, 8: 0.65,
    9: 0.7, 10: 0.85, 11: 1.2, 12: 1.5
  };
  return multipliers[month] ?? 1;
}

export function isHighSeason(month: number): boolean {
  return month >= 11 || month <= 4;
}

export function getEnvironmentSnapshot(now = new Date()): EnvironmentSnapshot {
  const month = now.getMonth() + 1;
  const hour = getBangkokNowMinutes(now) / 60;
  const seed = daySeed(now);
  const params = getSeasonalParams(month);

  const r1 = seededRandom(seed + 1);
  const r2 = seededRandom(seed + 2);
  const r3 = seededRandom(seed + 3);
  const r4 = seededRandom(seed + 4);
  const rHour = seededRandom(seed + Math.floor(hour));

  const tempC = Math.round((params.tempBase + hourTemperatureModifier(Math.floor(hour)) + r1 * params.tempRange - params.tempRange / 2) * 10) / 10;
  const rainProb = Math.round(Math.min(100, Math.max(0, params.rainBase + r2 * params.rainRange + (rHour > 0.7 ? 20 : 0))));
  const precipMm = rainProb > 50 ? Math.round(r3 * 4 * 10) / 10 : rainProb > 30 ? Math.round(r3 * 1.5 * 10) / 10 : 0;
  const windKph = Math.round((params.windBase + r4 * params.windRange) * 10) / 10;
  const aqi = Math.round(params.aqiBase + seededRandom(seed + 5) * params.aqiRange);
  const pm25 = Math.round(aqi * 0.45);

  const conditionLabel = precipMm >= 3 ? "Rain" : precipMm >= 1 ? "Light rain" : rainProb > 60 ? "Cloudy" : tempC > 33 ? "Hot & humid" : "Clear skies";

  return {
    tempC,
    precipMm,
    rainProb,
    windKph,
    aqi,
    pm25,
    conditionLabel,
    updatedAt: now.toISOString()
  };
}

export function getWeatherIntelligence(now = new Date()): WeatherIntelligence {
  const env = getEnvironmentSnapshot(now);
  const month = now.getMonth() + 1;
  const params = getSeasonalParams(month);
  const seed = daySeed(now);

  // Build 12-hour forecast
  const currentHour = Math.floor(getBangkokNowMinutes(now) / 60);
  const forecast: WeatherForecastHour[] = [];
  for (let i = 0; i < 12; i++) {
    const fHour = (currentHour + i) % 24;
    const r = seededRandom(seed + 100 + i);
    const rp = Math.round(Math.min(100, Math.max(0, params.rainBase + r * params.rainRange)));
    const precip = rp > 50 ? Math.round(r * 3 * 10) / 10 : 0;
    forecast.push({
      hour: `${String(fHour).padStart(2, "0")}:00`,
      tempC: Math.round(params.tempBase + hourTemperatureModifier(fHour) + (r - 0.5) * 2),
      rainProb: rp,
      precipMm: precip,
      windKph: Math.round(params.windBase + r * params.windRange),
      code: precip >= 3 ? 65 : precip >= 1 ? 61 : rp > 60 ? 3 : 0
    });
  }

  const driverAlerts: string[] = [];
  if (env.precipMm >= 3) driverAlerts.push("Heavy rain — reduce speed on hills");
  if (env.windKph >= 25) driverAlerts.push("High wind advisory — caution on exposed roads");
  if (env.rainProb >= 70) driverAlerts.push("Rain likely — activate headlights");

  return {
    current: { tempC: env.tempC, rainProb: env.rainProb, precipMm: env.precipMm, windKph: env.windKph, aqi: env.aqi, pm25: env.pm25 },
    forecast,
    monsoonSeason: params.monsoon,
    monsoonNote: params.monsoon ? "Southwest monsoon active — expect afternoon showers" : "Dry season — generally clear conditions",
    driverAlerts
  };
}

export function getWeatherAdvisories(now = new Date()): { advisories: Advisory[]; status: DataSourceStatus } {
  const env = getEnvironmentSnapshot(now);
  const advisories: Advisory[] = [];
  let severity: AdvisorySeverity = "info";

  if (env.precipMm >= 3 || env.rainProb >= 85) {
    severity = "warning";
    advisories.push({
      id: "weather-rain-warning",
      routeId: "all",
      source: "weather",
      severity: "warning",
      title: text("Heavy rain alert", "เตือนฝนตกหนัก"),
      message: text(`Precipitation ${env.precipMm}mm with ${env.rainProb}% probability.`, `ปริมาณน้ำฝน ${env.precipMm} มม. โอกาสฝน ${env.rainProb}%`),
      recommendation: text("Allow extra travel time and wait under cover.", "เผื่อเวลาเดินทางเพิ่มและรอในที่กำบัง"),
      updatedAt: now.toISOString(),
      active: true,
      tags: ["weather", "rain"]
    });
  } else if (env.precipMm >= 1.5 || env.rainProb >= 70 || env.windKph >= 28) {
    severity = "caution";
    advisories.push({
      id: "weather-caution",
      routeId: "all",
      source: "weather",
      severity: "caution",
      title: text("Weather caution", "ระวังสภาพอากาศ"),
      message: text(`Light rain or wind may cause minor delays.`, `ฝนเล็กน้อยหรือลมอาจทำให้เกิดความล่าช้าเล็กน้อย`),
      recommendation: text("Carry an umbrella and check route updates.", "พกร่มและตรวจสอบอัปเดตเส้นทาง"),
      updatedAt: now.toISOString(),
      active: true,
      tags: ["weather"]
    });
  }

  return {
    advisories,
    status: {
      source: "weather",
      state: "live",
      updatedAt: now.toISOString(),
      detail: text("Simulated weather based on seasonal model", "สภาพอากาศจำลองจากโมเดลฤดูกาล"),
      freshnessSeconds: 0,
      fallbackReason: null
    }
  };
}

type TrafficFixtureRecord = {
  id: string;
  routeId: string;
  severity: "info" | "caution" | "warning";
  source: "itic" | "weather" | "operations";
  updatedAt: string;
  tags: string[];
  titleEn: string;
  titleTh: string;
  messageEn: string;
  messageTh: string;
  recommendationEn: string;
  recommendationTh: string;
};

function transformFixtureAdvisory(record: TrafficFixtureRecord): Advisory {
  return {
    id: record.id,
    routeId: record.routeId as Advisory["routeId"],
    source: record.source,
    severity: record.severity,
    title: text(record.titleEn, record.titleTh),
    message: text(record.messageEn, record.messageTh),
    recommendation: text(record.recommendationEn, record.recommendationTh),
    updatedAt: record.updatedAt,
    active: true,
    tags: record.tags
  };
}

export function getTrafficAdvisories(routeId?: string, now = new Date()): { advisories: Advisory[]; status: DataSourceStatus } {
  const fixture = trafficFixture as unknown as TrafficFixtureRecord[];
  const transformed = fixture.map(transformFixtureAdvisory);
  const advisories = routeId
    ? transformed.filter((a) => a.routeId === routeId || a.routeId === "all")
    : transformed;

  return {
    advisories,
    status: {
      source: "traffic",
      state: "live",
      updatedAt: now.toISOString(),
      detail: text("Traffic intelligence active", "ข่าวกรองจราจรเปิดใช้งาน"),
      freshnessSeconds: 0,
      fallbackReason: null
    }
  };
}
