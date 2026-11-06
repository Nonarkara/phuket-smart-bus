import type { RouteId } from "@shared/types";
import { getPublishedAirportDepartures, getPublishedAirportboundTrips } from "./fleetSimulator";
import { getScheduledServices } from "./scheduleService";
import { getStopsForRoute } from "./routes";
import { parseScheduleEntries } from "./time";
import airportToRawai from "../data/timetables/airport-to-rawai.json";
import rawaiToAirport from "../data/timetables/rawai-to-airport.json";

export type RiderDeparture = {
  departureMin: number;
  waitMin: number;
  destination: string;
};

/**
 * One timetable answer for every rider surface.
 *
 * The airport corridor uses the official per-stop timetable directly. Other
 * routes use the same published service records consumed by the legacy map.
 * `nowMin` is Bangkok wall-clock minutes and the result wraps to tomorrow.
 */
export function getNextRiderDeparture(
  routeId: RouteId | null,
  nowMin: number
): RiderDeparture | null {
  if (!routeId) return null;
  const dayMin = ((nowMin % 1440) + 1440) % 1440;

  const candidates = routeId === "rawai-airport"
    ? getPublishedAirportDepartures().map((departureMin) => ({
        departureMin,
        destination: "Patong & Rawai"
      }))
    : getScheduledServices(routeId).flatMap((service) =>
        service.departures.map((departureMin) => ({
          departureMin,
          destination: service.directionLabel || "destination"
        }))
      );

  if (candidates.length === 0) return null;
  const ordered = candidates.slice().sort((a, b) => a.departureMin - b.departureMin);
  const next = ordered.find((candidate) => candidate.departureMin > dayMin) ?? ordered[0];
  if (!next) return null;
  const departureMin = next.departureMin > dayMin ? next.departureMin : next.departureMin + 1440;
  return {
    departureMin,
    waitMin: departureMin - dayMin,
    destination: next.destination
  };
}

/** "Phuket FantaSea" and "Phuket Fantasea" are the same stop; "PEA Patong" and "Patong PEA" too. */
function sameStop(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const left = norm(a);
  const right = norm(b);
  if (left === right) return true;
  const words = (s: string) => s.split(" ").filter(Boolean).sort().join(" ");
  return words(left) === words(right);
}

type TimetableShape = {
  stops: { name: string }[];
  departures: { times: (string | null)[] }[];
};

/** The minute of the day a clock string names, or null. */
function clockMinutes(value: string | null | undefined): number | null {
  if (!value) return null;
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(value.trim());
  if (!m) return null;
  let hours = Number(m[1]);
  const minutes = Number(m[2]);
  const meridiem = m[3]?.toUpperCase();
  if (meridiem === "PM" && hours < 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

/**
 * The next published bus AT a stop, in the direction the rider is going.
 *
 * The live ETA is measured: road metres still to drive ÷ the pace the line
 * actually runs. When no bus is on the way, the honest fallback is what the
 * timetable says about THIS stop — a bus leaves Rawai at 06:20 and reaches
 * Patong at 07:05, and the rider standing in Patong is waiting for 07:05,
 * not for 06:20. The airport corridor reads the official per-stop timetable
 * the company published; other lines read the stop's own published schedule.
 *
 * A stop the published timetable does not name has no published arrival, and
 * this returns null: the board then says nothing about a time it cannot
 * back, rather than a time that is wrong.
 */
export function getNextPublishedArrival(
  routeId: RouteId | null,
  stopName: string,
  direction: "fwd" | "rev",
  nowMin: number
): { arrivalMin: number; waitMin: number } | null {
  if (!routeId) return null;
  const dayMin = ((nowMin % 1440) + 1440) % 1440;

  const arrivals: number[] = [];
  if (routeId === "rawai-airport") {
    // "fwd" is toward the line's second terminal (Rawai), "rev" toward the
    // first (the airport) — the same convention the live board uses.
    const table = (direction === "fwd" ? airportToRawai : rawaiToAirport) as unknown as TimetableShape;
    const index = table.stops.findIndex((s) => sameStop(s.name, stopName));
    if (index < 0) return null;
    for (const departure of table.departures) {
      const at = clockMinutes(departure.times[index]);
      if (at === null) continue;
      arrivals.push(at);
    }
  } else {
    const stop = getStopsForRoute(routeId).find((s) => sameStop(s.name.en, stopName));
    if (!stop) return null;
    const { departures } = parseScheduleEntries(stop.scheduleText);
    arrivals.push(...departures);
  }
  if (arrivals.length === 0) return null;

  const ordered = arrivals.slice().sort((a, b) => a - b);
  const next = ordered.find((a) => a > dayMin) ?? ordered[0]!;
  const arrivalMin = next > dayMin ? next : next + 1440;
  return { arrivalMin, waitMin: arrivalMin - dayMin };
}

/**
 * The next published DEPARTURE of the airport corridor in one direction.
 *
 * The departure time, not the arrival: at the airport they are the same
 * minute, and this is what the rider waiting at the kerb is waiting for.
 */
export function getNextPublishedDeparture(
  direction: "fwd" | "rev",
  nowMin: number
): { departureMin: number; waitMin: number } | null {
  const dayMin = ((nowMin % 1440) + 1440) % 1440;
  const departures =
    direction === "fwd" ? getPublishedAirportDepartures() : getPublishedAirportboundTrips().map((t) => t.originDepMin);
  if (departures.length === 0) return null;
  const ordered = departures.slice().sort((a, b) => a - b);
  const next = ordered.find((d) => d > dayMin) ?? ordered[0]!;
  const departureMin = next > dayMin ? next : next + 1440;
  return { departureMin, waitMin: departureMin - dayMin };
}
