/**
 * The rider's live board: pick a stop (or use your location), see the real
 * buses heading there and how many minutes away they are, and where every
 * bus is on the map. Everything here comes from the PKSB trackers and the
 * trips the research record has measured — no simulated bus appears.
 */
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { LiveBus } from "@shared/pksbFeed";
import type { SlimDay } from "@shared/insights";
import { getLiveBusesRaw, getLiveFeedState, getLiveLedgerSnapshot, startLiveFeed, subscribeLiveFeed } from "../../engine/liveOps";
import { appPath } from "../../lib/paths";
import { LINES, ago, bkkClock, isOut, readRow } from "../v2/fleetRows";
import { arrivalsAt, buildPace, nearestStop, placeBuses, towardLabel, type Arrival, type Dir, type Pace, type StopRef } from "./arrivals";
import { RiderDecisionCard } from "./RiderDecisionCard";

const RiderMap = lazy(() => import("./RiderMap").then((m) => ({ default: m.RiderMap })));

const STOP_KEY = "pksb-rider-stop";
const DEFAULT_STOP: StopRef = { routeId: "rawai-airport", index: 0 };

function readStop(): StopRef {
  try {
    const s = JSON.parse(localStorage.getItem(STOP_KEY) ?? "null") as StopRef | null;
    if (s && LINES.some((l) => l.routeId === s.routeId && l.stops[s.index])) return s;
  } catch { /* private mode */ }
  return DEFAULT_STOP;
}
function saveStop(s: StopRef) {
  try { localStorage.setItem(STOP_KEY, JSON.stringify(s)); } catch { /* private mode */ }
}

function useLiveBuses() {
  const [buses, setBuses] = useState<readonly LiveBus[]>(() => getLiveBusesRaw());
  const [feed, setFeed] = useState(() => getLiveFeedState());
  useEffect(() => {
    const stop = startLiveFeed();
    const unsub = subscribeLiveFeed(() => { setBuses(getLiveBusesRaw()); setFeed(getLiveFeedState()); });
    return () => { unsub(); stop(); };
  }, []);
  return { buses, feed };
}

function usePace(): { pace: Pace; trips: number; since: string | null } {
  const [state, setState] = useState<{ pace: Pace; trips: number; since: string | null }>({ pace: new Map(), trips: 0, since: null });
  useEffect(() => {
    let live = true;
    fetch(appPath("/api/research/period"))
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { days?: SlimDay[]; firstDay?: string } | null) => {
        const days = d?.days ?? [];
        if (live) setState({ pace: buildPace(days), trips: days.reduce((n, day) => n + day.lines.reduce((m, l) => m + l.trips.length, 0), 0), since: d?.firstDay ?? null });
      })
      .catch(() => {});
    return () => { live = false; };
  }, []);
  return state;
}

function useNow(ms: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(id); }, [ms]);
  return now;
}

const minutes = (a: Arrival) =>
  a.etaMin === 0 ? "At stop"
  // A null ETA on a stopped bus is not "unknown" in the vague sense — we know
  // exactly why: it is not moving, so no pace can be applied to it.
  : a.etaMin === null ? (a.state === "standing" ? "Standing" : "—")
  : a.etaMin < 1 ? "<1 min" : `${Math.round(a.etaMin)} min`;
