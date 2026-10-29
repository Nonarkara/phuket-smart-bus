/**
 * What many days of real trips say about one line — pure, from the slim trips
 * /api/research/period returns. Every sentence is a count or a percentile of
 * recorded trips; nothing here is modelled.
 *
 * Caveat the UI must carry: a "departure" is the start of a trip we recorded end
 * to end. A bus whose tracker went quiet mid-trip leaves no trip, so a long gap
 * can be a missing bus or a missing signal — both worth a look.
 */

export type SlimTrip = { plate: string; dir: string; departMs: number; arriveMs: number; minutes: number };
export type SlimDay = { date: string; lines: { routeId: string; trips: SlimTrip[] }[] };
export type LineNames = {
  from: string; to: string; loop: boolean;
  /** The line's published running time, pooled over both directions. */
  timetableMin: number | null;
  /** …and per direction, when the two differ (Airport line: 130 down, 147 up). A trip is judged against its own way. */
  timetableMinByDir?: { fwd: number; rev: number } | null;
};

/** A long gap: over 1.5× the line's usual gap in that direction, and never under an hour —
 *  Patong and Dragon run hourly by design, so "over an hour" alone would flag every gap. */
export const LONG_GAP_MIN = 60;
export const LONG_GAP_FACTOR = 1.5;
/** Hours need this many trips before their percentile is shown. */
export const MIN_TRIPS_PER_HOUR = 3;

export function quantile(values: number[], q: number): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return s[lo]! + (s[hi]! - s[lo]!) * (pos - lo);
}

const minuteOfDay = (ms: number, date: string) => (ms - Date.parse(`${date}T00:00:00+07:00`)) / 60_000;
const weekday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay(); // 0 Sun … 6 Sat
export const hhmm = (min: number) => {
  const m = Math.round(min);
  return `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(((m % 60) + 60) % 60).padStart(2, "0")}`;
};
export const dur = (min: number | null) => {
  if (min === null) return "—";
  const m = Math.round(min);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;
};

export type HourRow = { dir: string; hour: number; n: number; median: number; p85: number };
export type GapHour = { dir: string; hour: number; days: number; thresholdMin: number };

export type LineInsight = {
  days: number;
  trips: number;
  dirs: string[];
  medianByDir: Record<string, number | null>;
  /** Share of all trips that made the published running time + 10 min. Null without a timetable. */
  onTimetable: { made: number; total: number } | null;
  weekdayMedian: number | null;
  weekendMedian: number | null;
  byHour: HourRow[];
  gapHours: GapHour[];
  /** Typical (median over days) first and last departure per direction, minutes of day. */
  firstLast: Record<string, { first: number | null; last: number | null }>;
  sentences: string[];
};

export function dirLabel(names: LineNames, dir: string): string {
  return dir === "lap" ? "round the loop" : dir === "fwd" ? `${names.from} → ${names.to}` : `${names.to} → ${names.from}`;
}
const leaving = (names: LineNames, dir: string) => (dir === "lap" ? "On the loop" : `Leaving ${dir === "fwd" ? names.from : names.to}`);

