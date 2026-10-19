#!/usr/bin/env bash
# Prove the built code reached both the Pages alias and the public host.
#
# WHAT THIS GUARDS AGAINST
#   The failure it exists for is "the deploy silently did not reach the
#   public host" — a stale asset, a 404 on the JS, an index.html pointing at
#   a bundle that was never uploaded.
#
# WHY IT COMPARES CONTENT, NOT PATHS
#   A Vite entry chunk contains its own filename, because the other chunks
#   import from "./index-<hash>.js". Two builds of the SAME source therefore
#   get different asset names, and every chunk that references the entry
#   cascades to a different hash too. And the Pages project is deployed
#   twice for one commit: scripts/deploy.sh builds and uploads locally, and
#   .github/workflows/cloudflare-pages.yml builds and uploads the same
#   commit in CI. Whichever finishes last owns the production alias.
#   Comparing paths would therefore fail on a perfectly good deploy.
#
#   So this compares BYTES, with that one self-reference normalised away,
#   and separately checks that the production deployment carries the commit
#   we are shipping. Both have to be true.
#
#   Probe keys are disposable so a stale response cannot poison a
#   user-facing URL.
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

CANONICAL="${CANONICAL:-https://phuket-smart-bus.pages.dev}"
CUSTOM="${CUSTOM:-https://bus.nonarkara.org}"
PROJECT="${PAGES_PROJECT:-phuket-smart-bus}"
INDEX="dist/client/index.html"

if [ ! -f "$INDEX" ]; then
  echo "error: $INDEX is missing; build before verification" >&2
  exit 1
fi

# ── the commit we are shipping ────────────────────────────────────────────
HEAD_SHA="$(git rev-parse HEAD)"
HEAD_SHORT="$(git rev-parse --short HEAD)"

# ── byte comparison, with hashed asset names normalised ───────────────────
# The entry chunk embeds its own filename (the other chunks import from
# "./index-<hash>.js") AND lists every sibling chunk's filename in its
# dependency map. So one difference in the entry's name cascades through
# every chunk's name and back into every chunk's bytes. Normalising all
# hashed asset names away leaves the actual code, which is what we want to
# compare.
normalise() {
  sed -E 's#[A-Za-z0-9_]+-[A-Za-z0-9_-]{8}\.(js|css)#CHUNK-HASH.\1#g'
}

hash_local() {
  normalise < "$1" | shasum -a 256 | awk '{print $1}'
}

hash_remote() {
  curl -fsS --max-time 20 "$1" | normalise | shasum -a 256 | awk '{print $1}'
}

live_asset_paths() {
  local host="$1"
  local html
  html="$(curl -fsS --max-time 20 "$host/?probe=idx-$(date +%s)-$RANDOM")"
  echo "$html" | sed -nE 's@.*src="(/assets/[^"]+\.js)".*@\1@p' | head -1
  echo "$html" | sed -nE 's@.*href="(/assets/[^"]+\.css)".*@\1@p' | head -1
}

LOCAL_JS="$(sed -nE 's@.*src="(/assets/[^"]+\.js)".*@\1@p' "$INDEX" | head -1)"
LOCAL_CSS="$(sed -nE 's@.*href="(/assets/[^"]+\.css)".*@\1@p' "$INDEX" | head -1)"
if [ -z "$LOCAL_JS" ] || [ -z "$LOCAL_CSS" ]; then
  echo "error: could not resolve built JS/CSS from $INDEX" >&2
  exit 1
fi

WANT_JS="$(hash_local "dist/client${LOCAL_JS}")"
WANT_CSS="$(hash_local "dist/client${LOCAL_CSS}")"

probe_host() {
  local host="$1"
  local paths js css
  paths="$(live_asset_paths "$host")"
  js="$(echo "$paths" | sed -n 1p)"
  css="$(echo "$paths" | sed -n 2p)"
  if [ -z "$js" ] || [ -z "$css" ]; then
    echo "error: ${host} served an index.html with no asset references" >&2
    return 1
  fi

  local matched=0 attempt=0
  for attempt in 1 2 3 4 5 6 7 8 9 10 11 12; do
    local ok=1
    for pair in "js:$js:$WANT_JS" "css:$css:$WANT_CSS"; do
      kind="${pair%%:*}"; rest="${pair#*:}"
      path="${rest%%:*}"; want="${rest##*:}"
      got="$(hash_remote "${host}${path}?probe=${attempt}-$(date +%s)" || true)"
      if [ -z "$got" ] || [ "$got" != "$want" ]; then
        ok=0
        break
      fi
    done
    if [ "$ok" -eq 1 ]; then
      matched=$((matched + 1))
      if [ "$matched" -ge 3 ]; then
        echo "ok: ${host} serves the built code (${js}, ${css})"
        return 0
      fi
    else
      matched=0
    fi
    sleep 3
  done
  echo "error: ${host} did not converge on the built bytes" >&2
  return 1
}

probe_host "$CANONICAL"
probe_host "$CUSTOM"

# ── the production deployment must carry the commit we are shipping ───────
DEPLOY_ROWS="$(npx --yes wrangler pages deployment list --project-name "$PROJECT" 2>/dev/null || true)"
PROD_SHA="$(echo "$DEPLOY_ROWS" | awk -F'│' '/Production/ {gsub(/[[:space:]]/, "", $5); print $5; exit}')"
if [ -n "$PROD_SHA" ]; then
  case "$PROD_SHA" in
    "$HEAD_SHORT"*)
      echo "ok: the production deployment carries commit ${HEAD_SHORT}"
      ;;
    *)
      echo "error: the production deployment carries ${PROD_SHA}, not ${HEAD_SHORT}" >&2
      exit 1
      ;;
  esac
else
  echo "warn: could not read the production deployment commit; byte check only"
fi

curl -fsS --max-time 20 "$CUSTOM/api/live-buses?probe=$(date +%s)" | grep -q '"status":"live"'
echo "ok: live-bus edge function returned live JSON"
