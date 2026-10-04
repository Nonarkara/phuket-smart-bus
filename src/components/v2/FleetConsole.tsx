/**
 * /fleet — the real buses, right now, readable at a glance.
 *
 * Built for a person, not a debugger:
 *   1. One sentence: how many buses are out, and is the feed alive.
 *   2. Four states, each a count you can tap to filter.
 *   3. Each PKSB line drawn as a straight strip, terminals at the ends, every
 *      bus where it really is and which way it is heading. Gaps and bunching
 *      are visible without reading a number.
 *   4. The map, and a short list of what needs a look.
 *   5. One card per bus, grouped by what it is doing.
 * Every field the trackers send is still one click away at /fleet/raw.
 *
 * Sources: the live relay (positions, ~1 fix/min), and the server's own
 * all-day record for "today" figures (/api/research/day for trips,
 * /api/collect/week for km and runs) — never this tab's own tally.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import type { LiveBus } from "@shared/pksbFeed";
import geometry from "@shared/lineGeometry.json";
import { projectOnLine } from "@shared/research";
import { getLiveBusesRaw, getLiveFeedState, startLiveFeed, subscribeLiveFeed } from "../../engine/liveOps";
import { appPath } from "../../lib/paths";
import "./fleetConsole.css";

// ── what a bus is doing ────────────────────────────────────────────────────
type State = "driving" | "standing" | "late" | "quiet" | "off";
const FRESH_MS = 3 * 60_000;
const QUIET_MS = 15 * 60_000;
const OFF_MS = 12 * 3_600_000;
const MOVING_KPH = 4;
const ON_STRIP_M = 300;
const BUNCH_M = 1_200;
const TERMINAL_ZONE_M = 1_000;
/** Where each fleet sleeps (from the parked positions in the feed). */
const DEPOTS: [number, number][] = [[7.8814, 98.4093], [7.8930, 98.3622]];

const STATE_LABEL: Record<State, string> = {
  driving: "Driving",
  standing: "Standing",
  late: "Late update",
  quiet: "No signal",
  off: "Not seen today",
};
const STATE_HINT: Record<State, string> = {
  driving: "moving now",
  standing: "stopped, signal fresh",
  late: "last fix 3–15 min old",
  quiet: "silent 15 min – 12 h",
  off: "no fix in 12 h",
};

function stateOf(bus: LiveBus, now: number): State {
  const age = now - Date.parse(bus.updatedAt);
  if (age > OFF_MS) return "off";
  if (age > QUIET_MS) return "quiet";
  if (age > FRESH_MS) return "late";
  return bus.speedKph > MOVING_KPH ? "driving" : "standing";
}

type Line = (typeof geometry)[number] & { cum: number[] };
const LINES: Line[] = geometry.map((g) => {
  const cum = [0];
  for (let i = 1; i < g.poly.length; i++) {
    const [a, b] = [g.poly[i - 1]!, g.poly[i]!];
    const kx = 111_320 * Math.cos((a[0]! * Math.PI) / 180);
    cum.push(cum[i - 1]! + Math.hypot((b[1]! - a[1]!) * kx, (b[0]! - a[0]!) * 110_540));
  }
  return { ...g, cum };
});
const SHORT: Record<string, string> = {
  "rawai-airport": "Airport ↔ Rawai",
  "patong-old-bus-station": "Old Town ↔ Patong",
  "dragon-line": "Dragon loop",
};

function km(a: [number, number], b: [number, number]) {
  const kx = 111.32 * Math.cos((a[0] * Math.PI) / 180);
  return Math.hypot((b[1] - a[1]) * kx, (b[0] - a[0]) * 110.54);
}

const ago = (ms: number, now: number) => {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return `${s} s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86_400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86_400)} days ago`;
};
const bkkClock = (ms: number) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(ms));

type Row = {
  bus: LiveBus;
  state: State;
  fixMs: number;
  /** Line the tracker names, if any. */
  line: Line | null;
  /** Position on that line, when the bus is on its road. */
  alongM: number | null;
  /** "to" = toward the line's second terminal, "from" = toward the first, "lap" on a loop. */
  dir: "to" | "from" | "lap" | null;
  near: string | null;
  atDepot: boolean;
};

