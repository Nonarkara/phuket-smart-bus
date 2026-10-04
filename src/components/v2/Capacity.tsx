/**
 * Capacity Command — one screen, one question: are we meeting demand right
 * now, and where do we need to add buses?
 *
 * Layout (top → bottom):
 *   1. Header strip — pulse + Bangkok clock + LIVE/SIM + service day
 *   2. Hero KPIs (4) — buses rolling · queue at airport · add NOW · missed this hour
 *   3. The Operating Equation — demand − supply = buses to add, single row
 *   4. 24-hour capacity forecast — coloured bars, direction-aware verdict per hour
 *   5. Next-action queue — top 6 hours needing attention, each with the math
 *   6. Live fleet snapshot — top 12 buses currently on the road
 *
 * Every number traces back to the engine:
 *   demand / supply / gap  → getHourlyBalance()
 *   recommendation        → engines's busesToAdd (whole 25-seat buses)
 *   money                → getDayDebrief() (THB at operator's published fare)
 *   current fleet        → getOperatorFleet() + the live feed
 *   clock                → getSimulatedMinutes() (LIVE: real BKK; SIM: replay)
 */
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  computeSimState,
  getDayInfo,
  getLiveTotals,
} from "../../engine/simulation";
import {
  getClockState,
  getSimulatedMinutes,
  setSimulatedMinutes,
  setClockOverride,
  resetClockAnchor,
  SERVICE_START,
  DAY_TARGET_END,
} from "../../engine/fleetSimulator";
import {
  getDayModelFor,
} from "../../engine/demandSupplyEngine";
import {
  bangkokDow,
  getLiveBusesRaw,
  getLiveFeedState,
  startLiveFeed,
  subscribeLiveFeed,
} from "../../engine/liveOps";
import {
  getHourlyBalance,
  getOperatorFleet,
  getDayDebrief,
  HOURLY_OPEX_PER_BUS_THB,
  type HourlyBalance,
} from "../../engine/v2OpsPanel";
import { setSimulationDay, getSimulationDay } from "../../engine/opsFlightSchedule";
import { getHeadlineMetrics } from "../../engine/headlineMetrics";
import { getBangkokNowFractionalMinutes } from "../../engine/time";
import { appPath } from "../../lib/paths";

const BKK_TZ = "Asia/Bangkok";
const BUS_CAPACITY = 25;
const FARE_THB = 100;
const FRESH_FIX_MS = 3 * 60_000;

function hhmm(min: number): string {
  return `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(Math.floor(min % 60)).padStart(2, "0")}`;
}

function bkkTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: BKK_TZ, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).format(d);
}

function fmtN(n: number | null | undefined, suffix = ""): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `${Math.round(n).toLocaleString()}${suffix}`;
}

function fmtThb(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return `${n < 0 ? "−" : ""}฿${(Math.abs(n) / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${n < 0 ? "−" : ""}฿${(Math.abs(n) / 1_000).toFixed(1)}k`;
  return `${n < 0 ? "−" : ""}฿${Math.round(Math.abs(n)).toLocaleString()}`;
}

function computeOpsScale(): number {
  if (typeof window === "undefined") return 1;
  const widthScale = window.innerWidth / 1440;
  const heightScale = window.innerHeight / 900;
  return Math.min(2.5, Math.max(1, Math.min(widthScale, heightScale)));
}

function shouldUseCompact(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth < 1360 || window.innerHeight < 820;
}

type OpsSource = "live" | "sim";

function getInitialSource(): OpsSource {
  if (typeof window === "undefined") return "auto" as never; // unused, just to silence TS
  const params = new URLSearchParams(window.location.search);
  if (params.has("demo")) return "sim";
  const r = params.get("source");
  return r === "sim" ? "sim" : "live";
}

