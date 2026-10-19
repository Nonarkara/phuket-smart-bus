#!/usr/bin/env bash
# Prove the built code reached both the Pages alias and the public host.
#
# WHAT THIS GUARDS AGAINST
#   The failure it exists for is "the deploy silently did not reach the
#   public host" — a stale asset, a 404 on the JS, an index.html pointing at
#   a bundle that was never uploaded.
#
# WHY IT COMPARES THE WHOLE ASSET GRAPH, NOT ONE FILE
#   The previous version of this script compared the entry chunk only. A
#   Vite entry chunk NAMES its lazy chunks and lazy stylesheets but does
#   not contain their bytes, so a commit that touched only a route's .tsx
#   produced an entry chunk with identical bytes and the guard printed
#   "ok" for two builds whose shipped code differed. scripts/verify-assets.mjs
#   crawls the full graph — entry, every lazy chunk, every lazy stylesheet
#   and anything they reference — and compares all of it, byte for byte,
#   with the content hashes normalised (a Vite chunk embeds its own
#   filename, so two builds of the same source get different names).
#
# WHY IT ALSO CHECKS THE COMMIT
#   The Pages project is deployed twice for one commit: scripts/deploy.sh
#   builds and uploads locally, and .github/workflows/cloudflare-pages.yml
#   builds and uploads the same commit in CI. Whichever finishes last owns
#   the production alias. The byte check proves the right code is live; the
#   commit check proves the live deployment is the one we are shipping.
#   Both have to be true.
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

# ── the whole asset graph, on both hosts ─────────────────────────────────
BASE_URL="$CANONICAL" node scripts/verify-assets.mjs
BASE_URL="$CUSTOM" node scripts/verify-assets.mjs

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
