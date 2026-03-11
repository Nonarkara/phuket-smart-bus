import type {
  AirportDestinationMatch,
  AirportFareComparison,
  AirportGuideKind,
  AirportGuidePayload,
  AirportQuickDestination,
  RouteId,
  Stop,
  VehiclePosition
} from "../../shared/types.js";
import { ROUTE_DEFINITIONS } from "../config.js";
import { haversineDistanceMeters } from "../lib/geo.js";
import { text } from "../lib/i18n.js";
import { getTrafficAdvisories } from "./providers/trafficProvider.js";
import { getVehiclesForRoute } from "./providers/busProvider.js";
import { estimateSeatAvailability } from "./providers/seatProvider.js";
import {
  buildAirportWeatherSummary,
  getWeatherAdvisories,
  getWeatherSnapshot
} from "./providers/weatherProvider.js";
import { getStopsForRoute } from "./routes.js";

const AIRPORT_ROUTE_ID: RouteId = "rawai-airport";
const TRANSFER_ROUTE_ID: RouteId = "patong-old-bus-station";
const AIRPORT_STOP_NAME = "Phuket Airport";
const AIRPORT_BOARDING_RADIUS_METERS = 260;
const AIRPORT_BUS_FARE_THB = 100;
const AIRPORT_TAXI_ESTIMATE_THB = 1000;

const aliasGroups = [
  {
    routeId: AIRPORT_ROUTE_ID,
    kind: "direct",
    label: text("Patong", "ป่าตอง"),
    keywords: ["patong", "bangla", "jungceylon", "kalim"],
    stopNames: ["Indigo Patong", "Patong PEA", "Holiday Inn Resort Patong"]
  },
  {
    routeId: AIRPORT_ROUTE_ID,
    kind: "direct",
    label: text("Karon", "กะรน"),
    keywords: ["karon", "karon beach"],
    stopNames: ["Karon Circle", "Woraburi Karon", "Karon Stadium"]
  },
  {
    routeId: AIRPORT_ROUTE_ID,
    kind: "direct",
    label: text("Kata", "กะตะ"),
    keywords: ["kata", "kata beach"],
    stopNames: ["Kata Palm", "Beyond hotel Kata", "OZO Phuket"]
  },
  {
    routeId: AIRPORT_ROUTE_ID,
    kind: "direct",
    label: text("Kamala", "กมลา"),
    keywords: ["kamala", "fantasea", "intercontinental"],
    stopNames: ["Big C Kamala", "Phuket Fantasea", "Intercontinental Kamala"]
  },
  {
    routeId: AIRPORT_ROUTE_ID,
    kind: "direct",
    label: text("Surin", "สุรินทร์"),
    keywords: ["surin", "surin beach", "cafe de mar"],
    stopNames: ["Surin Beach"]
  },
  {
    routeId: AIRPORT_ROUTE_ID,
    kind: "direct",
    label: text("Laguna", "ลากูน่า"),
    keywords: ["laguna", "cherngtalay", "boat avenue"],
    stopNames: ["Laguna", "Lotus Cherngtalay"]
  },
  {
    routeId: AIRPORT_ROUTE_ID,
    kind: "direct",
    label: text("Rawai", "ราไวย์"),
    keywords: ["rawai", "nai harn", "sai yuan", "promthep"],
    stopNames: ["Sai Yuan"]
  },
  {
    routeId: TRANSFER_ROUTE_ID,
    kind: "transfer",
    label: text("Old Town / Terminal 1", "เมืองเก่า / สถานีขนส่ง 1"),
    keywords: ["old town", "phuket town", "downtown", "terminal 1", "bus terminal"],
    stopNames: ["Phuket Bus Terminal 1"]
  },
  {
    routeId: TRANSFER_ROUTE_ID,
    kind: "transfer",
    label: text("Vachira Hospital", "โรงพยาบาลวชิระภูเก็ต"),
    keywords: ["vachira", "hospital", "phuket hospital"],
    stopNames: ["Vachira Phuket Hospital", "Bangkok Hospital Phuket"]
  }
] as const;

