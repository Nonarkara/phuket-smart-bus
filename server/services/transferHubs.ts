import type { MetricProvenance, RouteId, TransferHub } from "../../shared/types.js";
import { formatClockLabel, getBangkokNowMinutes } from "../lib/time.js";
import { text } from "../lib/i18n.js";
import {
  formatDepartureLabel,
  getBusScheduledServices,
  getFerryScheduledServices,
  getNextDepartureMinutes,
  type ScheduledService
} from "./scheduleService.js";

type HubConfig = {
  id: string;
  name: ReturnType<typeof text>;
  coordinates: [number, number];
  feederRouteIds: RouteId[];
  ferryRouteIds: RouteId[];
  walkMinutes: number;
  transferBufferMinutes: number;
  rationale: ReturnType<typeof text>;
};

const HUBS: HubConfig[] = [
  {
    id: "rassada",
    name: text("Rassada Feeder Hub", "จุดเชื่อมต่อรัษฎา"),
    coordinates: [7.8557, 98.4013],
    feederRouteIds: ["dragon-line", "patong-old-bus-station"],
    ferryRouteIds: ["rassada-phi-phi", "rassada-ao-nang"],
    walkMinutes: 12,
    transferBufferMinutes: 20,
    rationale: text(
      "Modeled feeder hub linking Old Town services to the Rassada ferry bank.",
      "จุดเชื่อมต่อแบบจำลองที่เชื่อมบริการเมืองเก่ากับท่าเรือรัษฎา"
    )
  },
  {
    id: "chalong",
    name: text("Chalong Feeder Hub", "จุดเชื่อมต่อฉลอง"),
    coordinates: [7.8281, 98.3613],
    feederRouteIds: ["rawai-airport"],
    ferryRouteIds: ["chalong-racha"],
    walkMinutes: 15,
    transferBufferMinutes: 20,
    rationale: text(
      "Modeled feeder hub linking the south corridor to Chalong Pier departures.",
      "จุดเชื่อมต่อแบบจำลองที่เชื่อมคอร์ริดอร์ฝั่งใต้กับเที่ยวเรือท่าเรือฉลอง"
    )
  },
  {
    id: "bang-rong",
    name: text("Bang Rong Feeder Hub", "จุดเชื่อมต่อบางโรง"),
    coordinates: [8.0133, 98.4186],
    feederRouteIds: ["rawai-airport"],
    ferryRouteIds: ["bang-rong-koh-yao"],
    walkMinutes: 18,
    transferBufferMinutes: 25,
    rationale: text(
      "Modeled feeder hub linking the airport corridor to Bang Rong pier services.",
      "จุดเชื่อมต่อแบบจำลองที่เชื่อมคอร์ริดอร์สนามบินกับเที่ยวเรือบางโรง"
    )
  }
];

function getNextFeederArrivalMinutes(service: ScheduledService, currentMinutes: number) {
  const travelMinutes = service.inferredHubTravelMinutes ?? 0;
  const arrivals = service.departures
    .flatMap((departure) => [departure + travelMinutes, departure + travelMinutes + 24 * 60])
    .filter((value) => value >= currentMinutes)
    .sort((left, right) => left - right);

  return arrivals[0] ?? null;
}

function buildFeederConnections(hub: HubConfig, currentMinutes: number, provenance: MetricProvenance) {
  return getBusScheduledServices()
    .filter(
      (service) =>
        hub.feederRouteIds.includes(service.routeId) && service.inferredHubTravelMinutes !== null
    )
    .map((service) => {
      const nextArrivalMinutes = getNextFeederArrivalMinutes(service, currentMinutes);
      return {
        routeId: service.routeId,
        directionLabel: service.directionLabel,
        nextDepartureLabel: formatDepartureLabel(nextArrivalMinutes),
        minutesUntil:
          nextArrivalMinutes === null ? null : Math.max(0, nextArrivalMinutes - currentMinutes),
        kind: "feeder_bus" as const
      };
    })
    .sort((left, right) => (left.minutesUntil ?? Infinity) - (right.minutesUntil ?? Infinity));
}

function buildFerryConnections(hub: HubConfig, currentMinutes: number) {
  const ferryServices = getFerryScheduledServices().filter((service) => hub.ferryRouteIds.includes(service.routeId));

  return ferryServices
    .map((service) => {
      const nextDepartureMinutes = getNextDepartureMinutes(service.departures, currentMinutes);

      return {
        routeId: service.routeId,
        directionLabel: service.directionLabel,
        nextDepartureLabel: formatDepartureLabel(nextDepartureMinutes),
        minutesUntil: nextDepartureMinutes === null ? null : Math.max(0, nextDepartureMinutes - currentMinutes),
        kind: "ferry" as const
      };
    })
    .sort((left, right) => (left.minutesUntil ?? Infinity) - (right.minutesUntil ?? Infinity));
}

function resolveHubStatus(
  hub: HubConfig,
  ferryConnections: ReturnType<typeof buildFerryConnections>
) {
  const nextFerry = ferryConnections[0];

  if (!nextFerry || nextFerry.minutesUntil === null) {
    return {
      status: "inactive" as const,
      activeWindowLabel: null,
      nextWindowStartLabel: null
    };
  }

  const readyThreshold = hub.walkMinutes + hub.transferBufferMinutes;

  if (nextFerry.minutesUntil <= readyThreshold) {
    return {
      status: "ready" as const,
      activeWindowLabel: `${nextFerry.nextDepartureLabel} ferry window`,
      nextWindowStartLabel: nextFerry.nextDepartureLabel
    };
  }

  if (nextFerry.minutesUntil <= readyThreshold + 30) {
    return {
      status: "watch" as const,
      activeWindowLabel: null,
      nextWindowStartLabel: nextFerry.nextDepartureLabel
    };
  }

  return {
    status: "inactive" as const,
    activeWindowLabel: null,
    nextWindowStartLabel: nextFerry.nextDepartureLabel
  };
}

export function getTransferHubs(now = new Date(), provenance: MetricProvenance = "estimated"): TransferHub[] {
  const currentMinutes = getBangkokNowMinutes(now);

  return HUBS.map((hub) => {
    const ferryConnections = buildFerryConnections(hub, currentMinutes);
    const feederConnections = buildFeederConnections(hub, currentMinutes, provenance);
    const status = resolveHubStatus(hub, ferryConnections);

    return {
      id: hub.id,
      name: hub.name,
      coordinates: hub.coordinates,
      feederRouteIds: hub.feederRouteIds,
      ferryRouteIds: hub.ferryRouteIds,
      walkMinutes: hub.walkMinutes,
      transferBufferMinutes: hub.transferBufferMinutes,
      provenance,
      status: status.status,
      rationale: hub.rationale,
      activeWindowLabel: status.activeWindowLabel,
      nextWindowStartLabel: status.nextWindowStartLabel,
      activeConnections: [...feederConnections, ...ferryConnections]
    };
  });
}
