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

interface SimulationControlsProps {
  clockState: { mode: "playing" | "paused"; speed: number };
  onClockStateChange: (state: { mode: "playing" | "paused"; speed: number }) => void;
}

export function SimulationControls({ clockState, onClockStateChange }: SimulationControlsProps) {
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
