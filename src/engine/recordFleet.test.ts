import { collectTick } from "../../functions/api/collect/tick";
import { GPS_HISTORY_TTL_S } from "../../shared/gpsBatch";
import { recordFleetSample, type FleetKv } from "../../shared/recordFleet";
import type { GpsBusPing } from "../../shared/gpsBatch";

function memoryKv(): FleetKv & { puts: Array<{ key: string; ttl?: number }> } {
  const store = new Map<string, unknown>();
  const puts: Array<{ key: string; ttl?: number }> = [];
  return {
    puts,
    async get(key) {
      return store.get(key) ?? null;
    },
    async put(key, value, options) {
      store.set(key, JSON.parse(value));
      puts.push({ key, ttl: options?.expirationTtl });
    },
  };
}

function ping(over: Partial<GpsBusPing> = {}): GpsBusPing {
  return {
    vehicleId: "10-1230",
    licensePlate: "10-1230",
    coordinates: [7.89, 98.39],
    speedKph: 30,
    timestamp: "2026-09-30T01:00:00.000Z",
    paxCount: 4,
    ...over,
  };
}

describe("fleet archive", () => {
  it("keeps the first sample, drops a second inside the gap, then counts the next boarding", async () => {
    const kv = memoryKv();
    const t0 = Date.parse("2026-09-30T01:00:00.000Z");
    const first = await recordFleetSample(kv, [ping()], t0);
    expect(first.recorded).toBe(true);
    expect(first.date).toBe("2026-09-30");
    expect(first.totalPaxServed).toBe(0);

    const rushed = await recordFleetSample(kv, [ping({ paxCount: 9, coordinates: [7.9, 98.39] })], t0 + 10_000);
    expect(rushed.recorded).toBe(false);
    expect(rushed.reason).toBe("recent");
    expect(rushed.totalPaxServed).toBe(0);

    const next = await recordFleetSample(kv, [ping({ paxCount: 9, coordinates: [7.9, 98.39] })], t0 + 60_000);
    expect(next.recorded).toBe(true);
    expect(next.totalPaxServed).toBe(5);
    expect(next.totalRevenueThb).toBe(500);
    expect(next.totalKmTracked).toBeGreaterThan(0);
    expect(kv.puts.every((put) => put.ttl === GPS_HISTORY_TTL_S)).toBe(true);
    expect(kv.puts.filter((put) => put.key.startsWith("gps:"))).toHaveLength(2);
  });

  it("does not invent a sample when the tracker returns no buses", async () => {
    const kv = memoryKv();
    const result = await recordFleetSample(kv, [], Date.parse("2026-09-30T01:00:00.000Z"));
    expect(result.recorded).toBe(false);
    expect(result.reason).toBe("no-vehicles");
    expect(kv.puts).toHaveLength(0);
  });
});

describe("GET /api/collect/tick", () => {
  const row = {
    licence: "10-1248ภูเก็ต",
    lat: "7.95",
    lon: "98.35",
    speed: "18",
    data: JSON.stringify({ HangXiang: 90, GPSTime: new Date().toISOString(), PeopleCur: 6 }),
  };

  function router(status = 200) {
    return vi.fn(async () => (status === 200 ? Response.json([row]) : new Response("down", { status })));
  }

  it("awaits a KV write and does not cache the tick", async () => {
    const kv = memoryKv();
    const fetchImpl = router();
    const res = await collectTick({ GPS_HISTORY: kv }, fetchImpl as unknown as typeof fetch);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ ok: true, recorded: true, vehicles: 1, fresh: 1, totalPaxServed: 0 });
    expect(kv.puts.some((put) => put.key.startsWith("day:"))).toBe(true);

    const again = await collectTick({ GPS_HISTORY: kv }, router() as unknown as typeof fetch);
    const second = await again.json();
    expect(second.recorded).toBe(false);
    expect(second.reason).toBe("recent");
  });

  it("does not write when the tracker is down", async () => {
    const kv = memoryKv();
    const res = await collectTick({ GPS_HISTORY: kv }, router(502) as unknown as typeof fetch);
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(kv.puts).toHaveLength(0);
  });
});
