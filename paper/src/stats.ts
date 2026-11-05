/**
 * Descriptive statistics for the preprint. Pure; every figure in the paper
 * passes through here, so each definition is stated once.
 */

/** Linear-interpolation quantile (type 7, the R/NumPy default). Null on empty input. */
export function quantile(values: readonly number[], q: number): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const pos = (s.length - 1) * Math.min(1, Math.max(0, q));
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo]! + (s[hi]! - s[lo]!) * (pos - lo);
}

export const median = (values: readonly number[]) => quantile(values, 0.5);

export function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Sample standard deviation (n − 1). Null below two values. */
export function sd(values: readonly number[]): number | null {
  if (values.length < 2) return null;
  const m = mean(values)!;
  return Math.sqrt(values.reduce((a, v) => a + (v - m) ** 2, 0) / (values.length - 1));
}

/**
 * Coefficient of variation of headways, cv_h = sd / mean — the TCQSM measure of
 * headway adherence. Null below three headways: two numbers have a spread but
 * not a meaningful one.
 */
export function headwayCv(headways: readonly number[]): number | null {
  if (headways.length < 3) return null;
  const m = mean(headways)!;
  return m > 0 ? sd(headways)! / m : null;
}

/** Gaps between consecutive sorted times. */
export function gaps(times: readonly number[]): number[] {
  const s = [...times].sort((a, b) => a - b);
  const out: number[] = [];
  for (let i = 1; i < s.length; i++) out.push(s[i]! - s[i - 1]!);
  return out;
}

export type Summary = { n: number; min: number | null; p15: number | null; p50: number | null; p85: number | null; max: number | null; mean: number | null };

export function summarize(values: readonly number[]): Summary {
  return {
    n: values.length,
    min: values.length ? Math.min(...values) : null,
    p15: quantile(values, 0.15),
    p50: median(values),
    p85: quantile(values, 0.85),
    max: values.length ? Math.max(...values) : null,
    mean: mean(values),
  };
}

/**
 * One-to-one matching of observed times to scheduled times, each pair within
 * `window`, closest pairs first. A greedy nearest-pair match is the usual way
 * to align AVL departures to a timetable when trip IDs are not broadcast.
 */
export function matchToSchedule(
  observed: readonly number[],
  scheduled: readonly number[],
  window: number,
): { pairs: { observed: number; scheduled: number; deviation: number }[]; unmatchedObserved: number[]; unmatchedScheduled: number[] } {
  const candidates: { o: number; s: number; d: number }[] = [];
  observed.forEach((o, oi) => scheduled.forEach((s, si) => {
    const d = Math.abs(o - s);
    if (d <= window) candidates.push({ o: oi, s: si, d });
  }));
  candidates.sort((a, b) => a.d - b.d || a.s - b.s);
  const usedO = new Set<number>();
  const usedS = new Set<number>();
  const pairs: { observed: number; scheduled: number; deviation: number }[] = [];
  for (const c of candidates) {
    if (usedO.has(c.o) || usedS.has(c.s)) continue;
    usedO.add(c.o);
    usedS.add(c.s);
    pairs.push({ observed: observed[c.o]!, scheduled: scheduled[c.s]!, deviation: observed[c.o]! - scheduled[c.s]! });
  }
  pairs.sort((a, b) => a.scheduled - b.scheduled);
  return {
    pairs,
    unmatchedObserved: observed.filter((_, i) => !usedO.has(i)),
    unmatchedScheduled: scheduled.filter((_, i) => !usedS.has(i)),
  };
}

export const round = (v: number | null, digits = 1): number | null =>
  v === null || !Number.isFinite(v) ? null : Math.round(v * 10 ** digits) / 10 ** digits;
