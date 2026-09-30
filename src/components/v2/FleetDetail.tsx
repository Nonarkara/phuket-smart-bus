/**
 * Fleet Detail — every data point the live tracker has on every real bus.
 *
 * The Ops Wall shows one row per bus in the fleet table. This screen shows
 * the SAME buses in a dense table with every field the keyless feed sent —
 * plate, routeId, destination, lat/lng, heading, speed, pax counter (cur/up/
 * down), online flag, odometer, device update time — plus the day ledger's
 * votes, trip count, km, boardings, APC flag and per-plate trip history.
 *
 * Designed for operators who want to debug "why is bus 10-1227 not on the
 * wall?" — the votes column explains "still identifying", the updatedAt
 * explains "offline since 11:08", the pax counter explains "modelled 18,
 * no counter fitted".
 *
 * Sort any column by clicking the header. Filter by plate, line and status.
 * Expand any row to see the raw LiveBus JSON + ledger entry + trip log.
 * Export the whole snapshot as JSON or a flat CSV.
 */
import { Fragment, useEffect, useMemo, useState } from "react";
import type { LiveBus, LiveBusRouteId } from "@shared/pksbFeed";
import {
  getLiveBusesRaw,
  getLiveFeedState,
  getLiveLedgerSnapshot,
  startLiveFeed,
  subscribeLiveFeed,
  type LiveLedger,
  type LiveTrip,
} from "../../engine/liveOps";

type SortKey =
  | "plate" | "routeId" | "destination" | "status" | "speedKph" | "paxOnBoard"
  | "heading" | "online" | "updatedAt" | "odometerM" | "trips" | "km" | "riders"
  | "fare" | "votes";

type SortDir = "asc" | "desc";
type LineFilter = "all" | LiveBusRouteId | "unassigned";
type StatusFilter = "all" | "moving" | "dwelling" | "stale" | "offline";

const LINE_LABEL: Record<LiveBusRouteId | "unassigned", string> = {
  "rawai-airport": "Rawai ↔ Airport",
  "patong-old-bus-station": "Patong ↔ Old Town",
  "dragon-line": "Dragon loop",
  unassigned: "Identifying",
};

const FRESH_FIX_MS = 3 * 60_000;

// ISO → Bangkok wall-clock "YYYY-MM-DD HH:MM:SS" (operators read in BKK).
const BKK_TZ = "Asia/Bangkok";
function bkkTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: BKK_TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

function compass(deg: number): string {
  if (!Number.isFinite(deg)) return "—";
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(((deg % 360) / 45)) % 8] ?? "—";
}

