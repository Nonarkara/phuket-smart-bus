/**
 * /research — how the buses really ran, one service day at a time.
 *
 * Written for a person first, a planner second:
 *   1. "In short" — plain sentences: trip time against the timetable, which
 *      way is slower, the slowest and quickest hours, how long people waited
 *      between buses, how often buses bunched.
 *   2. How long each trip took (dots; the timetable is a dashed line).
 *   3. How long people waited for the next bus (tall bar = long wait).
 *   4. Every bus, all day (time–distance diagram) for the curious.
 *   5. What the timetable should say — the time 85% of real trips made.
 *   Details (stop-by-stop minutes, every trip, method) fold away.
 *
 * Source: the permanent fix record (D1) via /api/research/day, analysed by
 * shared/research.ts. Nothing modelled. Sizes are em off a root that grows
 * with the screen, and charts draw at true pixel size in the same units.
 */
import { useEffect, useMemo, useState } from "react";
import { appPath } from "../../lib/paths";
import "./research.css";

type Trip = {
  plate: string;
  dir: "fwd" | "rev" | "lap";
  departMs: number;
  arriveMs: number;
  minutes: number;
  avgKph: number;
  stopMin: (number | null)[];
};

type LineDay = {
  routeId: string;
  name: string;
  from: string;
  to: string;
  loop: boolean;
  lengthM: number;
  stops: { name: string; nameTh: string; alongM: number }[];
  buses: { plate: string; feed: string; points: [number, number][] }[];
  trips: Trip[];
};

type DayResponse = {
  ok: boolean;
  error?: string;
  date: string;
  finished: boolean;
  computedAt: string;
  fixes: number;
  lines: LineDay[];
  unassigned: { plate: string; feed: string; fixes: number; movingFixes: number }[];
};

const BKK_OFFSET_MS = 7 * 3_600_000;
/** Published PKSB end-to-end running time (timetable effective 18 Jan 2025). Only the Airport line is published. */
const TIMETABLE_MIN: Record<string, number> = { "rawai-airport": 95 };
/** A trace breaks where the tracker was silent this long — never drawn across. */
const TRACE_GAP_MIN = 5;
/** The running time 85% of real trips made — the usual schedule-setting rule. */
const PLAN_PCTL = 0.85;

const serviceDateNow = () => new Date(Date.now() + BKK_OFFSET_MS - 3 * 3_600_000).toISOString().slice(0, 10);
const longDate = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));
const hhmm = (min: number) => {
  const m = Math.round(min);
  return `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(((m % 60) + 60) % 60).padStart(2, "0")}`;
};
const dur = (min: number | null) => {
  if (min === null) return "—";
  const m = Math.round(min);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;
};
const bkkMin = (ms: number, date: string) => (ms - Date.parse(`${date}T00:00:00+07:00`)) / 60_000;

function quantile(values: number[], q: number): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return s[lo]! + (s[hi]! - s[lo]!) * (pos - lo);
}

function dirName(line: LineDay, dir: Trip["dir"]) {
  return dir === "lap" ? "Round the loop" : dir === "fwd" ? `${line.from} → ${line.to}` : `${line.to} → ${line.from}`;
}
const dirsOf = (line: LineDay): Trip["dir"][] => (line.loop ? ["lap"] : ["fwd", "rev"]);

/** Container width and the px size of 1em there, so charts draw 1:1 with the page's type. */
function useBox(min: number) {
  const [el, ref] = useState<HTMLDivElement | null>(null);
  const [box, setBox] = useState({ w: min, em: 16 });
  useEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBox({ w: Math.max(min, Math.floor(e!.contentRect.width)), em: parseFloat(getComputedStyle(el).fontSize) || 16 }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el, min]);
  return { ref, ...box };
}

// ── departures and waits, per direction ────────────────────────────────────
function departures(line: LineDay, dir: Trip["dir"], date: string) {
  const deps = line.trips.filter((t) => t.dir === dir).map((t) => bkkMin(t.departMs, date)).sort((a, b) => a - b);
  const gaps = deps.slice(1).map((m, i) => ({ at: m, gap: m - deps[i]! }));
  const usual = quantile(gaps.map((g) => g.gap), 0.5);
  return { deps, gaps, usual, bunched: usual === null ? 0 : gaps.filter((g) => g.gap < usual / 3).length };
}

