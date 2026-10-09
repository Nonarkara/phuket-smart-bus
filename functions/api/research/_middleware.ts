/**
 * Runs for every /api/research/* Pages Function. The ratelimits binding
 * is declared on the research-gate worker (wrangler.research.toml), not
 * in the Pages wrangler file. When that binding is also on this env,
 * a denied call stops before the day analysis or the fixes export.
 */
import { allowResearchRead, researchLimitedResponse, researchLimitUnavailableResponse, type RateLimitBinding } from "../../../shared/researchLimit";

type MiddlewareContext = {
  request: Request;
  env: { RESEARCH?: RateLimitBinding };
  next: () => Promise<Response>;
};

export async function onRequest(context: MiddlewareContext): Promise<Response> {
  const limiter = context.env.RESEARCH;
  if (!limiter) return context.next();
  try {
    if (!(await allowResearchRead(context.request, limiter))) return researchLimitedResponse();
  } catch {
    return researchLimitUnavailableResponse();
  }
  return context.next();
}
