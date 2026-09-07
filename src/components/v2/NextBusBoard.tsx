/**
 * NextBusBoard — the departure board for the Airport Line.
 *
 * One row per landmark stop; two cells per row: the next bus heading south
 * (Airport → Rawai) and the next bus heading north (Rawai → Airport). Each
 * cell is a wait in minutes you can read from across the room, and under it
 * the proof: which bus, and where it is on the road right now.
 *
 * In LIVE mode the clock is Bangkok wall time, so these waits are a real
 * projection off the published PKSB timetable — the same thing a GPS feed
 * will sharpen, not replace. In replay they are the simulated day's waits.
 */

import { useMemo } from "react";
import { getAirportLineArrivalBoard, type StopArrivalProjection } from "../../engine/fleetSimulator";

const BOARD_STOPS = [
  { key: "airport", label: "Phuket Airport", southId: "phuket-airport", northId: "phuket-airport" },
  { key: "surin", label: "Surin Beach", southId: "surin-beach", northId: "surin-beach" },
  { key: "kamala", label: "Kamala · Big C", southId: "bigc-kamala", northId: "bigc-kamala" },
  { key: "patong", label: "Patong", southId: "pea-patong", northId: "bangla-patong" },
  { key: "karon", label: "Karon Circle", southId: "karon-circle", northId: "karon-circle" },
  { key: "kata", label: "Kata Night Plaza", southId: "kata-night-plaza", northId: "kata-night-plaza" },
  { key: "rawai", label: "Rawai Beach", southId: "rawai-beach", northId: "rawai-beach" },
];

interface Props {
  simMinutes: number;
  live: boolean;
  focusedVehicleId?: string | null;
  onFocusVehicle?: (id: string | null, pinned: boolean) => void;
}

function fmtClock(min: number) {
  const h = Math.floor(min / 60) % 24;
  const m = Math.floor(min % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function fmtKm(m: number) {
  return m < 950 ? `${Math.round(m / 50) * 50} m` : `${(m / 1000).toFixed(1)} km`;
}

function plateShort(plate: string | null) {
  return plate ? plate.replace(" ภูเก็ต", "") : "";
}

function Cell({
  p,
  terminus,
  focused,
  onFocus,
}: {
  p: StopArrivalProjection | null;
  terminus: boolean;
  focused: boolean;
  onFocus?: (id: string | null, pinned: boolean) => void;
}) {
  if (!p) return <span className="ax-bus__cell ax-bus__cell--none">—</span>;
  const wait = Math.round(p.waitMin);
  const tone = p.tomorrow ? "closed" : wait <= 5 ? "soon" : wait <= 20 ? "ok" : "long";
  const proof = p.tomorrow
    ? `first bus ${fmtClock(p.projectedMin)}`
    : !p.departed
      ? terminus
        ? `boards ${fmtClock(p.scheduledMin)}${p.plate ? ` · ${plateShort(p.plate)}` : ""}`
        : `leaves origin ${fmtClock(p.tripStartMin)}`
      : p.distanceM != null && p.plate
        ? `${plateShort(p.plate)} · ${fmtKm(p.distanceM)} away`
        : `${plateShort(p.plate) || "bus"} on the road`;
  const clickable = Boolean(p.vehicleId && onFocus);
  return (
    <button
      type="button"
      className={`ax-bus__cell ax-bus__cell--${tone} ${focused ? "is-focused" : ""} ${clickable ? "is-clickable" : ""}`}
      disabled={!clickable}
      onClick={() => clickable && onFocus?.(p.vehicleId, true)}
      onMouseEnter={() => clickable && onFocus?.(p.vehicleId, false)}
      onMouseLeave={() => clickable && onFocus?.(null, false)}
      title={`Timetable ${fmtClock(p.scheduledMin)} · projected ${fmtClock(p.projectedMin)}${p.lastBus ? " · last bus today" : ""}`}
    >
      <span className="ax-bus__wait">
        {p.tomorrow ? (
          <><strong className="ax-num ax-num--md">{fmtClock(p.projectedMin)}</strong></>
        ) : (
          <><strong className="ax-num ax-num--md">{wait}</strong><small>min</small></>
        )}
      </span>
      <span className="ax-bus__proof">{proof}{p.lastBus ? " · last" : ""}</span>
    </button>
  );
}

export function NextBusBoard({ simMinutes, live, focusedVehicleId = null, onFocusVehicle }: Props) {
  // Re-derive once per whole minute — waits are integers, and this keeps the
  // 4 Hz coarse render from recomputing the fleet for nothing.
  const minuteKey = Math.floor(simMinutes);
  const rows = useMemo(() => getAirportLineArrivalBoard(simMinutes, BOARD_STOPS), [minuteKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="ax-bus" aria-label="Next bus at each stop">
      <header className="ax-bus__head">
        <div>
          <span className="ax-eyebrow">Next bus · Airport Line · {live ? "live, Bangkok time" : "replay"}</span>
          <h2 className="ax-h2">How long is the wait?</h2>
        </div>
      </header>
      <div className="ax-bus__grid" role="table">
        <div className="ax-bus__hrow" role="row">
          <span role="columnheader">Stop</span>
          <span role="columnheader"><b>▼</b> to Rawai</span>
          <span role="columnheader"><b>▲</b> to Airport</span>
        </div>
        {rows.map((r) => (
          <div key={r.key} className="ax-bus__row" role="row">
            <span className="ax-bus__stop" role="rowheader">{r.stopName}</span>
            <Cell
              p={r.south}
              terminus={r.key === "airport"}
              focused={Boolean(r.south?.vehicleId && r.south.vehicleId === focusedVehicleId)}
              onFocus={onFocusVehicle}
            />
            <Cell
              p={r.north}
              terminus={r.key === "rawai"}
              focused={Boolean(r.north?.vehicleId && r.north.vehicleId === focusedVehicleId)}
              onFocus={onFocusVehicle}
            />
          </div>
        ))}
      </div>
      <p className="ax-bus__note">
        PKSB published timetable · bus position from the road model · hover a wait to find that bus on the map
      </p>
    </section>
  );
}
