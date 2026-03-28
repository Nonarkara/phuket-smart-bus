/**
 * HKT Phuket Airport demand model.
 * Current-mode endpoints use a rolling horizon.
 * Investor-mode endpoints use the full deterministic day.
 */

import type { DemandForecast, FlightInfo, HourlyDemandPoint } from "../../../shared/types.js";
import { BANGKOK_TIME_ZONE } from "../../config.js";
import { ADDRESSABLE_DEMAND_SHARE, BUS_SEAT_CAPACITY } from "../../../shared/productConfig.js";

const HOURLY_ARRIVALS = [
  1, 0, 0, 0, 1, 2,
  3, 4, 5, 6, 6, 5,
  4, 3, 3, 3, 4, 5,
  6, 6, 5, 4, 3, 2
];

const AIRLINES = [
  "Thai AirAsia", "Bangkok Airways", "Thai Smile", "Nok Air",
  "Thai Lion Air", "Thai VietJet", "AirAsia X", "Singapore Airlines",
  "Malaysia Airlines", "Cathay Pacific", "Korean Air", "China Southern",
  "Scoot", "Jetstar", "Qatar Airways", "Emirates"
];

const ORIGINS_DOMESTIC = ["BKK", "DMK", "CNX", "HDY", "USM"];
const ORIGINS_INTL = [
  "SIN", "KUL", "HKG", "PVG", "ICN", "DOH", "DXB",
  "SYD", "MEL", "NRT", "PEK", "DEL", "MUC", "LHR"
];

const ORIGIN_COUNTRY: Record<string, { country: string; flag: string }> = {
  BKK: { country: "Thailand", flag: "🇹🇭" },
  DMK: { country: "Thailand", flag: "🇹🇭" },
  CNX: { country: "Thailand", flag: "🇹🇭" },
  HDY: { country: "Thailand", flag: "🇹🇭" },
  USM: { country: "Thailand", flag: "🇹🇭" },
  SIN: { country: "Singapore", flag: "🇸🇬" },
  KUL: { country: "Malaysia", flag: "🇲🇾" },
  HKG: { country: "Hong Kong", flag: "🇭🇰" },
  PVG: { country: "China", flag: "🇨🇳" },
  ICN: { country: "South Korea", flag: "🇰🇷" },
  DOH: { country: "Qatar", flag: "🇶🇦" },
  DXB: { country: "UAE", flag: "🇦🇪" },
  SYD: { country: "Australia", flag: "🇦🇺" },
  MEL: { country: "Australia", flag: "🇦🇺" },
  NRT: { country: "Japan", flag: "🇯🇵" },
  PEK: { country: "China", flag: "🇨🇳" },
  DEL: { country: "India", flag: "🇮🇳" },
  MUC: { country: "Germany", flag: "🇩🇪" },
  LHR: { country: "UK", flag: "🇬🇧" }
};

const DEPARTURES_DESTINATIONS = [
  "BKK", "DMK", "SIN", "KUL", "HKG", "ICN", "NRT", "PVG", "SYD", "LHR"
];

function seededRandom(seed: number) {
  let value = seed;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function getBangkokHour(date = new Date()) {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: BANGKOK_TIME_ZONE,
      hour: "2-digit",
      hour12: false
    }).format(date)
  );
}

function getBangkokDateSeed(date = new Date()) {
  const isoDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: BANGKOK_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);

  return Number(isoDate.replaceAll("-", ""));
}

