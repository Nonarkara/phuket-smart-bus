import type { Advisory, DataSourceStatus, RouteId } from "../../../shared/types.js";
import { TRAFFIC_CACHE_MS } from "../../config.js";
import { readJsonFile, fromRoot } from "../../lib/files.js";
import { text } from "../../lib/i18n.js";

type RawAdvisory = {
  id: string;
  routeId: RouteId | "all";
  severity: Advisory["severity"];
  source: Advisory["source"];
  updatedAt: string;
  tags: string[];
  titleEn: string;
  titleTh: string;
  messageEn: string;
  messageTh: string;
  recommendationEn: string;
  recommendationTh: string;
};

const rawAdvisories = readJsonFile<RawAdvisory[]>(
  fromRoot("server", "data", "fixtures", "traffic_advisories.json")
);

let cache:
  | {
      expiresAt: number;
      advisories: Advisory[];
      status: DataSourceStatus;
    }
  | undefined;

export async function getTrafficSnapshot() {
  if (cache && cache.expiresAt > Date.now()) {
    return cache;
  }

  cache = {
    expiresAt: Date.now() + TRAFFIC_CACHE_MS,
    advisories: rawAdvisories.map<Advisory>((item) => ({
      id: item.id,
      routeId: item.routeId,
      severity: item.severity,
      source: item.source,
      updatedAt: item.updatedAt,
      active: true,
      tags: item.tags,
      title: text(item.titleEn, item.titleTh),
      message: text(item.messageEn, item.messageTh),
      recommendation: text(item.recommendationEn, item.recommendationTh)
    })),
    status: {
      source: "traffic",
      state: "fallback",
      updatedAt: new Date().toISOString(),
      detail: text(
        "Prototype iTIC advisory layer using fixture data",
        "ต้นแบบชั้นข้อมูล iTIC ด้วยข้อมูลจำลอง"
      )
    }
  };

  return cache;
}

export async function getTrafficAdvisories(routeId: RouteId) {
  const snapshot = await getTrafficSnapshot();
  return {
    status: snapshot.status,
    advisories: snapshot.advisories.filter(
      (advisory) => advisory.routeId === "all" || advisory.routeId === routeId
    )
  };
}
