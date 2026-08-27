/**
 * BusPlanPanel — one bus, its whole trip, on a card you can read in a glance.
 *
 * Opens when the operator hovers a bus on the map; pins on click. It answers
 * the questions a person asks about a single vehicle — how full, where it is
 * along the road, when it arrives, what it has earned — and it draws the load
 * profile of the trip AHEAD, computed from the same engine that positions the
 * bus (getVehiclesNow at future t). Nothing here is new arithmetic: every
 * number is an OperatorFleetRow field or the fare × the row's own load.
 */

import { useMemo } from "react";
import type { OperatorFleetRow } from "../../engine/v2OpsPanel";
import { getVehiclesNow, getSimulatedMinutes } from "../../engine/fleetSimulator";
import { FARE_THB } from "../../engine/demandSupplyEngine";

type Props = {
  row: OperatorFleetRow | null;
  pinned: boolean;
  onClose: () => void;
};

const ROUTE_LABEL: Record<string, string> = {
  "rawai-airport": "Airport Line",
  "patong-old-bus-station": "Patong Line",
  "dragon-line": "Dragon Line",
};

function fmtMin(m: number | null): string {
  if (m == null) return "—";
  if (m <= 0) return "arriving";
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

/** Sample the engine's road position for this vehicle every 5 sim-minutes
 *  from now to its scheduled terminus, and return trip-progress % at each
 *  step. This is the "where will it be" line under the load bar — a plan,
 *  not a guess: the engine already knows. */
function useRoadAhead(row: OperatorFleetRow | null): number[] {
  return useMemo(() => {
    if (!row || row.etaMin == null || row.etaMin <= 0) return [];
    const now = getSimulatedMinutes();
    const steps = Math.min(24, Math.ceil(row.etaMin / 5));
    const out: number[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = now + i * 5;
      const v = getVehiclesNow(undefined, t).find((x) => x.vehicleId === row.vehicleId);
      if (!v || v.distanceToDestinationMeters == null) break;
      // Progress along trip: 0 at start, 100 at terminus. Use remaining
      // distance vs the first sample's remaining distance as the ruler.
      out.push(v.distanceToDestinationMeters);
    }
    if (out.length < 2) return [];
    const start = out[0]!;
    return out.map((d) => (start > 0 ? Math.max(0, Math.min(100, Math.round((1 - d / start) * 100))) : 100));
  }, [row?.vehicleId, row?.etaMin]);
}

export function BusPlanPanel({ row, pinned, onClose }: Props) {
  const ahead = useRoadAhead(row);
  if (!row) return null;

  const earnedThb = row.load * FARE_THB;
  const isBoarding = row.status === "PRE_TRIP" || (row.tripProgressPct != null && row.tripProgressPct <= 2);

  return (
    <aside className={`v2-plan ${pinned ? "is-pinned" : ""}`} aria-live="polite" aria-label={`Bus ${row.plate} plan`}>
      <header className="v2-plan__head">
        <div>
          <span className="v2-plan__kicker">{ROUTE_LABEL[row.routeId] ?? row.routeId} · {row.direction}</span>
          <strong className="v2-plan__plate">{row.plate}</strong>
        </div>
        <span className={`v2-plan__status v2-plan__status--${row.status.toLowerCase()}`}>
          {isBoarding ? "BOARDING" : row.status.replace("_", " ")}
        </span>
        {pinned && (
          <button type="button" className="v2-plan__close" onClick={onClose} aria-label="Unpin">×</button>
        )}
      </header>

      {/* Load — the seat bar. 25 cells, filled left to right. */}
      <div className="v2-plan__load">
        <div className="v2-plan__load-head">
          <span className="v2-plan__label">On board</span>
          <strong className="v2-plan__num">{row.load}<small>/{row.capacity}</small></strong>
        </div>
        <div className="v2-plan__seats" role="img" aria-label={`${row.load} of ${row.capacity} seats taken`}>
          {Array.from({ length: row.capacity }, (_, i) => (
            <i key={i} className={i < row.load ? "is-taken" : ""} />
          ))}
        </div>
      </div>

      {/* The trip: where along the road, how long to go, what it's worth. */}
      <dl className="v2-plan__facts">
        <div>
          <dt>Along the road</dt>
          <dd>{row.tripProgressPct == null ? "—" : `${row.tripProgressPct}%`}</dd>
        </div>
        <div>
          <dt>Terminus in</dt>
          <dd>{fmtMin(row.etaMin)}</dd>
        </div>
        <div>
          <dt>This trip earns</dt>
          <dd>฿{earnedThb.toLocaleString()}</dd>
        </div>
      </dl>

      {/* Road ahead — the plan. A ruler from here to the terminus, sampled from
          the engine at future t. Ticks are 5-minute steps. */}
      {ahead.length > 1 && (
        <div className="v2-plan__ahead" aria-label="Road ahead, five-minute steps">
          <span className="v2-plan__label">Road ahead · 5-min steps</span>
          <div className="v2-plan__ruler">
            <span className="v2-plan__ruler-track" />
            {ahead.map((pct, i) => (
              <i key={i} style={{ left: `${pct}%` }} className={i === 0 ? "is-now" : i === ahead.length - 1 ? "is-end" : ""} />
            ))}
          </div>
          <div className="v2-plan__ruler-ends">
            <span>now</span>
            <span>terminus</span>
          </div>
        </div>
      )}

      {row.problem != null && row.problem !== "FULL" && (
        <p className="v2-plan__flag">{row.problemDetail}</p>
      )}
      {!pinned && <p className="v2-plan__hint">click the bus to pin</p>}
    </aside>
  );
}

export default BusPlanPanel;