function ago(ms: number, now: number): string {
  const sec = Math.max(0, Math.round((now - ms) / 1000));
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.round(sec / 60)}m ago`;
  return `${Math.round(sec / 3600)}h ago`;
}

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function FleetDetail() {
  const [, setNow] = useState(() => Date.now());
  const [feed, setFeed] = useState(() => getLiveFeedState());
  const [buses, setBuses] = useState<readonly LiveBus[]>(() => getLiveBusesRaw());
  const [ledger, setLedger] = useState<LiveLedger>(() => getLiveLedgerSnapshot());
  const [expandedPlate, setExpandedPlate] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [lineFilter, setLineFilter] = useState<LineFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("plate");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Ref-counted live feed + a 1s tick so "seen 6s ago" stays honest.
  useEffect(() => {
    const stop = startLiveFeed();
    const refresh = () => {
      setFeed(getLiveFeedState());
      setBuses(getLiveBusesRaw());
      setLedger(getLiveLedgerSnapshot());
    };
    const unsub = subscribeLiveFeed(refresh);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => { stop(); unsub(); clearInterval(tick); };
  }, []);

  const now = Date.now();
  const reportingCount = buses.filter((b) => now - Date.parse(b.updatedAt) <= FRESH_FIX_MS).length;

  // One row per plate: raw tracker fields + day-ledger fields + derived status.
  const rows = useMemo(() => {
    const latest = new Map(buses.map((b) => [b.plate, b]));
    const plates = new Set<string>([...latest.keys(), ...Object.keys(ledger.vehicles)]);
    const out: Array<{
      plate: string;
      bus: LiveBus | null;
      book: LiveLedger["vehicles"][string] | undefined;
      trips: LiveTrip[];
      status: "moving" | "dwelling" | "stale" | "offline";
      km: number;
      riders: number;
      counted: number;
      fare: number;
      votesSummary: string;
      ledgerFixMs: number | null;
    }> = [];
    for (const plate of plates) {
      const bus = latest.get(plate) ?? null;
      const book = ledger.vehicles[plate];
      const trips = ledger.trips.filter((t) => t.plate === plate);
      const fixMs = bus ? Date.parse(bus.updatedAt) : book?.fixMs ?? 0;
      const staleSec = (now - fixMs) / 1000;
      const status: "moving" | "dwelling" | "stale" | "offline" = bus === null
        ? "offline"
        : staleSec * 1000 > FRESH_FIX_MS
          ? "stale"
          : bus.speedKph > 4 ? "moving" : "dwelling";
      const km = book ? Math.round(book.km * 10) / 10 : 0;
      const riders = trips.reduce((s, t) => s + t.riders, 0);
      const counted = trips.filter((t) => t.basis === "apc-count").reduce((s, t) => s + t.riders, 0);
      const fare = trips.reduce((s, t) => s + t.riders * t.fareThb, 0);
      const votesSummary = book?.votes
        ? Object.entries(book.votes)
            .sort((a, b) => b[1] - a[1])
            .map(([r, v]) => `${LINE_LABEL[r as LiveBusRouteId] ?? r}·${v}`)
            .join(", ")
        : "—";
      out.push({
        plate,
        bus,
        book,
        trips,
        status,
        km, riders, counted, fare,
        votesSummary,
        ledgerFixMs: book?.fixMs ?? null,
      });
    }
    return out;
  }, [buses, ledger, now]);

  // Apply filters + sort.
  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = rows.filter((r) => {
      if (needle && !r.plate.toLowerCase().includes(needle)) return false;
      const line = r.bus?.routeId ?? r.book?.routeId ?? "unassigned";
      if (lineFilter !== "all" && line !== lineFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      return true;
    });
    const dir = sortDir === "asc" ? 1 : -1;
    const compare = (a: typeof filtered[number], b: typeof filtered[number]): number => {
      const av = readSortField(a, sortKey);
      const bv = readSortField(b, sortKey);
      if (av === bv) return a.plate.localeCompare(b.plate);
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av ?? "").localeCompare(String(bv ?? "")) * dir;
    };
    return [...filtered].sort(compare);
  }, [rows, search, lineFilter, statusFilter, sortKey, sortDir]);

  function clickHeader(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  function exportJSON() {
    const payload = {
      exportedAt: new Date().toISOString(),
      ledgerDate: ledger.date,
      fetchedAt: feed.fetchedAtMs ? new Date(feed.fetchedAtMs).toISOString() : null,
      sources: feed.sources,
      pollCount: feed.pollCount, okCount: feed.okCount,
      buses: filteredRows.map((r) => ({
        ...(r.bus ?? {}),
        plate: r.plate,
        ledgerStatus: r.status,
        ledgerVotes: r.book?.votes ?? {},
        ledgerKm: r.km,
        ledgerRiders: r.riders,
        ledgerCounted: r.counted,
        ledgerFareThb: r.fare,
        ledgerHasApc: r.book?.hasApc ?? false,
        ledgerAtTerminal: r.book?.atTerminal ?? null,
        ledgerLastTerminal: r.book?.lastTerminal ?? null,
        ledgerLeftTerminalMin: r.book?.leftTerminalMin ?? null,
        ledgerPathSinceTerminalM: r.book?.pathSinceTerminalM ?? 0,
        ledgerTripBoardings: r.book?.tripBoardings ?? 0,
        trips: r.trips,
      })),
    };
    download(`fleet-${ledger.date}-${Date.now()}.json`, JSON.stringify(payload, null, 2), "application/json");
  }

  function exportCSV() {
    const headers = [
      "plate", "routeId", "destination", "status",
      "lat", "lng", "heading", "speedKph", "online",
      "updatedAt", "odometerM", "paxOnBoard", "paxUp", "paxDown",
      "km", "trips", "riders", "counted", "fareThb",
      "atTerminal", "lastTerminal", "leftTerminalMin", "pathSinceTerminalM",
      "tripBoardings", "hasApc", "votes",
    ];
    const lines = [headers.join(",")];
    for (const r of filteredRows) {
      const b = r.bus;
      lines.push([
        r.plate,
        b?.routeId ?? r.book?.routeId ?? "",
        b?.destination ?? "",
        r.status,
        b?.lat ?? "", b?.lng ?? "",
        b?.heading ?? "", b?.speedKph ?? "",
        b?.online === null || b?.online === undefined ? "" : b.online ? "yes" : "no",
        b?.updatedAt ?? "",
        b?.odometerM ?? "",
        b?.paxOnBoard ?? "",
        b?.paxUp ?? "",
        b?.paxDown ?? "",
        r.km,
        r.trips.length, r.riders, r.counted, r.fare,
        r.book?.atTerminal ?? "",
        r.book?.lastTerminal ?? "",
        r.book?.leftTerminalMin ?? "",
        r.book?.pathSinceTerminalM ?? "",
        r.book?.tripBoardings ?? "",
        r.book?.hasApc ? "yes" : "no",
        r.votesSummary,
      ].map(csvCell).join(","));
    }
    download(`fleet-${ledger.date}-${Date.now()}.csv`, lines.join("\n"), "text/csv");
  }

  const lineFilterOptions: LineFilter[] = ["all", "rawai-airport", "patong-old-bus-station", "dragon-line", "unassigned"];
  const statusFilterOptions: StatusFilter[] = ["all", "moving", "dwelling", "stale", "offline"];

  return (
    <div className="v2 v2--operations fleet-detail" style={{ zoom: 1, minHeight: "100vh", overflow: "auto" }}>
      <header className="v2-header fleet-detail__header">
        <div className="v2-header__brand">
          <span className="v2-header__eyebrow">
            <span className="v2-header__eyebrow-full">Real Fleet</span>
            <span className="v2-header__eyebrow-compact">Fleet</span>
          </span>
          <h1>Phuket Smart Bus · Fleet Detail</h1>
          <span className="v2-header__sub">Every data point the tracker sends, per real bus</span>
        </div>
        <div className="fleet-detail__status">
          <div className={`fleet-detail__pill fleet-detail__pill--${feed.status}`}>{feed.status.toUpperCase()}</div>
          <div className="fleet-detail__meta">
            <span><strong>Reporting:</strong> {reportingCount} / {buses.length}</span>
            <span><strong>Server fetch:</strong> {feed.fetchedAtMs ? bkkTime(new Date(feed.fetchedAtMs).toISOString()) : "—"}</span>
            <span><strong>Feed age:</strong> {feed.feedAgeSec === null ? "—" : ago(feed.lastOkMs ?? 0, now)}</span>
            <span><strong>Polls:</strong> {feed.pollCount} · <strong>OK:</strong> {feed.okCount}</span>
            <span><strong>Sources:</strong>
              <span className={`fleet-detail__chip ${feed.sources?.keyless ? "is-on" : "is-off"}`}>
                {feed.sources?.keyless ? "✓" : "×"} keyless
              </span>
              <span className={`fleet-detail__chip ${feed.sources?.token ? "is-on" : "is-off"}`}>
                {feed.sources?.token ? "✓" : "×"} token
              </span>
            </span>
            <span><strong>Ledger day:</strong> {ledger.date}</span>
          </div>
        </div>
        <div className="fleet-detail__actions">
          <a className="v2-source__btn" href="/ops">← Back to ops</a>
          <button type="button" className="v2-source__btn" onClick={exportJSON}>Export JSON</button>
          <button type="button" className="v2-source__btn" onClick={exportCSV}>Export CSV</button>
        </div>
      </header>

      <div className="fleet-detail__filters">
        <input
          className="fleet-detail__search"
          type="search"
          placeholder="Search plate…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Filter by plate"
        />
        <div className="fleet-detail__chips" role="group" aria-label="Filter by line">
          {lineFilterOptions.map((opt) => (
            <button
              key={opt}
              type="button"
              className={`fleet-detail__chip-btn ${lineFilter === opt ? "is-active" : ""}`}
              onClick={() => setLineFilter(opt)}
            >
              {opt === "all" ? "All lines" : LINE_LABEL[opt]}
            </button>
          ))}
        </div>
        <div className="fleet-detail__chips" role="group" aria-label="Filter by status">
          {statusFilterOptions.map((opt) => (
            <button
              key={opt}
              type="button"
              className={`fleet-detail__chip-btn ${statusFilter === opt ? "is-active" : ""}`}
              onClick={() => setStatusFilter(opt)}
            >
              {opt === "all" ? "All status" : opt}
            </button>
          ))}
        </div>
        <span className="fleet-detail__count">{filteredRows.length} / {rows.length} buses</span>
      </div>

      <main className="fleet-detail__table-wrap">
        <table className="fleet-detail__table">
          <thead>
            <tr>
              {sortableHeader("Plate", "plate", sortKey, sortDir, clickHeader)}
              {sortableHeader("Line", "routeId", sortKey, sortDir, clickHeader)}
              {sortableHeader("Destination", "destination", sortKey, sortDir, clickHeader)}
              {sortableHeader("Status", "status", sortKey, sortDir, clickHeader)}
              {sortableHeader("Heading", "heading", sortKey, sortDir, clickHeader)}
              {sortableHeader("km/h", "speedKph", sortKey, sortDir, clickHeader)}
              {sortableHeader("Pax", "paxOnBoard", sortKey, sortDir, clickHeader)}
              {sortableHeader("Up/Down", "paxOnBoard", sortKey, sortDir, clickHeader)}
              {sortableHeader("Online", "online", sortKey, sortDir, clickHeader)}
              {sortableHeader("Updated (BKK)", "updatedAt", sortKey, sortDir, clickHeader)}
              {sortableHeader("Odometer km", "odometerM", sortKey, sortDir, clickHeader)}
              {sortableHeader("Lat", "plate", sortKey, sortDir, clickHeader)}
              {sortableHeader("Lng", "plate", sortKey, sortDir, clickHeader)}
              {sortableHeader("Trips", "trips", sortKey, sortDir, clickHeader)}
              {sortableHeader("km today", "km", sortKey, sortDir, clickHeader)}
              {sortableHeader("Riders", "riders", sortKey, sortDir, clickHeader)}
              {sortableHeader("฿ fare", "fare", sortKey, sortDir, clickHeader)}
              {sortableHeader("Votes", "votes", sortKey, sortDir, clickHeader)}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((r) => {
              const b = r.bus;
              const fixMs = b ? Date.parse(b.updatedAt) : r.ledgerFixMs ?? 0;
              const isOpen = expandedPlate === r.plate;
              return (
                <Fragment key={r.plate}>
                  <tr
                    className={`fleet-detail__row ${isOpen ? "is-open" : ""} fleet-detail__row--${r.status}`}
                    onClick={() => setExpandedPlate(isOpen ? null : r.plate)}
                  >
                    <td><strong>{r.plate}</strong></td>
                    <td>{b?.routeId ?? r.book?.routeId ?? <span className="fleet-detail__dim">identifying</span>}</td>
                    <td>{b?.destination || r.book?.lastTerminal || <span className="fleet-detail__dim">—</span>}</td>
                    <td><span className={`fleet-detail__status-tag fleet-detail__status-tag--${r.status}`}>{r.status}</span></td>
                    <td className="fleet-detail__num">{b ? `${b.heading.toString().padStart(3, " ")}° ${compass(b.heading)}` : "—"}</td>
                    <td className="fleet-detail__num">{b ? b.speedKph.toFixed(0) : "—"}</td>
                    <td className="fleet-detail__num">{b?.paxOnBoard ?? <span className="fleet-detail__dim">no counter</span>}</td>
                    <td className="fleet-detail__num">{b?.paxUp != null ? `${b.paxUp}/${b.paxDown ?? "?"}` : "—"}</td>
                    <td>{b?.online === true ? "yes" : b?.online === false ? "no" : <span className="fleet-detail__dim">—</span>}</td>
                    <td>{b ? bkkTime(b.updatedAt) : "—"}<br /><span className="fleet-detail__ago">{ago(fixMs, now)}</span></td>
                    <td className="fleet-detail__num">{b?.odometerM != null ? (b.odometerM / 1000).toFixed(1) : <span className="fleet-detail__dim">—</span>}</td>
                    <td className="fleet-detail__num">{b ? b.lat.toFixed(5) : "—"}</td>
                    <td className="fleet-detail__num">{b ? b.lng.toFixed(5) : "—"}</td>
                    <td className="fleet-detail__num">{r.trips.length}</td>
                    <td className="fleet-detail__num">{r.km}</td>
                    <td className="fleet-detail__num">{r.riders}<br /><span className="fleet-detail__ago">{r.counted} counted</span></td>
                    <td className="fleet-detail__num">฿{r.fare.toLocaleString()}</td>
                    <td className="fleet-detail__dim">{r.votesSummary}</td>
                  </tr>
                  {isOpen && (
                    <tr className="fleet-detail__expanded">
                      <td colSpan={18}>
                        <ExpandedDetail row={r} ledger={ledger} now={now} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {filteredRows.length === 0 && (
              <tr><td colSpan={18} className="fleet-detail__empty">No buses match the current filter.</td></tr>
            )}
          </tbody>
        </table>
      </main>
    </div>
  );
}

function sortableHeader(label: string, key: SortKey, currentKey: SortKey, currentDir: SortDir, onClick: (k: SortKey) => void) {
  const isActive = currentKey === key;
  return (
    <th onClick={() => onClick(key)} className={isActive ? `is-sorted is-${currentDir}` : ""}>
      {label}{isActive ? (currentDir === "asc" ? " ↑" : " ↓") : ""}
    </th>
  );
}

function readSortField(row: { plate: string; bus: LiveBus | null; book: LiveLedger["vehicles"][string] | undefined; trips: LiveTrip[]; km: number; riders: number; fare: number; status: string }, key: SortKey): string | number {
  switch (key) {
    case "plate": return row.plate;
    case "routeId": return row.bus?.routeId ?? row.book?.routeId ?? "zzz";
    case "destination": return row.bus?.destination ?? row.book?.lastTerminal ?? "";
    case "status": return row.status;
    case "speedKph": return row.bus?.speedKph ?? -1;
    case "paxOnBoard": return row.bus?.paxOnBoard ?? -1;
    case "heading": return row.bus?.heading ?? -1;
    case "online": return row.bus?.online === true ? 2 : row.bus?.online === false ? 1 : 0;
    case "updatedAt": return row.bus?.updatedAt ?? "";
    case "odometerM": return row.bus?.odometerM ?? -1;
    case "trips": return row.trips.length;
    case "km": return row.km;
    case "riders": return row.riders;
    case "fare": return row.fare;
    case "votes": return row.book?.votes ? Math.max(0, ...Object.values(row.book.votes)) : 0;
  }
}

function ExpandedDetail({ row, ledger, now }: { row: { plate: string; bus: LiveBus | null; book: LiveLedger["vehicles"][string] | undefined; trips: LiveTrip[] }; ledger: LiveLedger; now: number }) {
  return (
    <div className="fleet-detail__detail">
      <div className="fleet-detail__panel">
        <h4>Raw tracker row</h4>
        {row.bus ? (
          <pre className="fleet-detail__json">{JSON.stringify(row.bus, null, 2)}</pre>
        ) : (
          <p className="fleet-detail__dim">No raw bus in the last poll — only ledger history.</p>
        )}
      </div>
      <div className="fleet-detail__panel">
        <h4>Ledger entry</h4>
        {row.book ? (
          <pre className="fleet-detail__json">{JSON.stringify(row.book, null, 2)}</pre>
        ) : (
          <p className="fleet-detail__dim">No ledger entry yet (bus hasn't crossed into today's date).</p>
        )}
        <p className="fleet-detail__dim">
          Day {ledger.date} · DOW {ledger.dow} · first fix at {ledger.firstFixMs ? bkkTime(new Date(ledger.firstFixMs).toISOString()) : "—"}
        </p>
      </div>
      <div className="fleet-detail__panel">
        <h4>Trips today ({row.trips.length})</h4>
        {row.trips.length === 0 ? (
          <p className="fleet-detail__dim">No completed trips yet (still loading, or only short depot moves).</p>
        ) : (
          <table className="fleet-detail__trips">
            <thead><tr><th>From</th><th>To</th><th>Start (BKK)</th><th>End (BKK)</th><th>Riders</th><th>Basis</th><th>฿</th></tr></thead>
            <tbody>
              {row.trips.map((t, i) => (
                <tr key={i}>
                  <td>{t.from ?? "—"}</td>
                  <td>{t.to}</td>
                  <td>{t.startMin === null ? "—" : `${String(Math.floor(t.startMin / 60) % 24).padStart(2, "0")}:${String(Math.floor(t.startMin % 60)).padStart(2, "0")}`}</td>
                  <td>{`${String(Math.floor(t.endMin / 60) % 24).padStart(2, "0")}:${String(Math.floor(t.endMin % 60)).padStart(2, "0")}`}</td>
                  <td className="fleet-detail__num">{t.riders}</td>
                  <td>{t.basis}</td>
                  <td className="fleet-detail__num">฿{(t.riders * t.fareThb).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
