const TOOLKIT_ORIGIN = "https://depa-usdot-nonarkara-org.phuket-smart-bus.pages.dev";

export default {
  async fetch(request: Request): Promise<Response> {
    const incomingUrl = new URL(request.url);
    const originUrl = new URL(`${incomingUrl.pathname}${incomingUrl.search}`, TOOLKIT_ORIGIN);
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
