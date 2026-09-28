/**
 * GET /api/live-buses — Cloudflare Pages Function (deployed with the site by
 * `wrangler pages deploy`, which picks up this root-level functions/ dir).
 *
 * Relays the real Phuket Smart Bus fleet to the /ops console. The browser
 * can't call the trackers itself (no CORS; the keyless one wants a
 * smartbus.phuket.cloud Referer; the token one wants a secret). The edge
 * fetches, normalises and caches for 10 s, so any number of open wall
 * screens cost one upstream request per 10 s.
 *
 *   keyless  po-smartbus.phuket.cloud/vehicles/last  always — positions + APC
 *   token    smartbus-pk-api …/bus-news-2/           only if the secret is set
 *
 * Pages → Settings → Variables and Secrets (all optional):
 *   SMARTBUS_BEARER_TOKEN  (secret)  adds line + destination labels
 *   SMARTBUS_KEYLESS_URL / SMARTBUS_FEED_URL  override the upstream URLs
 */
import {
  PKSB_FEED_URL,
  PKSB_KEYLESS_HEADERS,
  PKSB_KEYLESS_URL,
  mergeLiveFeeds,
  parseKeylessFeed,
  parsePksbFeed,
  type LiveBus,
  type LiveBusFeed,
} from "../../shared/pksbFeed";

export type LiveBusEnv = {
  SMARTBUS_BEARER_TOKEN?: string;
  SMARTBUS_FEED_URL?: string;
  SMARTBUS_KEYLESS_URL?: string;
  GPS_HISTORY?: any;
};

type PagesContext = {
  request: Request;
  env: LiveBusEnv;
  waitUntil: (promise: Promise<unknown>) => void;
};

const EDGE_TTL_S = 10;
const UPSTREAM_TIMEOUT_MS = 6_000;

function reply(body: Omit<LiveBusFeed, "fetchedAt" | "source">, httpStatus: number, maxAgeS: number): Response {
  const full: LiveBusFeed = { fetchedAt: new Date().toISOString(), source: "pksb-tracker", ...body };
  return new Response(JSON.stringify(full), {
    status: httpStatus,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": `public, max-age=${maxAgeS}` },
  });
}

async function fetchJson(fetchImpl: typeof fetch, url: string, headers: Record<string, string>): Promise<unknown> {
  const res = await fetchImpl(url, { headers, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function buildLiveBusResponse(env: LiveBusEnv, fetchImpl: typeof fetch = fetch): Promise<Response> {
  const token = env.SMARTBUS_BEARER_TOKEN?.trim();
  const now = Date.now();

  const [keyless, labelled] = await Promise.allSettled([
    fetchJson(fetchImpl, env.SMARTBUS_KEYLESS_URL?.trim() || PKSB_KEYLESS_URL, PKSB_KEYLESS_HEADERS)
      .then((json) => parseKeylessFeed(json, now)),
    token
      ? fetchJson(fetchImpl, env.SMARTBUS_FEED_URL?.trim() || PKSB_FEED_URL, { accept: "application/json", authorization: `Bearer ${token}` })
          .then((json) => parsePksbFeed(json, now))
      : Promise.resolve<LiveBus[] | null>(null),
  ]);

  const keylessBuses = keyless.status === "fulfilled" ? keyless.value : null;
  const tokenBuses = labelled.status === "fulfilled" ? labelled.value : null;

  if (!keylessBuses && !tokenBuses) {
    const why = keyless.status === "rejected" ? (keyless.reason as Error).message : "no data";
    return reply({ status: "upstream_error", vehicles: [], detail: `Tracker unreachable (${why})`, sources: { keyless: false, token: false } }, 502, 5);
  }

  return reply({
    status: "live",
    vehicles: mergeLiveFeeds(keylessBuses ?? [], tokenBuses ?? []),
    sources: { keyless: keylessBuses !== null, token: tokenBuses !== null },
  }, 200, EDGE_TTL_S);
}

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const edgeCache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  const key = new Request(new URL("/api/live-buses", context.request.url).toString());

  if (edgeCache) {
    const hit = await edgeCache.match(key);
    if (hit) return hit;
  }

  const response = await buildLiveBusResponse(context.env);
  if (response.status === 200) {
    if (edgeCache) {
      context.waitUntil(edgeCache.put(key, response.clone()));
    }
    if (context.env.GPS_HISTORY) {
      try {
        const cloned = response.clone();
        const kvPromise = cloned.json().then((data: any) => {
          if (data?.vehicles && Array.isArray(data.vehicles) && data.vehicles.length > 0) {
            const now = Date.now();
            const batch = {
              fetchedAt: now,
              source: "pksb-tracker",
              buses: data.vehicles.map((v: any) => ({
                vehicleId: v.plate,
                licensePlate: v.plate,
                coordinates: [v.lat, v.lng],
                speedKph: v.speedKph,
                heading: v.heading,
                timestamp: v.updatedAt,
                routeId: v.routeId ?? undefined,
                destinationHint: v.destination ?? undefined,
                paxCount: v.paxOnBoard ?? undefined,
              })),
            };
            return context.env.GPS_HISTORY.put(`batch:${now}`, JSON.stringify(batch), {
              expirationTtl: 604800, // 7-day TTL
            });
          }
        }).catch(() => {});
        context.waitUntil(kvPromise);
      } catch {
        // Non-blocking KV write
      }
    }
  }
  return response;
}
