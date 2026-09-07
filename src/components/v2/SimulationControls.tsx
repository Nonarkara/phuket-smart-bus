/**
 * Time controls — one row, four labelled groups, read left to right:
 *
 *   MODE      DAY                       CLOCK                      SPEED
 *   ● LIVE    MON TUE WED THU FRI SAT SUN   ⏸  ──────●─────  14:32   1× 10× 30× 60×  ▶ WHOLE DAY
 *
 * Rules that make it self-explaining:
 *   · exactly one thing in each group is lit, and it is always the truth —
 *     the lit speed chip IS the engine's speed (the old bar defaulted to a
 *     speed that had no chip, so nothing was lit and nothing made sense);
 *   · LIVE is a mode, not a speed: buses sit where the published timetable
 *     puts them at this Bangkok minute, and the wait board projects from it;
 *   · touching a day, the slider or a speed leaves LIVE and says so — the
 *     LIVE lamp goes out, the REPLAY label lights.
 */

import { useEffect, useState } from "react";
import {
  getSimulatedMinutes,
  setSimulatedMinutes,
  pause,
  togglePlayPause,
  setSpeed,
  getClockState,
  DAY_SPEED,
  SERVICE_START,
  SERVICE_END,
} from "../../engine/fleetSimulator";

function formatSimTime(minutes: number) {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.floor(minutes % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** 10× is the engine default (SIM_SPEED) — it MUST be a chip, or the bar
 *  opens with no speed lit. */
export const SPEED_OPTIONS = [1, 10, 30, 60];

// Display order MON..SUN; values are JS getDay() codes.
const DAY_OPTIONS = [
  { dow: 1, label: "MON" },
  { dow: 2, label: "TUE" },
  { dow: 3, label: "WED" },
  { dow: 4, label: "THU" },
  { dow: 5, label: "FRI" },
  { dow: 6, label: "SAT" },
  { dow: 0, label: "SUN" },
];

export type ClockStateView = { mode: "live" | "playing" | "paused"; speed: number; sweep: boolean };

interface SimulationControlsProps {
  clockState: ClockStateView;
  onClockStateChange: (state: ClockStateView) => void;
  simDay: number;
  onDayChange: (dow: number) => void;
  onStartDaySweep: () => void;
  onGoLive: () => void;
}

export function SimulationControls({
  clockState,
  onClockStateChange,
  simDay,
  onDayChange,
  onStartDaySweep,
  onGoLive,
}: SimulationControlsProps) {
  const [sliderValue, setSliderValue] = useState(getSimulatedMinutes());

  // Animate slider thumb while playing (polled locally at 100ms)
  useEffect(() => {
    const id = setInterval(() => {
      setSliderValue(getSimulatedMinutes());
    }, 100);
    return () => clearInterval(id);
  }, []);

  const isLive = clockState.mode === "live";
  const isPaused = clockState.mode === "paused";
  const sweeping = clockState.sweep && clockState.speed === DAY_SPEED;
  const sliderMin = Math.min(SERVICE_START, Math.floor(sliderValue));
  const sliderMax = Math.max(SERVICE_END, Math.ceil(sliderValue));

  return (
    <div className={`v2-timebar ax-time ${isLive ? "is-live" : "is-replay"}`} role="group" aria-label="Time controls">
      {/* MODE */}
      <div className="ax-time__group ax-time__group--mode">
        <span className="ax-time__label">Mode</span>
        <div className="ax-time__row">
          <button
            type="button"
            className={`ax-time__live ${isLive ? "is-active" : ""}`}
            onClick={onGoLive}
            aria-pressed={isLive}
            title="Follow the Bangkok clock. Buses are where the PKSB timetable puts them right now."
          >
            <span className="ax-time__lamp" aria-hidden="true" />
            LIVE
          </button>
          <span className={`ax-time__replay ${isLive ? "" : "is-active"}`} aria-hidden={isLive}>REPLAY</span>
        </div>
      </div>

      {/* DAY */}
      <div className="ax-time__group ax-time__group--day">
        <span className="ax-time__label">{isLive ? "Today" : "Replay day"}</span>
        <div className="ax-time__row v2-timebar__days">
          {DAY_OPTIONS.map((d) => (
            <button
              key={d.dow}
              type="button"
              className={`ax-time__chip ${simDay === d.dow ? "is-active" : ""}`}
              onClick={() => onDayChange(d.dow)}
              title={`Replay ${d.label} from 05:30 — deterministic day-of-week schedule`}
              aria-pressed={simDay === d.dow}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* CLOCK */}
      <div className="ax-time__group ax-time__group--clock">
        <span className="ax-time__label">{isLive ? "Bangkok time" : isPaused ? "Paused at" : "Replaying"}</span>
        <div className="ax-time__row">
          <button
            type="button"
            className={`ax-time__play ${isPaused ? "is-paused" : ""}`}
            onClick={() => {
              togglePlayPause();
              onClockStateChange(getClockState());
            }}
            title={isPaused ? "Play" : "Pause"}
            aria-label={isPaused ? "Play simulation" : "Pause simulation"}
          >
            {isPaused ? "▶" : "⏸"}
            <span className="ax-time__play-word">{isPaused ? "PLAY" : "PAUSE"}</span>
          </button>
          <input
            type="range"
            className="v2-timebar__slider ax-time__slider"
            min={sliderMin}
            max={sliderMax}
            step={1}
            value={sliderValue}
            aria-label="Simulation time"
            title="Drag to any minute of the day (leaves LIVE)"
            onChange={(e) => {
              const val = Number(e.target.value);
              setSliderValue(val);
              setSimulatedMinutes(val);
              pause();
              onClockStateChange(getClockState());
            }}
          />
          <span className="v2-timebar__label ax-time__clock">{formatSimTime(sliderValue)}</span>
        </div>
      </div>

      {/* SPEED */}
      <div className="ax-time__group ax-time__group--speed">
        <span className="ax-time__label">Speed</span>
        <div className="ax-time__row v2-timebar__speeds">
          {SPEED_OPTIONS.map((s) => {
            const active = !isLive && !sweeping && clockState.speed === s;
            return (
              <button
                key={s}
                type="button"
                className={`ax-time__chip ${active ? "is-active" : ""}`}
                onClick={() => {
                  setSpeed(s);
                  onClockStateChange(getClockState());
                }}
                aria-pressed={active}
                title={s === 1 ? "Real time" : `${s} simulated minutes per real minute`}
              >
                {s}×
              </button>
            );
          })}
          <button
            type="button"
            className={`ax-time__chip ax-time__chip--sweep ${sweeping ? "is-active" : ""}`}
            onClick={onStartDaySweep}
            aria-pressed={sweeping}
            title="Replay the whole service day (05:30 → 22:30) in about one minute, then stop on the totals"
          >
            ▶ WHOLE DAY · 60s
          </button>
        </div>
      </div>
    </div>
  );
}
