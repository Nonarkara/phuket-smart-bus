/**
 * How long the OFFICIAL timetable says a trip takes — one place.
 *
 * The figure of 95 minutes for Airport ↔ Rawai was written down in six
 * modules as "the published running time". It is not: it is the
 * passenger-facing comparison number in the taxi-vs-bus table. The official
 * PKSB timetable's own first-stop → last-stop times are a median 130 min
 * Airport → Rawai and 147 min Rawai → Airport (range 102–147). Every screen
 * that judged a real bus against "the timetable" with 95 was calling a
 * normal trip 35–50 minutes late.
 *
 * Read from the same two timetable files the map and the rider countdown use.
 * Forward differences, so a trip across midnight is not negative.
 */
import airportToRawai from "../data/timetables/airport-to-rawai.json";
import rawaiToAirport from "../data/timetables/rawai-to-airport.json";

type Timetable = { departures: { times: (string | null)[] }[] };

function minutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h! * 60 + m!;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length & 1 ? s[mid]! : Math.round((s[mid - 1]! + s[mid]!) / 2);
}

/** End-to-end minutes of every published trip: first stop it serves → last stop. */
function endToEnd(timetable: Timetable): number[] {
  const out: number[] = [];
  for (const dep of timetable.departures) {
    const times = dep.times.filter((t): t is string => Boolean(t));
    if (times.length < 2) continue;
    out.push((((minutes(times[times.length - 1]!) - minutes(times[0]!)) % 1440) + 1440) % 1440);
  }
  return out;
}

const SOUTH = endToEnd(airportToRawai as Timetable);
const NORTH = endToEnd(rawaiToAirport as Timetable);

export type PublishedRunning = {
  /** Airport → Rawai ("fwd"): median published end-to-end minutes. */
  fwd: number;
  /** Rawai → Airport ("rev"). */
  rev: number;
  /** Both directions pooled — for a single line on a chart. */
  line: number;
};

/** The Airport ↔ Rawai line. Other lines publish no per-trip timetable. */
export const AIRPORT_PUBLISHED: PublishedRunning = {
  fwd: median(SOUTH)!,
  rev: median(NORTH)!,
  line: median([...SOUTH, ...NORTH])!,
};

/** Published end-to-end minutes for a route, or null when it publishes none. */
export function publishedRunningMin(routeId: string): number | null {
  return routeId === "rawai-airport" ? AIRPORT_PUBLISHED.line : null;
}

/** …for one direction of the Airport line ("fwd" = Airport → Rawai). */
export function publishedRunningByDir(routeId: string): { fwd: number; rev: number } | null {
  return routeId === "rawai-airport" ? { fwd: AIRPORT_PUBLISHED.fwd, rev: AIRPORT_PUBLISHED.rev } : null;
}
