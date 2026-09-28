import { describe, expect, it } from "vitest";
import {
  applyBusesToDay,
  emptyGpsDay,
  foldBatches,
  gpsBatchKey,
  GPS_HISTORY_TTL_S,
  studyDates,
  summarizeGpsDay,
  type GpsBusPing,
} from "../../shared/gpsBatch";

function ping(over: Partial<GpsBusPing> & Pick<GpsBusPing, "coordinates">): GpsBusPing {
  return {
    vehicleId: "10-1230ภูเก็ต",
    licensePlate: "10-1230ภูเก็ต",
    speedKph: 30,
    timestamp: "2026-09-29T03:00:00.000Z",
    paxCount: 0,
    ...over,
  };
}

describe("gps history", () => {
  it("lists newest batches first and keeps a study week past its last day", () => {
    expect(gpsBatchKey(2_000) < gpsBatchKey(1_000)).toBe(true);
    expect(GPS_HISTORY_TTL_S).toBe(14 * 24 * 60 * 60);
  });

  it("names the seven Bangkok dates of a study that starts 30 Sep", () => {
    expect(studyDates("2026-09-30", 7)).toEqual([
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
      "2026-10-05",
      "2026-10-06",
    ]);
    expect(studyDates("2026-09-31", 7)).toBeNull();
    expect(studyDates("2026-09-30", 100)).toHaveLength(14);
  });

  it("joins the Thai plate to the canonical plate and does not count riders already on board", () => {
    const t0 = Date.parse("2026-09-29T02:00:00.000Z");
    let day = applyBusesToDay(emptyGpsDay(t0), [ping({ coordinates: [7.89, 98.39], paxCount: 8 })], t0);
    day = applyBusesToDay(day, [ping({ coordinates: [7.90, 98.39], paxCount: 11 })], t0 + 60_000);
    const summary = summarizeGpsDay(day);
    expect(summary.vehicles).toHaveLength(1);
    expect(summary.vehicles[0]?.vehicleId).toBe("10-1230");
    expect(summary.totalPaxServed).toBe(3);
    expect(summary.totalRevenueThb).toBe(300);
  });

  it("a counter that stays at zero earns nothing — km is not turned into imaginary riders", () => {
    const t0 = Date.parse("2026-09-29T04:00:00.000Z");
    const batches = [0, 1, 2].map((i) => ({
      fetchedAt: t0 + i * 60_000,
      storedAt: t0 + i * 60_000,
      source: "pksb-tracker",
      buses: [ping({ coordinates: [7.89 + i * 0.01, 98.39], paxCount: 0, speedKph: 40 })],
    }));
    const summary = summarizeGpsDay(foldBatches(batches));
    expect(summary.totalKmTracked).toBeGreaterThan(0);
    expect(summary.totalPaxServed).toBe(0);
    expect(summary.totalRevenueThb).toBe(0);
    expect(summary.vehicles[0]?.paxBasis).toBe("apc");
  });

  it("drops a GPS jump and an off-island fix", () => {
    const t0 = Date.parse("2026-09-29T05:00:00.000Z");
    let day = applyBusesToDay(emptyGpsDay(t0), [ping({ coordinates: [7.89, 98.39], paxCount: 1 })], t0);
    day = applyBusesToDay(day, [ping({ coordinates: [8.2, 98.39], paxCount: 1 })], t0 + 5_000);
    day = applyBusesToDay(day, [ping({ coordinates: [0, 0], vehicleId: "ghost", paxCount: 20 })], t0 + 10_000);
    expect(summarizeGpsDay(day).totalKmTracked).toBe(0);
    expect(summarizeGpsDay(day).totalTrackedVehicles).toBe(1);
  });

  it("a counter glitch larger than 40 does not become boardings", () => {
    const t0 = Date.parse("2026-09-29T06:00:00.000Z");
    let day = applyBusesToDay(emptyGpsDay(t0), [ping({ coordinates: [7.89, 98.39], paxCount: 2 })], t0);
    day = applyBusesToDay(day, [ping({ coordinates: [7.891, 98.39], paxCount: 80 })], t0 + 60_000);
    expect(summarizeGpsDay(day).totalPaxServed).toBe(0);
  });
});
