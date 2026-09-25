import type { LiveFeedStatus, LiveOpsSummary } from "../../engine/liveOps";

const ROUTE_SHORT: Record<string, string> = {
  "rawai-airport": "Airport line",
  "patong-old-bus-station": "Patong line",
  "dragon-line": "Dragon line",
};

function seen(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  return `${Math.floor(sec / 3600)}h`;
}

function emptyMessage(status: LiveFeedStatus, detail: string | null): string {
  switch (status) {
    case "connecting": return "Connecting to the PKSB tracker…";
    case "quiet": return "Tracker connected — no bus has reported a fix in the last 3 minutes.";
    case "unconfigured": return detail ?? "The tracker relay needs its token configured.";
    case "offline": return `Tracker unreachable${detail ? ` — ${detail}` : ""}.`;
    default: return "No buses reporting.";
  }
}

/** One row per real bus: where it's heading, when it last reported, and what
 *  today's observed trips are worth at the model's load for each run. */
export function LiveFleetPanel({ summary, status, detail }: { summary: LiveOpsSummary; status: LiveFeedStatus; detail: string | null }) {
  const { rows } = summary;
  return (
    <div className="v2-fleet v2-fleet--live">
      <header className="v2-fleet__head">
        <div>
          <span className="v2-fleet__eyebrow">Fleet · live GPS</span>
          <strong className="v2-fleet__title">
            {summary.busesReporting} reporting · {summary.busesMoving} moving
          </strong>
          <span className="v2-fleet__sub">
            Trips &amp; km observed · riders &amp; ฿ estimated per run
          </span>
        </div>
      </header>

      <div className="v2-fleet__list" role="list">
        <div className="v2-fleet__row v2-fleet__row--live v2-fleet__row--header" aria-hidden="true">
          <span>Bus</span>
          <span>Heading to</span>
          <span>Speed</span>
          <span>Seen</span>
          <span>Trips</span>
          <span>Km</span>
          <span>฿ est.</span>
        </div>
        {rows.map((row) => (
          <div role="listitem" key={row.plate} className={`v2-fleet__row v2-fleet__row--live ${row.reporting ? "" : "is-silent"}`}>
            <span className="v2-fleet__plate-live">{row.plate}</span>
            <span className="v2-fleet__route">
              <span className="v2-fleet__route-tag">{ROUTE_SHORT[row.routeId] ?? row.routeId}</span>
              <span className="v2-fleet__route-dir">→ {row.destination || "—"}</span>
            </span>
            <span className="v2-fleet__num">{row.reporting ? `${row.speedKph} km/h` : "—"}</span>
            <span className="v2-fleet__num" title={row.reporting ? "Last fix" : "Not reporting — last fix"}>{seen(row.lastSeenSec)}</span>
            <span className="v2-fleet__num">{row.trips}</span>
            <span className="v2-fleet__num">{row.km.toFixed(1)}</span>
            <span className="v2-fleet__num v2-fleet__num--money">฿{row.fareThb.toLocaleString()}</span>
          </div>
        ))}
        {rows.length === 0 && <div className="v2-fleet__empty">{emptyMessage(status, detail)}</div>}
      </div>
    </div>
  );
}
