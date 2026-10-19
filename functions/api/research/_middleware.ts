/**
 * Runs for every /api/research/* Pages Function.
 *
 * The rate limit lives on the research-gate worker (wrangler.research.toml):
 * Pages cannot carry a ratelimits binding. The gate only fronts
 * bus.nonarkara.org, so a direct call to phuket-smart-bus.pages.dev (or a
 * preview alias) would skip it and read D1 without limit. The gate therefore
 * adds a shared-secret header, and this middleware serves only requests that
 * carry it — or that it can rate-limit itself, when the binding is present.
 * No binding and no RESEARCH_GATE_TOKEN secret: closed.
 */
import { allowResearchRead, researchLimitedResponse, researchLimitUnavailableResponse, type RateLimitBinding } from "../../../shared/researchLimit";
import { sameSecret } from "../../../shared/secret";

type MiddlewareContext = {
  request: Request;
  env: { RESEARCH?: RateLimitBinding; RESEARCH_GATE_TOKEN?: string };
  next: () => Promise<Response>;
};

/** Same name as workers/researchGate.ts GATE_HEADER. */
const GATE_HEADER = "x-research-gate";

export async function onRequest(context: MiddlewareContext): Promise<Response> {
  const limiter = context.env.RESEARCH;
  if (limiter) {
    try {
      if (!(await allowResearchRead(context.request, limiter))) return researchLimitedResponse();
    } catch {
      return researchLimitUnavailableResponse();
    }
    return context.next();
  }
  const expected = context.env.RESEARCH_GATE_TOKEN?.trim() ?? "";
  const given = context.request.headers.get(GATE_HEADER)?.trim() ?? "";
  if (!sameSecret(given, expected)) {
    return new Response(JSON.stringify({ ok: false, error: "research reads are served through https://bus.nonarkara.org/api/research/" }), {
      status: 403,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  }
  return context.next();
}
