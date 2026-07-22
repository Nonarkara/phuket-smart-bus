import { useMemo, useState } from "react";
import { Counter } from "./V2Shared";
import type { OperatorFleetRow, BusProblem } from "../../engine/v2OpsPanel";
import { getDriverProfile } from "../../engine/driverRoster";
import { getDriverDayRecord } from "../../engine/driverStats";
import { DriverProfileSheet } from "./DriverProfileSheet";

interface OperatorFleetPanelProps {
  rows: OperatorFleetRow[];
  waitingAtCurb: number;
}

type Filter = "all" | "issues" | "moving" | "idle";

const PROBLEM_LABEL: Record<NonNullable<BusProblem>, string> = {
  STUCK: "STUCK",
  RUNNING_EMPTY: "EMPTY + WAIT",
  IDLE_QUEUED: "EMPTY AT HUB",
  FULL: "FULL"
};

const PROBLEM_DESC: Record<NonNullable<BusProblem>, string> = {
  STUCK: "Stopped mid-trip while queue keeps building",
  RUNNING_EMPTY: "Bus running empty past waiting passengers",
  IDLE_QUEUED: "Empty bus at airport, queue building",
  FULL: "Bus at ≥92% capacity"
};

/**
 * Per-vehicle operations panel.
 *
 * Each row shows: driver face + name, plate, route, status, load bar, ETA.
 * Click / Enter opens the driver dossier (sim-derived day record).
 */
export function OperatorFleetPanel({ rows, waitingAtCurb }: OperatorFleetPanelProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    switch (filter) {
      case "issues": return rows.filter((r) => r.problem !== null);
      case "moving": return rows.filter((r) => r.status === "MOVING");
      case "idle": return rows.filter((r) => r.status !== "MOVING");
      default: return rows;
    }
  }, [rows, filter]);

  const problemCounts = useMemo(() => {
    const counts = { STUCK: 0, RUNNING_EMPTY: 0, IDLE_QUEUED: 0, FULL: 0 };
    for (const r of rows) {
      if (r.problem) counts[r.problem] += 1;
      else if (r.full) counts.FULL += 1;
    }
    return counts;
  }, [rows]);

  const selectedRecord = selectedVehicleId ? getDriverDayRecord(selectedVehicleId) : null;

  const headerCount = rows.length;
  const issueCount = rows.filter((r) => r.problem !== null).length;

  return (
    <div className="v2-fleet">
      <header className="v2-fleet__head">
        <div>
          <span className="v2-fleet__eyebrow">Fleet Operations</span>
          <strong className="v2-fleet__title">
            <Counter value={headerCount} /> buses in service
            {issueCount > 0 && (
              <span className="v2-fleet__problem-flag" title={`${issueCount} bus${issueCount === 1 ? "" : "es"} need attention`}>
                {issueCount} FLAG{issueCount === 1 ? "" : "S"}
              </span>
            )}
          </strong>
          <span className="v2-fleet__sub">
            {waitingAtCurb > 0
              ? `${waitingAtCurb} pax waiting at curb · click a driver for today's record`
              : "Curb queue clear · click a driver for today's record"}
          </span>
        </div>
        <div className="v2-fleet__chips" role="toolbar" aria-label="Filter fleet">
          {(["all", "issues", "moving", "idle"] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              className={`v2-fleet__chip ${filter === f ? "is-active" : ""}`}
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
            >
              {f === "all" ? `All ${headerCount}` : f === "issues" ? `Issues ${issueCount}` : f === "moving" ? `Moving ${rows.filter((r) => r.status === "MOVING").length}` : `Idle ${rows.filter((r) => r.status !== "MOVING").length}`}
            </button>
          ))}
        </div>
      </header>

      {(issueCount > 0 || problemCounts.FULL > 0) && (
        <div className="v2-fleet__problems">
          {problemCounts.STUCK > 0 && <span className="v2-fleet__problem-pill v2-fleet__problem-pill--stuck">{problemCounts.STUCK} STUCK</span>}
          {problemCounts.RUNNING_EMPTY > 0 && <span className="v2-fleet__problem-pill v2-fleet__problem-pill--empty">{problemCounts.RUNNING_EMPTY} EMPTY + WAIT</span>}
          {problemCounts.IDLE_QUEUED > 0 && <span className="v2-fleet__problem-pill v2-fleet__problem-pill--hub">{problemCounts.IDLE_QUEUED} EMPTY AT HUB</span>}
          {problemCounts.FULL > 0 && <span className="v2-fleet__problem-pill v2-fleet__problem-pill--full">{problemCounts.FULL} FULL</span>}
        </div>
      )}

      <div className="v2-fleet__list" role="list">
        <div className="v2-fleet__row v2-fleet__row--header" aria-hidden="true">
          <span>Driver</span>
          <span>Route</span>
          <span>Load</span>
          <span>Status</span>
          <span>ETA</span>
        </div>
        {filtered.map((row) => (
          <FleetRow
            key={row.vehicleId}
            row={row}
            selected={row.vehicleId === selectedVehicleId}
            onSelect={() => setSelectedVehicleId(row.vehicleId)}
          />
        ))}
        {filtered.length === 0 && (
          <div className="v2-fleet__empty">No buses match the current filter.</div>
        )}
      </div>

      <DriverProfileSheet
        record={selectedRecord}
        onClose={() => setSelectedVehicleId(null)}
      />
    </div>
  );
}