function formatTime(hour: number, minute: number) {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function getTimeHour(value: string) {
  return Number(value.slice(0, 2));
}

function isWithinRollingWindow(hour: number, startHour: number, windowHours: number) {
  const diff = (hour - startHour + 24) % 24;
  return diff < windowHours;
}

function buildFlightNumber(airline: string, random: () => number) {
  return `${airline.slice(0, 2).toUpperCase()}${100 + Math.floor(random() * 900)}`;
}

function buildFullDayFlightSchedule(date = new Date()) {
  const random = seededRandom(getBangkokDateSeed(date));
  const flights: FlightInfo[] = [];

  for (let hour = 0; hour < 24; hour += 1) {
    const arrivalCount = HOURLY_ARRIVALS[hour] ?? 0;

    for (let index = 0; index < arrivalCount; index += 1) {
      const isInternational = random() > 0.45;
      const originPool = isInternational ? ORIGINS_INTL : ORIGINS_DOMESTIC;
      const airline = AIRLINES[Math.floor(random() * AIRLINES.length)] ?? AIRLINES[0] ?? "Thai AirAsia";
      const origin = originPool[Math.floor(random() * originPool.length)] ?? originPool[0] ?? "BKK";
      const minute = Math.floor(random() * 55);
      const estimatedPax = isInternational
        ? Math.floor(150 + random() * 200)
        : Math.floor(100 + random() * 80);

      flights.push({
        flightNo: buildFlightNumber(airline, random),
        airline,
        origin,
        scheduledTime: formatTime(hour, minute),
        estimatedPax,
        type: "arrival"
      });
    }

    const departureCount = Math.max(1, Math.floor((HOURLY_ARRIVALS[hour] ?? 1) * 0.7));

    for (let index = 0; index < departureCount; index += 1) {
      const airline = AIRLINES[Math.floor(random() * AIRLINES.length)] ?? AIRLINES[0] ?? "Thai AirAsia";
      const origin =
        DEPARTURES_DESTINATIONS[Math.floor(random() * DEPARTURES_DESTINATIONS.length)] ??
        DEPARTURES_DESTINATIONS[0] ??
        "BKK";
      const minute = Math.floor(random() * 55);
      const estimatedPax = Math.floor(100 + random() * 150);

      flights.push({
        flightNo: buildFlightNumber(airline, random),
        airline,
        origin,
        scheduledTime: formatTime(hour, minute),
        estimatedPax,
        type: "departure"
      });
    }
  }

  return flights.sort((left, right) => left.scheduledTime.localeCompare(right.scheduledTime));
}

function getFlightsForWindow(date = new Date(), windowHours = 4) {
  const currentHour = getBangkokHour(date);
  return buildFullDayFlightSchedule(date).filter((flight) =>
    isWithinRollingWindow(getTimeHour(flight.scheduledTime), currentHour, windowHours)
  );
}

function getFlightsForNextTwoHours(date = new Date(), type: FlightInfo["type"]) {
  return getFlightsForWindow(date, 2).filter((flight) => flight.type === type);
}

export function getDailyFlightSchedule(date = new Date()) {
  return buildFullDayFlightSchedule(date);
}

export function getFlightSchedule(date = new Date()) {
  return getFlightsForWindow(date, 4);
}

export function getNationalityBreakdown(date = new Date()) {
  const flights = buildFullDayFlightSchedule(date).filter((flight) => flight.type === "arrival");
  const countryPax = new Map<string, { flag: string; pax: number }>();

  for (const flight of flights) {
    const info = ORIGIN_COUNTRY[flight.origin] ?? { country: flight.origin, flag: "✈️" };
    const existing = countryPax.get(info.country) ?? { flag: info.flag, pax: 0 };
    existing.pax += flight.estimatedPax;
    countryPax.set(info.country, existing);
  }

  const total = flights.reduce((sum, flight) => sum + flight.estimatedPax, 0) || 1;

  return Array.from(countryPax.entries())
    .map(([country, data]) => ({
      country,
      flag: data.flag,
      pax: data.pax,
      percentage: Math.round((data.pax / total) * 100)
    }))
    .sort((left, right) => right.pax - left.pax);
}

export function getDemandForecast(currentFleetOnline: number, date = new Date()): DemandForecast {
  const arrivalsNext2h = getFlightsForNextTwoHours(date, "arrival");
  const estimatedPaxNext2h = arrivalsNext2h.reduce((sum, flight) => sum + flight.estimatedPax, 0);
  const busDemandEstimate = Math.ceil(estimatedPaxNext2h * ADDRESSABLE_DEMAND_SHARE);
  const seatsAvailable = Math.max(currentFleetOnline, 0) * BUS_SEAT_CAPACITY;
  const recommendedFleet = Math.max(
    currentFleetOnline,
    Math.ceil(busDemandEstimate / BUS_SEAT_CAPACITY)
  );
  const deficit = Math.max(0, recommendedFleet - currentFleetOnline);
  let recommendation = `Fleet adequate. ${currentFleetOnline} buses can cover the next 2h demand.`;

  if (deficit > 0) {
    recommendation =
      deficit <= 2
        ? `Consider adding ${deficit} bus(es) to the airport line in the next 2h window.`
        : `Deploy ${deficit} extra buses to the airport line before the next arrival wave.`;
  }

  return {
    currentHour: formatTime(getBangkokHour(date), 0),
    arrivalsNext2h: arrivalsNext2h.length,
    estimatedPaxNext2h,
    busDemandEstimate,
    currentFleetOnline,
    recommendedFleet,
    recommendation: `${recommendation} ${seatsAvailable} scheduled seats are visible at current fleet strength.`,
    flights: getFlightSchedule(date)
  };
}

export function getHourlyDemandProjection(seatsPerBus: number, busesOnline: number, date = new Date()): HourlyDemandPoint[] {
  const flights = buildFullDayFlightSchedule(date).filter((flight) => flight.type === "arrival");

  return Array.from({ length: 12 }, (_, index) => {
    const hour = (getBangkokHour(date) - 4 + index + 24) % 24;
    const hourlyFlights = flights.filter((flight) => getTimeHour(flight.scheduledTime) === hour);
    const estimatedPax = hourlyFlights.reduce((sum, flight) => sum + flight.estimatedPax, 0);
    const busDemand = Math.ceil(estimatedPax * ADDRESSABLE_DEMAND_SHARE);

    return {
      hour: `${String(hour).padStart(2, "0")}:00`,
      arrivals: hourlyFlights.length,
      estimatedPax,
      busDemand,
      seatsAvailable: busesOnline * seatsPerBus
    };
  });
}
