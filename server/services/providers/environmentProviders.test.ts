import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearAqiSnapshotCache, getAqiSnapshot } from "./aqiProvider.js";
import { clearWeatherSnapshotCache, getWeatherSnapshot } from "./weatherProvider.js";

describe("environment providers", () => {
  beforeEach(() => {
    clearWeatherSnapshotCache();
    clearAqiSnapshotCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearWeatherSnapshotCache();
    clearAqiSnapshotCache();
  });

  it("reports degraded weather mode explicitly when the upstream request fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));

    const result = await getWeatherSnapshot();

    expect(result.status.state).toBe("fallback");
    expect(result.status.fallbackReason).toContain("weather:");
    expect(result.snapshot.temperatureC).toBeGreaterThan(0);
  });

  it("reports degraded AQI mode explicitly when the upstream request fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));

    const result = await getAqiSnapshot();

    expect(result.status.state).toBe("fallback");
    expect(result.status.fallbackReason).toContain("aqi:");
    expect(result.snapshot.usAqi).toBeGreaterThan(0);
  });
});
