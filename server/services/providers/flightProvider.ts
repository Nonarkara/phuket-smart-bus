/**
 * HKT Phuket Airport mock flight schedule.
 * Based on real patterns: ~80 arrivals/day, peak 10-12 AM and 6-9 PM.
 * Replace with AviationStack API or FlightAware when ready for production.
 */

import type { FlightInfo, DemandForecast, HourlyDemandPoint } from "../../../shared/types.js";
import { BANGKOK_TIME_ZONE } from "../../config.js";

// Realistic HKT arrival patterns (hourly flight count, 0-23)
const HOURLY_ARRIVALS = [
  1, 0, 0, 0, 1, 2,   // 00-05: red-eye + early
  3, 4, 5, 6, 6, 5,   // 06-11: morning peak
  4, 3, 3, 3, 4, 5,   // 12-17: afternoon
  6, 6, 5, 4, 3, 2    // 18-23: evening peak
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
  BKK: { country: "Thailand", flag: "🇹🇭" }, DMK: { country: "Thailand", flag: "🇹🇭" },
  CNX: { country: "Thailand", flag: "🇹🇭" }, HDY: { country: "Thailand", flag: "🇹🇭" },
  USM: { country: "Thailand", flag: "🇹🇭" }, SIN: { country: "Singapore", flag: "🇸🇬" },
  KUL: { country: "Malaysia", flag: "🇲🇾" }, HKG: { country: "Hong Kong", flag: "🇭🇰" },
  PVG: { country: "China", flag: "🇨🇳" }, ICN: { country: "South Korea", flag: "🇰🇷" },
  DOH: { country: "Qatar", flag: "🇶🇦" }, DXB: { country: "UAE", flag: "🇦🇪" },
  SYD: { country: "Australia", flag: "🇦🇺" }, MEL: { country: "Australia", flag: "🇦🇺" },
  NRT: { country: "Japan", flag: "🇯🇵" }, PEK: { country: "China", flag: "🇨🇳" },
  DEL: { country: "India", flag: "🇮🇳" }, MUC: { country: "Germany", flag: "🇩🇪" },
  LHR: { country: "UK", flag: "🇬🇧" },
};

const DEPARTURES_DESTINATIONS = [
  "BKK", "DMK", "SIN", "KUL", "HKG", "ICN", "NRT", "PVG", "SYD", "LHR"
];

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function getBangkokHour(): number {
  const now = new Date();
  const bkk = new Intl.DateTimeFormat("en-US", {
    timeZone: BANGKOK_TIME_ZONE,
    hour: "numeric",
    hour12: false
  }).format(now);
  return parseInt(bkk, 10);
}

function formatBkkTime(hoursFromNow: number, minuteOffset: number): string {
  const future = new Date(Date.now() + hoursFromNow * 3_600_000 + minuteOffset * 60_000);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: BANGKOK_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit"
  }).format(future);
}

export function getFlightSchedule(): FlightInfo[] {
  const currentHour = getBangkokHour();
  const daySeed = Math.floor(Date.now() / 86_400_000);
  const rand = seededRandom(daySeed);
  const flights: FlightInfo[] = [];

  // Generate flights for current hour + next 3 hours
  for (let offset = 0; offset < 4; offset++) {
    const hour = (currentHour + offset) % 24;
    const count = HOURLY_ARRIVALS[hour] ?? 2;

    for (let i = 0; i < count; i++) {
      const isIntl = rand() > 0.45;
      const origins = isIntl ? ORIGINS_INTL : ORIGINS_DOMESTIC;
      const airline = AIRLINES[Math.floor(rand() * AIRLINES.length)]!;
      const origin = origins[Math.floor(rand() * origins.length)]!;
      const pax = isIntl ? Math.floor(150 + rand() * 200) : Math.floor(100 + rand() * 80);
      const minute = Math.floor(rand() * 55);
      const flightNum = `${airline.slice(0, 2).toUpperCase()}${100 + Math.floor(rand() * 900)}`;

      flights.push({
        flightNo: flightNum,
        airline,
        origin,
        scheduledTime: formatBkkTime(offset, minute),
        estimatedPax: pax,
        type: "arrival"
      });
    }
  }

  // Add departures (people need buses TO airport)
  for (let offset = 0; offset < 4; offset++) {
    const hour = (currentHour + offset) % 24;
    const depCount = Math.max(1, Math.floor((HOURLY_ARRIVALS[hour] ?? 2) * 0.7));
    for (let i = 0; i < depCount; i++) {
      const dest = DEPARTURES_DESTINATIONS[Math.floor(rand() * DEPARTURES_DESTINATIONS.length)]!;
      const airline = AIRLINES[Math.floor(rand() * AIRLINES.length)]!;
      const pax = Math.floor(100 + rand() * 150);
      const minute = Math.floor(rand() * 55);
      const flightNum = `${airline.slice(0, 2).toUpperCase()}${100 + Math.floor(rand() * 900)}`;
      flights.push({
        flightNo: flightNum, airline, origin: dest,
        scheduledTime: formatBkkTime(offset, minute),
        estimatedPax: pax, type: "departure"
      });
    }
  }

  // Sort by scheduled time
  flights.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
  return flights;
}

