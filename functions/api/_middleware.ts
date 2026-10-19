/**
 * Every /api/* Pages Function response gets the security headers that
 * public/_headers gives the static site (Pages does not apply _headers to
 * Functions). JSON never needs to load anything or be framed.
 */
const API_HEADERS: Record<string, string> = {
  "strict-transport-security": "max-age=31536000; includeSubDomains",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
};

export async function onRequest(context: { next: () => Promise<Response> }): Promise<Response> {
  const res = await context.next();
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(API_HEADERS)) if (!out.headers.has(k)) out.headers.set(k, v);
  return out;
}
