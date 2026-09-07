import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getAirportLineArrivalBoard,
  getClockState,
  getSimulatedMinutes,
  getVehiclesNow,
  goLive,
  isLiveClock,
  pause,
  play,
  setSimulatedMinutes,
  setSpeed,
  SIM_SPEED,
} from "./fleetSimulator";
import { getBangkokNowFractionalMinutes } from "./time";

const STOPS = [
  { key: "airport", label: "Phuket Airport", southId: "phuket-airport", northId: "phuket-airport" },
  { key: "patong", label: "Patong", southId: "pea-patong", northId: "bangla-patong" },
  { key: "rawai", label: "Rawai Beach", southId: "rawai-beach", northId: "rawai-beach" },
];

describe("Airport Line arrival board — the wait is a projection of the same bus the map paints", () => {
  it("resolves every landmark stop in both directions", () => {
    const rows = getAirportLineArrivalBoard(720, STOPS);
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.south, `${row.key} south`).not.toBeNull();
      expect(row.north, `${row.key} north`).not.toBeNull();
    }
  });

  it("next arrival is strictly after now and the wait is non-negative", () => {
    for (let min = 330; min <= 1350; min += 37) {
      for (const row of getAirportLineArrivalBoard(min, STOPS)) {
        for (const p of [row.south!, row.north!]) {
          expect(p.projectedMin).toBeGreaterThan(min);
          expect(p.waitMin).toBeGreaterThanOrEqual(0);
          expect(Math.abs(p.projectedMin - min - p.waitMin)).toBeLessThan(1e-9);
        }
      }
    }
  });

  it("a departed bus is the vehicle the map paints, with a road distance to the stop", () => {
    // Midday: plenty of trips in progress in both directions.
    const rows = getAirportLineArrivalBoard(720, STOPS);
    const vehicles = getVehiclesNow(undefined, 720);
    const departed = rows.flatMap((r) => [r.south!, r.north!]).filter((p) => p.departed);
    expect(departed.length).toBeGreaterThan(0);
    for (const p of departed) {
      expect(p.vehicleId).not.toBeNull();
      const v = vehicles.find((x) => x.vehicleId === p.vehicleId);
      expect(v, `vehicle ${p.vehicleId} on map`).toBeDefined();
      expect(v!.tripStartMin).toBe(p.tripStartMin);
      expect(p.distanceM).not.toBeNull();
      expect(p.distanceM!).toBeGreaterThanOrEqual(0);
    }
  });

  it("after the last bus, the board wraps to tomorrow's first bus and says so", () => {
    // 23:55 — the last southbound departure left the curb at 23:30, so the
    // airport cell must point at tomorrow's first bus, while Rawai still
    // sees tonight's last bus arriving after midnight.
    const rows = getAirportLineArrivalBoard(1435, STOPS);
    const airportSouth = rows.find((r) => r.key === "airport")!.south!;
    expect(airportSouth.tomorrow).toBe(true);
    expect(airportSouth.projectedMin).toBeGreaterThan(1440);
    const rawaiSouth = rows.find((r) => r.key === "rawai")!.south!;
    expect(rawaiSouth.tomorrow).toBe(false);
    expect(rawaiSouth.departed).toBe(true);
  });
});

describe("LIVE clock — the wall clock is the simulation clock", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("goLive follows Bangkok fractional minutes at 1×", () => {
    vi.setSystemTime(new Date("2026-09-07T05:12:30Z")); // 12:12:30 Bangkok
    goLive();
    expect(isLiveClock()).toBe(true);
    expect(getClockState()).toMatchObject({ mode: "live", speed: 1, sweep: false });
    expect(getSimulatedMinutes()).toBeCloseTo(getBangkokNowFractionalMinutes(), 6);
    expect(getSimulatedMinutes()).toBeCloseTo(12 * 60 + 12.5, 3);
    vi.setSystemTime(new Date("2026-09-07T05:42:30Z"));
    expect(getSimulatedMinutes()).toBeCloseTo(12 * 60 + 42.5, 3); // +30 real min = +30 sim min
  });

  it("picking a speed leaves LIVE and replays from the minute it was showing", () => {
    vi.setSystemTime(new Date("2026-09-07T05:00:00Z")); // 12:00 Bangkok
    goLive();
    setSpeed(30);
    expect(isLiveClock()).toBe(false);
    expect(getClockState()).toMatchObject({ mode: "playing", speed: 30 });
    expect(getSimulatedMinutes()).toBeCloseTo(720, 3);
    vi.setSystemTime(new Date("2026-09-07T05:01:00Z")); // +1 real min
    expect(getSimulatedMinutes()).toBeCloseTo(750, 3); // +30 sim min
  });

  it("scrubbing leaves LIVE at the engine's replay speed; pause freezes the wall-clock minute", () => {
    vi.setSystemTime(new Date("2026-09-07T05:00:00Z"));
    goLive();
    setSimulatedMinutes(600);
    expect(getClockState().mode).toBe("playing");
    expect(getClockState().speed).toBe(SIM_SPEED);
    expect(getSimulatedMinutes()).toBeCloseTo(600, 3);

    goLive();
    pause();
    expect(getClockState().mode).toBe("paused");
    vi.setSystemTime(new Date("2026-09-07T05:30:00Z"));
    expect(getSimulatedMinutes()).toBeCloseTo(720, 3);
    play();
    expect(getClockState().mode).toBe("playing");
  });
});
