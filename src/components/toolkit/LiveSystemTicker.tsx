/**
 * LiveSystemTicker — a small persistent badge in the page that shows the
 * live simulation clock and the current hour's missed money.
 *
 * The point is to keep the research page tied to the live system: a reader
 * who notices this number ticking has proof that the engine is real, not a
 * static slide.
 */

import { useEffect, useState } from "react";
import { getHourlyCorridor } from "../../engine/demandSupplyEngine";
import { getSimulatedMinutes } from "../../engine/fleetSimulator";

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
  const [now, setNow] = useState(() => getSimulatedMinutes());
  useEffect(() => {
    const id = setInterval(() => setNow(getSimulatedMinutes()), 1000);
    return () => clearInterval(id);
  }, []);

  // Fixed-position badges sit on top of whatever page content happens to
  // scroll under that corner. Two mitigations: stay hidden over the hero
  // (nothing to hide from before that), and stay collapsed to a small pill
  // the rest of the time — expand only on hover/focus/tap, so it covers a
  // sentence at most, never a whole card.
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 480);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const [expanded, setExpanded] = useState(false);

  const hour = Math.floor(now / 60) % 24;
  const corridor = getHourlyCorridor();
  const h = corridor[hour] ?? corridor[0];
  const totalMissedPax = h.abandonedPax + h.outLostPax;
  const totalMissedThb = h.missedThb;
  const isServiceWindow = h.demandPax + h.outDemandPax > 0;
  const isAlert = isServiceWindow && totalMissedPax > 0;

  return (
    <aside
      className={`lst ${visible ? "is-visible" : ""} ${expanded ? "is-expanded" : ""}`}
      aria-hidden={!visible}
    >
      <button
        type="button"
        className="lst__pill"
        aria-expanded={expanded}
        aria-label="Live simulation status — expand for detail"
        onClick={() => setExpanded((v) => !v)}
        onFocus={() => setExpanded(true)}
        onBlur={() => setExpanded(false)}
      >
        <span className="lst__pulse" aria-hidden="true" />
        <strong>{formatClock(now)}</strong>
        <span className={`lst__pill-missed ${isAlert ? "is-alert" : ""}`}>
          {isServiceWindow ? formatTHB(totalMissedThb) : "—"}
        </span>
      </button>
      <div className="lst__detail" role="status">
        <div className="lst__clock">
          <span className="lst__kicker">Live · bus.nonarkara.org/ops</span>
          <strong>{formatClock(now)}</strong>
          <small>BKK simulated clock</small>
        </div>
        <div className="lst__metric">
          <span className="lst__kicker">Hour {String(hour).padStart(2, "0")}:00 · missed</span>
          <strong className={isAlert ? "is-alert" : ""}>
            {isServiceWindow ? formatTHB(totalMissedThb) : "—"}
          </strong>
          <small>
            {isServiceWindow
              ? `${totalMissedPax} pax walking away in this hour`
              : "Outside service window"}
          </small>
        </div>
      </div>
    </aside>
  );
}

export default LiveSystemTicker;
