/**
 * Cloudflare Pages Function: GET /api/vehicles/last
 *
 * Keyless proxy to the official Phuket Smart Bus public tracker
 * (https://po-smartbus.phuket.cloud/vehicles/last). The upstream
 * sends no CORS headers and requires a Referer/Origin that mimics
 * smartbus.phuket.cloud, so the edge does the fetch and returns the
 * normalised JSON to the browser with permissive CORS.
 *
 * Pairs with src/engine/phuketGpsProducer.ts — that producer polls
 * this URL every 30 s on the operator wall and feeds the data into
 * the existing LiveGpsReceiver + fleetEfficiency pipeline.
 */

interface PagesEventContext {
  request: Request;
  env: Record<string, string>;
}

export async function onRequestGet(context: PagesEventContext): Promise<Response> {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Accept, Accept-Language, Content-Language, Content-Type",
    "Cache-Control": "public, max-age=5, s-maxage=10"
  };

  try {
    const upstreamUrl = "https://po-smartbus.phuket.cloud/vehicles/last";
    const response = await fetch(upstreamUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        "Referer": "https://smartbus.phuket.cloud/",
        "Origin": "https://smartbus.phuket.cloud",
        "Accept": "application/json"
      }
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: `Upstream tracker returned HTTP ${response.status}` }),
        { status: response.status, headers: { "Content-Type": "application/json", ...cors } }
      );
    }

    const data = await response.text();
    return new Response(data, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...cors
      }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: "Failed to fetch vehicle telemetry", details: message }),
      { status: 502, headers: { "Content-Type": "application/json", ...cors } }
    );
  }
}

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Accept, Accept-Language, Content-Language, Content-Type",
      "Access-Control-Max-Age": "600"
    }
  });
}