// ── "In short" ─────────────────────────────────────────────────────────────
function findings(line: LineDay, date: string): string[] {
  const t = line.trips;
  if (t.length === 0) return [`No complete ${line.loop ? "lap" : "trip"} on this line was recorded on ${longDate(date)}.`];
  const out: string[] = [];
  const word = line.loop ? "lap" : "trip";
  const med = quantile(t.map((x) => x.minutes), 0.5)!;
  const tt = TIMETABLE_MIN[line.routeId];
  out.push(tt
    ? `A ${word} took about ${dur(med)}, ${Math.abs(Math.round(med - tt))} min ${med >= tt ? "longer" : "shorter"} than the timetable's ${dur(tt)}.`
    : `A ${word} took about ${dur(med)}.`);
  const first = Math.min(...t.map((x) => x.departMs)), last = Math.max(...t.map((x) => x.arriveMs));
  out.push(`${t.length} ${word}s by ${new Set(t.map((x) => x.plate)).size} buses, the first leaving at ${hhmm(bkkMin(first, date))} and the last arriving at ${hhmm(bkkMin(last, date))}.`);

  if (!line.loop) {
    const f = t.filter((x) => x.dir === "fwd").map((x) => x.minutes), r = t.filter((x) => x.dir === "rev").map((x) => x.minutes);
    if (f.length >= 3 && r.length >= 3) {
      const [mf, mr] = [quantile(f, 0.5)!, quantile(r, 0.5)!];
      if (Math.abs(mf - mr) >= 5) out.push(`Going to ${mf > mr ? line.to : line.from} is the slow way: about ${dur(Math.max(mf, mr))}, against ${dur(Math.min(mf, mr))} the other way.`);
    }
  }
  const byHour = new Map<number, number[]>();
  for (const x of t) {
    const h = Math.floor(bkkMin(x.departMs, date) / 60);
    byHour.set(h, [...(byHour.get(h) ?? []), x.minutes]);
  }
  const hours = [...byHour.entries()].filter(([, m]) => m.length >= 2).map(([h, m]) => ({ h, med: quantile(m, 0.5)! }));
  if (hours.length >= 3) {
    const slow = hours.reduce((a, b) => (b.med > a.med ? b : a)), quick = hours.reduce((a, b) => (b.med < a.med ? b : a));
    if (slow.med - quick.med >= 5) out.push(`The slowest ${word}s left around ${hhmm(slow.h * 60)} (${dur(slow.med)}); the quickest around ${hhmm(quick.h * 60)} (${dur(quick.med)}).`);
  }
  for (const d of dirsOf(line)) {
    const { gaps, usual, bunched } = departures(line, d, date);
    if (usual === null || gaps.length < 3) continue;
    const worst = gaps.reduce((a, b) => (b.gap > a.gap ? b : a));
    const where = d === "lap" ? "On the loop" : `Leaving ${d === "fwd" ? line.from : line.to}`;
    out.push(`${where}, a bus left about every ${Math.round(usual)} min; the longest wait was ${Math.round(worst.gap)} min, until ${hhmm(worst.at)}.${bunched ? ` ${bunched} ${bunched === 1 ? "time" : "times"} a bus left right behind another.` : ""}`);
  }
  return out;
}

