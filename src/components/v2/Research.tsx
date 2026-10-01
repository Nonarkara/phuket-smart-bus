/**
 * /research — the real fleet, as a timetable planner reads it.
 *
 * One service day (03:00 → 03:00 Bangkok) from the permanent fix record (D1),
 * analysed by shared/research.ts and served by /api/research/day:
 *   - time–distance (Marey) diagram: every bus as a line through time and
 *     along its route. Slope = speed, flat = dwell, lines bunching = buses
 *     arriving together, gaps = the wait a rider sees.
 *   - trip time by departure hour, headways at each terminal, minutes from
 *     the terminal to every stop, and the running time a timetable would
 *     need to hold (85th percentile of what the buses actually took).
 * Nothing here is modelled. Every figure is a count of observed fixes.
 */
import { useEffect, useMemo, useState } from "react";
import { appPath } from "../../lib/paths";

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
/** A trace breaks where the tracker was silent this long — never drawn across. */
const TRACE_GAP_MIN = 5;
/** p85: the running time that 85% of observed trips made — the usual schedule-setting rule. */
const SCHEDULE_PCTL = 0.85;

function serviceDateNow(): string {
  return new Date(Date.now() + BKK_OFFSET_MS - 3 * 3_600_000).toISOString().slice(0, 10);
}

