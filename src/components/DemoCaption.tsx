import { useEffect, useState } from "react";
import { simNow } from "../engine/simulation";

/**
 * Auto-play caption overlay used by `?demo=tuesday`. Reads the simulated
 * clock and shows a fixed caption when sim time enters one of the
 * scripted windows. Designed to run on its own — the presenter can talk
 * over the demo without driving the UI.
 */

type Caption = {
  /** Sim minute when the caption appears. */
  fromMin: number;
  /** Sim minute when it disappears (next caption's fromMin or +60). */
  toMin: number;
  /** English narration. Single line. Mono font. */
  text: string;
};

// 08:00 → 22:00 in 5 real minutes. Anchored at 08:00 so the very first
// bus departure (08:15 sim) hits within ~5 real seconds of demo start —
// no dead-zone, action begins immediately.
const SCRIPT: Caption[] = [
  { fromMin: 480, toMin: 510, text: "08:00 — Bus กข 1001 prepares to leave the airport. Fares set at ฿100 vs ฿800 by Grab." },
  { fromMin: 510, toMin: 555, text: "08:30 — First bus departs. 21 boarded. Second bus loading at gate 6." },
  { fromMin: 555, toMin: 615, text: "09:15 — Morning rush hits. 4 buses on the Airport-Patong corridor. Demand exceeds supply." },
  { fromMin: 615, toMin: 690, text: "10:15 — Capture rate holds at 12%. Each tourist who chose the bus saved an average of ฿620." },
  { fromMin: 690, toMin: 780, text: "11:30 — Right bar climbing past ฿14k revenue and 96 kg CO₂ avoided." },
  { fromMin: 780, toMin: 870, text: "13:00 — A China Southern charter from Guangzhou adds 234 pax. Day-of-week patterns reshape the schedule." },
  { fromMin: 870, toMin: 990, text: "14:30 — Buses follow real road geometry, no shortcut diagonals across landmarks." },
  { fromMin: 990, toMin: 1080, text: "16:30 — Evening peak. Patong corridor saturates. On-demand dispatch unlocks the next 10% of capture." },
  { fromMin: 1080, toMin: 1200, text: "18:00 — Dinner rush. Drivers swap shifts at the terminals." },
  { fromMin: 1200, toMin: 1320, text: "20:00 — Day winds down. Last airport-bound bus on its return leg." },
  { fromMin: 1320, toMin: 1320 + 9999, text: "22:00 — Today's totals: ฿182M annual projection · 1,400 t CO₂ avoided · payback in 11 months." }
];

export function DemoCaption() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 500);
    return () => clearInterval(id);
  }, []);

  const now = simNow();
  void tick;
  const active = SCRIPT.find((c) => now >= c.fromMin && now < c.toMin);

  return (
    <>
      {/* Persistent banner — buyer always knows they're watching the auto-loop. */}
      <div className="demo-banner" aria-hidden="true">
        <span className="demo-banner__dot" />
        <span className="demo-banner__label">AUTO-PLAY DEMO</span>
        <span className="demo-banner__sub">Tuesday in October · 5-min loop · {Math.floor(now / 60)}:{String(Math.floor(now % 60)).padStart(2, "0")}</span>
      </div>
      {active && (
        <div className="demo-caption" role="status" aria-live="polite">
          <span className="demo-caption__bar" />
          <span className="demo-caption__text">{active.text}</span>
        </div>
      )}
    </>
  );
}

/** Linear sim-clock function: maps real elapsed seconds to sim minutes
 *  spanning 08:00 → 22:00 over 5 real minutes (300 sec). When the demo
 *  loop completes, it wraps back to 08:00. */
export function buildTuesdayDemoClock() {
  const startReal = Date.now();
  const SCRIPT_REAL_SECONDS = 300;
  const SIM_START = 480; // 08:00 — past the dead zone
  const SIM_END = 1320;  // 22:00
  const SIM_SPAN = SIM_END - SIM_START;
  return function simulatedMinutes(): number {
    const elapsedSec = (Date.now() - startReal) / 1000;
    const cycle = elapsedSec % SCRIPT_REAL_SECONDS;
    const progress = cycle / SCRIPT_REAL_SECONDS;
    return SIM_START + progress * SIM_SPAN;
  };
}