// ── chart: how long each trip took ─────────────────────────────────────────
function TripTimes({ line, date }: { line: LineDay; date: string }) {
  const { ref, w, em } = useBox(300);
  const H = 18 * em, L = 3.6 * em, R = 1 * em, T = 1.2 * em, B = 2.2 * em;
  const tt = TIMETABLE_MIN[line.routeId] ?? null;
  const yMax = Math.ceil(Math.max(30, tt ?? 0, ...line.trips.map((t) => t.minutes)) / 30) * 30;
  const x0 = 5 * 60, x1 = 25 * 60;
  const sx = (m: number) => L + ((m - x0) / (x1 - x0)) * (w - L - R);
  const sy = (v: number) => H - B - (v / yMax) * (H - T - B);
  const ticks: number[] = [];
  for (let v = 0; v <= yMax; v += yMax > 120 ? 60 : 30) ticks.push(v);
  return (
    <div ref={ref}>
      <svg className="rs-chart" width={w} height={H} viewBox={`0 0 ${w} ${H}`} role="img" aria-label={`Trip time by departure time, ${line.name}`}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={L} x2={w - R} y1={sy(v)} y2={sy(v)} className="rs-grid" />
            <text x={L - 0.5 * em} y={sy(v) + 0.3 * em} textAnchor="end" className="rs-axis">{v === 0 ? "0" : dur(v)}</text>
          </g>
        ))}
        {[6, 9, 12, 15, 18, 21, 24].map((h) => (
          <text key={h} x={sx(h * 60)} y={H - 0.6 * em} textAnchor="middle" className="rs-axis">{hhmm(h * 60)}</text>
        ))}
        {tt !== null && (
          <g>
            <line x1={L} x2={w - R} y1={sy(tt)} y2={sy(tt)} className="rs-timetable" />
            <text x={w - R} y={sy(tt) - 0.4 * em} textAnchor="end" className="rs-axis rs-axis--strong">timetable {dur(tt)}</text>
          </g>
        )}
        {line.trips.map((t, i) => (
          <circle key={i} cx={sx(bkkMin(t.departMs, date))} cy={sy(t.minutes)} r={0.32 * em}
            className={t.dir === "rev" ? "rs-dot rs-dot--rev" : "rs-dot"}>
            <title>{`${t.plate} · ${dirName(line, t.dir)} · left ${hhmm(bkkMin(t.departMs, date))} · took ${dur(t.minutes)}`}</title>
          </circle>
        ))}
      </svg>
    </div>
  );
}

// ── chart: how long people waited ──────────────────────────────────────────
function Waits({ line, date }: { line: LineDay; date: string }) {
  const { ref, w, em } = useBox(300);
  const rows = dirsOf(line).map((d) => ({ d, ...departures(line, d, date) }));
  const maxGap = Math.max(30, ...rows.flatMap((r) => r.gaps.map((g) => g.gap)));
  const rowH = 7 * em, L = 0.5 * em, R = 0.5 * em, top = 1.6 * em;
  const x0 = 5 * 60, x1 = 25 * 60;
  const sx = (m: number) => L + ((m - x0) / (x1 - x0)) * (w - L - R);
  const H = rows.length * (rowH + top) + 2 * em;
  const barW = Math.max(3, 0.45 * em);
  return (
    <div ref={ref}>
      <svg className="rs-chart" width={w} height={H} viewBox={`0 0 ${w} ${H}`} role="img" aria-label="Minutes between departures">
        {rows.map((r, ri) => {
          const base = ri * (rowH + top) + top + rowH;
          const sh = (g: number) => (g / maxGap) * rowH;
          return (
            <g key={r.d}>
              <text x={L} y={base - rowH - 0.5 * em} className="rs-axis rs-axis--strong">
                {r.d === "lap" ? "Round the loop" : `Leaving ${r.d === "fwd" ? line.from : line.to}`}
                {r.usual !== null ? ` — usually ${Math.round(r.usual)} min between buses` : ""}
              </text>
              <line x1={L} x2={w - R} y1={base} y2={base} className="rs-grid" />
              {r.usual !== null && <line x1={L} x2={w - R} y1={base - sh(r.usual)} y2={base - sh(r.usual)} className="rs-timetable" />}
              {r.gaps.map((g, i) => {
                const bunched = r.usual !== null && g.gap < r.usual / 3;
                return (
                  <rect key={i} x={sx(g.at) - barW / 2} y={base - sh(g.gap)} width={barW} height={Math.max(1, sh(g.gap))}
                    className={bunched ? "rs-bar rs-bar--bunched" : "rs-bar"}>
                    <title>{`Bus at ${hhmm(g.at)} came ${Math.round(g.gap)} min after the one before${bunched ? " — bunched" : ""}`}</title>
                  </rect>
                );
              })}
            </g>
          );
        })}
        {[6, 9, 12, 15, 18, 21, 24].map((h) => (
          <text key={h} x={sx(h * 60)} y={H - 0.4 * em} textAnchor="middle" className="rs-axis">{hhmm(h * 60)}</text>
        ))}
      </svg>
    </div>
  );
}

