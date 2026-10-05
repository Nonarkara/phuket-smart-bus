/**
 * /fleet — the real buses, right now, for a person.
 *
 * Reads like a station board, not a database:
 *   - one sentence: how many buses are out, and how fresh that is
 *   - the map: every bus where it is, arrows pointing the way it drives
 *   - per PKSB line, in words: how many buses, which way, about how often
 *     one comes, how long a trip takes against the timetable — with a small
 *     line diagram
 *   - the town fleet in one sentence
 *   - "needs a look" only when something is wrong
 *   - every bus in a plain folded table; every tracker field at /fleet/raw
 *
 * Text and spacing are in em off one root size that grows with the screen,
 * so a 4K wall reads like a laptop and a phone stays a phone.
 *
 * Sources: live relay (~1 fix/min per bus) for positions; the server's
 * all-day record (/api/research/day, /api/collect/week) for trips and km.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import type { LiveBus } from "@shared/pksbFeed";
import { getLiveBusesRaw, getLiveFeedState, startLiveFeed, subscribeLiveFeed } from "../../engine/liveOps";
import { appPath } from "../../lib/paths";
import {
  ago, BUNCH_M, bkkClock, duration, isOut, LINES, loadToday, MOVING_KPH, readRow, service, STATE_WORD, TERMINAL_ZONE_M, TIMETABLE_MIN,
  type Line, type Row, type State, type Today,
} from "./fleetRows";
import "./fleetConsole.css";

/** "3 heading to Rawai, about every 40 min." / "None heading to Patong." */
function heading(n: number, to: string, every: string | null): string {
  return n === 0 ? `None heading to ${to}.` : `${n} heading to ${to}${every ? `, ${every}` : ""}.`;
}

// ── one PKSB line, in words + a small diagram ──────────────────────────────
function LineBlock({ line, rows, today, focus, onFocus }: {
  line: Line; rows: Row[]; today: Today["line"][string] | undefined; focus: string | null; onFocus: (p: string) => void;
}) {
  const running = rows.filter(isOut);
  const placed = running.filter((r) => r.alongM !== null);
  const toward = (d: "to" | "from") => running.filter((r) => r.dir === d).length;
  const median = today?.medianMin ?? null;
  // A bus every (trip time ÷ buses heading that way) — the spacing a rider waiting by the road would see.
  const every = (n: number) => (median && n > 0 ? `about every ${Math.max(5, Math.round(median / n / 5) * 5)} min` : null);
  const timetable = TIMETABLE_MIN[line.routeId];

  return (
    <section className="fc-line">
      <header className="fc-line__head">
        <h3>{line.name}</h3>
        <strong>{running.length} {running.length === 1 ? "bus" : "buses"}</strong>
      </header>

      <div className="fc-line__diagram">
        <span className="fc-line__end">{line.from}</span>
        <div className="fc-line__track">
          <i className="fc-line__rail" />
          {placed.map((r) => (
            <button key={r.bus.plate} type="button"
              className={`fc-line__bus fc-line__bus--${r.state}${focus === r.bus.plate ? " is-focus" : ""}`}
              style={{ left: `${(r.alongM! / line.lengthM) * 100}%` }}
              onClick={() => onFocus(r.bus.plate)}
              title={`${r.bus.plate} · ${STATE_WORD[r.state]}${r.near ? ` · near ${r.near}` : ""}`}
              aria-label={`${r.bus.plate}, ${STATE_WORD[r.state]}${r.near ? `, near ${r.near}` : ""}`}>
              <span className={`fc-arrow fc-arrow--${r.dir === "from" ? "left" : r.dir ? "right" : "dot"}`} />
            </button>
          ))}
        </div>
        <span className="fc-line__end">{line.loop ? "round" : line.to}</span>
      </div>

      <p className="fc-line__say">
        {running.length === 0
          ? "No bus on this line is reporting right now."
          : line.loop
            ? `Buses circle Old Town${every(running.length) ? `, ${every(running.length)}` : ""}.`
            : <>
                {heading(toward("to"), line.to, every(toward("to")))}{" "}
                {heading(toward("from"), line.from, every(toward("from")))}
              </>}
      </p>
      {today && (
        <p className="fc-line__say fc-line__say--quiet">
          {today.trips} {line.loop ? "laps" : "trips"} finished today
          {median !== null ? ` · ${line.loop ? "a lap" : "a trip"} takes about ${duration(median)}` : ""}
          {median !== null && timetable ? ` (timetable: ${duration(timetable)})` : ""}.
        </p>
      )}
    </section>
  );
}