function FleetRow({
  row,
  selected,
  onSelect,
}: {
  row: OperatorFleetRow;
  selected: boolean;
  onSelect: () => void;
}) {
  const driver = getDriverProfile({
    vehicleId: row.vehicleId,
    plate: row.plate,
    routeId: row.routeId,
  });
  const isFull = row.full;
  const loadTone = isFull
    ? "v2-fleet__bar--full"
    : row.loadPct >= 75
      ? "v2-fleet__bar--high"
      : row.loadPct >= 40
        ? "v2-fleet__bar--mid"
        : row.loadPct > 0
          ? "v2-fleet__bar--low"
          : "v2-fleet__bar--empty";
  const eta = row.etaMin == null ? "—" : row.etaMin < 0 ? `+${-row.etaMin}` : `${row.etaMin}m`;
  const dir = row.direction || "—";
  const routeShort = row.routeId === "rawai-airport"
    ? "Airport→"
    : row.routeId === "patong-old-bus-station"
      ? "Patong→"
      : row.routeId === "dragon-line"
        ? "Dragon"
        : row.routeId;
  const plateShort = row.plate.replace(" ภูเก็ต", "");

  return (
    <div
      role="listitem"
      className={`v2-fleet__row v2-fleet__row--clickable ${row.problem ? "has-problem" : ""} ${isFull && !row.problem ? "is-full" : ""} ${selected ? "is-selected" : ""}`}
      title={`${driver.nameEn} · ${row.summary} · Open driver dossier`}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <span className="v2-fleet__driver">
        <img className="v2-fleet__face" src={driver.faceDataUri} alt="" width={28} height={28} />
        <span className="v2-fleet__driver-text">
          <span className="v2-fleet__driver-name">{driver.nameTh}</span>
          <span className="v2-fleet__plate">{plateShort}</span>
        </span>
      </span>
      <span className="v2-fleet__route">
        <span className="v2-fleet__route-tag">{routeShort}</span>
        <span className="v2-fleet__route-dir">{dir.replace("Bus to ", "→ ")}</span>
        {row.tripProgressPct != null && (
          <span className="v2-fleet__route-progress" aria-label="position on route" title={`${row.tripProgressPct}% through trip`}>
            <span className="v2-fleet__route-progress-fill" style={{ width: `${row.tripProgressPct}%` }} />
          </span>
        )}
      </span>
      <span className="v2-fleet__load">
        <span className={`v2-fleet__bar ${loadTone}`}>
          <span className="v2-fleet__bar-fill" style={{ width: `${Math.min(100, row.loadPct)}%` }} />
        </span>
        <span className="v2-fleet__load-num">
          {row.load}/{row.capacity}
          {isFull && !row.problem && <span className="v2-fleet__full-tag" title="Bus at capacity">FULL</span>}
        </span>
      </span>
      <span className={`v2-fleet__status v2-fleet__status--${row.status.toLowerCase()}`}>{row.status.replace("_", " ")}</span>
      <span className="v2-fleet__eta">{eta}</span>
      {row.problem && (
        <span
          className={`v2-fleet__prob v2-fleet__prob--${row.problem.toLowerCase()}`}
          title={PROBLEM_DESC[row.problem] + " · " + row.problemDetail}
        >
          {PROBLEM_LABEL[row.problem]}
          <span className="v2-fleet__prob-detail">{row.problemDetail}</span>
        </span>
      )}
    </div>
  );
}