// ── chart: every bus, all day ──────────────────────────────────────────────
function Marey({ line, date, focus, onFocus }: { line: LineDay; date: string; focus: string | null; onFocus: (p: string | null) => void }) {
  const { ref, w, em } = useBox(640);
  const H = 26 * em, L = 11 * em, R = 1 * em, T = 1 * em, B = 2 * em;
  const all = line.buses.flatMap((b) => b.points.map((p) => p[0]));
  const x0 = all.length ? Math.max(4 * 60, Math.floor((Math.min(...all) - 20) / 60) * 60) : 5 * 60;
  const x1 = all.length ? Math.min(27 * 60, Math.ceil((Math.max(...all) + 20) / 60) * 60) : 24 * 60;
  const km = line.lengthM / 1000;
  const sx = (m: number) => L + ((m - x0) / (x1 - x0)) * (w - L - R);
  const sy = (k: number) => T + (k / km) * (H - T - B);
  const hours: number[] = [];
  for (let h = Math.ceil(x0 / 60); h <= Math.floor(x1 / 60); h += w < 900 ? 2 : 1) hours.push(h);
  let lastY = -Infinity;
  const stops = line.stops.map((s) => {
    const y = sy(s.alongM / 1000);
    const show = y - lastY >= 1.25 * em;
    if (show) lastY = y;
    return { ...s, y, show };
  });
  return (
    <div ref={ref} className="rs-scroll">
      <svg className="rs-chart" width={w} height={H} viewBox={`0 0 ${w} ${H}`} role="img"
        aria-label={`Every bus on ${line.name} through the day: ${line.buses.length} buses`}>
        {stops.map((s) => (
          <g key={s.name}>
            <line x1={L} x2={w - R} y1={s.y} y2={s.y} className="rs-stopline" />
            {s.show && <text x={L - 0.5 * em} y={s.y + 0.3 * em} textAnchor="end" className="rs-axis">{s.name}</text>}
          </g>
        ))}
        {hours.map((h) => (
          <g key={h}>
            <line x1={sx(h * 60)} x2={sx(h * 60)} y1={T} y2={H - B} className="rs-grid" />
            <text x={sx(h * 60)} y={H - 0.5 * em} textAnchor="middle" className="rs-axis">{hhmm(h * 60)}</text>
          </g>
        ))}
        {line.buses.map((bus) => {
          let d = "";
          bus.points.forEach(([m, k], i) => {
            const prev = bus.points[i - 1];
            d += `${!prev || m - prev[0] > TRACE_GAP_MIN ? "M" : "L"}${sx(m).toFixed(1)},${sy(k).toFixed(1)}`;
          });
          const on = focus === bus.plate;
          return (
            <g key={bus.plate} onMouseEnter={() => onFocus(bus.plate)} onMouseLeave={() => onFocus(null)}>
              <path d={d} className="rs-hit" />
              <path d={d} className={`rs-trace${on ? " is-focus" : focus ? " is-dim" : ""}`} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── page ───────────────────────────────────────────────────────────────────
export function Research() {
  const [date, setDate] = useState(serviceDateNow);
  const [data, setData] = useState<DayResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [routeId, setRouteId] = useState("rawai-airport");
  const [focus, setFocus] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let finished = false;
    const load = async () => {
      try {
        const res = await fetch(`${appPath("/api/research/day")}?date=${date}`, { cache: "no-store" });
        if (!(res.headers.get("content-type") ?? "").includes("json")) {
          if (alive) { setError(`The research service did not answer (HTTP ${res.status}).`); setData(null); }
          return;
        }
        const body = (await res.json()) as DayResponse;
        if (!alive) return;
        if (!body.ok) { setError(body.error ?? `HTTP ${res.status}`); setData(null); return; }
        finished = body.finished;
        setError(null);
        setData(body);
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
    };
    void load();
    const id = setInterval(() => { if (!finished) void load(); }, 60_000);
    return () => { alive = false; clearInterval(id); };
  }, [date]);

  const line = data?.lines.find((l) => l.routeId === routeId) ?? null;
  const said = useMemo(() => (line ? findings(line, date) : []), [line, date]);
  const word = line?.loop ? "lap" : "trip";

  return (
    <div className="v2 v2--operations rs">
      <div className="rs-page">
        <header className="rs-head">
          <div>
            <p className="rs-eyebrow">Phuket Smart Bus · real trips</p>
            <h1 className="rs-title">How the buses really ran on {longDate(date)}</h1>
            <p className="rs-sub">Every number below is counted from the buses' own GPS — nothing is modelled.{data && !data.finished ? " The day is still going; this refreshes every minute." : ""}</p>
          </div>
          <nav className="rs-nav" aria-label="Other views">
            <a href={appPath("/fleet")}>Fleet now</a>
            <a href={appPath("/study")}>Study</a>
            <a href={appPath("/ops")}>Ops wall</a>
          </nav>
        </header>

        <div className="rs-controls">
          <label className="rs-date">
            <span>Day</span>
            <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          </label>
          {data && (
            <div className="rs-lines" role="group" aria-label="Line">
              {data.lines.map((l) => (
                <button key={l.routeId} type="button" className={l.routeId === routeId ? "is-active" : undefined} onClick={() => setRouteId(l.routeId)} aria-pressed={l.routeId === routeId}>
                  {l.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {error && <p className="rs-error">Could not load {longDate(date)}: {error}</p>}

        {line && (
          <>
            <section className="rs-short" aria-label="In short">
              <h2>In short — {line.name}</h2>
              <ul>{said.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </section>

            {line.trips.length > 0 && (
              <>
                <section className="rs-card">
                  <h2>How long each {word} took</h2>
                  <p className="rs-hint">
                    One dot per {word}, placed at the time it left.{" "}
                    {line.loop ? "" : `Filled: ${line.from} → ${line.to}. Open: the way back. `}
                    {TIMETABLE_MIN[line.routeId] ? "Dots above the dashed line took longer than the timetable says." : ""}
                  </p>
                  <TripTimes line={line} date={date} />
                </section>

                <section className="rs-card">
                  <h2>How long people waited for the next bus</h2>
                  <p className="rs-hint">Each bar is one departure; its height is the minutes since the bus before. Tall bars are long waits; amber bars left right behind another bus. The dashed line is the usual gap.</p>
                  <Waits line={line} date={date} />
                </section>

                <section className="rs-card">
                  <h2>What the timetable should say</h2>
                  <p className="rs-hint">For each hour a bus leaves: how long it usually took, and the time to plan for — the time 85% of real {word}s made. One day is a sample; a month makes a timetable.</p>
                  <PlanTable line={line} date={date} />
                </section>
              </>
            )}

            <section className="rs-card">
              <h2>Every bus, all day</h2>
              <p className="rs-hint">
                Down the side, the stops in order ({line.from} at the top); across, the time. Each line is one bus: a slope is driving, flat is standing,
                two lines touching are two buses together. Point at a line to follow one bus.
              </p>
              {line.buses.length === 0
                ? <p className="rs-hint">No bus reported on this line that day.</p>
                : <Marey line={line} date={date} focus={focus} onFocus={setFocus} />}
            </section>

            <details className="rs-more">
              <summary>Minutes from the terminal to each stop</summary>
              <StopProfile line={line} date={date} />
            </details>
            <details className="rs-more">
              <summary>Every {word} ({line.trips.length})</summary>
              <table className="rs-table">
                <thead><tr><th>Bus</th><th>Way</th><th>Left</th><th>Arrived</th><th className="rs-num">Took</th></tr></thead>
                <tbody>
                  {line.trips.map((t, i) => (
                    <tr key={i}><td>{t.plate}</td><td>{dirName(line, t.dir)}</td><td>{hhmm(bkkMin(t.departMs, date))}</td><td>{hhmm(bkkMin(t.arriveMs, date))}</td><td className="rs-num">{dur(t.minutes)}</td></tr>
                  ))}
                </tbody>
              </table>
            </details>
            <details className="rs-more">
              <summary>How these numbers are made</summary>
              <ul className="rs-method">
                <li>Positions come from both trackers behind the official map (smartbus.phuket.cloud), collected every 30 s and kept fix by fix: {data?.fixes.toLocaleString()} fixes this day (03:00 to 03:00 Bangkok). <a href={`${appPath("/api/research/fixes")}?date=${date}&format=csv`}>Download them as CSV</a>.</li>
                <li>A trip starts at the last position at one terminal and ends at the first position at the other. Patong-line buses wait at Phuket Bus Terminal 1, so that is its terminal. Buses may leave the drawn route on the way; a trip only breaks if the tracker goes silent for 15 min or the bus jumps impossibly far.</li>
                <li>A loop lap is counted each time the bus comes round, either direction; a lap with a 15-min stand is a layover, not a lap.</li>
                <li>Stop times are interpolated between the two positions either side of the stop, when they are 5 min apart or less.</li>
                <li>Not measured: riders. Every passenger counter reads zero, so this page says nothing about how full the buses were.</li>
              </ul>
            </details>
          </>
        )}
      </div>
    </div>
  );
}

function PlanTable({ line, date }: { line: LineDay; date: string }) {
  const dirs = dirsOf(line);
  const hours = Array.from({ length: 21 }, (_, i) => i + 4);
  const cell = (d: Trip["dir"], h: number) => line.trips.filter((t) => t.dir === d && Math.floor(bkkMin(t.departMs, date) / 60) === h).map((t) => t.minutes);
  return (
    <div className="rs-scroll">
      <table className="rs-table">
        <thead>
          <tr><th>Leaving at</th>{dirs.map((d) => <th key={d} colSpan={2} className="rs-num">{dirName(line, d)}</th>)}</tr>
          <tr><th />{dirs.flatMap((d) => [<th key={`${d}u`} className="rs-num">usually took</th>, <th key={`${d}p`} className="rs-num">plan for</th>])}</tr>
        </thead>
        <tbody>
          {hours.map((h) => {
            const cells = dirs.map((d) => cell(d, h));
            if (cells.every((c) => c.length === 0)) return null;
            return (
              <tr key={h}>
                <td>{hhmm(h * 60)}</td>
                {cells.flatMap((c, i) => [
                  <td key={`${i}u`} className="rs-num">{c.length ? `${dur(quantile(c, 0.5))}${c.length > 1 ? ` (${c.length})` : ""}` : "—"}</td>,
                  <td key={`${i}p`} className="rs-num"><strong>{c.length >= 3 ? dur(quantile(c, PLAN_PCTL)) : c.length ? <span className="rs-few">needs 3+</span> : "—"}</strong></td>,
                ])}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StopProfile({ line, date }: { line: LineDay; date: string }) {
  const dirs = dirsOf(line);
  return (
    <div className="rs-scroll">
      <table className="rs-table">
        <thead><tr><th>Stop</th>{dirs.map((d) => <th key={d} className="rs-num">{dirName(line, d)}: usually (slow day)</th>)}</tr></thead>
        <tbody>
          {line.stops.map((s, si) => (
            <tr key={s.name}>
              <td>{s.name} <span className="rs-th">{s.nameTh}</span></td>
              {dirs.map((d) => {
                const since = line.trips.filter((t) => t.dir === d)
                  .map((t) => { const at = t.stopMin[si]; return at == null ? null : at - bkkMin(t.departMs, date); })
                  .filter((v): v is number => v !== null && v >= -2 && v < 300);
                return <td key={d} className="rs-num">{since.length ? `${dur(quantile(since, 0.5))} (${dur(quantile(since, 0.9))})` : "—"}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