export function getNationalityBreakdown(): { country: string; flag: string; pax: number; percentage: number }[] {
  const flights = getFlightSchedule().filter(f => f.type === "arrival");
  const countryPax = new Map<string, { flag: string; pax: number }>();
  for (const f of flights) {
    const info = ORIGIN_COUNTRY[f.origin] ?? { country: f.origin, flag: "✈️" };
    const existing = countryPax.get(info.country) ?? { flag: info.flag, pax: 0 };
    existing.pax += f.estimatedPax;
    countryPax.set(info.country, existing);
  }
  const total = flights.reduce((s, f) => s + f.estimatedPax, 0) || 1;
  return Array.from(countryPax.entries())
    .map(([country, data]) => ({
      country, flag: data.flag, pax: data.pax,
      percentage: Math.round((data.pax / total) * 100)
    }))
    .sort((a, b) => b.pax - a.pax);
}

export function getDemandForecast(currentFleetOnline: number): DemandForecast {
  const flights = getFlightSchedule();
  const currentHour = getBangkokHour();

  // Next 2 hours of arrivals
  const next2hFlights = flights.slice(0, Math.ceil(flights.length * 0.6));
  const arrivalsNext2h = next2hFlights.length;
  const estimatedPaxNext2h = next2hFlights.reduce((sum, f) => sum + f.estimatedPax, 0);

  // ~12-18% of arriving passengers consider public bus (behavioral economics baseline)
  const busConversionRate = 0.15;
  const busDemandEstimate = Math.ceil(estimatedPaxNext2h * busConversionRate);

  // Each bus holds ~40 passengers, runs ~75 min airport route
  const busCapacity = 40;
  const tripsPerBusIn2h = 1.5; // can do ~1.5 round trips in 2h
  const recommendedFleet = Math.max(
    currentFleetOnline,
    Math.ceil(busDemandEstimate / (busCapacity * tripsPerBusIn2h))
  );

  const deficit = recommendedFleet - currentFleetOnline;
  let recommendation: string;
  if (deficit <= 0) {
    recommendation = `Fleet adequate. ${currentFleetOnline} buses handle projected ${busDemandEstimate} riders.`;
  } else if (deficit <= 2) {
    recommendation = `Consider adding ${deficit} bus(es) to Airport Line. ${arrivalsNext2h} flights arriving with ~${estimatedPaxNext2h} passengers.`;
  } else {
    recommendation = `Deploy ${deficit} additional buses to Airport Line urgently. Peak arrival wave: ${arrivalsNext2h} flights, ~${estimatedPaxNext2h} passengers expected.`;
  }

  return {
    currentHour: formatBkkTime(0, 0),
    arrivalsNext2h,
    estimatedPaxNext2h,
    busDemandEstimate,
    currentFleetOnline,
    recommendedFleet,
    recommendation,
    flights
  };
}

export function getHourlyDemandProjection(seatsPerBus: number, busesOnline: number): HourlyDemandPoint[] {
  const currentHour = getBangkokHour();
  const daySeed = Math.floor(Date.now() / 86_400_000);
  const rand = seededRandom(daySeed + 999);
  const points: HourlyDemandPoint[] = [];

  for (let offset = -4; offset <= 8; offset++) {
    const hour = (currentHour + offset + 24) % 24;
    const arrivals = HOURLY_ARRIVALS[hour] ?? 2;
    const avgPaxPerFlight = 180 + Math.floor(rand() * 60);
    const estimatedPax = arrivals * avgPaxPerFlight;
    const busDemand = Math.ceil(estimatedPax * 0.15);
    const seatsAvailable = busesOnline * seatsPerBus;

    points.push({
      hour: `${String(hour).padStart(2, "0")}:00`,
      arrivals,
      estimatedPax,
      busDemand,
      seatsAvailable: offset <= 0 ? seatsAvailable : seatsAvailable // current capacity projected
    });
  }

  return points;
}