const kmText = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`);

export function LiveArrivals({
  timetableNext,
  children
}: {
  timetableNext: string | null;
  children?: React.ReactNode;
}) {
  const { buses, feed } = useLiveBuses();
  const { pace, trips, since } = usePace();
  const now = useNow(5_000);
  const [ref, setRef] = useState<StopRef>(readStop);
  const [locating, setLocating] = useState<string | null>(null);

  const line = LINES.find((l) => l.routeId === ref.routeId)!;
  const stop = line.stops[ref.index]!;

  // Direction from movement needs the bus's place on the line one poll ago.
  const prevAlong = useRef(new Map<string, number>());
  const lastBuses = useRef<readonly LiveBus[] | null>(null);
  const placed = useMemo(() => {
    const ledger = getLiveLedgerSnapshot();
    const out = placeBuses(buses, Date.now(), (b) => b.routeId ?? ledger.vehicles[b.plate]?.routeId ?? null, prevAlong.current, (p) => ledger.vehicles[p]?.lastTerminal);
    if (lastBuses.current !== buses) {
      lastBuses.current = buses;
      prevAlong.current = new Map(out.map((p) => [p.bus.plate, p.alongM]));
    }
    return out;
  }, [buses]);

  const board = useMemo(() => arrivalsAt(placed, ref, pace, now), [placed, ref, pace, now]);
  const bestEtaMin = useMemo(() => {
    const fwdEta = board.fwd[0]?.etaMin ?? null;
    const revEta = board.rev[0]?.etaMin ?? null;
    if (fwdEta !== null && revEta !== null) return Math.min(fwdEta, revEta);
    return fwdEta !== null ? fwdEta : revEta;
  }, [board]);
  const onLine = useMemo(() => new Set(placed.filter((p) => p.line.routeId === ref.routeId).map((p) => p.bus.plate)), [placed, ref.routeId]);
  const reporting = buses.filter((b) => isOut(readRow(b, now))).length;
  const live = feed.status === "live" || feed.status === "quiet";
  const dirs: Dir[] = ["fwd", "rev"];

  function choose(next: StopRef) { setRef(next); saveStop(next); }
  function locate() {
    if (!navigator.geolocation) { setLocating("This phone did not share a location."); return; }
    setLocating("Finding you…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const n = nearestStop(pos.coords.latitude, pos.coords.longitude);
        choose({ routeId: n.routeId, index: n.index });
        setLocating(`Nearest stop, ${n.km < 1 ? `${Math.round(n.km * 1000)} m` : `${n.km.toFixed(1)} km`} from you.`);
      },
      () => setLocating("Location not shared. Pick your stop from the list."),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  return (
    <section className="pa-live" aria-labelledby="pa-live-title">
      <header className="pa-live__head">
        <h2 id="pa-live-title">Next real buses</h2>
        <span className={`pa-live__feed${live ? " is-live" : ""}`} role="status">
          {live
            ? `${reporting} bus${reporting === 1 ? "" : "es"} reporting · updated ${feed.lastOkMs ? ago(feed.lastOkMs, now) : "—"}`
            : feed.status === "connecting" ? "Connecting to the bus trackers…" : "Bus trackers not answering"}
        </span>
      </header>

      <div className="pa-live__pick">
        <label className="pa-live__select">
          <span>Your stop</span>
          <select
            value={`${ref.routeId}:${ref.index}`}
            onChange={(e) => { const [r, i] = e.target.value.split(":"); choose({ routeId: r!, index: Number(i) }); setLocating(null); }}
          >
            {LINES.map((l) => (
              <optgroup key={l.routeId} label={l.name}>
                {l.stops.map((s, i) => <option key={i} value={`${l.routeId}:${i}`}>{s.name}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
        <button type="button" className="pa-live__locate" onClick={locate}>Use my location</button>
      </div>
      {locating && <p className="pa-live__note">{locating}</p>}

      <div className="pa-live__board">
        {dirs.map((d) => {
          const rows = board[d].slice(0, 3);
          return (
            <div className="pa-live__dir" key={d}>
              <h3>{towardLabel(line, d)}</h3>
              {rows.length === 0 ? (
                <p className="pa-live__none">
                  No bus on its way here right now.
                  {d === "fwd" && ref.routeId === "rawai-airport" && ref.index === 0 && timetableNext ? ` Timetable: next departure ${timetableNext}.` : ""}
                </p>
              ) : (
                <ol>
                  {rows.map((a) => (
                    <li key={a.plate} className="pa-live__row">
                      <strong className={`pa-live__eta${a.etaMin === null ? " is-none" : ""}`}>{minutes(a)}</strong>
                      <span className="pa-live__bus">
                        Bus {a.plate}
                        <small>{kmText(a.awayM)} away · {a.state === "late" ? `late signal, last seen ${bkkClock(a.fixMs)}` : `seen ${ago(a.fixMs, now)}`}</small>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          );
        })}
      </div>

      {/* The map answers the board's own question — where are they — so it follows
          the board directly. The bus-or-Grab decision and the tickets come after. */}
      <Suspense fallback={<div className="pa-map pa-map--loading">Loading the map…</div>}>
        <RiderMap buses={buses} onLine={onLine} line={line} stop={stop} now={now} />
      </Suspense>

      <p className="pa-live__truth">
        Positions come from the buses' own GPS trackers. Minutes are distance along the route at the median pace of
        {trips > 0 ? ` ${trips.toLocaleString("en-US")} trips recorded${since ? ` since ${since}` : ""}` : " recorded trips (loading)"}; traffic can change them.
        Town buses don't report a line, so they show on the map but not on this board.
      </p>

      <RiderDecisionCard
        currentStopRef={ref}
        stopName={stop.name}
        liveEtaMin={bestEtaMin}
        timetableNextStr={timetableNext}
      >
        {children}
      </RiderDecisionCard>
    </section>
  );
}