// ── map ────────────────────────────────────────────────────────────────────
function busIcon(r: Row, focus: boolean): L.DivIcon {
  const cls = `fc-mapbus fc-mapbus--${r.state}${focus ? " is-focus" : ""}`;
  const html = r.state === "driving"
    ? `<span class="fc-mapbus__arrow" style="transform: rotate(${Math.round(r.bus.heading)}deg)"></span>`
    : `<span class="fc-mapbus__dot"></span>`;
  const label = focus ? `<span class="fc-mapbus__label">${r.bus.plate}</span>` : "";
  return L.divIcon({ className: cls, html: html + label, iconSize: [0, 0], iconAnchor: [0, 0] }); // sized in em by CSS, centred there
}

function FleetMap({ rows, focus, onFocus }: { rows: Row[]; focus: string | null; onFocus: (p: string) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const framed = useRef(false);

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { center: [7.93, 98.33], zoom: 11, minZoom: 9, maxZoom: 18, worldCopyJump: false, attributionControl: true });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap contributors", maxZoom: 19 }).addTo(m);
    for (const line of LINES) {
      L.polyline(line.poly.map((p) => [p[0]!, p[1]!] as [number, number]), { className: "fc-route", weight: 3, interactive: false }).addTo(m);
      const [a, b] = [line.poly[0]!, line.poly[line.poly.length - 1]!];
      const ends = line.loop ? [{ at: a, name: "Dragon loop" }] : [{ at: a, name: line.from }, { at: b, name: line.to }];
      for (const e of ends) {
        L.marker([e.at[0]!, e.at[1]!], { interactive: false, icon: L.divIcon({ className: "fc-terminal", html: `<span>${e.name}</span>`, iconSize: [0, 0] }) }).addTo(m);
      }
    }
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    // Leaflet measures its box once; the layout settles after. Re-measure on every resize
    // or the tiles only fill the first size (the black half-map).
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(el.current);
    return () => { ro.disconnect(); m.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    const g = layer.current;
    if (!g) return;
    g.clearLayers();
    const shown = rows.filter((r) => r.state !== "off"); // a days-old parked position isn't news
    for (const r of shown) {
      L.marker([r.bus.lat, r.bus.lng], { icon: busIcon(r, focus === r.bus.plate), keyboard: false, zIndexOffset: focus === r.bus.plate ? 1000 : 0 })
        .bindTooltip(`${r.bus.plate} · ${STATE_WORD[r.state]}${r.near ? ` · near ${r.near}` : ""}`, { direction: "top", offset: [0, -10] })
        .on("click", () => onFocus(r.bus.plate))
        .addTo(g);
    }
    const out = shown.filter(isOut);
    if (!framed.current && map.current && out.length >= 2) {
      map.current.fitBounds(L.latLngBounds(out.map((r) => [r.bus.lat, r.bus.lng] as [number, number])), { padding: [30, 30], maxZoom: 13 });
      framed.current = true;
    }
  }, [rows, focus, onFocus]);

  useEffect(() => {
    const r = rows.find((x) => x.bus.plate === focus);
    if (r && map.current) map.current.setView([r.bus.lat, r.bus.lng], Math.max(map.current.getZoom(), 14));
  }, [focus]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fc-mapwrap">
      <div ref={el} className="fc-map" role="application" aria-label="Map of the fleet" />
      <div className="fc-legend" aria-hidden>
        <span><i className="fc-legend__arrow" /> driving</span>
        <span><i className="fc-legend__dot" /> standing</span>
        <span><i className="fc-legend__dot fc-legend__dot--late" /> late signal</span>
        <span><i className="fc-legend__dot fc-legend__dot--quiet" /> no signal</span>
      </div>
    </div>
  );
}

