/**
 * Rate-limit gate for the public research reads.
 *
 * Cloudflare Pages cannot carry a ratelimits binding (wrangler pages
 * deploy rejects the key). This worker's only route is
 * bus.nonarkara.org/api/research/*. A call that is allowed is fetched
 * from the Pages origin, which still owns D1 and the analysis.
 * pages.dev is not this route, so the origin fetch does not loop.
 *
 * Deploy after Pages: npx wrangler deploy -c wrangler.research.toml
 */
import {
  allowResearchRead,
  researchLimitedResponse,
  researchLimitUnavailableResponse,
  type RateLimitBinding,
} from "../shared/researchLimit";

const PAGES_ORIGIN = "https://phuket-smart-bus.pages.dev";

export type ResearchGateEnv = { RESEARCH?: RateLimitBinding };

export async function gateResearch(
  request: Request,
  env: ResearchGateEnv,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  if (!env.RESEARCH) return researchLimitUnavailableResponse();
  let allowed = false;
  try {
    allowed = await allowResearchRead(request, env.RESEARCH);
  } catch {
    return researchLimitUnavailableResponse();
  }
  if (!allowed) return researchLimitedResponse();

  const incoming = new URL(request.url);
  const originUrl = new URL(`${incoming.pathname}${incoming.search}`, PAGES_ORIGIN);
  // Do not follow a redirect back onto bus.nonarkara.org — that route is this worker.
  return fetchImpl(new Request(originUrl, request), { redirect: "manual" });
}

export default {
  async fetch(request: Request, env: ResearchGateEnv): Promise<Response> {
    return gateResearch(request, env);
  },
};
