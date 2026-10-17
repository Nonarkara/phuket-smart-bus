/**
 * The Airport line as it actually ran — from the research record's complete
 * recorded trips — turned into the departure lists the simulation runs on.
 *
 * For each weekday: the most recent recorded day of that weekday with a
 * working record (≥ MIN_TRIPS trips each way). Southbound = departures from
 * the airport ("fwd"), northbound = Rawai → Airport trips with the minute
 * the bus really reached the airport ("rev").
 *
 * Caveat the UI carries: only trips recorded end to end count. A bus whose
 * tracker went quiet mid-trip leaves no trip, so this can undercount supply.
 */
import type { SlimDay } from "@shared/insights";
import { quantile } from "@shared/insights";
import type { MeasuredAirportSupply } from "./fleetSimulator";

/** A day with fewer trips in either direction is treated as a tracker outage, not a service level. */
export const MIN_TRIPS = 5;

const minuteOf = (ms: number, date: string) => Math.round((ms - Date.parse(`${date}T00:00:00+07:00`)) / 60_000);
const weekdayOf = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();

export function measuredSupplyFor(day: SlimDay): MeasuredAirportSupply | null {
  const trips = day.lines.find((l) => l.routeId === "rawai-airport")?.trips ?? [];
  const inDay = (m: number) => m >= 0 && m < 1440;
  const southbound = trips.filter((t) => t.dir === "fwd").map((t) => minuteOf(t.departMs, day.date)).filter(inDay).sort((a, b) => a - b);
  const northbound = trips
    .filter((t) => t.dir === "rev")
    .map((t) => ({ originDepMin: minuteOf(t.departMs, day.date), airportArriveMin: minuteOf(t.arriveMs, day.date) }))
    .filter((t) => inDay(t.originDepMin) && inDay(t.airportArriveMin))
    .sort((a, b) => a.originDepMin - b.originDepMin);
  if (southbound.length < MIN_TRIPS || northbound.length < MIN_TRIPS) return null;
  return { date: day.date, southbound, northbound, medianTripMin: quantile(trips.map((t) => t.minutes), 0.5) };
}

/** Latest usable recorded day per weekday (0 = SUN). Weekdays with none stay on the timetable. */
export function measuredSupplyByDow(days: SlimDay[]): Partial<Record<number, MeasuredAirportSupply>> {
  const out: Partial<Record<number, MeasuredAirportSupply>> = {};
  for (const day of [...days].sort((a, b) => b.date.localeCompare(a.date))) {
    const dow = weekdayOf(day.date);
    if (out[dow]) continue;
    const s = measuredSupplyFor(day);
    if (s) out[dow] = s;
  }
  return out;
}
