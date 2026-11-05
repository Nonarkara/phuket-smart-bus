/**
 * The pace the buses actually run at — one implementation, used by the rider's
 * ETA and by the endpoint that serves it.
 *
 * WHY IT IS ITS OWN MODULE
 *   The rider's board computes "minutes away" as road metres ÷ the pace this
 *   line, this direction, this hour has actually been run. The pace comes
 *   from recorded end-to-end trips, and those trips live in the record. When
 *   the browser computed the medians itself, it had to download 33 service
 *   days — 210 kB, and up to fifteen seconds on a cold cache — to derive
 *   about forty numbers. On a phone at the airport that is the difference
 *   between an ETA and a distance.
 *
 *   So the medians are computed where the record is, and served as the small
 *   thing they are. This module is what both sides call, so the server's
 *   answer and the browser's answer cannot drift apart.
 *
 * THE RULES, unchanged
 *   Pace is the median MINUTES PER KILOMETRE of recorded end-to-end trips:
 *     per line · direction · hour   (an hour needs 3 trips before its own
 *                                    median is trusted)
 *     per line · direction           (the fallback)
 *     per line                      (the last fallback)
 *   With no recorded pace there is no pace, and a minute figure that cannot
 *   be backed is not shown. The rider sees the distance instead.
 */
import { quantile } from "./insights.js";

/** key → median minutes per km */
export type Pace = Map<string, number>;

/** The shape both sides hand in: the trips of a day, with the line they ran on. */
export type PaceDay = {
  lines: {
    routeId: string;
    /** The line's length along its own polyline, in metres. */
    lengthM: number;
    /** A loop has one way round; its trips are all "lap". */
    loop: boolean;
    trips: { dir: string; departMs: number; minutes: number }[];
  }[];
};

export const PACE_HOUR_MIN_TRIPS = 3;

/** The hour of day a trip left, in Bangkok. */
export function bkkHourOf(ms: number): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", hour12: false }).format(new Date(ms))) % 24;
}

/**
 * The pace map. The hour bucket is only trusted with three trips or more;
 * the direction and line buckets are always there.
 */
export function buildPace(days: PaceDay[]): Pace {
  const buckets = new Map<string, number[]>();
  const push = (k: string, v: number) => {
    const b = buckets.get(k);
    if (b) b.push(v);
    else buckets.set(k, [v]);
  };
  for (const day of days) {
    for (const line of day.lines) {
      if (!(line.lengthM > 0)) continue;
      const km = line.lengthM / 1000;
      for (const trip of line.trips) {
        if (!(trip.minutes > 0)) continue;
        const perKm = trip.minutes / km;
        const dir = line.loop ? "lap" : trip.dir;
        push(`${line.routeId}|${dir}|${bkkHourOf(trip.departMs)}`, perKm);
        push(`${line.routeId}|${dir}`, perKm);
        push(line.routeId, perKm);
      }
    }
  }
  const pace: Pace = new Map();
  for (const [k, v] of buckets) {
    if (k.split("|").length < 3 || v.length >= PACE_HOUR_MIN_TRIPS) pace.set(k, quantile(v, 0.5)!);
  }
  return pace;
}

/** The pace for a line, direction and hour, falling back as far as it must. */
export function minPerKm(pace: Pace, routeId: string, dir: string, hour: number): number | null {
  return pace.get(`${routeId}|${dir}|${hour}`) ?? pace.get(`${routeId}|${dir}`) ?? pace.get(routeId) ?? null;
}

/** The map as JSON, for the wire. */
export function paceToJson(pace: Pace): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of pace) out[k] = Math.round(v * 1000) / 1000;
  return out;
}

/** The map from the wire. A malformed entry is dropped, not guessed at. */
export function paceFromJson(raw: unknown): Pace {
  const pace: Pace = new Map();
  if (!raw || typeof raw !== "object") return pace;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v) && v > 0) pace.set(k, v);
  }
  return pace;
}

/** How many recorded trips the pace was built from — the rider's truth line. */
export function countTrips(days: PaceDay[]): number {
  return days.reduce((n, d) => n + d.lines.reduce((m, l) => m + l.trips.length, 0), 0);
}

/**
 * One recorded trip, as the small projections carry it.
 *
 * The cross-day views read the arrival minute and the plate; the pace reads
 * the direction, the departure minute and the minutes.
 */
export type SlimTripRecord = {
  plate?: string;
  dir: string;
  departMs: number;
  arriveMs?: number;
  minutes: number;
};

/**
 * The day's trips, with the line they ran on, and nothing else.
 *
 * A full research day carries the time–distance trace of every bus — 144 kB
 * for one day. The trips alone are about 8 kB. The pace and the cross-day
 * views read only the trips, so the small projection is what gets cached and
 * what gets read: 33 days of it is ~250 kB against 4.7 MB.
 */
export type CachedSlimDay = {
  date: string;
  lines: { routeId: string; loop: boolean; lengthM: number; trips: SlimTripRecord[] }[];
};

export function slimDay(day: CachedSlimDay): CachedSlimDay {
  return {
    date: day.date,
    lines: day.lines.map((l) => ({
      routeId: l.routeId,
      loop: l.loop,
      lengthM: l.lengthM,
      trips: l.trips.map((t) => ({
        plate: t.plate,
        dir: t.dir,
        departMs: t.departMs,
        arriveMs: t.arriveMs,
        minutes: t.minutes,
      })),
    })),
  };
}
