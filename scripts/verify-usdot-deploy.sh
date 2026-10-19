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

CUSTOM="${CUSTOM:-https://depa-usdot.nonarkara.org}"
INDEX="dist/client/index.html"

if [ ! -f "$INDEX" ]; then
  echo "error: $INDEX is missing; build before verification" >&2
  exit 1
fi

hash_file() { shasum -a 256 "$1" | awk '{print $1}'; }
hash_url() { curl -fsS --max-time 20 "$1" | shasum -a 256 | awk '{print $1}'; }
asset_path() { sed -nE "$1" "$INDEX" | head -1; }

JS_PATH="$(asset_path 's@.*src="(/assets/[^\"]+\.js)".*@\1@p')"
CSS_PATH="$(asset_path 's@.*href="(/assets/[^\"]+\.css)".*@\1@p')"

if [ -z "$JS_PATH" ] || [ -z "$CSS_PATH" ]; then
  echo "error: could not resolve built JS/CSS from $INDEX" >&2
  exit 1
fi

probe_asset() {
  local host="$1" path="$2" want got attempt streak=0
  want="$(hash_file "dist/client${path}")"
  for attempt in 1 2 3 4 5 6 7 8 9 10 11 12; do
    got="$(hash_url "${host}${path}?probe=${attempt}-$(date +%s)" || true)"
    if [ -n "$got" ] && [ "$got" = "$want" ]; then
      streak=$((streak + 1))
      if [ "$streak" -ge 3 ]; then
        echo "ok: ${host}${path} matched 3 consecutive probes"
        return 0
      fi
    else
      streak=0
      sleep 3
    fi
  done
  echo "error: ${host}${path} did not converge" >&2
  return 1
}

echo "→ static assets on ${CUSTOM}"
probe_asset "$CUSTOM" "$JS_PATH"
probe_asset "$CUSTOM" "$CSS_PATH"

echo "→ deep links return the app, not a 404"
for route in / /toolkit /ops /study; do
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "${CUSTOM}${route}")"
  if [ "$code" != "200" ]; then
    echo "error: ${CUSTOM}${route} returned ${code}, expected 200" >&2
    exit 1
  fi
  echo "ok: ${CUSTOM}${route} -> 200"
done

echo "→ the published path and an invented path must differ"
real_type="$(curl -s -o /dev/null -w '%{content_type}' --max-time 20 "${CUSTOM}${JS_PATH}")"
fake_type="$(curl -s -o /dev/null -w '%{content_type}' --max-time 20 "${CUSTOM}/assets/INVENTED-NAME.js")"
if [ "$real_type" = "$fake_type" ]; then
  echo "error: ${JS_PATH} and an invented path answer identically (${real_type}) — both are the SPA fallback" >&2
  exit 1
fi
echo "ok: ${JS_PATH} is ${real_type}, the invented path is ${fake_type}"

echo "→ the live API is reachable through the domain"
api_code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 "${CUSTOM}/api/live-buses")"
if [ "$api_code" != "200" ]; then
  echo "error: ${CUSTOM}/api/live-buses returned ${api_code}, expected 200" >&2
  exit 1
fi
echo "ok: ${CUSTOM}/api/live-buses -> 200"

echo "→ security headers are present"
headers="$(curl -sI --max-time 20 "${CUSTOM}/" || true)"
for want in strict-transport-security content-security-policy x-content-type-options; do
  if ! printf '%s' "$headers" | grep -qi "$want"; then
    echo "error: ${CUSTOM}/ is missing ${want}" >&2
    exit 1
  fi
done
echo "ok: HSTS, CSP and nosniff are all present"

echo
echo "✓ toolkit deploy verified"
