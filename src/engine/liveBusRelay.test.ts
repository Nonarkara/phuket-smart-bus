import { buildLiveBusResponse } from "../../functions/api/live-buses";

const row = {
  id: 7,
  licence: "10-1001",
  date: "2026-09-24T09:00:00",
  buffer: "Rawai",
  data: {
    azm: 180,
    pos: [98.307, 8.108],
    spd: 30,
    time: "2026-09-24T09:00:00",
    buffer: "Rawai",
    determineBusDirection: ["The bus is heading from Phuket Airport to Rawai", 1, "Rawai", 42000, 30],
    vhc: { id: "DEV7", lc: "10-1001" },
  },
};

describe("/api/live-buses edge relay", () => {
  it("sends the bearer token server-side and returns normalised buses", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => Response.json([row]));
    const res = await buildLiveBusResponse({ SMARTBUS_BEARER_TOKEN: "secret" }, fetchImpl as typeof fetch);
    const init = fetchImpl.mock.calls[0]![1]!;
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer secret");

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("public, max-age=10");
    const body = await res.json();
    expect(body.status).toBe("live");
    expect(body.vehicles[0]).toMatchObject({ plate: "10-1001", lat: 8.108, lng: 98.307, routeId: "rawai-airport" });
    expect(JSON.stringify(body)).not.toContain("secret");
  });

  it("reports unconfigured when the tracker refuses auth", async () => {
    const res = await buildLiveBusResponse({}, (async () => new Response("no", { status: 401 })) as typeof fetch);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.status).toBe("unconfigured");
    expect(body.detail).toMatch(/SMARTBUS_BEARER_TOKEN/);
  });

  it("reports upstream_error when the tracker is unreachable or broken", async () => {
    const down = await buildLiveBusResponse({}, (async () => { throw new Error("ECONNRESET"); }) as typeof fetch);
    expect((await down.json()).status).toBe("upstream_error");
    const broken = await buildLiveBusResponse({}, (async () => new Response("<html>", { status: 200 })) as typeof fetch);
    expect((await broken.json()).status).toBe("upstream_error");
  });

  it("honours a feed URL override", async () => {
    const fetchImpl = vi.fn(async () => Response.json([]));
    await buildLiveBusResponse({ SMARTBUS_FEED_URL: "https://example.test/feed" }, fetchImpl as unknown as typeof fetch);
    expect(fetchImpl.mock.calls[0]).toBeDefined();
    expect(String((fetchImpl.mock.calls[0] as unknown[])[0])).toBe("https://example.test/feed");
  });
});