const quickDestinationSpecs = [
  {
    id: "patong",
    label: text("Patong", "ป่าตอง"),
    routeId: AIRPORT_ROUTE_ID,
    stopNames: ["Indigo Patong"],
    kind: "direct"
  },
  {
    id: "karon",
    label: text("Karon", "กะรน"),
    routeId: AIRPORT_ROUTE_ID,
    stopNames: ["Karon Circle"],
    kind: "direct"
  },
  {
    id: "kata",
    label: text("Kata", "กะตะ"),
    routeId: AIRPORT_ROUTE_ID,
    stopNames: ["Kata Palm"],
    kind: "direct"
  },
  {
    id: "kamala",
    label: text("Kamala", "กมลา"),
    routeId: AIRPORT_ROUTE_ID,
    stopNames: ["Phuket Fantasea"],
    kind: "direct"
  },
  {
    id: "surin",
    label: text("Surin", "สุรินทร์"),
    routeId: AIRPORT_ROUTE_ID,
    stopNames: ["Surin Beach"],
    kind: "direct"
  },
  {
    id: "laguna",
    label: text("Laguna", "ลากูน่า"),
    routeId: AIRPORT_ROUTE_ID,
    stopNames: ["Laguna"],
    kind: "direct"
  },
  {
    id: "rawai",
    label: text("Rawai", "ราไวย์"),
    routeId: AIRPORT_ROUTE_ID,
    stopNames: ["Sai Yuan"],
    kind: "direct"
  },
  {
    id: "old-town",
    label: text("Old Town", "เมืองเก่า"),
    routeId: TRANSFER_ROUTE_ID,
    stopNames: ["Phuket Bus Terminal 1"],
    kind: "transfer"
  }
] as const;

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u0E00-\u0E7F]+/g, " ")
    .trim();
}

function scoreText(query: string, haystack: string) {
  if (!query || !haystack) {
    return 0;
  }

  if (haystack.includes(query)) {
    return 10;
  }

  const tokens = query.split(" ").filter(Boolean);

  if (tokens.length === 0) {
    return 0;
  }

  return tokens.reduce((score, token) => score + (haystack.includes(token) ? 3 : 0), 0);
}

function findStopByEnglishName(routeId: RouteId, stopNames: readonly string[]) {
  const stops = routeId === AIRPORT_ROUTE_ID ? getAirportDirectionStops() : getStopsForRoute(routeId);
  return stops.find((stop) => stopNames.includes(stop.name.en)) ?? null;
}

function getAirportDirectionStops() {
  return getStopsForRoute(AIRPORT_ROUTE_ID).filter((stop) => stop.direction.en === "Bus to Rawai");
}

function parseClockMinutes(value: string) {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);

  if (!match) {
    return null;
  }

  const [, rawHour, rawMinute, meridiem] = match;
  const minute = Number(rawMinute);

  if (!meridiem) {
    return Number(rawHour) * 60 + minute;
  }

  let hour = Number(rawHour) % 12;

  if (meridiem.toUpperCase() === "PM") {
    hour += 12;
  }

  return hour * 60 + minute;
}

function getTravelEstimateMinutes(fromStop: Stop, toStop: Stop) {
  const fromMinutes = parseClockMinutes(fromStop.timetable.firstDepartureLabel ?? "");
  const toMinutes = parseClockMinutes(toStop.timetable.firstDepartureLabel ?? "");

  if (fromMinutes === null || toMinutes === null) {
    return null;
  }

  const delta = toMinutes - fromMinutes;
  return delta >= 0 ? delta : delta + 24 * 60;
}

function buildQuickDestinations() {
  const airportStop = findAirportStop();

  return quickDestinationSpecs
    .map<AirportQuickDestination | null>((item) => {
      const stop = findStopByEnglishName(item.routeId, item.stopNames);

      if (!stop) {
        return null;
      }

      return {
        id: item.id,
        label: item.label,
        routeId: item.routeId,
        stopId: stop.id,
        kind: item.kind,
        travelMinutes: item.routeId === AIRPORT_ROUTE_ID ? getTravelEstimateMinutes(airportStop, stop) : null
      };
    })
    .filter((item): item is AirportQuickDestination => Boolean(item));
}

function buildStopMatch(query: string, stop: Stop): AirportDestinationMatch | null {
  const haystack = normalizeText(
    [
      stop.name.en,
      stop.name.th,
      stop.nearbyPlace.name,
      stop.routeDirection.en,
      stop.routeDirection.th
    ].join(" ")
  );
  const score = scoreText(query, haystack);

  if (score === 0) {
    return null;
  }

  return {
    routeId: stop.routeId,
    stopId: stop.id,
    stopName: stop.name,
    nearbyPlaceName: stop.nearbyPlace.name,
    areaLabel: stop.name,
    kind: stop.routeId === AIRPORT_ROUTE_ID ? "direct" : "transfer",
    travelMinutes:
      stop.routeId === AIRPORT_ROUTE_ID ? getTravelEstimateMinutes(findAirportStop(), stop) : null
  };
}

function buildAliasMatch(query: string) {
  return aliasGroups
    .map<AirportDestinationMatch | null>((group) => {
      const hasKeyword = group.keywords.some((keyword) =>
        normalizeText(keyword).includes(query) || query.includes(normalizeText(keyword))
      );

      if (!hasKeyword) {
        return null;
      }

      const stop = findStopByEnglishName(group.routeId, group.stopNames);

      if (!stop) {
        return null;
      }

      return {
        routeId: group.routeId,
        stopId: stop.id,
        stopName: stop.name,
        nearbyPlaceName: stop.nearbyPlace.name,
        areaLabel: group.label,
        kind: group.kind,
        travelMinutes:
          group.routeId === AIRPORT_ROUTE_ID ? getTravelEstimateMinutes(findAirportStop(), stop) : null
      };
    })
    .filter((item): item is AirportDestinationMatch => Boolean(item));
}

