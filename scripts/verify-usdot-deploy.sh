#!/usr/bin/env bash
# Prove the toolkit reached the published domain, and that the live API is
# actually reachable through it.
#
# A status code is not proof. The published domain serves the SPA shell for
# unmatched paths, so a 200 can mean "the app" or "the asset" — the body
# decides. The control is an invented filename: if the real path and the
# invented path answer identically, both are the fallback.
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# TWO FAILURES, TWO EXIT CODES — the same contract as verify-deploy.sh.
#   2 — the BYTES did not reach the host.
#   1 — the GATE failed.
# The deploy script has exactly two things to say, and "the upload worked"
# said when the upload did NOT work sends the operator nowhere while the
# site stays on the old build.
EXIT_BYTES=2
EXIT_GATE=1

CUSTOM="${CUSTOM:-https://depa-usdot.nonarkara.org}"
INDEX="dist/client/index.html"

if [ ! -f "$INDEX" ]; then
  echo "error: $INDEX is missing; build before verification" >&2
  exit "$EXIT_BYTES"
fi

hash_file() { shasum -a 256 "$1" | awk '{print $1}'; }
hash_url() { curl -fsS --max-time 20 "$1" | shasum -a 256 | awk '{print $1}'; }
asset_path() { sed -nE "$1" "$INDEX" | head -1; }

JS_PATH="$(asset_path 's@.*src="(/assets/[^\"]+\.js)".*@\1@p')"
CSS_PATH="$(asset_path 's@.*href="(/assets/[^\"]+\.css)".*@\1@p')"

if [ -z "$JS_PATH" ] || [ -z "$CSS_PATH" ]; then
  echo "error: could not resolve built JS/CSS from $INDEX" >&2
  exit "$EXIT_BYTES"
fi

echo "→ the whole asset graph on ${CUSTOM}"
# The entry chunk NAMES its lazy chunks without containing their bytes, so
# comparing the entry alone cannot see a stale route. This crawls the graph
# — entry, every lazy chunk, every lazy stylesheet and what they reference
# — and compares all of it, byte for byte, with the content hashes
# normalised away.
BASE_URL="$CUSTOM" node scripts/verify-assets.mjs || exit "$EXIT_BYTES"

echo "→ deep links return the app, not a 404"
for route in / /toolkit /ops /study; do
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "${CUSTOM}${route}")"
  if [ "$code" != "200" ]; then
    echo "error: ${CUSTOM}${route} returned ${code}, expected 200" >&2
    exit "$EXIT_BYTES"
  fi
  echo "ok: ${CUSTOM}${route} -> 200"
done

echo "→ the published path and an invented path must differ"
real_type="$(curl -s -o /dev/null -w '%{content_type}' --max-time 20 "${CUSTOM}${JS_PATH}")"
fake_type="$(curl -s -o /dev/null -w '%{content_type}' --max-time 20 "${CUSTOM}/assets/INVENTED-NAME.js")"
if [ "$real_type" = "$fake_type" ]; then
  echo "error: ${JS_PATH} and an invented path answer identically (${real_type}) — both are the SPA fallback" >&2
  exit "$EXIT_BYTES"
fi
echo "ok: ${JS_PATH} is ${real_type}, the invented path is ${fake_type}"

echo "→ the live API is reachable through the domain"
api_code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 "${CUSTOM}/api/live-buses")"
if [ "$api_code" != "200" ]; then
  echo "error: ${CUSTOM}/api/live-buses returned ${api_code}, expected 200" >&2
  exit "$EXIT_BYTES"
fi
echo "ok: ${CUSTOM}/api/live-buses -> 200"

echo "→ security headers are present"
headers="$(curl -sI --max-time 20 "${CUSTOM}/" || true)"
for want in strict-transport-security content-security-policy x-content-type-options; do
  if ! printf '%s' "$headers" | grep -qi "$want"; then
    echo "error: ${CUSTOM}/ is missing ${want}" >&2
    exit "$EXIT_BYTES"
  fi
done
echo "ok: HSTS, CSP and nosniff are all present"

# ── every deployment of THIS commit must serve the same bytes ───────────────
# One commit is deployed twice — locally by scripts/deploy-usdot.sh and in CI
# by depa-usdot.yml — and whichever finishes last owns the preview domain. If
# the LOCAL deployment owns it, comparing the domain against the local build is
# comparing the deployment to itself. Each deployment of the commit is
# therefore checked by its own deployment URL, so a build input that differs
# between the two is a failure rather than a coincidence.
PROJECT="${PAGES_PROJECT:-phuket-smart-bus}"
HEAD_SHORT="$(git rev-parse --short HEAD)"
BRANCH_NAME="${CUSTOM#https://}"; BRANCH_NAME="${BRANCH_NAME#http://}"; BRANCH_NAME="${BRANCH_NAME%/}"
DEPLOY_ROWS="$(npx --yes wrangler pages deployment list --project-name "$PROJECT" 2>/dev/null || true)"

DEPLOY_URLS="$(printf '%s\n' "$DEPLOY_ROWS" | awk -F'│' -v sha="$HEAD_SHORT" -v branch="$BRANCH_NAME" '
  {
    br = $4; src = $5; url = $6;
    gsub(/[[:space:]]/, "", br); gsub(/[[:space:]]/, "", src); gsub(/[[:space:]]/, "", url);
    if (br == branch && src != "" && url != "" && index(src, sha) == 1) print url
  }' | sort -u)"

CHECKED=0
while IFS= read -r url; do
  [ -n "$url" ] || continue
  echo "→ comparing deployment $url"
  BASE_URL="$url" node scripts/verify-assets.mjs || exit "$EXIT_BYTES"
  CHECKED=$((CHECKED + 1))
done <<< "$DEPLOY_URLS"

if [ "$CHECKED" -gt 0 ]; then
  echo "ok: $CHECKED further deployment(s) of ${HEAD_SHORT} serve identical bytes"
else
  echo "warn: no further deployment of ${HEAD_SHORT} was found to compare"
fi

echo
echo "✓ toolkit deploy verified"

# ── the design gate ────────────────────────────────────────────────────────
# The bytes can be perfect and the page can still be wrong: a type token
# that no scope defines, a band that starts on a different line, a size
# that no token names. The branch carries its own copy of the toolkit, so
# it needs the gate too.
if [ "${SKIP_DESIGN_GATE:-0}" != "1" ]; then
  if command -v node >/dev/null 2>&1 && [ -d node_modules/playwright ]; then
    bash scripts/design/verify-design.sh "$CUSTOM" || exit "$EXIT_GATE"
  else
    echo "warn: playwright is not installed — the design gate did not run"
  fi
fi
