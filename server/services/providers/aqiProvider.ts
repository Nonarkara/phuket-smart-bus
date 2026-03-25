import type { DataSourceStatus } from "../../../shared/types.js";
import { AQI_CACHE_MS } from "../../config.js";
import { text } from "../../lib/i18n.js";

export type AqiSnapshot = {
  updatedAt: string;
  pm25: number;
  pm10: number;
  usAqi: number;
};

let cache:
  | {
      expiresAt: number;
      snapshot: AqiSnapshot;
      status: DataSourceStatus;
    }
  | undefined;

async function fetchAqi(): Promise<AqiSnapshot> {
  const response = await fetch(
    "https://air-quality-api.open-meteo.com/v1/air-quality?latitude=7.88&longitude=98.39&current=pm2_5,pm10,us_aqi&timezone=Asia%2FBangkok",
    { signal: AbortSignal.timeout(5_000) }
  );

  if (!response.ok) {
    throw new Error(`AQI feed failed with ${response.status}`);
  }

  const data = (await response.json()) as {
    current?: {
      time: string;
      pm2_5: number;
      pm10: number;
      us_aqi: number;
    };
  };

  return {
    updatedAt: data.current?.time ?? new Date().toISOString(),
    pm25: data.current?.pm2_5 ?? 0,
    pm10: data.current?.pm10 ?? 0,
    usAqi: data.current?.us_aqi ?? 0
  };
}

const FALLBACK_SNAPSHOT: AqiSnapshot = {
  updatedAt: new Date().toISOString(),
  pm25: 18,
  pm10: 32,
  usAqi: 55
};

export async function getAqiSnapshot() {
  if (cache && cache.expiresAt > Date.now()) {
    return cache;
  }

  try {
    const snapshot = await fetchAqi();
    cache = {
      expiresAt: Date.now() + AQI_CACHE_MS,
      snapshot,
      status: {
        source: "weather",
        state: "live",
        updatedAt: snapshot.updatedAt,
        detail: text("Open-Meteo AQI loaded", "โหลดข้อมูลคุณภาพอากาศแล้ว")
      }
    };
  } catch {
    cache = {
      expiresAt: Date.now() + AQI_CACHE_MS,
      snapshot: FALLBACK_SNAPSHOT,
      status: {
        source: "weather",
        state: "fallback",
        updatedAt: new Date().toISOString(),
        detail: text("Using AQI fallback", "ใช้ข้อมูลคุณภาพอากาศสำรอง")
      }
    };
  }

  return cache;
}

export function getAqiLabel(usAqi: number): { en: string; level: "good" | "moderate" | "unhealthy_sensitive" | "unhealthy" } {
  if (usAqi <= 50) return { en: "Good", level: "good" };
  if (usAqi <= 100) return { en: "Moderate", level: "moderate" };
  if (usAqi <= 150) return { en: "Unhealthy for sensitive groups", level: "unhealthy_sensitive" };
  return { en: "Unhealthy", level: "unhealthy" };
}
