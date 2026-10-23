/**
 * GET /api/adsb — Cloudflare Pages Function.
 *
 * A relay for the aircraft positions around Phuket airport, so the browser
 * does not call airplanes.live itself.
 *
 * WHY THE RELAY EXISTS
 *   The browser used to fetch https://api.airplanes.live/v2/point/… directly.
 *   That endpoint now answers 403 to everyone who has not arranged an API
 *   key with the operator first ("Please contact us at contact@airplanes.live…
 *   your email MUST include any links, a description of the project"). It is
 *   invitation-only, not intermittently down.
 *
 *   Two things followed. The browser's request was blocked by CORS, so
 *   EVERY page that draws the operations map printed a red CORS error in
 *   the console — measured on both live hosts. And the overlay had no live
 *   data, so it fell back to the schedule beads.
 *
 *   The edge can be told the answer instead of letting the browser find out
 *   the hard way: this function asks once, and always answers 200. When the
 *   upstream is unavailable the answer is an empty list with
 *   `status: "unavailable"`, and the overlay degrades to the schedule beads
 *   with nothing broken and nothing red.
 *
 *   If airplanes.live ever grants access, this relay starts returning live
 *   aircraft with no change to the client and no new deploy.
 *
 * Pages → Settings → Variables and Secrets (optional):
 *   ADSB_UPSTREAM_URL   overrides the upstream point query
 *   ADSB_RADIUS_NM      overrides the radius (default 80 nm)
 */
type PagesContext = {
  request: Request;
  env: Record<string, unknown>;
  waitUntil: (promise: Promise<unknown>) => void;
};

const HKT = { lat: 7.8804, lon: 98.3923 };
const DEFAULT_RADIUS_NM = 80;
const EDGE_TTL_S = 15;
const UPSTREAM_TIMEOUT_MS = 6_000;

function upstreamUrl(env: Record<string, unknown>): string {
  const override = env.ADSB_UPSTREAM_URL;
  if (typeof override === "string" && override.length > 0) return override;
  const radius = Number(env.ADSB_RADIUS_NM) || DEFAULT_RADIUS_NM;
  return `https://api.airplanes.live/v2/point/${HKT.lat}/${HKT.lon}/${radius}`;
}

function json(body: unknown, status: number, maxAgeS: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "cache-control": `public, max-age=${maxAgeS}`,
    },
  });
}

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const edgeCache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  const key = new Request(new URL("/api/adsb", context.request.url).toString());
  if (edgeCache) {
    const hit = await edgeCache.match(key);
    if (hit) return hit;
  }

  const response = await buildResponse(context.env);
  if (response.status === 200 && edgeCache) {
    context.waitUntil(edgeCache.put(key, response.clone()));
  }
  return response;
}

async function buildResponse(env: Record<string, unknown>): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const res = await fetch(upstreamUrl(env), {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      // A 403 from an invitation-only upstream is the EXPECTED answer
      // today. It is not an outage of this site, so it is not an error of
      // this site either — the relay answers 200 with nothing in it.
      return json(
        { ac: [], updatedAt: new Date().toISOString(), status: "unavailable", upstreamStatus: res.status },
        200,
        EDGE_TTL_S
      );
    }
    const data = (await res.json()) as { ac?: Record<string, unknown>[] };
    // The upstream's own shape passes through. The client normalises it —
    // one normaliser, one place where the field names are known.
    return json({ ac: data.ac ?? [], updatedAt: new Date().toISOString(), status: "live" }, 200, EDGE_TTL_S);
  } catch {
    return json(
      { ac: [], updatedAt: new Date().toISOString(), status: "unavailable" },
      200,
      EDGE_TTL_S
    );
  } finally {
    clearTimeout(timer);
  }
}