const hhmm = (min: number) => {
  const m = Math.round(min);
  return `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};
const bkkMin = (ms: number, date: string) => (ms - Date.parse(`${date}T00:00:00+07:00`)) / 60_000;

function quantile(values: number[], q: number): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return s[lo]! + (s[hi]! - s[lo]!) * (pos - lo);
}
const fmt = (n: number | null, d = 0) => (n === null ? "—" : n.toFixed(d));

function dirLabel(line: LineDay, dir: Trip["dir"]) {
  return dir === "lap" ? "Lap" : dir === "fwd" ? `${line.from} → ${line.to}` : `${line.to} → ${line.from}`;
}

/** Container width in px, so SVG units are pixels and 13 px text stays 13 px. */
function useWidth(min: number) {
  // A callback ref: the chart's container mounts only after data arrives.
  const [el, ref] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(min);
  useEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(min, Math.floor(entry!.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el, min]);
  return { ref, width };
}

// ── Time–distance diagram ──────────────────────────────────────────────────
function Marey({ line, date, focus, onFocus, W }: { line: LineDay; date: string; focus: string | null; onFocus: (p: string | null) => void; W: number }) {
  const H = 560, L = 190, R = 16, T = 16, B = 34;
  const all = line.buses.flatMap((b) => b.points.map((p) => p[0]));
  const x0 = all.length ? Math.max(4 * 60, Math.floor((Math.min(...all) - 20) / 60) * 60) : 5 * 60;
  const x1 = all.length ? Math.min(27 * 60, Math.ceil((Math.max(...all) + 20) / 60) * 60) : 24 * 60;
  const km = line.lengthM / 1000;
  const sx = (m: number) => L + ((m - x0) / (x1 - x0)) * (W - L - R);
  const sy = (k: number) => T + (k / km) * (H - T - B);
  const hours = [];
  for (let h = Math.ceil(x0 / 60); h <= Math.floor(x1 / 60); h++) hours.push(h);

  // Label a stop only when it has room; every stop still gets its hairline.
  let lastY = -Infinity;
  const labelled = line.stops.map((s) => {
    const y = sy(s.alongM / 1000);
    const show = y - lastY >= 16;
    if (show) lastY = y;
    return { ...s, y, show };
  });

  const nowMin = line.buses.length ? bkkMin(Date.now(), date) : null;

  return (
    <svg className="research__marey" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label={`Time–distance diagram, ${line.name}: ${line.buses.length} buses, ${line.trips.length} trips`}>
      {labelled.map((s) => (
        <g key={s.name}>
          <line x1={L} x2={W - R} y1={s.y} y2={s.y} className="research__stopline" />
          {s.show && <text x={L - 8} y={s.y + 4} textAnchor="end" className="research__axis">{s.name}</text>}
        </g>
      ))}
      {hours.map((h) => (
        <g key={h}>
          <line x1={sx(h * 60)} x2={sx(h * 60)} y1={T} y2={H - B} className="research__gridline" />
          <text x={sx(h * 60)} y={H - B + 20} textAnchor="middle" className="research__axis">{String(h % 24).padStart(2, "0")}</text>
        </g>
      ))}
      {nowMin !== null && nowMin > x0 && nowMin < x1 && (
        <line x1={sx(nowMin)} x2={sx(nowMin)} y1={T} y2={H - B} className="research__now" />
      )}
      {line.buses.map((bus) => {
        // One path per unbroken run of fixes: a silent tracker is a gap, not a straight line.
        let d = "";
        bus.points.forEach(([m, k], i) => {
          const prev = bus.points[i - 1];
          d += `${!prev || m - prev[0] > TRACE_GAP_MIN ? "M" : "L"}${sx(m).toFixed(1)},${sy(k).toFixed(1)}`;
        });
        const on = focus === bus.plate;
        return (
          <g key={bus.plate} onMouseEnter={() => onFocus(bus.plate)} onMouseLeave={() => onFocus(null)}>
            <path d={d} className="research__hit" />
            <path d={d} className={`research__trace${on ? " is-focus" : focus ? " is-dim" : ""}`} />
          </g>
        );
      })}
      <text x={L} y={H - 4} className="research__axis">Bangkok time →</text>
    </svg>
  );
}

// ── Trip time by departure hour ────────────────────────────────────────────
function TripTimes({ line, date }: { line: LineDay; date: string }) {
  const { ref, width: W } = useWidth(320);
  const H = 260, L = 44, R = 10, T = 12, B = 30;
  const trips = line.trips;
  const maxMin = Math.max(30, ...trips.map((t) => t.minutes));
  const yMax = Math.ceil(maxMin / 30) * 30;
  const sx = (m: number) => L + ((m - 300) / (25 * 60 - 300)) * (W - L - R);
  const sy = (v: number) => H - B - (v / yMax) * (H - T - B);
  const ticks = [];
  for (let v = 0; v <= yMax; v += 30) ticks.push(v);
  return (
    <div ref={ref}>
    <svg className="research__chart" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Trip time by departure time">
      {ticks.map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={sy(v)} y2={sy(v)} className="research__gridline" />
          <text x={L - 6} y={sy(v) + 4} textAnchor="end" className="research__axis">{v}</text>
        </g>
      ))}
      {[6, 9, 12, 15, 18, 21, 24].map((h) => (
        <text key={h} x={sx(h * 60)} y={H - 8} textAnchor="middle" className="research__axis">{String(h % 24).padStart(2, "0")}</text>
      ))}
      {trips.map((t, i) => (
        <circle key={i} cx={sx(bkkMin(t.departMs, date))} cy={sy(t.minutes)} r={4}
          className={t.dir === "rev" ? "research__dot research__dot--rev" : "research__dot"}>
          <title>{`${t.plate} · ${dirLabel(line, t.dir)} · left ${hhmm(bkkMin(t.departMs, date))} · ${t.minutes} min · ${t.avgKph} km/h`}</title>
        </circle>
      ))}
    </svg>
    </div>
  );
}

// ── Headways at the origin terminal ────────────────────────────────────────
function Headways({ line, date }: { line: LineDay; date: string }) {
  const dirs = line.loop ? (["lap"] as const) : (["fwd", "rev"] as const);
  return (
    <div className="research__headways">
      {dirs.map((dir) => {
        const deps = line.trips.filter((t) => t.dir === dir).map((t) => bkkMin(t.departMs, date)).sort((a, b) => a - b);
        const gaps = deps.slice(1).map((m, i) => m - deps[i]!);
        const med = quantile(gaps, 0.5);
        const bunched = med === null ? 0 : gaps.filter((g) => g < med / 3).length;
        return (
          <div key={dir} className="research__headway-row">
            <div className="research__headway-label">
              <strong>{dirLabel(line, dir)}</strong>
              <span>{deps.length} departures · median gap {fmt(med)} min · longest {fmt(gaps.length ? Math.max(...gaps) : null)} min{bunched ? ` · ${bunched} bunched (< ⅓ of median)` : ""}</span>
            </div>
            <div className="research__ticks">
              {deps.map((m, i) => (
                <span key={i} className={`research__tick${med !== null && i > 0 && gaps[i - 1]! < med / 3 ? " is-bunched" : ""}`}
                  style={{ left: `${((m - 300) / (25 * 60 - 300)) * 100}%` }} title={hhmm(m)} />
              ))}
            </div>
          </div>
        );
      })}
      <div className="research__ticks-axis">{["05", "09", "13", "17", "21", "01"].map((h) => <span key={h}>{h}</span>)}</div>
    </div>
  );
}

// ── Minutes from the terminal to each stop ─────────────────────────────────
function StopProfile({ line, date }: { line: LineDay; date: string }) {
  const dirs = line.loop ? (["lap"] as const) : (["fwd", "rev"] as const);
  return (
    <div className="research__table-scroll">
      <table className="study__table research__profile">
        <thead>
          <tr>
            <th>Stop</th>
            {dirs.map((d) => <th key={d} className="study__num">{dirLabel(line, d)} · median (p90) min</th>)}
          </tr>
        </thead>
        <tbody>
          {line.stops.map((s, si) => (
            <tr key={s.name}>
              <td>{s.name} <span className="research__th">{s.nameTh}</span></td>
              {dirs.map((d) => {
                const since = line.trips.filter((t) => t.dir === d)
                  .map((t) => { const at = t.stopMin[si]; return at == null ? null : at - bkkMin(t.departMs, date); })
                  .filter((v): v is number => v !== null && v >= -2 && v < 300);
                return <td key={d} className="study__num">{since.length ? `${fmt(quantile(since, 0.5))} (${fmt(quantile(since, 0.9))})` : "—"}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Running time a timetable should hold ───────────────────────────────────
function ScheduleTable({ line, date }: { line: LineDay; date: string }) {
  const dirs = line.loop ? (["lap"] as const) : (["fwd", "rev"] as const);
  const hours = Array.from({ length: 20 }, (_, i) => i + 5);
  return (
    <div className="research__table-scroll">
      <table className="study__table">
        <thead>
          <tr>
            <th>Leaving</th>
            {dirs.map((d) => <th key={d} className="study__num" colSpan={3}>{dirLabel(line, d)}</th>)}
          </tr>
          <tr>
            <th />
            {dirs.flatMap((d) => [
              <th key={`${d}n`} className="study__num">trips</th>,
              <th key={`${d}m`} className="study__num">median</th>,
              <th key={`${d}p`} className="study__num">schedule (p85)</th>,
            ])}
          </tr>
        </thead>
        <tbody>
          {hours.map((h) => {
            const cells = dirs.map((d) => line.trips.filter((t) => t.dir === d && Math.floor(bkkMin(t.departMs, date) / 60) === h).map((t) => t.minutes));
            if (cells.every((c) => c.length === 0)) return null;
            return (
              <tr key={h}>
                <td>{String(h % 24).padStart(2, "0")}:00</td>
                {cells.flatMap((c, i) => [
                  <td key={`${i}n`} className="study__num">{c.length || "—"}</td>,
                  <td key={`${i}m`} className="study__num">{fmt(quantile(c, 0.5))}</td>,
                  <td key={`${i}p`} className="study__num"><strong>{c.length >= 3 ? fmt(quantile(c, SCHEDULE_PCTL)) : c.length ? <span className="study__null">n&lt;3</span> : "—"}</strong></td>,
                ])}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function Research() {
  const [date, setDate] = useState(serviceDateNow);
  const [data, setData] = useState<DayResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [routeId, setRouteId] = useState("rawai-airport");
  const [focus, setFocus] = useState<string | null>(null);
  const marey = useWidth(900);

  useEffect(() => {
    let alive = true;
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
        setError(null);
        setData(body);
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
    };
    void load();
    const id = setInterval(() => { if (!data?.finished) void load(); }, 60_000);
    return () => { alive = false; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const line = data?.lines.find((l) => l.routeId === routeId) ?? null;
  const stats = useMemo(() => {
    if (!line) return null;
    const mins = line.trips.map((t) => t.minutes);
    const kph = line.trips.map((t) => t.avgKph);
    const deps = line.trips.map((t) => t.departMs);
    const arrs = line.trips.map((t) => t.arriveMs);
    return {
      buses: line.buses.length,
      trips: line.trips.length,
      med: quantile(mins, 0.5), p10: quantile(mins, 0.1), p90: quantile(mins, 0.9),
      kph: quantile(kph, 0.5),
      first: deps.length ? hhmm(bkkMin(Math.min(...deps), date)) : "—",
      last: arrs.length ? hhmm(bkkMin(Math.max(...arrs), date)) : "—",
      perBus: line.buses.map((b) => ({ plate: b.plate, trips: line.trips.filter((t) => t.plate === b.plate).length })),
    };
  }, [line, date]);

  return (
    <div className="v2 v2--operations study research" style={{ zoom: 1, minHeight: "100vh", overflow: "auto" }}>
      <header className="v2-header study__header">
        <div className="v2-header__brand">
          <span className="v2-header__eyebrow">Schedule research</span>
          <h1>Phuket Smart Bus · Real trips</h1>
          <span className="v2-header__sub">Every line drawn from GPS fixes the buses sent — nothing modelled</span>
        </div>
        <div className="study__controls">
          <input type="date" className="study__date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Service day (Bangkok)" />
          <a className="study__refresh" href={`${appPath("/api/research/fixes")}?date=${date}&format=csv`}>Raw CSV</a>
        </div>
        <div className="study__actions">
          <a className="v2-source__btn" href={appPath("/ops")}>← Ops</a>
          <a className="v2-source__btn" href={appPath("/study")}>Study</a>
        </div>
      </header>

      {error && <div className="study__error"><strong>Could not load {date}.</strong><span>{error}</span></div>}

      {data && (
        <>
          <nav className="study__chips research__lines" aria-label="Line">
            {data.lines.map((l) => (
              <button key={l.routeId} type="button" className={`study__chip${l.routeId === routeId ? " is-active" : ""}`} onClick={() => setRouteId(l.routeId)}>
                {l.name} · {l.trips.length}
              </button>
            ))}
          </nav>

          {line && stats && (
            <>
              <section className="study__kpis">
                <div className="study__kpi"><span className="study__kpi-label">Buses on the line</span><strong className="study__kpi-value">{stats.buses}</strong><span className="study__kpi-detail">{(line.lengthM / 1000).toFixed(1)} km of route · {line.stops.length} stops</span></div>
                <div className="study__kpi"><span className="study__kpi-label">{line.loop ? "Laps" : "Trips completed"}</span><strong className="study__kpi-value">{stats.trips}</strong><span className="study__kpi-detail">first left {stats.first} · last arrived {stats.last}</span></div>
                <div className="study__kpi"><span className="study__kpi-label">Trip time</span><strong className="study__kpi-value">{fmt(stats.med)} min</strong><span className="study__kpi-detail">p10 {fmt(stats.p10)} · p90 {fmt(stats.p90)} — the spread a timetable must absorb</span></div>
                <div className="study__kpi"><span className="study__kpi-label">Average speed</span><strong className="study__kpi-value">{fmt(stats.kph, 1)} km/h</strong><span className="study__kpi-detail">terminal to terminal, dwell at stops included</span></div>
              </section>

              <section className="study__table-wrap">
                <h3>Where every bus was, all day</h3>
                <p className="study__hint">Down the side, the stops in route order ({line.from} at the top). Across, the time. Each line is one bus. Steep = moving, flat = standing, lines touching = buses arriving together. A break means the tracker went quiet. Hover a line, or a plate below, to follow one bus.</p>
                <div className="research__marey-wrap" ref={marey.ref}><Marey line={line} date={date} focus={focus} onFocus={setFocus} W={marey.width} /></div>
                <div className="research__plates">
                  {stats.perBus.map((b) => (
                    <button key={b.plate} type="button" className={`study__chip${focus === b.plate ? " is-active" : ""}`}
                      onMouseEnter={() => setFocus(b.plate)} onMouseLeave={() => setFocus(null)} onClick={() => setFocus(focus === b.plate ? null : b.plate)}>
                      {b.plate} · {b.trips}
                    </button>
                  ))}
                  {line.buses.length === 0 && <span className="study__hint">No bus reported on this line in this service day yet.</span>}
                </div>
              </section>

              <div className="research__pair">
                <section className="study__table-wrap">
                  <h3>How long each trip took</h3>
                  <p className="study__hint">One dot per trip, at the time it left. Filled: {line.from} → {line.to}. Open: the way back.</p>
                  <TripTimes line={line} date={date} />
                </section>
                <section className="study__table-wrap">
                  <h3>How long riders wait between buses</h3>
                  <p className="study__hint">Each tick is a departure from the terminal. Amber ticks left less than a third of the usual gap after the bus before — bunching.</p>
                  <Headways line={line} date={date} />
                </section>
              </div>

              <section className="study__table-wrap">
                <h3>Running time to put in the timetable</h3>
                <p className="study__hint">By the hour a trip leaves: how many trips, the median time, and the 85th-percentile time — a schedule built on it is met by 85% of trips. Needs 3+ trips in the hour; one day is a sample, a month is a timetable.</p>
                <ScheduleTable line={line} date={date} />
              </section>

              <section className="study__table-wrap">
                <h3>Minutes from the terminal to each stop</h3>
                <StopProfile line={line} date={date} />
              </section>

              <section className="study__table-wrap">
                <h3>Trip log</h3>
                <div className="research__table-scroll">
                  <table className="study__table">
                    <thead><tr><th>Bus</th><th>Direction</th><th>Left</th><th>Arrived</th><th className="study__num">Minutes</th><th className="study__num">km/h</th></tr></thead>
                    <tbody>
                      {line.trips.length === 0
                        ? <tr><td colSpan={6} className="study__empty">No completed trip yet — a trip counts when a bus leaves one terminal zone and reaches the other.</td></tr>
                        : line.trips.map((t, i) => (
                          <tr key={i} onMouseEnter={() => setFocus(t.plate)} onMouseLeave={() => setFocus(null)}>
                            <td><strong>{t.plate}</strong></td><td>{dirLabel(line, t.dir)}</td>
                            <td>{hhmm(bkkMin(t.departMs, date))}</td><td>{hhmm(bkkMin(t.arriveMs, date))}</td>
                            <td className="study__num">{t.minutes}</td><td className="study__num">{t.avgKph}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          <section className="study__caveats">
            <h3>How these numbers are made</h3>
            <ul>
              <li><strong>Source.</strong> Both feeds behind the official map at smartbus.phuket.cloud, sampled every 30 s by our collector and stored fix by fix, with no expiry. {data.fixes.toLocaleString()} fixes in this service day (03:00 → 03:00 Bangkok). Download them with “Raw CSV”.</li>
              <li><strong>Line.</strong> The line the tracker names; if it names none, the line whose road carries 60%+ of the bus's moving fixes (within 250 m). Fixes off the line are left out, never snapped onto it.</li>
              <li><strong>Trip.</strong> Leaving one terminal zone (within 1 km of the end of the line) and reaching the other, with no tracker silence over 15 min. Departure is the last fix at the origin; arrival the first at the destination. Loops count a lap each time the bus comes round.</li>
              <li><strong>Stop times</strong> are interpolated between the two fixes either side of the stop, only when they are ≤5 min apart.</li>
              <li><strong>Not measured:</strong> riders. The passenger counters report 0 on every bus, so this page says nothing about how full the buses were.</li>
              {data.unassigned.length > 0 && <li><strong>{data.unassigned.length} buses on no PKSB line</strong> ({data.unassigned.filter((u) => u.movingFixes > 0).length} moved): the town fleet and parked buses. They are in the raw CSV and on /study.</li>}
            </ul>
          </section>
          <footer className="study__footer"><span>{data.finished ? "Finished day" : "Day in progress — refreshes each minute"} · computed {new Date(data.computedAt).toLocaleTimeString("en-GB", { timeZone: "Asia/Bangkok" })} BKK</span></footer>
        </>
      )}
    </div>
  );
}
