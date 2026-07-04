import { useEffect, useState } from "react";
import {
  getSimulatedMinutes,
  setSimulatedMinutes,
  pause,
  togglePlayPause,
  setSpeed,
  getClockState,
  SERVICE_START,
  SERVICE_END,
} from "../../engine/fleetSimulator";

function formatSimTime(minutes: number) {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.floor(minutes % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const SPEED_OPTIONS = [1, 5, 15, 30];
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

interface SimulationControlsProps {
  clockState: { mode: "playing" | "paused"; speed: number };
  onClockStateChange: (state: { mode: "playing" | "paused"; speed: number }) => void;
  simDay: number;
  onDayChange: (dow: number) => void;
  onStartDaySweep: () => void;
}

export function SimulationControls({ clockState, onClockStateChange, simDay, onDayChange, onStartDaySweep }: SimulationControlsProps) {
  const [sliderValue, setSliderValue] = useState(getSimulatedMinutes());

  // Animate slider thumb while playing (polled locally at 100ms)
  useEffect(() => {
    const id = setInterval(() => {
      setSliderValue(getSimulatedMinutes());
    }, 100);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="v2-timebar">
      <div className="v2-timebar__days">
        {DAY_OPTIONS.map((d) => (
          <button
            key={d.dow}
            className={`v2-timebar__speed ${simDay === d.dow ? "is-active" : ""}`}
            onClick={() => onDayChange(d.dow)}
            title={`Replay ${d.label} — deterministic day-of-week schedule`}
          >
            {d.label}
          </button>
        ))}
      </div>
      <button
        className="v2-timebar__play"
        onClick={() => {
          togglePlayPause();
          onClockStateChange(getClockState());
        }}
        title={clockState.mode === 'playing' ? 'Pause' : 'Play'}
      >
        {clockState.mode === 'playing' ? '⏸' : '▶'}
      </button>
      <input
        type="range"
        className="v2-timebar__slider"
        min={SERVICE_START}
        max={SERVICE_END}
        step={1}
        value={sliderValue}
        onChange={(e) => {
          const val = Number(e.target.value);
          setSliderValue(val);
          setSimulatedMinutes(val);
          pause();
          onClockStateChange(getClockState());
        }}
      />
      <span className="v2-timebar__label">{formatSimTime(sliderValue)}</span>
      <div className="v2-timebar__speeds">
        <button
          className="v2-timebar__day-sweep"
          onClick={onStartDaySweep}
          title="Replay the whole service day (05:30 → 22:30) in ~60 seconds"
        >
          ▶ DAY · 60s
        </button>
        {SPEED_OPTIONS.map((s) => (
          <button
            key={s}
            className={`v2-timebar__speed ${clockState.speed === s ? 'is-active' : ''}`}
            onClick={() => {
              setSpeed(s);
              onClockStateChange(getClockState());
            }}
          >
            {s}×
          </button>
        ))}
      </div>
    </div>
  );
}