function readRow(bus: LiveBus, now: number): Row {
  const state = stateOf(bus, now);
  const line = LINES.find((l) => l.routeId === bus.routeId) ?? null;
  let alongM: number | null = null;
  let near: string | null = null;
  if (line) {
    const p = projectOnLine(line, bus.lat, bus.lng);
    if (p.offM <= ON_STRIP_M) {
      alongM = p.alongM;
      near = line.stops.reduce((best, s) => (Math.abs(s.alongM - p.alongM) < Math.abs(best.alongM - p.alongM) ? s : best), line.stops[0]!).name;
    }
  }
  const dest = (bus.destination || "").toLowerCase();
  const dir: Row["dir"] = !line ? null : line.loop ? "lap" : !dest ? null : dest.includes(line.to.toLowerCase()) ? "to" : "from";
  const atDepot = DEPOTS.some((d) => km([bus.lat, bus.lng], d) <= 0.5);
  return { bus, state, fixMs: Date.parse(bus.updatedAt), line, alongM, dir, near, atDepot };
}

// ── server's all-day figures per plate ─────────────────────────────────────
type Today = Record<string, { trips: number; km: number | null; runs: number | null; hoursMoving: number | null }>;

async function loadToday(): Promise<{ today: Today; median: Record<string, number | null>; trips: Record<string, number> } | null> {
  try {
    const [day, week] = await Promise.all([
      fetch(appPath("/api/research/day"), { cache: "no-store" }).then((r) => r.json()),
      fetch(`${appPath("/api/collect/week")}?days=1&detail=vehicles`, { cache: "no-store" }).then((r) => r.json()),
    ]);
    const today: Today = {};
    const median: Record<string, number | null> = {};
    const trips: Record<string, number> = {};
    for (const line of day?.lines ?? []) {
      trips[line.routeId] = line.trips.length;
      const mins = (line.trips as { minutes: number }[]).map((t) => t.minutes).sort((a, b) => a - b);
      median[line.routeId] = mins.length ? mins[Math.floor(mins.length / 2)]! : null;
      for (const t of line.trips as { plate: string }[]) {
        (today[t.plate] ??= { trips: 0, km: null, runs: null, hoursMoving: null }).trips += 1;
      }
    }
    for (const v of week?.days?.[0]?.vehicles ?? []) {
      const e = (today[v.licensePlate] ??= { trips: 0, km: null, runs: null, hoursMoving: null });
      e.km = v.totalDistanceKm ?? null;
      e.runs = v.runs ?? null;
      e.hoursMoving = v.hoursMoving ?? null;
    }
    return { today, median, trips };
  } catch {
    return null;
  }
}

