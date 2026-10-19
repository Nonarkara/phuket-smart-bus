/**
 * depa · USDOT toolkit — domain router.
 *
 * The toolkit deploys as a PREVIEW deployment of the phuket-smart-bus Pages
 * project (`--branch=depa-usdot.nonarkara.org`). Pages Functions only run on
 * the PRODUCTION branch of a project, so on the preview deployment every
 * /api/* route 404s. That is why the published domain had no live feed and
 * no research archive: not a missing function, a missing branch.
 *
 * So the two surfaces are split at the edge:
 *
 *   static  /            -> the toolkit preview deployment
 *   api     /api/*       -> the production deployment (bus.nonarkara.org),
 *                           where the tracker relay, the collector tick and
 *                           the research archive actually run
 *
 * The relay holds the SMARTBUS_BEARER_TOKEN server-side; the browser never
 * sees it. Proxying the API to the production origin is the same request the
 * operator wall makes, so the toolkit and the wall read one fleet, not two.
 */

const TOOLKIT_ORIGIN = "https://depa-usdot-nonarkara-org.phuket-smart-bus.pages.dev";
const API_ORIGIN = "https://bus.nonarkara.org";

export default {
  async fetch(request: Request): Promise<Response> {
    const incomingUrl = new URL(request.url);
    const isApi = incomingUrl.pathname === "/api" || incomingUrl.pathname.startsWith("/api/");
    const origin = isApi ? API_ORIGIN : TOOLKIT_ORIGIN;
    const originUrl = new URL(`${incomingUrl.pathname}${incomingUrl.search}`, origin);
    const originResponse = await fetch(new Request(originUrl, request));
    const headers = new Headers(originResponse.headers);

    // Cloudflare marks preview aliases as noindex. This hostname is the
    // branch's public, canonical home, so do not inherit that preview header.
    headers.delete("x-robots-tag");

    return new Response(originResponse.body, {
      status: originResponse.status,
      statusText: originResponse.statusText,
      headers
    });
  }
};
