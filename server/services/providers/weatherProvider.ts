import type { Advisory, DataSourceStatus, RouteId } from "../../../shared/types.js";
import { OPEN_METEO_URL, WEATHER_CACHE_MS } from "../../config.js";
import { readJsonFile, fromRoot } from "../../lib/files.js";
import { text } from "../../lib/i18n.js";

type WeatherPayload = {
  current?: {
    time: string;
    temperature_2m: number;
    weather_code: number;
    precipitation: number;
    wind_speed_10m: number;
  };
  hourly?: {
    time: string[];
    precipitation_probability: number[];
    precipitation: number[];
    weather_code: number[];
  };
  error?: boolean;
};

type WeatherSnapshot = {
  updatedAt: string;
  precipitationProbability: number;
  precipitation: number;
  windSpeed: number;
  weatherCode: number;
};

const fallbackWeather = readJsonFile<WeatherPayload>(
  fromRoot("server", "data", "fixtures", "weather_sample.json")
);

let cache:
  | {
      expiresAt: number;
      snapshot: WeatherSnapshot;
      status: DataSourceStatus;
    }
  | undefined;

function toSnapshot(payload: WeatherPayload): WeatherSnapshot {
  const precipitationProbability =
    payload.hourly?.precipitation_probability?.slice(0, 3).reduce((max, value) => Math.max(max, value), 0) ?? 0;
  const precipitation =
    payload.current?.precipitation ??
    payload.hourly?.precipitation?.slice(0, 1)[0] ??
    0;
  const weatherCode =
    payload.current?.weather_code ??
    payload.hourly?.weather_code?.slice(0, 1)[0] ??
    0;
  const windSpeed = payload.current?.wind_speed_10m ?? 0;
  const updatedAt = payload.current?.time ?? new Date().toISOString();

  return {
    updatedAt,
    precipitationProbability,
    precipitation,
    windSpeed,
    weatherCode
  };
}

async function fetchWeatherPayload() {
  const response = await fetch(
    `${OPEN_METEO_URL}?latitude=7.88&longitude=98.39&current=temperature_2m,weather_code,precipitation,wind_speed_10m&hourly=precipitation_probability,precipitation,weather_code&forecast_days=1&timezone=Asia%2FBangkok`,
    {
      signal: AbortSignal.timeout(5_000)
    }
  );

  if (!response.ok) {
    throw new Error(`Weather feed failed with ${response.status}`);
  }

  const payload = (await response.json()) as WeatherPayload;

  if (payload.error) {
    throw new Error("Weather feed returned an error payload");
  }

  return payload;
}

export async function getWeatherSnapshot() {
  if (cache && cache.expiresAt > Date.now()) {
    return cache;
  }

  try {
    const payload = await fetchWeatherPayload();
    cache = {
      expiresAt: Date.now() + WEATHER_CACHE_MS,
      snapshot: toSnapshot(payload),
      status: {
        source: "weather",
        state: "live",
        updatedAt: payload.current?.time ?? new Date().toISOString(),
        detail: text("Open-Meteo current conditions loaded", "โหลดสภาพอากาศ Open-Meteo แล้ว")
      }
    };
  } catch {
    cache = {
      expiresAt: Date.now() + WEATHER_CACHE_MS,
      snapshot: toSnapshot(fallbackWeather),
      status: {
        source: "weather",
        state: "fallback",
        updatedAt: fallbackWeather.current?.time ?? new Date().toISOString(),
        detail: text("Using weather fallback sample", "กำลังใช้ข้อมูลอากาศตัวอย่าง")
      }
    };
  }

  return cache;
}

export async function getWeatherAdvisories(routeId: RouteId) {
  const { snapshot, status } = await getWeatherSnapshot();
  const advisories: Advisory[] = [];

  if (snapshot.precipitationProbability >= 70 || snapshot.precipitation >= 1.5) {
    advisories.push({
      id: `${routeId}-rain-watch`,
      routeId,
      source: "weather",
      severity: snapshot.precipitation >= 3 ? "warning" : "caution",
      title: text("Rain watch on exposed stops", "เฝ้าระวังฝนที่ป้ายเปิดโล่ง"),
      message: text(
        "Rain intensity can slow boarding and make uncovered stops uncomfortable.",
        "ฝนอาจทำให้ขึ้นรถช้าลงและรอรถลำบากที่ป้ายไม่มีหลังคา"
      ),
      recommendation: text(
        "Leave a little earlier if your stop has no cover.",
        "ออกจากที่พักให้เร็วขึ้นเล็กน้อยหากป้ายไม่มีหลังคา"
      ),
      updatedAt: snapshot.updatedAt,
      active: true,
      tags: ["rain", "waiting-time"]
    });
  }

  if (snapshot.windSpeed >= 28) {
    advisories.push({
      id: `${routeId}-wind-watch`,
      routeId,
      source: "weather",
      severity: "caution",
      title: text("Windy roadside conditions", "ลมแรงบริเวณข้างทาง"),
      message: text(
        "Coastal wind can make stops feel slower than the timetable suggests.",
        "ลมชายฝั่งอาจทำให้การรอรถรู้สึกนานกว่าตารางเวลา"
      ),
      recommendation: text(
        "Give yourself extra waiting margin.",
        "เผื่อเวลารอรถเพิ่มอีกเล็กน้อย"
      ),
      updatedAt: snapshot.updatedAt,
      active: true,
      tags: ["wind", "comfort"]
    });
  }

  return {
    advisories,
    status
  };
}