// ── line strip ─────────────────────────────────────────────────────────────
function LineStrip({ line, rows, tripsToday, medianMin, focus, onFocus }: {
  line: Line; rows: Row[]; tripsToday: number | null; medianMin: number | null; focus: string | null; onFocus: (p: string) => void;
}) {
  const len = line.lengthM;
  const placed = rows.filter((r) => r.alongM !== null && r.state !== "quiet" && r.state !== "off").sort((a, b) => a.alongM! - b.alongM!);
  // Labels collide when buses are close: stack them in up to three rows.
  const lastInRow = [-Infinity, -Infinity, -Infinity];
  const rowOf = new Map<string, number>();
  for (const r of placed) {
    const pct = (r.alongM! / len) * 100;
    const row = lastInRow.findIndex((x) => pct - x >= 7);
    const use = row === -1 ? 2 : row;
    lastInRow[use] = pct;
    rowOf.set(r.bus.plate, use);
  }
  // Label a stop only where its text fits between its neighbours and the terminal names.
  const [track, setTrack] = useState<HTMLDivElement | null>(null);
  const [trackW, setTrackW] = useState(640);
  useEffect(() => {
    if (!track) return;
    const ro = new ResizeObserver(([e]) => setTrackW(e!.contentRect.width));
    ro.observe(track);
    return () => ro.disconnect();
  }, [track]);
  const CHAR_PX = 7.4, PAD_PX = 16, END_PX = 70;
  let right = END_PX;
  const labels = line.stops.filter((s) => {
    const x = (s.alongM / len) * trackW;
    const half = (s.name.length * CHAR_PX) / 2;
    if (x - half < right + PAD_PX || x + half > trackW - END_PX) return false;
    right = x + half;
    return true;
  });
  const toward = (d: "to" | "from") => placed.filter((r) => r.dir === d).length;
  const elsewhere = rows.length - placed.length;

  return (
    <section className="fc-strip">
      <header className="fc-strip__head">
        <h3>{line.name}</h3>
        <span>
          {placed.length} on the road{line.loop ? "" : ` · ${toward("to")} → ${line.to} · ${toward("from")} → ${line.from}`}
          {elsewhere > 0 ? ` · ${elsewhere} elsewhere` : ""}
          {tripsToday !== null && <>{" · "}{tripsToday} {line.loop ? "laps" : "trips"} completed today{medianMin !== null ? `, median ${Math.round(medianMin)} min` : ""}</>}
        </span>
      </header>
      <div className="fc-strip__scroll">
        <div className="fc-strip__track" ref={setTrack}>
          {placed.length === 0 && <span className="fc-strip__empty">No bus on this line is reporting right now.</span>}
          <span className="fc-strip__end fc-strip__end--a">{line.from}</span>
          <span className="fc-strip__end fc-strip__end--b">{line.loop ? "back to start" : line.to}</span>
          <div className="fc-strip__rail" />
          {line.stops.map((s) => <i key={s.name} className="fc-strip__stop" style={{ left: `${(s.alongM / len) * 100}%` }} />)}
          {labels.map((s) => <span key={s.name} className="fc-strip__label" style={{ left: `${(s.alongM / len) * 100}%` }}>{s.name}</span>)}
          {placed.map((r) => (
            <button key={r.bus.plate} type="button"
              className={`fc-bus fc-bus--${r.state}${focus === r.bus.plate ? " is-focus" : ""}`}
              style={{ left: `${(r.alongM! / len) * 100}%`, bottom: `${30 + (rowOf.get(r.bus.plate) ?? 0) * 26}px` }}
              onClick={() => onFocus(r.bus.plate)}
              title={`${r.bus.plate} · ${STATE_LABEL[r.state]} ${Math.round(r.bus.speedKph)} km/h · near ${r.near ?? "—"}`}>
              <span className="fc-bus__plate">{r.bus.plate.slice(3)}</span>
              <span className={`fc-bus__arrow fc-bus__arrow--${r.dir === "from" ? "left" : r.dir ? "right" : "none"}`} aria-hidden />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── map ────────────────────────────────────────────────────────────────────
const STATE_COLOR: Record<State, string> = {
  driving: "var(--ax-accent)", standing: "var(--ax-ink-2)", late: "var(--ax-warn)", quiet: "var(--ax-neg)", off: "var(--ax-ink-3)",
};

function FleetMap({ rows, focus, onFocus }: { rows: Row[]; focus: string | null; onFocus: (p: string) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { center: [7.93, 98.33], zoom: 11, minZoom: 9, maxZoom: 18, worldCopyJump: false, zoomControl: true, attributionControl: true });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap contributors", className: "v2-basemap-tile", maxZoom: 19 }).addTo(m);
    for (const line of LINES) {
      L.polyline(line.poly.map((p) => [p[0]!, p[1]!] as [number, number]), { color: "#929eaa", weight: 2, opacity: 0.5, interactive: false }).addTo(m);
    }
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => { m.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    const g = layer.current;
    if (!g) return;
    g.clearLayers();
    const css = getComputedStyle(el.current!);
    const color = (s: State) => css.getPropertyValue(STATE_COLOR[s].slice(4, -1)).trim() || "#999";
    for (const r of rows) {
      if (r.state === "off") continue; // a days-old parked position isn't news
      const on = focus === r.bus.plate;
      L.circleMarker([r.bus.lat, r.bus.lng], {
        radius: on ? 10 : 6, weight: on ? 3 : 1.5, color: color(r.state),
        fillColor: color(r.state), fillOpacity: r.state === "quiet" ? 0 : 0.9,
      })
        .bindTooltip(`${r.bus.plate} · ${STATE_LABEL[r.state]}`, { direction: "top" })
        .on("click", () => onFocus(r.bus.plate))
        .addTo(g);
    }
  }, [rows, focus, onFocus]);

  // Frame the buses that are out, once, when the first positions arrive.
  const framed = useRef(false);
  useEffect(() => {
    const out = rows.filter((r) => r.state !== "off" && r.state !== "quiet");
    if (framed.current || !map.current || out.length < 2) return;
    map.current.fitBounds(L.latLngBounds(out.map((r) => [r.bus.lat, r.bus.lng] as [number, number])), { padding: [24, 24], maxZoom: 13 });
    framed.current = true;
  }, [rows]);

  useEffect(() => {
    const r = rows.find((x) => x.bus.plate === focus);
    if (r && map.current) map.current.panTo([r.bus.lat, r.bus.lng]);
  }, [focus]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={el} className="fc-map v2-map__canvas" role="application" aria-label="Map of the fleet" />;
}

// ── page ───────────────────────────────────────────────────────────────────
export function FleetConsole() {
  const [now, setNow] = useState(() => Date.now());
  const [buses, setBuses] = useState<readonly LiveBus[]>(() => getLiveBusesRaw());
  const [feed, setFeed] = useState(() => getLiveFeedState());
  const [today, setToday] = useState<Awaited<ReturnType<typeof loadToday>>>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [filter, setFilter] = useState<State | null>(null);
  const [showOff, setShowOff] = useState(false);

  useEffect(() => {
    const stop = startLiveFeed();
    const unsub = subscribeLiveFeed(() => { setBuses(getLiveBusesRaw()); setFeed(getLiveFeedState()); });
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const pull = () => void loadToday().then((t) => t && setToday(t));
    pull();
    const slow = setInterval(pull, 120_000);
    return () => { stop(); unsub(); clearInterval(tick); clearInterval(slow); };
  }, []);

  const rows = useMemo(() => buses.map((b) => readRow(b, now)).sort((a, b) => a.bus.plate.localeCompare(b.bus.plate)), [buses, now]);
  const count = (s: State) => rows.filter((r) => r.state === s).length;
  const out = rows.filter((r) => r.state === "driving" || r.state === "standing" || r.state === "late");
  const onLines = out.filter((r) => r.line);
  const feedAge = feed.lastOkMs ? Math.round((now - feed.lastOkMs) / 1000) : null;
  const feedDead = feed.status === "offline" || feedAge === null || feedAge > 120;

  // What needs a look — each item says what happened and to which bus.
  const attention = useMemo(() => {
    const items: { tone: "neg" | "warn" | "info"; plate: string | null; text: string }[] = [];
    for (const r of rows) {
      if (r.state === "quiet" && r.bus.speedKph > MOVING_KPH) {
        items.push({ tone: "neg", plate: r.bus.plate, text: `${r.bus.plate} went silent while driving ${Math.round(r.bus.speedKph)} km/h, ${ago(r.fixMs, now)} (${bkkClock(r.fixMs)})${r.near ? ` near ${r.near}` : ""}.` });
      }
    }
    for (const line of LINES) {
      if (line.loop) continue;
      for (const d of ["to", "from"] as const) {
        const seq = rows.filter((r) => r.line === line && r.dir === d && r.alongM !== null && (r.state === "driving" || r.state === "standing"))
          .sort((a, b) => a.alongM! - b.alongM!);
        for (let i = 1; i < seq.length; i++) {
          const [a, b] = [seq[i - 1]!, seq[i]!];
          const gap = b.alongM! - a.alongM!;
          const atEnd = (x: number) => x < TERMINAL_ZONE_M || x > line.lengthM - TERMINAL_ZONE_M;
          if (gap < BUNCH_M && !atEnd(a.alongM!) && !atEnd(b.alongM!)) {
            items.push({ tone: "warn", plate: a.bus.plate, text: `${a.bus.plate} and ${b.bus.plate} are ${(gap / 1000).toFixed(1)} km apart, both heading to ${d === "to" ? line.to : line.from} — riders will wait twice as long behind them.` });
          }
        }
      }
    }
    const unnamed = rows.filter((r) => r.bus.feed === "token" && !r.line && r.state === "driving");
    if (unnamed.length) items.push({ tone: "info", plate: unnamed[0]!.bus.plate, text: `${unnamed.map((r) => r.bus.plate).join(", ")} ${unnamed.length > 1 ? "are" : "is"} driving, but the tracker names no line.` });
    const late = rows.filter((r) => r.state === "late");
    if (late.length) items.push({ tone: "info", plate: late[0]!.bus.plate, text: `${late.map((r) => r.bus.plate).join(", ")}: last position 3–15 min old.` });
    return items;
  }, [rows, now]);

  const visible = filter ? rows.filter((r) => r.state === filter) : rows.filter((r) => r.state !== "off" || showOff);
  const groups: { title: string; rows: Row[] }[] = [
    { title: "On the PKSB lines", rows: visible.filter((r) => r.line && r.state !== "quiet" && r.state !== "off") },
    { title: "Town service", rows: visible.filter((r) => !r.line && r.bus.feed === "keyless" && r.state !== "quiet" && r.state !== "off") },
    { title: "No line named", rows: visible.filter((r) => !r.line && r.bus.feed !== "keyless" && r.state !== "quiet" && r.state !== "off") },
    { title: "No signal", rows: visible.filter((r) => r.state === "quiet") },
    { title: "Not seen today", rows: visible.filter((r) => r.state === "off") },
  ].filter((g) => g.rows.length);
  const focused = rows.find((r) => r.bus.plate === focus) ?? null;

  return (
    <div className="v2 v2--operations fc">
      <header className="fc-head">
        <div>
          <span className="fc-eyebrow">Phuket Smart Bus · fleet now</span>
          <h1 className="fc-title">
            {out.length} of {rows.length} buses are out — {count("driving")} driving, {onLines.length} on the PKSB lines.
          </h1>
          <p className={`fc-feed${feedDead ? " is-dead" : ""}`}>
            {feedDead ? "The tracker feed is not answering — positions below may be old. " : `Positions updated ${feedAge} s ago · `}
            {bkkClock(now)} Bangkok · both official trackers (smartbus.phuket.cloud)
          </p>
        </div>
        <nav className="fc-nav">
          <a href={appPath("/ops")}>Ops wall</a>
          <a href={appPath("/research")}>Trips</a>
          <a href={appPath("/study")}>Study</a>
          <a href={appPath("/fleet/raw")}>Every field</a>
        </nav>
      </header>

      <section className="fc-states" aria-label="Filter by state">
        {(["driving", "standing", "late", "quiet", "off"] as State[]).map((s) => (
          <button key={s} type="button" className={`fc-state fc-state--${s}${filter === s ? " is-active" : ""}`} onClick={() => setFilter(filter === s ? null : s)} aria-pressed={filter === s}>
            <strong>{count(s)}</strong>
            <span>{STATE_LABEL[s]}</span>
            <small>{STATE_HINT[s]}</small>
          </button>
        ))}
      </section>

      <section className="fc-strips" aria-label="Lines">
        {LINES.map((line) => (
          <LineStrip key={line.routeId} line={line} rows={rows.filter((r) => r.line === line)}
            tripsToday={today?.trips[line.routeId] ?? null}
            medianMin={today?.median[line.routeId] ?? null} focus={focus} onFocus={setFocus} />
        ))}
        <p className="fc-note">Each line is drawn straight, terminal to terminal; ticks are stops. Arrows show which way each bus is heading, from the destination the tracker reports. Town buses run no PKSB line and appear on the map only.</p>
      </section>

      <div className="fc-pair">
        <FleetMap rows={rows} focus={focus} onFocus={setFocus} />
        <section className="fc-attn" aria-label="Needs a look">
          <h2>Needs a look</h2>
          {attention.length === 0
            ? <p className="fc-calm">Nothing unusual: every bus out is reporting, none bunched.</p>
            : <ul>{attention.map((a, i) => (
              <li key={i} className={`fc-attn__item is-${a.tone}`}>
                {a.plate ? <button type="button" onClick={() => setFocus(a.plate)}>{a.text}</button> : a.text}
              </li>
            ))}</ul>}
          {focused && <BusDetail row={focused} now={now} today={today?.today[focused.bus.plate] ?? null} onClose={() => setFocus(null)} />}
        </section>
      </div>

      {groups.map((g) => (
        <section key={g.title} className="fc-group">
          <h2>{g.title} <span>{g.rows.length}</span></h2>
          <div className="fc-cards">
            {g.rows.map((r) => <BusCard key={r.bus.plate} row={r} now={now} today={today?.today[r.bus.plate] ?? null} focus={focus === r.bus.plate} onFocus={setFocus} />)}
          </div>
        </section>
      ))}
      {!filter && !showOff && count("off") > 0 && (
        <button type="button" className="fc-more" onClick={() => setShowOff(true)}>Show {count("off")} buses not seen today</button>
      )}
      <p className="fc-note">Trips, km and runs are the server's all-day record (since 03:00 Bangkok), not this page's tally. Passenger counters read 0 on every bus, so nothing here says how full a bus is.</p>
    </div>
  );
}

function headingText(r: Row): string {
  if (!r.line) return r.bus.feed === "keyless" ? "Town service" : "No line named";
  if (r.dir === "lap") return SHORT[r.line.routeId] ?? r.line.name;
  return `${SHORT[r.line.routeId] ?? r.line.name}${r.bus.destination ? ` · to ${r.bus.destination}` : ""}`;
}

function BusCard({ row: r, now, today, focus, onFocus }: { row: Row; now: number; today: Today[string] | null; focus: boolean; onFocus: (p: string) => void }) {
  return (
    <button type="button" className={`fc-card fc-card--${r.state}${focus ? " is-focus" : ""}`} onClick={() => onFocus(r.bus.plate)}>
      <span className="fc-card__top"><strong>{r.bus.plate}</strong><em>{STATE_LABEL[r.state]}{r.state === "driving" ? ` ${Math.round(r.bus.speedKph)} km/h` : ""}</em></span>
      <span className="fc-card__line">{headingText(r)}</span>
      <span className="fc-card__where">{r.atDepot ? "At the depot" : r.near ? `Near ${r.near}` : " "}</span>
      <span className="fc-card__meta">
        {today ? [today.trips ? `${today.trips} trips` : null, today.km !== null ? `${Math.round(today.km)} km` : null].filter(Boolean).join(" · ") || "no trips yet" : "—"}
        {" · "}seen {ago(r.fixMs, now)}
      </span>
    </button>
  );
}

function BusDetail({ row: r, now, today, onClose }: { row: Row; now: number; today: Today[string] | null; onClose: () => void }) {
  const b = r.bus;
  const facts: [string, string][] = [
    ["State", `${STATE_LABEL[r.state]} — ${STATE_HINT[r.state]}`],
    ["Service", headingText(r)],
    ["Where", r.atDepot ? "At the depot" : r.near ? `Near ${r.near}` : `${b.lat.toFixed(5)}, ${b.lng.toFixed(5)}`],
    ["Speed", `${Math.round(b.speedKph)} km/h, heading ${Math.round(b.heading)}°`],
    ["Last fix", `${bkkClock(r.fixMs)} Bangkok (${ago(r.fixMs, now)})`],
    ["Today", today ? `${today.trips} trips · ${today.km !== null ? `${Math.round(today.km)} km` : "km —"}${today.hoursMoving !== null ? ` · ${today.hoursMoving} h moving` : ""}` : "—"],
    ["Odometer", b.odometerM ? `${Math.round(b.odometerM / 1000).toLocaleString()} km` : "not sent"],
    ["Tracker", `${b.feed === "token" ? "Line-fleet feed" : "Town-fleet feed"}${b.online === false ? " · device says offline" : ""}`],
  ];
  return (
    <div className="fc-detail">
      <header><h3>{b.plate}</h3><button type="button" onClick={onClose} aria-label="Close">Close</button></header>
      <dl>{facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      <details><summary>Raw tracker row</summary><pre>{JSON.stringify(b, null, 2)}</pre></details>
    </div>
  );
}
