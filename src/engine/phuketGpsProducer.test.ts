// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { normalisePhuketGpsRow, pollPhuketGpsOnce, getPhuketProducerState, startPhuketGpsProducer, stopPhuketGpsProducer } from "./phuketGpsProducer";

describe("phuketGpsProducer", () => {
  describe("normalisePhuketGpsRow", () => {
    it("normalises a typical moving row", () => {
      const result = normalisePhuketGpsRow({
        licence: "10-1230ภูเก็ต",
        lat: "7.867424",
        lon: "98.396622",
        speed: "42",
        data: JSON.stringify({
          HangXiang: 173,
          GPSTime: "2026-09-25T12:00:00.000Z",
          Satellites: 12,
          PeopleCur: 18,
        }),
      }, Date.parse("2026-09-25T12:00:00Z"));

      expect(result.usable).toBe(true);
      expect(result.ping.vehicleId).toBe("10-1230ภูเก็ต");
      expect(result.ping.licensePlate).toBe("10-1230ภูเก็ต");
      expect(result.ping.coordinates).toEqual([7.867424, 98.396622]);
      expect(result.ping.speedKph).toBe(42);
      expect(result.ping.heading).toBe(173);
      expect(result.ping.satellites).toBe(12);
      expect(result.ping.paxCount).toBe(18);
      expect(result.ping.timestamp).toBe("2026-09-25T12:00:00.000Z");
      expect(result.ping.routeId).toBe("rawai-airport");
      expect(result.ping.destinationHint).toBe("Rawai Beach");
    });

    it("marks a parked bus (speed 0) as heading for the airport", () => {
      const result = normalisePhuketGpsRow({
        licence: "10-1231ภูเก็ต",
        lat: "7.867205",
        lon: "98.39677",
        speed: "0",
        data: JSON.stringify({ HangXiang: 173, GPSTime: "2026-09-25T12:00:00.000Z" }),
      });
      expect(result.usable).toBe(true);
      expect(result.ping.speedKph).toBe(0);
      expect(result.ping.destinationHint).toBe("Phuket Airport");
    });

    it("rejects a row with missing licence plate", () => {
      const result = normalisePhuketGpsRow({ lat: "7.0", lon: "98.0" });
      expect(result.usable).toBe(false);
    });

    it("rejects a row with missing coordinates", () => {
      const result = normalisePhuketGpsRow({ licence: "10-9999" });
      expect(result.usable).toBe(false);
    });

    it("rejects 0,0 (depot sentinel where GPS hasn't locked)", () => {
      const result = normalisePhuketGpsRow({ licence: "10-9999", lat: "0", lon: "0" });
      expect(result.usable).toBe(false);
    });

    it("survives malformed inner data JSON without crashing", () => {
      const result = normalisePhuketGpsRow({
        licence: "10-9999",
        lat: "7.0",
        lon: "98.0",
        data: "{this is not json",
      });
      expect(result.usable).toBe(true);
      expect(result.ping.heading).toBe(0);
      expect(result.ping.timestamp).toBeDefined();
    });

    it("falls back to current time when GPS timestamp is missing or unparseable", () => {
      const t0 = Date.parse("2026-09-25T12:00:00Z");
      const r1 = normalisePhuketGpsRow({ licence: "10-1", lat: "7", lon: "98", data: JSON.stringify({ GPSTime: "not a date" }) }, t0);
      expect(r1.ping.timestamp).toBe("2026-09-25T12:00:00.000Z");

      const r2 = normalisePhuketGpsRow({ licence: "10-1", lat: "7", lon: "98" }, t0);
      expect(r2.ping.timestamp).toBe("2026-09-25T12:00:00.000Z");
    });

    it("parses numeric strings without precision loss", () => {
      const result = normalisePhuketGpsRow({
        licence: "10-1",
        lat: "7.867424111",
        lon: "98.396622999",
        speed: "42",
      });
      expect(result.ping.coordinates[0]).toBeCloseTo(7.867424111, 6);
      expect(result.ping.coordinates[1]).toBeCloseTo(98.396622999, 6);
    });
  });

  describe("pollPhuketGpsOnce", () => {
    it("returns empty + error when the upstream is unreachable", async () => {
      const result = await pollPhuketGpsOnce(AbortSignal.timeout(50));
      expect(result.error).toBeDefined();
      expect(result.rows).toEqual([]);
    });
  });

  describe("producer lifecycle", () => {
    it("starts idempotently and reports state", async () => {
      stopPhuketGpsProducer();
      const before = getPhuketProducerState();
      expect(before.running).toBe(false);

      const stop = startPhuketGpsProducer(60_000);
      // The first poll is async — running=true is set synchronously,
      // but pollCount updates after the fetch settles.
      const running = getPhuketProducerState();
      expect(running.running).toBe(true);

      // Wait for the first poll to settle so pollCount advances.
      await new Promise((r) => setTimeout(r, 200));
      const afterPoll = getPhuketProducerState();
      expect(afterPoll.pollCount).toBeGreaterThanOrEqual(1);

      const stop2 = startPhuketGpsProducer(60_000);
      expect(typeof stop2).toBe("function");

      stop();
      const after = getPhuketProducerState();
      expect(after.running).toBe(false);

      stop2();
    });
  });
});
