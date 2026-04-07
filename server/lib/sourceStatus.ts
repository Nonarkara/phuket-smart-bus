import type { DataSourceStatus, OpsDataMode, SourceName } from "../../shared/types.js";
import { text } from "./i18n.js";

function toFreshnessSeconds(updatedAt: string) {
  const updatedMillis = Date.parse(updatedAt);

  if (!Number.isFinite(updatedMillis)) {
    return null;
  }

  return Math.max(0, Math.round((Date.now() - updatedMillis) / 1000));
}

export function buildSourceStatus(
  source: SourceName,
  state: DataSourceStatus["state"],
  updatedAt: string,
  detail: DataSourceStatus["detail"],
  fallbackReason: string | null = null
): DataSourceStatus {
  return {
    source,
    state,
    updatedAt,
    detail,
    freshnessSeconds: toFreshnessSeconds(updatedAt),
    fallbackReason
  };
}

export function formatFallbackReason(source: SourceName, error: unknown) {
  if (error instanceof Error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      return `${source}: request timed out`;
    }

    if (error.message.length > 0) {
      return `${source}: ${error.message}`;
    }
  }

  return `${source}: upstream request failed`;
}

export function sourceStatusesToFallbackReasons(statuses: DataSourceStatus[]) {
  return Array.from(
    new Set(
      statuses
        .filter((status) => status.state !== "live")
        .map((status) => status.fallbackReason ?? `${status.source}: fallback active`)
    )
  );
}

export function resolveOpsDataMode(statuses: DataSourceStatus[]): OpsDataMode {
  const nonLiveSources = statuses.filter((status) => status.state !== "live");

  if (nonLiveSources.length === 0) {
    return "live";
  }

  if (nonLiveSources.some((status) => status.source === "bus")) {
    return "demo";
  }

  return "degraded";
}

export function fallbackDetail(label: string) {
  return text(`${label} fallback active`, `${label} กำลังใช้ข้อมูลสำรอง`);
}