/** Animated counter — same engine as the Ops Wall's money cells. */
function Counter({ value, suffix = "", className }: { value: number; suffix?: string; className?: string }) {
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    if (value === display) return;
    const from = display;
    const diff = value - from;
    const duration = 1200;
    const t0 = performance.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const step = () => {
      const p = Math.min(1, (performance.now() - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(from + diff * eased));
      if (p < 1) timer = setTimeout(step, 33);
    };
    step();
    return () => { if (timer) clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return <span className={className}>{display.toLocaleString()}{suffix}</span>;
}

export function Capacity() {
  // ── SIM clock state ─────────────────────────────────────────────────────
  const [simMin, setSimMin] = useState(() => getSimulatedMinutes());
  const [clockState, setClockState] = useState(getClockState());
  const [source, setSource] = useState<OpsSource>(getInitialSource);

  // ── LIVE feed state ─────────────────────────────────────────────────────
  const [liveFeed, setLiveFeed] = useState(() => getLiveFeedState());
  const [liveBuses, setLiveBuses] = useState(() => getLiveBusesRaw());
  const [now, setNow] = useState(() => Date.now());

  // Wall-display scaling
  const [opsScale, setOpsScale] = useState(() => computeOpsScale());
  const [isCompact, setIsCompact] = useState(() => shouldUseCompact());
  useEffect(() => {
    const onResize = () => {
      setOpsScale(computeOpsScale());
      setIsCompact(shouldUseCompact());
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // rAF heartbeat — drives the sim clock and ref-writes the imperative text cells.
  useEffect(() => {
    let raf = 0;
    let lastT = -1;
    const tick = () => {
      const t = source === "live" ? getBangkokNowFractionalMinutes() : getSimulatedMinutes();
      if (t !== lastT) {
        lastT = t;
        setSimMin(t);
        setClockState(getClockState());
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [source]);

  // Subscribe to live feed
  useEffect(() => {
    const stop = startLiveFeed();
    const refresh = () => {
      setLiveFeed(getLiveFeedState());
      setLiveBuses(getLiveBusesRaw());
    };
    const unsub = subscribeLiveFeed(refresh);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => { stop(); unsub(); clearInterval(tick); };
  }, []);

  // ── Engine-derived numbers ──────────────────────────────────────────────
  const simState = useMemo(() => computeSimState(), [simMin]);
  const simDay = getSimulationDay();
  const headline = useMemo(() => getHeadlineMetrics(), [simMin]);

  const totals = useMemo(() => getLiveTotals(simMin), [simMin]);

  const balance = useMemo(() => getHourlyBalance(), [simDay]);
  const debrief = useMemo(() => getDayDebrief(), [simDay]);
  const operatorFleet = useMemo(() => getOperatorFleet(), [simMin]);

  const currentHour = Math.floor(simMin / 60) % 24;
  const currentBalance = balance[currentHour];
  const nextHours = useMemo(() => {
    const out: HourlyBalance[] = [];
    for (let i = 0; i < 6; i++) out.push(balance[(currentHour + i) % 24]!);
    return out;
  }, [balance, currentHour]);

  // ── LIVE: switch engine to real Bangkok clock + today's weekday ─────────
  useEffect(() => {
    if (source !== "live") return;
    const dow = bangkokDow(Date.now());
    setSimulationDay(dow);
    setClockOverride(() => getBangkokNowFractionalMinutes());
    return () => {
      setClockOverride(null);
      resetClockAnchor();
      setClockState(getClockState());
    };
  }, [source]);

  // ── Derived LIVE state ──────────────────────────────────────────────────
  const liveReporting = liveBuses.filter((b) => now - Date.parse(b.updatedAt) <= FRESH_FIX_MS);
  const liveMoving = liveReporting.filter((b) => b.speedKph > 4);
  const liveAgeSec = liveFeed.lastOkMs === null ? null : Math.max(0, Math.round((now - liveFeed.lastOkMs) / 1000));
  const liveSourceOk = liveFeed.sources?.keyless ?? false;

  // ── Hero KPI numbers ────────────────────────────────────────────────────
  const currentBusesRolling = source === "live" ? liveMoving.length : simState.busesMoving;
  const currentQueue = Math.max(0, Math.round(simState.paxAtAirport));
  const currentBusesToAdd = Math.max(0, Math.ceil(currentQueue / BUS_CAPACITY));
  const currentMissedThb = simState.lostRevenueThb;

  // Next 24 hours' pending actions, ranked by urgency (gap, then by hour)
  const topActions = useMemo(() => {
    const actions = balance
      .filter((r) => r.busesToAdd > 0 || r.emptySeatsPax >= BUS_CAPACITY)
      .map((r) => ({
        hour: r.hour,
        inGap: r.inGapPax,
        outGap: r.outGapPax,
        busesToAdd: r.busesToAdd,
        emptySeats: r.emptySeatsPax,
        verdict: r.status,
        missedThb: r.missedThb,
        earnedThb: r.earnedThb,
        severity: r.busesToAdd * 10 + Math.max(r.inGapPax, r.outGapPax),
      }));
    return actions.sort((a, b) => b.severity - a.severity).slice(0, 6);
  }, [balance]);

  const chooseSource = (next: OpsSource) => {
    setSource(next);
    const url = new URL(window.location.href);
    url.searchParams.set("source", next);
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  };

  const dayInfo = getDayInfo();

  return (
    <div className={`v2 v2--operations capacity ${isCompact ? "capacity--compact" : ""}`} style={{ zoom: opsScale, minHeight: "100vh", overflow: "auto" }}>
      {/* ── Header ────────────────────────────────────────────────────── */}
      <header className="capacity__header">
        <div className="capacity__brand">
          <span className="capacity__eyebrow">Capacity Command</span>
          <h1>Phuket Smart Bus</h1>
          <span className="capacity__sub">Live fleet · modelled demand · planning recommendation</span>
        </div>

        <div className="capacity__clock">
          <span className="capacity__pulse" aria-hidden="true" />
          <span className="capacity__day">{dayInfo.label}</span>
          <span className="capacity__time">{hhmm(simMin)}</span>
          <span className="capacity__bkk">BKK</span>
        </div>

        <div className="capacity__source">
          <button
            type="button"
            className={`capacity__source-btn ${source === "live" ? "is-active" : ""} ${liveSourceOk && liveAgeSec !== null && liveAgeSec < 90 ? "is-available" : ""}`}
            onClick={() => chooseSource("live")}
          >
            LIVE FLEET{liveReporting.length > 0 ? ` · ${liveReporting.length}` : ""}
          </button>
          <button
            type="button"
            className={`capacity__source-btn ${source === "sim" ? "is-active" : ""}`}
            onClick={() => chooseSource("sim")}
          >
            SIMULATION
          </button>
          <a className="capacity__source-btn" href={appPath("/ops")}>OPS</a>
          <a className="capacity__source-btn" href={appPath("/study")}>STUDY</a>
          <a className="capacity__source-btn" href={appPath("/fleet")}>FLEET</a>
        </div>
      </header>

      {/* ── Hero KPIs ─────────────────────────────────────────────────── */}
      <section className="capacity__heroes">
        <div className="capacity__hero">
          <span className="capacity__hero-label">Buses rolling</span>
          <strong className="capacity__hero-value">
            <Counter value={currentBusesRolling} />
          </strong>
          <span className="capacity__hero-sub">{source === "live" ? `${liveReporting.length} reporting · ${liveMoving.length} &gt; 4 km/h` : `${fmtN(headline.fleet.totalBuses)} in fleet`}</span>
        </div>
        <div className={`capacity__hero ${currentQueue > 50 ? "capacity__hero--alert" : currentQueue > 0 ? "capacity__hero--warn" : ""}`}>
          <span className="capacity__hero-label">Modelled airport queue</span>
          <strong className="capacity__hero-value">
            <Counter value={currentQueue} suffix=" pax" />
          </strong>
          <span className="capacity__hero-sub">{simState.paxAbandoned > 0 ? `${fmtN(simState.paxAbandoned)} already walked away` : "FIFO patience 60 min"}</span>
        </div>
        <div className={`capacity__hero ${currentBusesToAdd > 0 ? "capacity__hero--action" : ""}`}>
          <span className="capacity__hero-label">Planning recommendation</span>
          <strong className="capacity__hero-value">
            <Counter value={currentBusesToAdd} suffix=" buses" />
          </strong>
          <span className="capacity__hero-sub">to clear {currentQueue}-pax queue at 25-cap · {fmtThb(currentMissedThb)} lost today</span>
        </div>
        <div className="capacity__hero capacity__hero--money">
          <span className="capacity__hero-label">Modelled fare potential</span>
          <strong className="capacity__hero-value">
            <Counter value={Math.round(totals.revenueThb)} className="capacity__hero-thb" />
          </strong>
          <span className="capacity__hero-sub">riders × ฿{FARE_THB} · {fmtN(totals.paxDelivered)} delivered · {fmtN(totals.tripsCompleted)} trips</span>
        </div>
      </section>

      {/* ── Operating Equation ──────────────────────────────────────── */}
      <section className="capacity__equation">
        <div className="capacity__equation-cell">
          <span className="capacity__equation-label">Demand this hour</span>
          <strong className="capacity__equation-value">{fmtN((currentBalance?.busEligiblePax ?? 0) + (currentBalance?.outEligiblePax ?? 0))} <span className="capacity__equation-unit">pax</span></strong>
          <span className="capacity__equation-detail">{(currentBalance?.busEligiblePax ?? 0)} inbound · {(currentBalance?.outEligiblePax ?? 0)} outbound</span>
        </div>
        <div className="capacity__equation-cell">
          <span className="capacity__equation-label">Supply (seats)</span>
          <strong className="capacity__equation-value">{fmtN((currentBalance?.busSeats ?? 0) + (currentBalance?.outSeats ?? 0))} <span className="capacity__equation-unit">seats</span></strong>
          <span className="capacity__equation-detail">{fmtN(currentBalance?.busSeats ?? 0)} south · {fmtN(currentBalance?.outSeats ?? 0)} north</span>
        </div>
        <div className="capacity__equation-op">−</div>
        <div className="capacity__equation-cell">
          <span className="capacity__equation-label">Gap</span>
          <strong className={`capacity__equation-value ${(currentBalance?.gapPax ?? 0) > 0 ? "is-shortfall" : "is-ok"}`}>{currentBalance?.gapPax && currentBalance.gapPax > 0 ? "−" : ""}{fmtN(Math.abs(currentBalance?.gapPax ?? 0))} <span className="capacity__equation-unit">pax</span></strong>
          <span className="capacity__equation-detail">{currentBalance?.status?.toUpperCase() ?? "—"}</span>
        </div>
        <div className="capacity__equation-op">=</div>
        <div className={`capacity__equation-cell capacity__equation-cell--action ${(currentBalance?.busesToAdd ?? 0) > 0 ? "is-action" : ""}`}>
          <span className="capacity__equation-label">Action</span>
          <strong className="capacity__equation-value">
            {(currentBalance?.busesToAdd ?? 0) > 0
              ? <>+<Counter value={currentBalance?.busesToAdd ?? 0} /> <span className="capacity__equation-unit">buses @ {String(currentHour).padStart(2, "0")}:00</span></>
              : <span className="capacity__equation-ok">OK · run as-is</span>}
          </strong>
          <span className="capacity__equation-detail">{fmtThb(currentBalance?.missedThb ?? 0)} missed this hour · {fmtThb(currentBalance?.earnedThb ?? 0)} earned</span>
        </div>
      </section>

      {/* ── 24-hour capacity forecast ──────────────────────────────────── */}
      <section className="capacity__forecast">
        <div className="capacity__forecast-head">
          <h2>24-hour capacity forecast</h2>
          <span className="capacity__forecast-legend">
            <span className="capacity__legend-swatch capacity__legend-swatch--shortfall">shortfall</span>
            <span className="capacity__legend-swatch capacity__legend-swatch--tight">tight</span>
            <span className="capacity__legend-swatch capacity__legend-swatch--balanced">balanced</span>
            <span className="capacity__legend-swatch capacity__legend-swatch--surplus">surplus</span>
          </span>
        </div>
        <div className="capacity__forecast-strip">
          {balance.map((r) => {
            const max = Math.max(1, ...balance.map((x) => Math.max(x.busEligiblePax + x.outEligiblePax, x.busSeats + x.outSeats)));
            const demandH = Math.max(0, ((r.busEligiblePax + r.outEligiblePax) / max) * 100);
            const supplyH = Math.max(0, ((r.busSeats + r.outSeats) / max) * 100);
            const isNow = r.hour === currentHour;
            const isPast = r.hour < currentHour;
            return (
              <div
                key={r.hour}
                className={`capacity__hour capacity__hour--${r.status} ${isNow ? "is-now" : ""} ${isPast ? "is-past" : ""}`}
                title={`${String(r.hour).padStart(2, "0")}:00 — ${r.status}, gap ${r.gapPax}, add ${r.busesToAdd}`}
              >
                <div className="capacity__hour-bars">
                  <div className="capacity__hour-bar capacity__hour-bar--demand" style={{ height: `${demandH}%` }} />
                  <div className="capacity__hour-bar capacity__hour-bar--supply" style={{ height: `${supplyH}%` }} />
                </div>
                <div className="capacity__hour-label">{String(r.hour).padStart(2, "0")}</div>
                {r.busesToAdd > 0 && (
                  <div className="capacity__hour-badge">+{r.busesToAdd}</div>
                )}
              </div>
            );
          })}
        </div>
        <div className="capacity__forecast-axis">
          <span>demand (filled) vs supply (outline) per hour · numbers above the bar = buses to add</span>
        </div>
      </section>

      {/* ── Live pattern overlay (only in LIVE) ──────────────────────── */}
      {source === "live" && liveFeed.fetchedAtMs && (
        <section className="capacity__live-strip">
          <div className="capacity__live-cell">
            <span className="capacity__live-label">Feed</span>
            <strong className="capacity__live-value">{liveFeed.status.toUpperCase()}</strong>
            <span className="capacity__live-sub">{bkkTime(new Date(liveFeed.fetchedAtMs).toISOString())} fetched · {liveAgeSec}s ago</span>
          </div>
          <div className="capacity__live-cell">
            <span className="capacity__live-label">Sources</span>
            <strong className="capacity__live-value">{liveFeed.sources?.keyless ? "keyless" : "—"} {liveFeed.sources?.token ? "+ token" : ""}</strong>
            <span className="capacity__live-sub">edge relay from po-smartbus.phuket.cloud</span>
          </div>
          <div className="capacity__live-cell">
            <span className="capacity__live-label">Polls</span>
            <strong className="capacity__live-value">{liveFeed.okCount}/{liveFeed.pollCount}</strong>
            <span className="capacity__live-sub">ok / total · {liveFeed.pollCount === 0 ? "warming up" : `${Math.round((liveFeed.okCount / liveFeed.pollCount) * 100)}%`}</span>
          </div>
          <div className="capacity__live-cell">
            <span className="capacity__live-label">Ledger day</span>
            <strong className="capacity__live-value">{liveFeed.ledgerDate}</strong>
            <span className="capacity__live-sub">Bangkok calendar · rolls at midnight</span>
          </div>
        </section>
      )}

      {/* ── Two columns: next actions + next 6 hours detail ──────────── */}
      <section className="capacity__grid">
        <div className="capacity__panel">
          <header className="capacity__panel-head">
            <h2>What to do next</h2>
            <span className="capacity__panel-meta">{debrief.shortHours} shortfall hrs · {debrief.lightHours} light hrs</span>
          </header>
          {topActions.length === 0 ? (
            <div className="capacity__panel-empty">Service window is balanced. No buses to add today.</div>
          ) : (
            <ol className="capacity__actions">
              {topActions.map((a, i) => (
                <li key={a.hour} className={`capacity__action capacity__action--${a.verdict}`}>
                  <div className="capacity__action-head">
                    <strong className="capacity__action-hour">{String(a.hour).padStart(2, "0")}:00</strong>
                    {a.busesToAdd > 0
                      ? <span className="capacity__action-tag capacity__action-tag--add">+{a.busesToAdd} buses</span>
                      : <span className="capacity__action-tag capacity__action-tag--light">run lighter</span>}
                    <span className="capacity__action-money">{fmtThb(a.missedThb)} missed</span>
                  </div>
                  <div className="capacity__action-detail">
                    inbound gap <strong>{fmtN(a.inGap)}</strong>
                    {" · "}outbound gap <strong>{fmtN(a.outGap)}</strong>
                    {a.emptySeats > 0 && <span className="capacity__action-empty"> · {fmtN(a.emptySeats)} empty seats</span>}
                  </div>
                  <div className="capacity__action-cost">
                    A standby bus costs ~{fmtThb(HOURLY_OPEX_PER_BUS_THB)}/hr · recouped if even 1 rider
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="capacity__panel">
          <header className="capacity__panel-head">
            <h2>Next 6 hours · detail</h2>
            <span className="capacity__panel-meta">verdict per hour · tap to replay</span>
          </header>
          <table className="capacity__hours-table">
            <thead>
              <tr>
                <th>Hr</th>
                <th className="capacity__num">Demand</th>
                <th className="capacity__num">Supply</th>
                <th className="capacity__num">Gap</th>
                <th>Verdict</th>
                <th className="capacity__num">Missed</th>
              </tr>
            </thead>
            <tbody>
              {nextHours.map((r) => {
                const isNow = r.hour === currentHour;
                return (
                  <tr key={r.hour} className={`capacity__hours-row capacity__hours-row--${r.status} ${isNow ? "is-now" : ""}`} onClick={() => setSimulatedMinutes(r.hour * 60 + 30)}>
                    <td><strong>{String(r.hour).padStart(2, "0")}:00</strong>{isNow && <span className="capacity__now-tag">now</span>}</td>
                    <td className="capacity__num">{fmtN(r.busEligiblePax + r.outEligiblePax)}</td>
                    <td className="capacity__num">{fmtN(r.busSeats + r.outSeats)}</td>
                    <td className={`capacity__num ${r.gapPax > 0 ? "is-shortfall" : ""}`}>
                      {r.gapPax > 0 ? "−" : ""}{fmtN(Math.abs(r.gapPax))}
                    </td>
                    <td>
                      <span className={`capacity__verdict capacity__verdict--${r.status}`}>{r.status}</span>
                      {r.busesToAdd > 0 && <span className="capacity__verdict-add">+{r.busesToAdd}</span>}
                    </td>
                    <td className="capacity__num">{fmtThb(r.missedThb)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Live fleet snapshot ───────────────────────────────────────── */}
      <section className="capacity__panel">
        <header className="capacity__panel-head">
          <h2>{source === "live" ? "Live fleet" : "Fleet snapshot"}</h2>
          <span className="capacity__panel-meta">
            {source === "live" ? `${liveReporting.length} reporting · ${liveMoving.length} moving · top 12` : `${operatorFleet.length} buses in service`}
          </span>
        </header>
        <table className="capacity__fleet-table">
          <thead>
            <tr>
              <th>Plate</th>
              <th>Route</th>
              <th>Heading</th>
              <th className="capacity__num">km/h</th>
              <th className="capacity__num">Load</th>
              <th>State</th>
              <th>Last seen (BKK)</th>
            </tr>
          </thead>
          <tbody>
            {source === "live" ? (
              liveBuses.slice(0, 12).map((bus) => {
                const ageSec = Math.max(0, Math.round((now - Date.parse(bus.updatedAt)) / 1000));
                const isFresh = ageSec * 1000 <= FRESH_FIX_MS;
                const state = !isFresh ? "stale" : bus.speedKph > 4 ? "in_transit" : "dwelling";
                return (
                  <tr key={bus.plate} className={`capacity__fleet-row capacity__fleet-row--${state}`}>
                    <td><strong>{bus.plate}</strong></td>
                    <td>{bus.routeId ?? <span className="capacity__dim">identifying</span>}</td>
                    <td>{bus.destination || <span className="capacity__dim">—</span>}</td>
                    <td className="capacity__num">{bus.speedKph.toFixed(0)}</td>
                    <td className="capacity__num">{bus.paxOnBoard ?? <span className="capacity__dim">—</span>}</td>
                    <td><span className={`capacity__state capacity__state--${state}`}>{state}</span></td>
                    <td>{bkkTime(bus.updatedAt)}</td>
                  </tr>
                );
              })
            ) : (
              operatorFleet.slice(0, 12).map((row) => (
                <tr key={row.vehicleId} className={`capacity__fleet-row capacity__fleet-row--${row.status.toLowerCase()}`}>
                  <td><strong>{row.plate}</strong></td>
                  <td>{row.routeId}</td>
                  <td>{row.direction}</td>
                  <td className="capacity__num">{row.tripProgressPct ?? 0}%</td>
                  <td className="capacity__num">{row.load}/{row.capacity} ({row.loadPct}%)</td>
                  <td><span className={`capacity__state capacity__state--${row.status.toLowerCase()}`}>{row.status}</span></td>
                  <td>{row.etaMin !== null ? `ETA ${row.etaMin}m` : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <footer className="capacity__footer">
        <span>
          <strong>{dayInfo.label}</strong> · {fmtN(headline.fleet.totalBuses)} in fleet · {fmtN(headline.fleet.movingBuses)} rolling · {fmtN(simState.paxBoarded)} boarded · {fmtThb(simState.revenueThb)} earned · {fmtThb(simState.lostRevenueThb)} missed · {fmtThb(debrief.earnedThb - debrief.missedThb)} net
        </span>
        <span className="capacity__footer-detail">
          One engine · <code>src/engine/demandSupplyEngine.ts</code> · every number traces back · source: {source === "live" ? "real tracker" : "timetable + flight demand model"}
        </span>
      </footer>
    </div>
  );
}
