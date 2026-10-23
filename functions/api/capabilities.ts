/**
 * GET /api/capabilities — Cloudflare Pages Function (deployed with the site by
 * `wrangler pages deploy`, which picks up this root-level functions/ dir).
 *
 * "Is there a backend behind this origin?"
 *
 * WHY THIS ENDPOINT EXISTS
 *   The static site ships a client-side engine. The Express backend in
 *   server/ — the one that would take real device telemetry — is NOT
 *   deployed with it. The app used to try the live API first anyway
 *   (USE_LIVE = true) and fall back when it failed, which meant every route
 *   opened with twenty-two requests to endpoints that could only answer 404:
 *   /api/health, /api/environment, /api/compare, /api/routes, and every
 *   /api/routes/<id>/{stops,vehicles,advisories}. The fallback worked, so
 *   the page rendered — but the reader paid for the round-trips and every
 *   one of them printed a red line in the console.
 *
 *   scripts/design/shipaudit.mjs counted 176 dead-endpoint calls across
 *   sixteen routes of the live site.
 *
 * WHY IT IS AN ENDPOINT AND NOT A CONSTANT
 *   The answer is a property of the DEPLOYMENT, not of the source. This
 *   function is what the static site deploys, and it says `backend: false`.
 *   When the Express server is deployed behind the same origin, it answers
 *   the same path with `backend: true` and the app switches to the live API
 *   on its own. No source change, no redeploy of the client, no constant to
 *   remember to flip.
 *
 * WHY IT ANSWERS 200 EVERYWHERE
 *   A probe that 404s is a dead endpoint, and the audit counts dead
 *   endpoints. A probe that answers 200 with a one-word answer costs one
 *   request per session and leaves no trace. That is the whole difference
 *   between one clean question and twenty-two broken ones.
 */
type PagesContext = {
  request: Request;
  env: Record<string, unknown>;
  waitUntil: (promise: Promise<unknown>) => void;
};

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type",
};

export async function onRequestGet(context: PagesContext): Promise<Response> {
  return new Response(
    JSON.stringify({
      // The Pages deployment serves the bundle and the Functions tree. The
      // Express server is not behind this origin.
      backend: false,
      mode: "static",
      // The client falls back to the in-browser engine, which computes
      // positions, the timetable and the demand model locally.
      engine: "client",
      builtAt: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: {
        ...CORS,
        "content-type": "application/json; charset=utf-8",
        // The answer is the same for every reader of this deployment, but it
        // is a build property — it must not be cached across a deploy that
        // changes it.
        "cache-control": "no-store",
      },
    }
  );
}

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, { status: 204, headers: CORS });
}
