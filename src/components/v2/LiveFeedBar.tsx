import type { LiveFeedStatus } from "../../engine/liveOps";

function hhmm(min: number): string {
  return `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(Math.floor(min % 60)).padStart(2, "0")}`;
}

type Props = {
  status: LiveFeedStatus;
  detail: string | null;
  feedAgeSec: number | null;
  busesReporting: number;
  observedSinceMin: number | null;
  onOpenDevices: () => void;
};

/** Replaces the replay timebar in LIVE: no scrubber, no speeds — the clock is
 *  the real one. Says plainly where the numbers come from and how fresh they are. */
export function LiveFeedBar({ status, detail, feedAgeSec, busesReporting, observedSinceMin, onOpenDevices }: Props) {
  const headline =
    status === "live" ? `${busesReporting} bus${busesReporting === 1 ? "" : "es"} reporting`
      : status === "quiet" ? "Tracker connected · no bus reporting now"
        : status === "connecting" ? "Connecting to the PKSB tracker…"
          : status === "unconfigured" ? "Tracker relay not configured"
            : "Tracker unreachable";

  return (
    <div className={`v2-timebar v2-livebar v2-livebar--${status}`} role="status">
      <span className="v2-livebar__dot" aria-hidden="true" />
      <strong className="v2-livebar__headline">{headline}</strong>
      {feedAgeSec !== null && <span className="v2-livebar__meta">feed {feedAgeSec}s old</span>}
      {observedSinceMin !== null && <span className="v2-livebar__meta">observed since {hhmm(observedSinceMin)}</span>}
      {(status === "unconfigured" || status === "offline") && detail && <span className="v2-livebar__meta v2-livebar__meta--warn">{detail}</span>}
      <span className="v2-livebar__basis">Trips &amp; km: GPS · Riders &amp; ฿: trip × modelled load per run</span>
      <button type="button" className="v2-timebar__speed" onClick={onOpenDevices} title="Direct GPS device ingest console">
        DEVICES
      </button>
    </div>
  );
}
