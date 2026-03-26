import type {
  Advisory,
  AdvisorySeverity,
  AirportWeatherSummary,
  DataSourceStatus,
  RouteId
} from "../../../shared/types.js";
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

export type WeatherSnapshot = {
  updatedAt: string;
  temperatureC: number;
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
  const temperatureC = payload.current?.temperature_2m ?? 31;
  const updatedAt = payload.current?.time ?? new Date().toISOString();

  return {
    updatedAt,
    temperatureC,
    precipitationProbability,
    precipitation,
    windSpeed,
    weatherCode
  };
}

function toWeatherSeverity(snapshot: WeatherSnapshot): AdvisorySeverity {
  if (snapshot.precipitation >= 3 || snapshot.precipitationProbability >= 85) {
    return "warning";
  }

  if (snapshot.precipitation >= 1.5 || snapshot.precipitationProbability >= 70 || snapshot.windSpeed >= 28) {
    return "caution";
  }

  return "info";
}

function getConditionLabel(snapshot: WeatherSnapshot) {
  if ([95, 96, 99].includes(snapshot.weatherCode)) {
    return text("Storm risk near the airport", "มีความเสี่ยงพายุใกล้สนามบิน");
  }

  if ([61, 63, 65, 80, 81, 82].includes(snapshot.weatherCode)) {
    return text("Rain moving across the airport corridor", "มีกลุ่มฝนเคลื่อนผ่านแนวสนามบิน");
  }

  if ([51, 53, 55, 56, 57].includes(snapshot.weatherCode)) {
    return text("Light rain around exposed stops", "มีฝนเบาบริเวณป้ายเปิดโล่ง");
  }

  if ([1, 2, 3, 45, 48].includes(snapshot.weatherCode)) {
    return text("Clouds building over Phuket", "เมฆกำลังก่อตัวเหนือภูเก็ต");
  }

  return text("Weather looks steady for now", "ตอนนี้สภาพอากาศยังค่อนข้างคงที่");
}

export function buildAirportWeatherSummary(snapshot: WeatherSnapshot): AirportWeatherSummary {
  const severity = toWeatherSeverity(snapshot);
  let recommendation = text(
    "Weather looks manageable, but Phuket showers can build quickly near the stop.",
    "อากาศยังพอจัดการได้ แต่ฝนภูเก็ตสามารถมาเร็วได้ใกล้ป้ายรถ"
  );

  if (severity === "warning") {
    recommendation = text(
      "Rain is likely. Walk to the stop a little earlier and wait under cover until boarding starts.",
      "มีแนวโน้มฝนตก ควรเดินไปที่ป้ายเร็วขึ้นเล็กน้อยและรอใต้ที่กำบังก่อนขึ้นรถ"
    );
  } else if (severity === "caution") {
    recommendation = text(
      "Keep a small buffer in case rain or wind slows boarding at the airport stop.",
      "ควรเผื่อเวลาเล็กน้อยในกรณีที่ฝนหรือลมทำให้การขึ้นรถที่ป้ายสนามบินช้าลง"
    );
  }

  return {
    conditionLabel: getConditionLabel(snapshot),
    currentPrecipitation: snapshot.precipitation,
    maxRainProbability: snapshot.precipitationProbability,
    recommendation,
    severity
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

export function clearWeatherSnapshotCache() {
  cache = undefined;
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
