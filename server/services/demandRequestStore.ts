import type { DemandHotspot, MetricProvenance } from "../../shared/types.js";

type DemandRequest = {
  lat: number;
  lng: number;
  zone: string;
  ts: number;
};

type DemandZone = {
  id: string;
  zone: string;
  lat: number;
  lng: number;
  baseDemand: number;
};

const ONE_HOUR_MS = 60 * 60 * 1000;

export const DEMAND_ZONES: DemandZone[] = [
  { id: "patong", zone: "Central Patong", lat: 7.8961, lng: 98.2969, baseDemand: 12 },
  { id: "airport", zone: "Airport", lat: 8.1132, lng: 98.3169, baseDemand: 10 },
  { id: "kata", zone: "Kata Beach", lat: 7.8205, lng: 98.2976, baseDemand: 8 },
  { id: "old-town", zone: "Phuket Town", lat: 7.8804, lng: 98.3923, baseDemand: 7 },
  { id: "karon", zone: "Karon Beach", lat: 7.8425, lng: 98.2948, baseDemand: 6 },
  { id: "rawai", zone: "Rawai", lat: 7.7734, lng: 98.3258, baseDemand: 5 },
  { id: "chalong", zone: "Chalong", lat: 7.8379, lng: 98.3398, baseDemand: 4 },
  { id: "surin", zone: "Surin Beach", lat: 7.9765, lng: 98.2798, baseDemand: 3 }
];

const demandRequests: DemandRequest[] = [];

function purgeExpiredRequests(now = Date.now()) {
  const cutoff = now - ONE_HOUR_MS;

  while (demandRequests.length > 0 && (demandRequests[0]?.ts ?? 0) < cutoff) {
    demandRequests.shift();
  }
}

function distanceScore(lat: number, lng: number, zone: DemandZone) {
  return Math.sqrt((zone.lat - lat) ** 2 + (zone.lng - lng) ** 2);
}

function getDemandScale(hour: number) {
  if (hour >= 10 && hour <= 14) {
    return 1;
  }

  if (hour >= 18 && hour <= 20) {
    return 0.9;
  }

  if (hour >= 7 && hour <= 22) {
    return 0.6;
  }

  return 0.12;
}

function getCoverageRatio(demand: number) {
  if (demand >= 10) {
    return 0.45;
  }

  if (demand >= 6) {
    return 0.62;
  }

  return 0.8;
}

export function findDemandZone(lat: number, lng: number) {
  return [...DEMAND_ZONES].sort((left, right) => distanceScore(lat, lng, left) - distanceScore(lat, lng, right))[0];
}

export function recordDemandRequest(lat: number, lng: number, now = Date.now()) {
  const zone = findDemandZone(lat, lng);

  if (!zone) {
    return null;
  }

  demandRequests.push({ lat, lng, zone: zone.zone, ts: now });
  purgeExpiredRequests(now);

  const totalRequests = demandRequests.filter((request) => request.zone === zone.zone).length;

  return {
    zone: zone.zone,
    totalRequests
  };
}

export function getDemandHotspots(now = new Date()) {
  purgeExpiredRequests(now.getTime());

  const hour = now.getHours();
  const scale = getDemandScale(hour);
  const liveCounts = new Map<string, number>();

  for (const request of demandRequests) {
    liveCounts.set(request.zone, (liveCounts.get(request.zone) ?? 0) + 1);
  }

  const hotspots = DEMAND_ZONES.map<DemandHotspot>((zone) => {
    const liveRequests = liveCounts.get(zone.zone) ?? 0;
    const modeledDemand = Math.max(1, Math.round(zone.baseDemand * scale));
    const demand = modeledDemand + liveRequests;
    const coverageRatio = getCoverageRatio(demand);
    const gap = Math.max(0, demand - Math.round(demand * coverageRatio));
    const provenance: MetricProvenance = liveRequests > 0 ? "live" : "estimated";

    return {
      id: zone.id,
      zone: zone.zone,
      lat: zone.lat,
      lng: zone.lng,
      demand,
      liveRequests,
      modeledDemand,
      coverageRatio,
      gap,
      provenance
    };
  }).sort((left, right) => right.demand - left.demand);

  return {
    hotspots,
    totalRequests: demandRequests.length
  };
}