export function matchAirportDestination(destinationQuery: string) {
  const query = normalizeText(destinationQuery);

  if (!query) {
    return [];
  }

  const routeStops = [...getAirportDirectionStops(), ...getStopsForRoute(TRANSFER_ROUTE_ID)];
  const stopMatches = routeStops
    .map((stop) => buildStopMatch(query, stop))
    .filter((item): item is AirportDestinationMatch => Boolean(item));
  const aliasMatches = buildAliasMatch(query);
  const merged = new Map<string, AirportDestinationMatch>();

  for (const match of [...aliasMatches, ...stopMatches]) {
    if (!merged.has(match.stopId)) {
      merged.set(match.stopId, match);
    }
  }

  return Array.from(merged.values()).slice(0, 5);
}

function findAirportStop() {
  return (
    getStopsForRoute(AIRPORT_ROUTE_ID).find((stop) => stop.name.en === AIRPORT_STOP_NAME) ??
    getStopsForRoute(AIRPORT_ROUTE_ID)[0]
  );
}

function findBoardingVehicle(vehicles: VehiclePosition[], airportStop: Stop) {
  return vehicles
    .map((vehicle) => ({
      vehicle,
      distance: haversineDistanceMeters(vehicle.coordinates, airportStop.coordinates)
    }))
    .filter(({ vehicle, distance }) => vehicle.freshness === "fresh" && distance <= AIRPORT_BOARDING_RADIUS_METERS)
    .sort((left, right) => {
      const leftRank = left.vehicle.status === "dwelling" ? 0 : 1;
      const rightRank = right.vehicle.status === "dwelling" ? 0 : 1;

      return leftRank - rightRank || left.distance - right.distance;
    })[0]?.vehicle ?? null;
}

function getRecommendationCopy(kind: AirportGuideKind, bestMatch: AirportDestinationMatch | null, query: string) {
  switch (kind) {
    case "ready":
      return {
        headline: text("A bus is running from the airport", "มีรถบัสวิ่งออกจากสนามบิน"),
        summary: text(
          "Search a beach, hotel belt, or landmark and we will tell you if Smart Bus is the right choice before you leave the terminal.",
          "พิมพ์ชื่อหาด ย่านโรงแรม หรือจุดสังเกต แล้วเราจะบอกว่าควรเลือก Smart Bus ก่อนออกจากอาคารหรือไม่"
        )
      };
    case "direct":
      return {
        headline: text("Yes, take the Airport Line", "ใช่ ให้ขึ้นสายสนามบิน"),
        summary: text(
          `Smart Bus goes directly to ${bestMatch?.areaLabel.en ?? bestMatch?.stopName.en ?? "that stop"}. Focus on the next airport departure and the seat estimate below.`,
          `Smart Bus ไปถึง ${bestMatch?.areaLabel.th ?? bestMatch?.stopName.th ?? "จุดนั้น"} ได้โดยตรง ให้ดูเที่ยวถัดไปจากสนามบินและจำนวนที่นั่งโดยประมาณด้านล่าง`
        )
      };
    case "transfer":
      return {
        headline: text("Use Smart Bus for the first leg", "ใช้ Smart Bus ได้ในช่วงแรก"),
        summary: text(
          `Ride the Airport Line first, then continue on the Patong Line for ${bestMatch?.areaLabel.en ?? bestMatch?.stopName.en ?? "your destination"}.`,
          `ขึ้นสายสนามบินก่อน แล้วต่อสายป่าตองเพื่อไปยัง ${bestMatch?.areaLabel.th ?? bestMatch?.stopName.th ?? "ปลายทางของคุณ"}`
        )
      };
    case "not_supported":
      return {
        headline: text("This stop is outside the current lines", "จุดนี้อยู่นอกเส้นทางปัจจุบัน"),
        summary: text(
          `The current bus lines do not show a clear match for "${query}". Use the live map below to inspect coverage before choosing another transfer.`,
          `เส้นทางปัจจุบันยังไม่พบจุดที่ชัดเจนสำหรับ "${query}" ให้ใช้แผนที่สดด้านล่างตรวจสอบความครอบคลุมก่อนเลือกการเดินทางแบบอื่น`
        )
      };
  }
}

