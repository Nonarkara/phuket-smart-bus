/**
 * GET /api/live-buses — Cloudflare Pages Function (deployed with the site by
 * `wrangler pages deploy`, which picks up this root-level functions/ dir).
 *
 * Relays the PKSB public tracker to the /ops console. The browser can't call
 * the tracker itself: the feed wants a bearer token (a secret must never ship
 * in the client bundle) and doesn't send CORS headers. The edge holds the
 * token, normalises the rows, and caches the answer for 10 s so any number
 * of open wall screens cost one upstream request per 10 s.
 *
 * Pages → Settings → Variables and Secrets:
 *   SMARTBUS_BEARER_TOKEN  (secret)    tracker bearer token
 *   SMARTBUS_FEED_URL      (optional)  override the upstream URL
 */
import { PKSB_FEED_URL, parsePksbFeed, type LiveBusFeed, type LiveBusFeedStatus } from "../../shared/pksbFeed";

export type LiveBusEnv = { SMARTBUS_BEARER_TOKEN?: string; SMARTBUS_FEED_URL?: string };

type PagesContext = {
  request: Request;
  env: LiveBusEnv;
  waitUntil: (promise: Promise<unknown>) => void;
};

const EDGE_TTL_S = 10;
const UPSTREAM_TIMEOUT_MS = 6_000;

function reply(status: LiveBusFeedStatus, httpStatus: number, maxAgeS: number, extra: Partial<LiveBusFeed> = {}): Response {
  const body: LiveBusFeed = {
    status,
    fetchedAt: new Date().toISOString(),
    source: "pksb-tracker",
    vehicles: [],
    ...extra,
  };
  return new Response(JSON.stringify(body), {
    status: httpStatus,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": `public, max-age=${maxAgeS}`,
    },
  });
}

export async function buildLiveBusResponse(env: LiveBusEnv, fetchImpl: typeof fetch = fetch): Promise<Response> {
  const token = env.SMARTBUS_BEARER_TOKEN?.trim();
  const url = env.SMARTBUS_FEED_URL?.trim() || PKSB_FEED_URL;

  let upstream: Response;
  try {
    upstream = await fetchImpl(url, {
      headers: {
        accept: "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (error) {
    return reply("upstream_error", 502, 5, { detail: `Tracker unreachable: ${(error as Error).message}` });
  }

  if (upstream.status === 401 || upstream.status === 403) {
    return reply("unconfigured", 503, 30, {
      detail: token
        ? "The PKSB tracker rejected the configured SMARTBUS_BEARER_TOKEN."
        : "The PKSB tracker needs SMARTBUS_BEARER_TOKEN set as a Cloudflare Pages secret.",
    });
  }
  if (!upstream.ok) {
    return reply("upstream_error", 502, 5, { detail: `Tracker answered HTTP ${upstream.status}` });
  }

  let json: unknown;
  try {
    json = await upstream.json();
  } catch {
    return reply("upstream_error", 502, 5, { detail: "Tracker returned non-JSON" });
  }

  return reply("live", 200, EDGE_TTL_S, { vehicles: parsePksbFeed(json, Date.now()) });
}

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const edgeCache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  const key = new Request(new URL("/api/live-buses", context.request.url).toString());

  if (edgeCache) {
    const hit = await edgeCache.match(key);
    if (hit) return hit;
  }

  const response = await buildLiveBusResponse(context.env);
  if (edgeCache && response.status === 200) {
    context.waitUntil(edgeCache.put(key, response.clone()));
  }
  return response;
}
