/** Equal-length compare that doesn't stop at the first differing byte. Empty never matches. */
export function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** The token in `Authorization: Bearer <token>`, or "". */
export function bearerToken(request: Request): string {
  return (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
}

/** Closed unless `expected` is set and the request carries it. */
export function hasSecret(request: Request, expected: string | undefined): boolean {
  const want = expected?.trim() ?? "";
  return want.length > 0 && sameSecret(bearerToken(request), want);
}
