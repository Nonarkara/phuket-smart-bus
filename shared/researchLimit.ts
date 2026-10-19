/**
 * Cost guard for the unauthenticated research reads
 * (`/api/research/day`, `/api/research/fixes`).
 *
 * Pages cannot declare a ratelimits binding — wrangler pages deploy
 * rejects the key — so the binding is attached by wrangler.research.toml
 * to the worker whose route is only those paths. The Pages middleware
 * honours the same binding when it is present and does nothing when it
 * is not, so a Pages deploy on its own keeps serving the routes.
 */

export type RateLimitBinding = {
  limit(options: { key: string }): Promise<{ success: boolean }>;
};

/** One /research view is the selected day plus the seven-day strip. */
export const RESEARCH_LIMIT = 90;
export const RESEARCH_PERIOD_S = 60;

export const RESEARCH_LIMIT_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "retry-after": String(RESEARCH_PERIOD_S),
  "access-control-allow-origin": "*",
};

export function researchClientKey(request: Request): string {
  const ip = request.headers.get("cf-connecting-ip")?.trim();
  return ip || "unknown";
}

export function researchLimitedResponse(): Response {
  return new Response(JSON.stringify({ ok: false, error: "rate_limited" }), {
    status: 429,
    headers: RESEARCH_LIMIT_HEADERS,
  });
}

export function researchLimitUnavailableResponse(): Response {
  return new Response(JSON.stringify({ ok: false, error: "rate_limit_unavailable" }), {
    status: 503,
    headers: RESEARCH_LIMIT_HEADERS,
  });
}

/** True when this request may proceed to the D1 read. */
export async function allowResearchRead(request: Request, limiter: RateLimitBinding): Promise<boolean> {
  const { success } = await limiter.limit({ key: researchClientKey(request) });
  return success;
}
