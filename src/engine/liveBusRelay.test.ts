import { buildLiveBusResponse } from "../../functions/api/live-buses";

const keylessRow = {
  licence: "10-1230ภูเก็ต",
  lat: "8.108",
  lon: "98.307",
  speed: "30",
  data: JSON.stringify({ HangXiang: 180, GPSTime: new Date().toISOString(), PeopleCur: 9 }),
};

const tokenRow = {
  id: 7,
  licence: "10-1230",
  date: "2026-09-24T09:00:00",
  buffer: "Rawai",
  data: {
    azm: 180, pos: [98.307, 8.108], spd: 30, time: "2026-09-24T09:00:00", buffer: "Rawai",
    determineBusDirection: ["The bus is heading from Phuket Airport to Rawai", 1, "Rawai", 42000, 30],
    vhc: { id: "DEV7", lc: "10-1230" },
  },
};

function router(routes: Record<string, () => Response | Promise<Response>>) {
  return vi.fn(async (url: string | URL | Request, _init?: RequestInit) => {
    const key = Object.keys(routes).find((k) => String(url).includes(k));
    if (!key) throw new Error(`unexpected ${String(url)}`);
    return routes[key]!();
  });
}

describe("/api/live-buses edge relay", () => {
  it("works with no token at all: keyless tracker, smartbus Referer, 10 s edge cache", async () => {
    const fetchImpl = router({ "po-smartbus": () => Response.json([keylessRow]) });
    const res = await buildLiveBusResponse({}, fetchImpl as unknown as typeof fetch);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const headers = fetchImpl.mock.calls[0]![1]!.headers as Record<string, string>;
    expect(headers.referer).toBe("https://smartbus.phuket.cloud/");

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("public, max-age=10");
    const body = await res.json();
    expect(body).toMatchObject({ status: "live", sources: { keyless: true, token: false } });
    expect(body.vehicles[0]).toMatchObject({ plate: "10-1230", lat: 8.108, lng: 98.307, paxOnBoard: 9, routeId: null });
  });

  it("with a token, adds line + destination to the keyless position, and never echoes the secret", async () => {
    const fetchImpl = router({
      "po-smartbus": () => Response.json([keylessRow]),
      "bus-news-2": () => Response.json([tokenRow]),
    });
    const res = await buildLiveBusResponse({ SMARTBUS_BEARER_TOKEN: "secret" }, fetchImpl as unknown as typeof fetch);
    const tokenCall = fetchImpl.mock.calls.find((c) => String(c[0]).includes("bus-news-2"))!;
    expect((tokenCall[1]!.headers as Record<string, string>).authorization).toBe("Bearer secret");
    const body = await res.json();
    expect(body.sources).toEqual({ keyless: true, token: true });
    expect(body.vehicles).toHaveLength(1);
    expect(body.vehicles[0]).toMatchObject({ plate: "10-1230", paxOnBoard: 9, routeId: "rawai-airport", destination: "Rawai" });
    expect(JSON.stringify(body)).not.toContain("secret");
  });

  it("stays live on the token feed alone if the keyless tracker is down", async () => {
    const fetchImpl = router({
      "po-smartbus": () => new Response("bad gateway", { status: 502 }),
      "bus-news-2": () => Response.json([tokenRow]),
    });
    const body = await (await buildLiveBusResponse({ SMARTBUS_BEARER_TOKEN: "t" }, fetchImpl as unknown as typeof fetch)).json();
    expect(body).toMatchObject({ status: "live", sources: { keyless: false, token: true } });
  });

  it("reports upstream_error (not cached) when nothing answers", async () => {
    const res = await buildLiveBusResponse({}, (async () => { throw new Error("ECONNRESET"); }) as typeof fetch);
    expect(res.status).toBe(502);
    expect(res.headers.get("cache-control")).toBe("public, max-age=5");
    const body = await res.json();
    expect(body.status).toBe("upstream_error");
    expect(body.detail).toMatch(/ECONNRESET/);
  });

  it("honours upstream URL overrides", async () => {
    const fetchImpl = router({ "example.test/keyless": () => Response.json([]) });
    await buildLiveBusResponse({ SMARTBUS_KEYLESS_URL: "https://example.test/keyless" }, fetchImpl as unknown as typeof fetch);
    expect(String(fetchImpl.mock.calls[0]![0])).toBe("https://example.test/keyless");
  });
});
