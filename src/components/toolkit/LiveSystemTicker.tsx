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

  const hour = Math.floor(now / 60) % 24;
  const corridor = getHourlyCorridor();
  const h = corridor[hour] ?? corridor[0];
  const totalMissedPax = h.abandonedPax + h.outLostPax;
  const totalMissedThb = h.missedThb;
  const isServiceWindow = h.demandPax + h.outDemandPax > 0;

  return (
    <aside className="lst" aria-label="Live system status">
      <div className="lst__pulse" aria-hidden="true" />
      <div className="lst__clock">
        <span className="lst__kicker">Live · bus.nonarkara.org/ops</span>
        <strong>{formatClock(now)}</strong>
        <small>BKK simulated clock</small>
      </div>
      <div className="lst__metric">
        <span className="lst__kicker">Hour {String(hour).padStart(2, "0")}:00 · missed</span>
        <strong className={isServiceWindow && totalMissedPax > 0 ? "is-alert" : ""}>
          {isServiceWindow ? formatTHB(totalMissedThb) : "—"}
        </strong>
        <small>
          {isServiceWindow
            ? `${totalMissedPax} pax walking away in this hour`
            : "Outside service window"}
        </small>
      </div>
    </aside>
  );
}

export default LiveSystemTicker;
