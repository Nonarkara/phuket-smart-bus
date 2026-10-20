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
#
# WHY IT ALSO COMPARES EVERY DEPLOYMENT OF THE COMMIT
#   One commit is deployed twice — locally by scripts/deploy.sh and in CI by
#   cloudflare-pages.yml — and whichever finishes last owns the production
#   alias. If the LOCAL deployment owns the alias, then comparing the alias
#   against the local build is comparing the deployment to itself, and the
#   check passes no matter what CI built. The comparison that has teeth is
#   against EVERY deployment of this commit, each by its own URL: the CI
#   deployment's bytes are compared to the local build's bytes, so a build
#   input that differs between the two is a failure, not a coincidence.
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

# ── every deployment of THIS commit must serve the same bytes ───────────────
# The CI deployment and the local deployment are two builds of one commit.
# The alias may be owned by either, so the alias check above can degenerate
# into a self-comparison. Each deployment of the commit is therefore checked
# by its own deployment URL.
DEPLOY_URLS="$(printf '%s\n' "$DEPLOY_ROWS" | awk -F'│' -v sha="$HEAD_SHORT" '
  {
    src = $5; url = $6;
    gsub(/[[:space:]]/, "", src); gsub(/[[:space:]]/, "", url);
    if (src != "" && url != "" && index(src, sha) == 1) print url
  }' | sort -u)"

CHECKED=0
while IFS= read -r url; do
  [ -n "$url" ] || continue
  case "$url" in
    "$CANONICAL" | "$CUSTOM") continue ;; # already compared above
  esac
  echo "→ comparing deployment $url"
  BASE_URL="$url" node scripts/verify-assets.mjs
  CHECKED=$((CHECKED + 1))
done <<< "$DEPLOY_URLS"

if [ "$CHECKED" -gt 0 ]; then
  echo "ok: $CHECKED further deployment(s) of ${HEAD_SHORT} serve identical bytes"
else
  echo "warn: no further deployment of ${HEAD_SHORT} was found to compare"
fi

curl -fsS --max-time 20 "$CUSTOM/api/live-buses?probe=$(date +%s)" | grep -q '"status":"live"'
echo "ok: live-bus edge function returned live JSON"

# ── the two hosts must answer an unknown path the same way ────────────────
# MEASURED 2026-10-20: an unknown path answers with the app shell. The
# STATUS depends on whether the build carried the 404.html copy — 200 with
# it, 404 without — and only the local build used to make the copy, so the
# same commit could answer differently depending on which build owned the
# alias. The two hosts must not disagree, and the answer must be the shell
# (text/html), never a real asset.
INV="assets/INVENTED-NAME-$$.js"
canon_status="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$CANONICAL/$INV")"
custom_status="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$CUSTOM/$INV")"
custom_type="$(curl -s -o /dev/null -w '%{content_type}' --max-time 20 "$CUSTOM/$INV")"
if [ "$canon_status" != "$custom_status" ]; then
  echo "error: an unknown path answers ${canon_status} on the alias and ${custom_status} on the host — the two builds of this commit disagree" >&2
  exit 1
fi
if [ "${custom_type%%;*}" != "text/html" ]; then
  echo "error: an unknown path answers ${custom_type}, not the app shell" >&2
  exit 1
fi
echo "ok: an unknown path answers ${custom_status} with the app shell on both hosts"

# ── the design gate ────────────────────────────────────────────────────────
# The bytes can be perfect and the page can still be wrong: a type token
# that no scope defines, a band that starts on a different line, a size
# that no token names. Those are the defects a byte check cannot see, and
# they have shipped before. The gate runs against the site that is LIVE.
if [ "${SKIP_DESIGN_GATE:-0}" != "1" ]; then
  if command -v node >/dev/null 2>&1 && [ -d node_modules/playwright ]; then
    bash scripts/design/verify-design.sh "$CUSTOM"
  else
    echo "warn: playwright is not installed — the design gate did not run"
  fi
fi