export function lineInsight(days: SlimDay[], routeId: string, names: LineNames): LineInsight | null {
  const perDay = days
    .map((d) => ({ date: d.date, trips: d.lines.find((l) => l.routeId === routeId)?.trips ?? [] }))
    .filter((d) => d.trips.length > 0);
  if (perDay.length === 0) return null;
  const all = perDay.flatMap((d) => d.trips.map((t) => ({ ...t, date: d.date })));
  const dirs = names.loop ? ["lap"] : ["fwd", "rev"];

  const medianByDir: Record<string, number | null> = {};
  for (const dir of dirs) medianByDir[dir] = quantile(all.filter((t) => t.dir === dir).map((t) => t.minutes), 0.5);

  const tt = names.timetableMin;
  // A trip is judged against the timetable for its own direction when there is one.
  const ttOf = (dir: string) => (dir === "fwd" || dir === "rev" ? names.timetableMinByDir?.[dir] : undefined) ?? tt;
  const onTimetable = tt === null ? null : { made: all.filter((t) => t.minutes <= ttOf(t.dir)! + 10).length, total: all.length };

  const isWeekend = (date: string) => [0, 6].includes(weekday(date));
  const weekdayMedian = quantile(all.filter((t) => !isWeekend(t.date)).map((t) => t.minutes), 0.5);
  const weekendMedian = quantile(all.filter((t) => isWeekend(t.date)).map((t) => t.minutes), 0.5);

  const byHour: HourRow[] = [];
  for (const dir of dirs) {
    const buckets = new Map<number, number[]>();
    for (const t of all.filter((x) => x.dir === dir)) {
      const h = Math.floor(minuteOfDay(t.departMs, t.date) / 60);
      buckets.set(h, [...(buckets.get(h) ?? []), t.minutes]);
    }
    for (const [hour, mins] of [...buckets.entries()].sort((a, b) => a[0] - b[0])) {
      if (mins.length >= MIN_TRIPS_PER_HOUR) byHour.push({ dir, hour, n: mins.length, median: quantile(mins, 0.5)!, p85: quantile(mins, 0.85)! });
    }
  }

  const gapHours: GapHour[] = [];
  const firstLast: LineInsight["firstLast"] = {};
  for (const dir of dirs) {
    const count = new Map<number, Set<string>>();
    const firsts: number[] = [], lasts: number[] = [];
    const depsByDay = perDay.map((d) => ({ date: d.date, deps: d.trips.filter((t) => t.dir === dir).map((t) => minuteOfDay(t.departMs, d.date)).sort((a, b) => a - b) }));
    const usualGap = quantile(depsByDay.flatMap(({ deps }) => deps.slice(1).map((m, i) => m - deps[i]!)), 0.5) ?? 0;
    const threshold = Math.max(LONG_GAP_MIN, Math.round(usualGap * LONG_GAP_FACTOR));
    for (const { date, deps } of depsByDay) {
      if (deps.length === 0) continue;
      firsts.push(deps[0]!); lasts.push(deps[deps.length - 1]!);
      for (let i = 1; i < deps.length; i++) {
        if (deps[i]! - deps[i - 1]! > threshold) {
          const h = Math.floor(deps[i - 1]! / 60);
          count.set(h, (count.get(h) ?? new Set()).add(date));
        }
      }
    }
    for (const [hour, set] of count) gapHours.push({ dir, hour, days: set.size, thresholdMin: threshold });
    firstLast[dir] = { first: quantile(firsts, 0.5), last: quantile(lasts, 0.5) };
  }
  gapHours.sort((a, b) => b.days - a.days || a.hour - b.hour);

  // ── sentences: the few things a person should take away ──────────────────
  const n = perDay.length;
  const word = names.loop ? "lap" : "trip";
  const s: string[] = [];
  const overall = quantile(all.map((t) => t.minutes), 0.5)!;
  if (tt !== null && onTimetable) {
    const pct = Math.round((onTimetable.made / onTimetable.total) * 100);
    // "Only" is a verdict; say it only when the share is low.
    s.push(`Over ${n} days, ${all.length} ${word}s took a median ${dur(overall)} against the timetable's ${names.timetableMinByDir ? `${dur(names.timetableMinByDir.fwd)} one way and ${dur(names.timetableMinByDir.rev)} the other` : dur(tt)}. ${pct < 50 ? "Only " : ""}${onTimetable.made} of ${onTimetable.total} (${pct}%) came within 10 minutes of it.`);
  } else {
    s.push(`Over ${n} days, ${all.length} ${word}s took a median ${dur(overall)}.`);
  }
  if (!names.loop) {
    const [f, r] = [medianByDir.fwd, medianByDir.rev];
    if (f !== null && r !== null && Math.abs(f - r) >= 5) {
      const slowDir = f > r ? "fwd" : "rev";
      s.push(`${dirLabel(names, slowDir)} is the slow way: ${dur(Math.max(f, r))} against ${dur(Math.min(f, r))} the other way.`);
    }
  }
  const worstHour = [...byHour].sort((a, b) => b.p85 - a.p85)[0];
  if (worstHour && (byHour.length > 2)) {
    s.push(`The hardest hour to keep a timetable is ${dirLabel(names, worstHour.dir)} leaving around ${hhmm(worstHour.hour * 60)}: 85% of those ${word}s took up to ${dur(worstHour.p85)} (${worstHour.n} ${word}s).`);
  }
  if (weekdayMedian !== null && weekendMedian !== null && Math.abs(weekdayMedian - weekendMedian) >= 4) {
    s.push(`Weekends run ${Math.round(Math.abs(weekdayMedian - weekendMedian))} min ${weekendMedian < weekdayMedian ? "faster" : "slower"} than weekdays (${dur(weekendMedian)} against ${dur(weekdayMedian)}).`);
  }
  for (const dir of dirs) {
    const top = gapHours.filter((g) => g.dir === dir && g.days >= Math.max(3, Math.ceil(n / 3))).slice(0, 2);
    if (top.length) {
      const over = top[0]!.thresholdMin;
      s.push(`${leaving(names, dir)}, a wait of over ${over === 60 ? "an hour" : dur(over)} opens around ${top.map((g) => `${hhmm(g.hour * 60)} (${g.days} of ${n} days)`).join(" and ")}.`);
    }
  }
  return { days: n, trips: all.length, dirs, medianByDir, onTimetable, weekdayMedian, weekendMedian, byHour, gapHours, firstLast, sentences: s };
}
