/**
 * /fleet/raw — every bus, every detail, in plain words.
 *
 * For the person who needs to look one bus up: grouped by what the bus is
 * doing (on the road / lost signal today / not out today), one readable row
 * each. Open a row for every field the trackers send, labelled in words, with
 * the raw tracker row underneath. Search, filters, ordering and CSV / JSON
 * download are all here.
 *
 * Same words as /fleet: both read fleetRows.ts. "Today" figures are the
 * server's all-day record, never this tab's own tally.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { LiveBus } from "@shared/pksbFeed";
import { getLiveBusesRaw, getLiveFeedState, startLiveFeed, subscribeLiveFeed } from "../../engine/liveOps";
import { appPath } from "../../lib/paths";
import { ago, bkkClock, isOut, loadToday, readRow, service, STATE_WORD, type Row, type Today } from "./fleetRows";
import "./fleetDetail.css";

type Show = "all" | "road" | "quiet" | "off";
type ServiceFilter = "all" | "rawai-airport" | "patong-old-bus-station" | "dragon-line" | "town" | "none";
type Order = "bus" | "signal" | "km";

const SHOW_LABEL: Record<Show, string> = { all: "All", road: "On the road", quiet: "Lost signal", off: "Not out" };
const SERVICE_LABEL: Record<ServiceFilter, string> = {
  all: "Every service", "rawai-airport": "Airport ↔ Rawai", "patong-old-bus-station": "Old Town ↔ Patong",
  "dragon-line": "Dragon loop", town: "Town routes", none: "No line given",
};
const COMPASS = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];
const compass = (deg: number) => (Number.isFinite(deg) ? COMPASS[Math.round((((deg % 360) + 360) % 360) / 45) % 8]! : "—");
const bkkDateTime = (ms: number) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(ms));

function serviceKey(r: Row): ServiceFilter {
  if (r.line) return r.line.routeId as ServiceFilter;
  return r.bus.feed === "keyless" ? "town" : "none";
}
function doing(r: Row): string {
  if (r.state === "driving") return `Driving ${Math.round(r.bus.speedKph)} km/h, heading ${compass(r.bus.heading)}`;
  return STATE_WORD[r.state];
}
function lastSignal(r: Row, now: number): string {
  if (r.state === "off") return `Last seen ${bkkDateTime(r.fixMs)}`;
  if (r.state === "quiet") return `${bkkClock(r.fixMs)} (${ago(r.fixMs, now)})`;
  return ago(r.fixMs, now);
}
const where = (r: Row) => (r.atDepot ? "At the depot" : r.near ? `Near ${r.near}` : "—");
const todayText = (t: Today["perBus"][string] | undefined) =>
  t ? [t.trips ? `${t.trips} ${t.trips === 1 ? "trip" : "trips"}` : null, t.km !== null ? `${Math.round(t.km)} km` : null].filter(Boolean).join(" · ") || "—" : "—";

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function download(filename: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function FleetDetail() {
  const [now, setNow] = useState(() => Date.now());
  const [buses, setBuses] = useState<readonly LiveBus[]>(() => getLiveBusesRaw());
  const [feed, setFeed] = useState(() => getLiveFeedState());
  const [today, setToday] = useState<Today | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [show, setShow] = useState<Show>("all");
  const [svc, setSvc] = useState<ServiceFilter>("all");
  const [order, setOrder] = useState<Order>("bus");

  useEffect(() => {
    const stop = startLiveFeed();
    const unsub = subscribeLiveFeed(() => { setBuses(getLiveBusesRaw()); setFeed(getLiveFeedState()); });
    const tick = setInterval(() => setNow(Date.now()), 5_000);
    const pull = () => void loadToday().then((t) => t && setToday(t));
    pull();
    const slow = setInterval(pull, 120_000);
    return () => { stop(); unsub(); clearInterval(tick); clearInterval(slow); };
  }, []);

  const rows = useMemo(() => buses.map((b) => readRow(b, now)), [buses, now]);
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const kmOf = (r: Row) => today?.perBus[r.bus.plate]?.km ?? -1;
    return rows
      .filter((r) => !needle || r.bus.plate.toLowerCase().includes(needle))
      .filter((r) => svc === "all" || serviceKey(r) === svc)
      .sort((a, b) => order === "signal" ? b.fixMs - a.fixMs : order === "km" ? kmOf(b) - kmOf(a) : a.bus.plate.localeCompare(b.bus.plate));
  }, [rows, search, svc, order, today]);

  const groups: { key: Show; title: string; note: string; rows: Row[] }[] = [
    { key: "road", title: "On the road", note: "a position in the last 15 minutes", rows: visible.filter(isOut) },
    { key: "quiet", title: "Lost signal today", note: "reported earlier today, silent for 15 minutes or more", rows: visible.filter((r) => r.state === "quiet") },
    { key: "off", title: "Not out today", note: "no position in the last 12 hours", rows: visible.filter((r) => r.state === "off") },
  ].filter((g) => (show === "all" || show === g.key) && g.rows.length > 0) as { key: Show; title: string; note: string; rows: Row[] }[];

  const count = (k: Show) => rows.filter((r) => (k === "road" ? isOut(r) : k === "quiet" ? r.state === "quiet" : r.state === "off")).length;
  const feedAge = feed.lastOkMs ? Math.round((now - feed.lastOkMs) / 1000) : null;
  const stamp = new Date(now + 7 * 3_600_000).toISOString().slice(0, 16).replace("T", "_").replace(":", "");

  function exportRows() {
    return visible.map((r) => ({
      plate: r.bus.plate, doing: doing(r), state: r.state, service: service(r), where: where(r),
      last_fix_bkk: bkkDateTime(r.fixMs), last_fix_utc: r.bus.updatedAt,
      lat: r.bus.lat, lng: r.bus.lng, speed_kph: r.bus.speedKph, heading_deg: r.bus.heading,
      tracker: r.bus.feed ?? "", device_online: r.bus.online ?? "", line_named: r.bus.routeId ?? "", destination: r.bus.destination || "",
      odometer_km: r.bus.odometerM ? Math.round(r.bus.odometerM / 100) / 10 : "",
      counter_on_board: r.bus.paxOnBoard ?? "", counter_up: r.bus.paxUp ?? "", counter_down: r.bus.paxDown ?? "",
      trips_today: today?.perBus[r.bus.plate]?.trips ?? "", km_today: today?.perBus[r.bus.plate]?.km ?? "",
    }));
  }
  function exportCSV() {
    const data = exportRows();
    const cols = Object.keys(data[0] ?? { plate: "" });
    download(`PBUS_${stamp}_DATA_fleet-snapshot.csv`, [cols.join(","), ...data.map((d) => cols.map((c) => csvCell((d as Record<string, unknown>)[c])).join(","))].join("\n"), "text/csv");
  }
  function exportJSON() {
    download(`PBUS_${stamp}_DATA_fleet-snapshot.json`, JSON.stringify({ exportedAt: new Date().toISOString(), sources: feed.sources, buses: exportRows(), raw: visible.map((r) => r.bus) }, null, 2), "application/json");
  }

  return (
    <div className="v2 v2--operations fd">
      <div className="fd-page">
        <header className="fd-head">
          <div>
            <p className="fd-eyebrow">Phuket Smart Bus · every bus</p>
            <h1 className="fd-title">Every bus, every detail</h1>
            <p className="fd-sub">
              {rows.length} buses on the two official trackers: {count("road")} on the road, {count("quiet")} lost signal today, {count("off")} not out.
              {" "}Positions update about once a minute{feedAge !== null ? ` — last update ${feedAge < 5 ? "just now" : `${feedAge} s ago`}` : ""}. Open any bus for everything its tracker says.
            </p>
          </div>
          <nav className="fd-nav" aria-label="Other views">
            <a href={appPath("/fleet")}>Fleet now</a>
            <a href={appPath("/research")}>Trips</a>
            <a href={appPath("/study")}>Study</a>
            <a href={appPath("/ops")}>Ops wall</a>
          </nav>
        </header>

        <div className="fd-controls">
          <input className="fd-search" type="search" placeholder="Find a bus, e.g. 1149" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Find a bus by plate" />
          <div className="fd-chips" role="group" aria-label="Show">
            {(["all", "road", "quiet", "off"] as Show[]).map((k) => (
              <button key={k} type="button" className={show === k ? "is-active" : undefined} aria-pressed={show === k} onClick={() => setShow(k)}>
                {SHOW_LABEL[k]}{k !== "all" ? ` · ${count(k)}` : ""}
              </button>
            ))}
          </div>
          <label className="fd-select"><span>Service</span>
            <select value={svc} onChange={(e) => setSvc(e.target.value as ServiceFilter)}>
              {(Object.keys(SERVICE_LABEL) as ServiceFilter[]).map((k) => <option key={k} value={k}>{SERVICE_LABEL[k]}</option>)}
            </select>
          </label>
          <label className="fd-select"><span>Order by</span>
            <select value={order} onChange={(e) => setOrder(e.target.value as Order)}>
              <option value="bus">Bus number</option>
              <option value="signal">Latest signal first</option>
              <option value="km">Most km today</option>
            </select>
          </label>
          <div className="fd-downloads">
            <button type="button" onClick={exportCSV}>Download CSV</button>
            <button type="button" onClick={exportJSON}>Download JSON</button>
          </div>
        </div>

        {groups.length === 0 && <p className="fd-empty">{rows.length === 0 ? "Waiting for the trackers…" : "No bus matches."}</p>}

        {groups.map((g) => (
          <section key={g.key} className="fd-group">
            <h2>{g.title} <span>{g.rows.length} · {g.note}</span></h2>
            <div className="fd-scroll">
              <table className="fd-table">
                <thead>
                  <tr><th>Bus</th><th>Doing</th><th>Service</th><th>Where</th><th>Last signal</th><th>Today</th></tr>
                </thead>
                <tbody>
                  {g.rows.map((r) => {
                    const isOpen = open === r.bus.plate;
                    return [
                      <tr key={r.bus.plate} className={`fd-row fd-row--${r.state}${isOpen ? " is-open" : ""}`}>
                        <td>
                          <button type="button" className="fd-plate" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : r.bus.plate)}>
                            <span className="fd-caret" aria-hidden>{isOpen ? "−" : "+"}</span>{r.bus.plate}
                          </button>
                        </td>
                        <td className="fd-doing">{doing(r)}</td>
                        <td>{service(r)}</td>
                        <td>{where(r)}</td>
                        <td>{lastSignal(r, now)}</td>
                        <td>{todayText(today?.perBus[r.bus.plate])}</td>
                      </tr>,
                      isOpen && (
                        <tr key={`${r.bus.plate}-detail`} className="fd-detail-row">
                          <td colSpan={6}><BusFacts row={r} today={today?.perBus[r.bus.plate]} /></td>
                        </tr>
                      ),
                    ];
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))}

        <p className="fd-foot">
          Sources: the two trackers behind the official map (smartbus.phuket.cloud) — the line-fleet tracker for Airport, Patong and Dragon buses, the
          town-fleet tracker for town routes. "Today" is our collector's record since 03:00 Bangkok. Passenger counters read zero on every bus, so they are shown as sent and never used as rider counts.
        </p>
      </div>
    </div>
  );
}

function BusFacts({ row: r, today }: { row: Row; today: Today["perBus"][string] | undefined }) {
  const b = r.bus;
  const counter = [b.paxOnBoard, b.paxUp, b.paxDown];
  const facts: [string, ReactNode][] = [
    ["Position", <><a href={`https://www.openstreetmap.org/?mlat=${b.lat}&mlon=${b.lng}#map=17/${b.lat}/${b.lng}`} target="_blank" rel="noreferrer">{b.lat.toFixed(5)}, {b.lng.toFixed(5)}</a>{r.near ? ` — near ${r.near}` : ""}{r.atDepot ? " — at the depot" : ""}</>],
    ["Speed", `${Math.round(b.speedKph * 10) / 10} km/h, facing ${compass(b.heading)} (${Math.round(b.heading)}°)`],
    ["Last GPS fix", `${bkkDateTime(Date.parse(b.updatedAt))} Bangkok`],
    ["Service", `${service(r)}${b.routeId ? "" : b.feed === "keyless" ? " (this tracker never names a line)" : " (tracker names no line right now)"}`],
    ["Tracker", b.feed === "token" ? "Line-fleet tracker (Airport, Patong, Dragon buses)" : "Town-fleet tracker (town routes)"],
    ["Device link", b.online === true ? "Online" : b.online === false ? "Offline — the device reports it is not connected" : "Not reported"],
    ["Odometer", b.odometerM ? `${(b.odometerM / 1000).toLocaleString("en-GB", { maximumFractionDigits: 1 })} km` : "Not sent by this tracker"],
    ["Passenger counter", counter.every((c) => c == null) ? "Not sent" : `On board ${b.paxOnBoard ?? "—"}, boarded ${b.paxUp ?? "—"}, alighted ${b.paxDown ?? "—"}${counter.every((c) => !c) ? " — reads zero, so treated as no counter" : ""}`],
    // Town routes have no terminals in our geometry, so "trips" only means something on a PKSB line.
    ["Today", today ? [r.line ? `${today.trips} ${today.trips === 1 ? "trip" : "trips"} completed` : null, today.km !== null ? `${Math.round(today.km)} km driven` : null].filter(Boolean).join(" · ") || "Nothing recorded yet" : "No record yet today"],
  ];
  return (
    <div className="fd-facts">
      <dl>{facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      <details><summary>Raw tracker row</summary><pre>{JSON.stringify(b, null, 2)}</pre></details>
    </div>
  );
}