function buildFareComparison(): AirportFareComparison {
  const savingsThb = AIRPORT_TAXI_ESTIMATE_THB - AIRPORT_BUS_FARE_THB;

  return {
    busFareThb: AIRPORT_BUS_FARE_THB,
    taxiFareEstimateThb: AIRPORT_TAXI_ESTIMATE_THB,
    savingsThb,
    savingsCopy: text(
      `Save about ${savingsThb} THB versus a typical airport taxi ride.`,
      `ประหยัดได้ประมาณ ${savingsThb} บาทเมื่อเทียบกับแท็กซี่จากสนามบินทั่วไป`
    )
  };
}

export async function getAirportGuide(destinationQuery = ""): Promise<AirportGuidePayload> {
  const airportStop = findAirportStop();
  const [vehiclePayload, traffic, weather, weatherSnapshot] = await Promise.all([
    getVehiclesForRoute(AIRPORT_ROUTE_ID),
    getTrafficAdvisories(AIRPORT_ROUTE_ID),
    getWeatherAdvisories(AIRPORT_ROUTE_ID),
    getWeatherSnapshot()
  ]);
  const matches = matchAirportDestination(destinationQuery);
  const bestMatch = matches[0] ?? null;
  const recommendation: AirportGuideKind = destinationQuery.trim()
    ? bestMatch?.kind ?? "not_supported"
    : "ready";
  const copy = getRecommendationCopy(recommendation, bestMatch, destinationQuery.trim());
  const boardingVehicle = findBoardingVehicle(vehiclePayload.vehicles, airportStop);
  const seats = estimateSeatAvailability(boardingVehicle);
  const mockBoardingCountdown =
    vehiclePayload.status.state === "fallback" ? airportStop.nextBus.minutesUntil : 0;
  const nextDepartureMinutes = boardingVehicle ? mockBoardingCountdown : airportStop.nextBus.minutesUntil;
  const nextDepartureLabel =
    boardingVehicle && vehiclePayload.status.state === "live" ? "Boarding now" : airportStop.nextBus.label;
  const nextDepartureBasis = boardingVehicle
    ? vehiclePayload.status.state === "live"
      ? "live"
      : "fallback"
    : airportStop.nextBus.basis;
  const nextDepartureState =
    boardingVehicle && vehiclePayload.status.state === "live" ? "boarding" : "scheduled";

  return {
    destinationQuery,
    recommendation,
    headline: copy.headline,
    summary: copy.summary,
    fareComparison: buildFareComparison(),
    boardingWalk: {
      primaryInstruction: text(
        "Turn left after you come out and head to the Smart Bus stop by Cafe Amazon.",
        "เมื่อออกมาด้านนอกแล้วให้เลี้ยวซ้ายและเดินไปที่ป้าย Smart Bus ข้าง Cafe Amazon"
      ),
      secondaryInstruction: text(
        "Use exit 3, cross to the Cafe Amazon side, and stay under cover if rain starts.",
        "ใช้ทางออก 3 ข้ามไปฝั่ง Cafe Amazon และหลบฝนใต้ที่กำบังหากฝนเริ่มตก"
      ),
      focusStopId: airportStop.id
    },
    weatherSummary: buildAirportWeatherSummary(weatherSnapshot.snapshot),
    bestMatch,
    matches,
    nextDeparture: {
      routeId: AIRPORT_ROUTE_ID,
      routeName: ROUTE_DEFINITIONS[AIRPORT_ROUTE_ID].shortName,
      label: nextDepartureLabel,
      minutesUntil: nextDepartureMinutes,
      basis: nextDepartureBasis,
      state: nextDepartureState,
      liveBusId: boardingVehicle?.vehicleId ?? null,
      liveLicensePlate: boardingVehicle?.licensePlate ?? null,
      seats
    },
    followingDepartures: airportStop.timetable.nextDepartures.slice(0, 3),
    airportBoardingLabel: text("Board opposite Cafe Amazon", "ขึ้นรถฝั่งตรงข้าม Cafe Amazon"),
    boardingNotes: [
      text(
        "International arrivals: follow the signs to the domestic side before exiting.",
        "ผู้โดยสารขาเข้าระหว่างประเทศให้เดินตามป้ายไปยังฝั่งอาคารในประเทศก่อนออกมา"
      ),
      text(
        "Go to exit 3 and wait opposite Cafe Amazon for the Smart Bus stop.",
        "ไปที่ทางออก 3 แล้วรอที่ป้าย Smart Bus ฝั่งตรงข้าม Cafe Amazon"
      ),
      text(
        "Be ready 10 to 15 minutes early because buses can load and depart quickly once boarding starts.",
        "ควรมารอก่อนเวลา 10 ถึง 15 นาที เพราะเมื่อเริ่มขึ้นรถแล้วรถอาจออกได้ค่อนข้างเร็ว"
      )
    ],
    quickDestinations: buildQuickDestinations(),
    sourceStatuses: [vehiclePayload.status, traffic.status, weather.status],
    checkedAt: new Date().toISOString()
  };
}