// ── page ───────────────────────────────────────────────────────────────────
export function FleetConsole() {
  const [now, setNow] = useState(() => Date.now());
  const [buses, setBuses] = useState<readonly LiveBus[]>(() => getLiveBusesRaw());
  const [feed, setFeed] = useState(() => getLiveFeedState());
  const [today, setToday] = useState<Today | null>(null);
  const [focus, setFocus] = useState<string | null>(null);

  useEffect(() => {
    const stop = startLiveFeed();
    const unsub = subscribeLiveFeed(() => { setBuses(getLiveBusesRaw()); setFeed(getLiveFeedState()); });
    const tick = setInterval(() => setNow(Date.now()), 5_000);
    const pull = () => void loadToday().then((t) => t && setToday(t));
    pull();
    const slow = setInterval(pull, 120_000);
    return () => { stop(); unsub(); clearInterval(tick); clearInterval(slow); };
  }, []);

  const rows = useMemo(() => buses.map((b) => readRow(b, now)).sort((a, b) => a.bus.plate.localeCompare(b.bus.plate)), [buses, now]);
  const count = (s: State) => rows.filter((r) => r.state === s).length;
  const out = rows.filter(isOut);
  const townOut = rows.filter((r) => r.bus.feed === "keyless" && isOut(r));
  const feedAge = feed.lastOkMs ? Math.round((now - feed.lastOkMs) / 1000) : null;
  const feedDead = rows.length > 0 && (feed.status === "offline" || feedAge === null || feedAge > 120);

  const attention = useMemo(() => {
    const items: { tone: "neg" | "warn"; plate: string; text: string }[] = [];
    for (const r of rows) {
      if (r.state === "quiet" && r.bus.speedKph > MOVING_KPH) {
        items.push({ tone: "neg", plate: r.bus.plate, text: `${r.bus.plate} stopped reporting while driving, at ${bkkClock(r.fixMs)}${r.near ? ` near ${r.near}` : ""}.` });
      }
    }
    for (const line of LINES) {
      if (line.loop) continue;
      for (const d of ["to", "from"] as const) {
        const seq = rows.filter((r) => r.line === line && r.dir === d && r.alongM !== null && (r.state === "driving" || r.state === "standing"))
          .sort((a, b) => a.alongM! - b.alongM!);
        for (let i = 1; i < seq.length; i++) {
          const [a, b] = [seq[i - 1]!, seq[i]!];
          const atEnd = (x: number) => x < TERMINAL_ZONE_M || x > line.lengthM - TERMINAL_ZONE_M;
          if (b.alongM! - a.alongM! < BUNCH_M && !atEnd(a.alongM!) && !atEnd(b.alongM!)) {
            items.push({ tone: "warn", plate: a.bus.plate, text: `${a.bus.plate} and ${b.bus.plate} are running together toward ${d === "to" ? line.to : line.from}${a.near ? ` near ${a.near}` : ""} — the next rider waits twice as long.` });
          }
        }
      }
    }
    return items;
  }, [rows]);

  const focused = rows.find((r) => r.bus.plate === focus) ?? null;

  return (
    <div className="v2 v2--operations fc">
      <div className="fc-page">
        <header className="fc-head">
          <div>
            <p className="fc-eyebrow">Phuket Smart Bus · live fleet</p>
            <h1 className="fc-title">{rows.length === 0 ? "Waiting for the trackers…" : `${out.length} of ${rows.length} buses are on the road.`}</h1>
            <p className={`fc-sub${feedDead ? " is-dead" : ""}`}>
              {feedDead
                ? "The trackers are not answering — what you see may be old."
                : `${count("driving")} driving, ${count("standing")} standing${count("late") ? `, ${count("late")} with a late signal` : ""}. ${count("quiet")} lost signal earlier today, ${count("off")} not out. Updated ${feedAge === null ? "—" : feedAge < 5 ? "just now" : `${feedAge} s ago`}, ${bkkClock(now)} in Phuket.`}
            </p>
          </div>
          <nav className="fc-nav" aria-label="Other views">
            <a href={appPath("/ops")}>Ops wall</a>
            <a href={appPath("/research")}>Trips</a>
            <a href={appPath("/study")}>Study</a>
            <a href={appPath("/fleet/raw")}>Every field</a>
          </nav>
        </header>

        <div className="fc-main">
          <FleetMap rows={rows} focus={focus} onFocus={setFocus} />

          <aside className="fc-board" aria-label="Lines">
            {focused && <BusDetail row={focused} now={now} today={today?.perBus[focused.bus.plate] ?? null} onClose={() => setFocus(null)} />}

            {attention.length > 0 && (
              <section className="fc-attn" aria-label="Needs a look">
                <h2>Needs a look</h2>
                <ul>{attention.map((a, i) => (
                  <li key={i} className={`is-${a.tone}`}><button type="button" onClick={() => setFocus(a.plate)}>{a.text}</button></li>
                ))}</ul>
              </section>
            )}

            {LINES.map((line) => (
              <LineBlock key={line.routeId} line={line} rows={rows.filter((r) => r.line === line)} today={today?.line[line.routeId]} focus={focus} onFocus={setFocus} />
            ))}

            <section className="fc-line">
              <header className="fc-line__head"><h3>Town buses</h3><strong>{townOut.length} {townOut.length === 1 ? "bus" : "buses"}</strong></header>
              <p className="fc-line__say">
                {townOut.filter((r) => r.state === "driving").length} driving, {townOut.filter((r) => r.state !== "driving").length} standing.
                {" "}These run Phuket Town routes that aren't PKSB lines, so they show on the map only.
              </p>
            </section>
          </aside>
        </div>

        <details className="fc-all">
          <summary>All {rows.length} buses</summary>
          <table>
            <thead><tr><th>Bus</th><th>Now</th><th>Service</th><th>Where</th><th>Last signal</th><th>Today</th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const t = today?.perBus[r.bus.plate];
                return (
                  <tr key={r.bus.plate} className={focus === r.bus.plate ? "is-focus" : undefined}>
                    <td><button type="button" onClick={() => setFocus(r.bus.plate)}>{r.bus.plate}</button></td>
                    <td className={`fc-state-word fc-state-word--${r.state}`}>{STATE_WORD[r.state]}</td>
                    <td>{service(r)}</td>
                    <td>{r.atDepot ? "At the depot" : r.near ? `Near ${r.near}` : "—"}</td>
                    <td>{ago(r.fixMs, now)}</td>
                    <td>{t ? [t.trips ? `${t.trips} trips` : null, t.km !== null ? `${Math.round(t.km)} km` : null].filter(Boolean).join(", ") || "—" : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </details>

        <p className="fc-foot">
          Positions: both official trackers behind smartbus.phuket.cloud, about one fix a minute per bus. Trips and km: our collector's record since 03:00.
          Passenger counters read zero on every bus, so nothing here says how full a bus is.
        </p>
      </div>
    </div>
  );
}


function BusDetail({ row: r, now, today, onClose }: { row: Row; now: number; today: Today["perBus"][string] | null; onClose: () => void }) {
  const b = r.bus;
  return (
    <section className="fc-detail" aria-label={`Bus ${b.plate}`}>
      <header>
        <h2>{b.plate}</h2>
        <button type="button" onClick={onClose}>Close</button>
      </header>
      <p className="fc-line__say">
        <strong>{STATE_WORD[r.state]}{r.state === "driving" ? ` at ${Math.round(b.speedKph)} km/h` : ""}</strong>
        {" · "}{service(r)}{" · "}{r.atDepot ? "at the depot" : r.near ? `near ${r.near}` : `${b.lat.toFixed(4)}, ${b.lng.toFixed(4)}`}.
      </p>
      <p className="fc-line__say fc-line__say--quiet">
        Last signal {bkkClock(r.fixMs)} ({ago(r.fixMs, now)}).
        {today ? ` Today: ${today.trips} trips${today.km !== null ? `, ${Math.round(today.km)} km` : ""}.` : ""}
        {b.odometerM ? ` Odometer ${Math.round(b.odometerM / 1000).toLocaleString()} km.` : ""}
      </p>
      <details><summary>Raw tracker row</summary><pre>{JSON.stringify(b, null, 2)}</pre></details>
    </section>
  );
}
