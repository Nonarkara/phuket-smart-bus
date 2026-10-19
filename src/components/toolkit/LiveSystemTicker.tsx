/**
 * LiveSystemTicker — a small persistent badge that shows two things at once,
 * and never conflates them.
 *
 *  LIVE      the real Phuket Smart Bus fleet, as the trackers report it.
 *            Positions, age of the last fix, how many buses are moving.
 *            Sourced from /api/live-buses via the liveOps ledger.
 *
 *  SIMULATED this page's own demand-supply model, on a 30x clock, used for
 *            bus-planning questions ("what would an extra bus at 14:00 be
 *            worth?"). Every figure in this half is modelled, and says so.
 *
 * Before 2026-10-20 this badge showed ONLY the simulation, under a "Live ·
 * bus.nonarkara.org/ops" kicker. That was a model wearing a live label: the
 * number was computed in the reader's browser and had nothing to do with
 * bus.nonarkara.org. The clock now reads the real Bangkok wall clock, the
 * pill counts real buses, and the modelled half keeps its own label.
 *
 * The live half says "unavailable" when the feed is down. It never shows a
 * zero it did not measure.
 *
 * The panel is a disclosure, not a tooltip. Hover previews it; a click PINS
 * it so a reader can move the mouse away and still read it. Escape or a
 * click outside closes it. (Before, `onFocus` set it open and `onClick` set
 * it closed in the same gesture, and the panel was only ever visible while
 * hovered — so the reader moved the mouse to read it and it vanished.)
 */

import { useEffect, useRef, useState } from "react";
import { getHourlyCorridor } from "../../engine/demandSupplyEngine";
import { getSimulatedMinutes } from "../../engine/fleetSimulator";
import { getBangkokNowFractionalMinutes } from "../../engine/time";
import { getLiveFeedState, startLiveFeed, subscribeLiveFeed } from "../../engine/liveOps";

function formatTHB(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `฿${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `฿${Math.round(n / 1_000)}k`;
  return `฿${Math.round(n)}`;
}

function formatClock(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = Math.floor(min % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function LiveSystemTicker() {
  // The real clock, on Bangkok wall time.
  const [wallMin, setWallMin] = useState(() => getBangkokNowFractionalMinutes());
  // The simulation clock, for the modelled half only.
  const [simMin, setSimMin] = useState(() => getSimulatedMinutes());
  // A counter that changes whenever the live ledger changes.
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setWallMin(getBangkokNowFractionalMinutes());
      setSimMin(getSimulatedMinutes());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const stop = startLiveFeed();
    const unsub = subscribeLiveFeed(() => setTick((n) => n + 1));
    return () => {
      unsub();
      stop();
    };
  }, []);

  // Fixed-position badges sit on top of whatever page content happens to
  // scroll under that corner. Two mitigations: stay hidden over the hero
  // (nothing to hide from before that), and stay collapsed to a small pill
  // the rest of the time — expand only on hover/click, so it covers a
  // sentence at most, never a whole card.
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 480);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Pinned open by a click. Not a focus flag: focus and click fired in the
  // same gesture and fought each other.
  const [expanded, setExpanded] = useState(false);
  const asideRef = useRef<HTMLElement | null>(null);

  // A click outside dismisses. The pill's own click is inside the aside, so
  // it never closes the panel it just opened.
  useEffect(() => {
    if (!expanded) return;
    const onDown = (e: PointerEvent) => {
      if (!asideRef.current?.contains(e.target as Node)) setExpanded(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [expanded]);

  // ── the real half ───────────────────────────────────────────────────────
  const feed = getLiveFeedState();
  const liveOk = feed.status === "live" || feed.status === "quiet";
  const reporting = feed.summary.busesReporting;
  const moving = feed.summary.busesMoving;
  const feedAge = feed.feedAgeSec;

  // ── the modelled half ───────────────────────────────────────────────────
  const hour = Math.floor(simMin / 60) % 24;
  const corridor = getHourlyCorridor();
  const h = corridor[hour] ?? corridor[0];
  const totalMissedPax = h.abandonedPax + h.outLostPax;
  const totalMissedThb = h.missedThb;
  const isServiceWindow = h.demandPax + h.outDemandPax > 0;
  const isAlert = isServiceWindow && totalMissedPax > 0;

  const liveLine = liveOk
    ? feedAge === null
      ? "feed connecting"
      : `feed ${feedAge < 90 ? `${feedAge}s old` : `${Math.round(feedAge / 60)} min old`}`
    : feed.status === "connecting"
      ? "connecting"
      : "feed unavailable";

  return (
    <aside
      ref={asideRef}
      className={`lst ${visible ? "is-visible" : ""} ${expanded ? "is-expanded" : ""}`}
      aria-hidden={!visible}
    >
      <button
        type="button"
        className="lst__pill"
        aria-expanded={expanded}
        aria-label="Live fleet status and the simulation model — expand for detail"
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setExpanded(false);
            e.currentTarget.blur();
          }
        }}
      >
        <span className={`lst__pulse ${liveOk ? "" : "is-off"}`} aria-hidden="true" />
        <strong>{formatClock(wallMin)}</strong>
        <span className="lst__pill-missed">
          {liveOk ? `${reporting} bus${reporting === 1 ? "" : "es"}` : "no live feed"}
        </span>
      </button>
      <div className="lst__detail" role="status">
        <div className="lst__clock">
          <span className="lst__kicker">Live · PKSB tracker</span>
          <strong>{liveOk ? `${reporting} reporting` : "unavailable"}</strong>
          <small>
            {liveOk ? `${moving} moving · ${liveLine}` : "the tracker did not answer"}
          </small>
        </div>
        <div className="lst__metric">
          <span className="lst__kicker">Simulated · this page’s model</span>
          <strong className={isAlert ? "is-alert" : ""}>
            {isServiceWindow ? formatTHB(totalMissedThb) : "—"}
          </strong>
          <small>
            {isServiceWindow
              ? `${totalMissedPax} modelled passengers not served in hour ${String(hour).padStart(2, "0")}`
              : "outside the service window"}
          </small>
        </div>
      </div>
    </aside>
  );
}

export default LiveSystemTicker;
