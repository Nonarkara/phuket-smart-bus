import type { DataSourceStatus } from "../../../shared/types.js";
import { AQI_CACHE_MS } from "../../config.js";
import { text } from "../../lib/i18n.js";
import { buildSourceStatus, formatFallbackReason } from "../../lib/sourceStatus.js";
import { fetchJsonWithRetry } from "../../lib/upstream.js";

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

type AqiSnapshotResult = {
  expiresAt: number;
  snapshot: AqiSnapshot;
  status: DataSourceStatus;
};

async function fetchAqi(): Promise<AqiSnapshot> {
  const data = await fetchJsonWithRetry<{
    current?: {
      time: string;
      pm2_5: number;
      pm10: number;
      us_aqi: number;
    };
  }>(
    "https://air-quality-api.open-meteo.com/v1/air-quality?latitude=7.88&longitude=98.39&current=pm2_5,pm10,us_aqi&timezone=Asia%2FBangkok",
    {},
    {
      timeoutMs: 5_000,
      retries: 1
    }
  );

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

export async function getAqiSnapshot(): Promise<AqiSnapshotResult> {
  if (cache && cache.expiresAt > Date.now()) {
    return cache;
  }

  try {
    const snapshot = await fetchAqi();
    const next: AqiSnapshotResult = {
      expiresAt: Date.now() + AQI_CACHE_MS,
      snapshot,
      status: buildSourceStatus(
        "aqi",
        "live",
        snapshot.updatedAt,
        text("Open-Meteo AQI loaded", "โหลดข้อมูลคุณภาพอากาศแล้ว")
      )
    };
    cache = next;
    return next;
  } catch (error) {
    const next: AqiSnapshotResult = {
      expiresAt: Date.now() + AQI_CACHE_MS,
      snapshot: FALLBACK_SNAPSHOT,
      status: buildSourceStatus(
        "aqi",
        "fallback",
        new Date().toISOString(),
        text("Using AQI fallback", "ใช้ข้อมูลคุณภาพอากาศสำรอง"),
        formatFallbackReason("aqi", error)
      )
    };
    cache = next;
    return next;
  }
}

export function clearAqiSnapshotCache() {
  cache = undefined;
}

export function getAqiLabel(usAqi: number): { en: string; level: "good" | "moderate" | "unhealthy_sensitive" | "unhealthy" } {
  if (usAqi <= 50) return { en: "Good", level: "good" };
  if (usAqi <= 100) return { en: "Moderate", level: "moderate" };
  if (usAqi <= 150) return { en: "Unhealthy for sensitive groups", level: "unhealthy_sensitive" };
  return { en: "Unhealthy", level: "unhealthy" };
}
