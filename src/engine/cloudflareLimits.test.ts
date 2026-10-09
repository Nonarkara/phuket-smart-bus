import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import collector, { collectTwice } from "../../workers/collect";
import toolkit from "../../cloudflare/toolkit-domain-router";
import { onRequest } from "../../functions/api/research/_middleware";
import { gateResearch } from "../../workers/researchGate";
import { RESEARCH_LIMIT, RESEARCH_PERIOD_S } from "../../shared/researchLimit";

const json = (body: string, status = 200) =>
  new Response(body, { status, headers: { "content-type": "application/json" } });

function cpuMs(): number {
  const used = process.cpuUsage();
  return (used.user + used.system) / 1000;
}

describe("cloudflare cost guard", () => {
  it("caps the collector at 30s CPU and turns its logs on", () => {
    const toml = readFileSync("wrangler.collector.toml", "utf8");
    expect(toml).toMatch(/\[limits\]\s+cpu_ms = 30000/);
    expect(toml).toMatch(/\[observability\]\s+enabled = true/);
  });

  it("caps the toolkit router at 50ms CPU and keeps its logs on", () => {
    const raw = readFileSync("wrangler.toolkit.jsonc", "utf8");
    const cfg = JSON.parse(raw.replace(/^\s*\/\/.*$/gm, "")) as { limits: { cpu_ms: number }; observability: { enabled: boolean } };
    expect(cfg.limits.cpu_ms).toBe(50);
    expect(cfg.observability.enabled).toBe(true);
  });

  it("puts the research ratelimits binding on the route worker, not on Pages", () => {
    const pages = readFileSync("wrangler.toml", "utf8");
    const gate = readFileSync("wrangler.research.toml", "utf8");
    expect(pages).not.toMatch(/\[\[ratelimits\]\]/);
    expect(gate).toMatch(/pattern = "bus\.nonarkara\.org\/api\/research\/\*"/);
    expect(gate).toMatch(/name = "RESEARCH"/);
    expect(gate).toMatch(/namespace_id = "8601001"/);
    expect(gate).toContain(`limit = ${RESEARCH_LIMIT}`);
    expect(gate).toContain(`period = ${RESEARCH_PERIOD_S}`);
    expect(gate).toMatch(/\[observability\]\s+enabled = true/);
  });

  it("keeps a collector firing under the 30s CPU cap", async () => {
    const fetchMock = vi.fn(async () => json("{}"));
    vi.stubGlobal("fetch", fetchMock);
    try {
      const before = cpuMs();
      await collectTwice(async () => {});
      const spent = cpuMs() - before;
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(spent).toBeLessThan(30_000);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("keeps the toolkit router under the 50ms CPU cap", async () => {
    let forwarded = "";
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      forwarded = input instanceof Request ? input.url : String(input);
      return new Response("ok", { status: 200, headers: { "x-robots-tag": "noindex" } });
    });
    vi.stubGlobal("fetch", fetchMock);
    try {
      const before = cpuMs();
      const res = await toolkit.fetch(new Request("https://depa-usdot.nonarkara.org/path?q=1"));
      const spent = cpuMs() - before;
      expect(res.status).toBe(200);
      expect(res.headers.get("x-robots-tag")).toBeNull();
      expect(forwarded).toBe("https://depa-usdot-nonarkara-org.phuket-smart-bus.pages.dev/path?q=1");
      expect(spent).toBeLessThan(50);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("does not fetch the research origin when the rate limit says no", async () => {
    const fetchMock = vi.fn(async () => json("{\"ok\":true}"));
    const limiter = { limit: vi.fn(async () => ({ success: false })) };
    const res = await gateResearch(
      new Request("https://bus.nonarkara.org/api/research/day?date=2026-10-06", { headers: { "cf-connecting-ip": "203.0.113.8" } }),
      { RESEARCH: limiter },
      fetchMock,
    );
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ ok: false, error: "rate_limited" });
    expect(limiter.limit).toHaveBeenCalledWith({ key: "203.0.113.8" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards an allowed research read to the Pages origin", async () => {
    let forwarded = "";
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      forwarded = input instanceof Request ? input.url : String(input);
      return json("{\"ok\":true}");
    });
    const res = await gateResearch(
      new Request("https://bus.nonarkara.org/api/research/fixes?date=2026-10-06&format=csv"),
      { RESEARCH: { limit: async () => ({ success: true }) } },
      fetchMock,
    );
    expect(res.status).toBe(200);
    expect(forwarded).toBe("https://phuket-smart-bus.pages.dev/api/research/fixes?date=2026-10-06&format=csv");
  });

  it("fails closed when the research binding is missing or throws", async () => {
    const fetchMock = vi.fn(async () => json("{\"ok\":true}"));
    const missing = await gateResearch(new Request("https://bus.nonarkara.org/api/research/day"), {}, fetchMock);
    const broken = await gateResearch(
      new Request("https://bus.nonarkara.org/api/research/day"),
      { RESEARCH: { limit: async () => { throw new Error("binding down"); } } },
      fetchMock,
    );
    expect(missing.status).toBe(503);
    expect(broken.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stops a Pages research read before next() when the binding denies it", async () => {
    const next = vi.fn(async () => json("{\"ok\":true}"));
    const res = await onRequest({
      request: new Request("https://bus.nonarkara.org/api/research/day", { headers: { "cf-connecting-ip": "203.0.113.9" } }),
      env: { RESEARCH: { limit: async () => ({ success: false }) } },
      next,
    });
    expect(res.status).toBe(429);
    expect(next).not.toHaveBeenCalled();
  });

  it("fails closed on Pages when the research binding throws", async () => {
    const next = vi.fn(async () => json("{\"ok\":true}"));
    const res = await onRequest({
      request: new Request("https://bus.nonarkara.org/api/research/day"),
      env: { RESEARCH: { limit: async () => { throw new Error("binding down"); } } },
      next,
    });
    expect(res.status).toBe(503);
    expect(next).not.toHaveBeenCalled();
  });

  it("lets a Pages research read through when no binding is configured", async () => {
    const next = vi.fn(async () => json("{\"ok\":true}"));
    const res = await onRequest({
      request: new Request("https://bus.nonarkara.org/api/research/day"),
      env: {},
      next,
    });
    expect(res.status).toBe(200);
    expect(next).toHaveBeenCalledOnce();
  });

  it("still answers a collector HTTP poke", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json("{\"ok\":true}", 200)));
    try {
      const res = await collector.fetch();
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
