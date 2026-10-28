#!/usr/bin/env bash
# Deploy phuket-smart-bus to Cloudflare Pages production.
#
# Working path until CLOUDFLARE_API_TOKEN GH-Actions secret is fixed —
# `wrangler pages deploy` from the local machine bypasses the broken
# Actions webhook entirely.
#
# CRITICAL: wrangler expects Pages Functions at <deploy-dir>/functions/,
# NOT at the project root. The Functions source lives at ./functions/
# in this repo (Cloudflare convention) but vite builds into ./dist/client/.
# Copy the Functions tree into dist/client/functions/ before deploy,
# otherwise the static bundle ships alone and every /api/* route 404s.
#
# SPA routes (/ops, /fleet, …) are explicit public/_redirects → / 200 rules.
# dist/client/404.html (a copy of index.html) is what the rest of the paths
# get: the app, with a 404 status, instead of a host error page.
#
# MEASURED 2026-10-20, and only the invariant is claimed here: the local
# build and the CI build of one commit used to differ on this, because only
# the local build made the copy, and one commit shipped two different
# products. Both make it now. What status the edge answers with has been
# observed as both 404 and 200 across deployments of the same source, and
# which one applies is NOT visible from outside — Pages' clean-URL redirect
# on /404.html only says the path is not served as a file. So the rule is:
# the two builds must be identical, and the two hosts must agree, and
# scripts/verify-deploy.sh asserts the second.
#
# Usage:
#   scripts/deploy.sh                  # auto commit-message from git log
#   scripts/deploy.sh "custom message" # explicit commit-message
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

if [ ! -d functions ]; then
  echo "error: ./functions/ not found at $PROJECT_ROOT" >&2
  exit 1
fi

# Trashed dist defeats Vite's incremental-cache old-bundle-hash problem —
# without this, a stale chunk can keep shipping across rebuilds.
# mavis-trash exits non-zero when there's nothing to trash (no dist/ yet)
# and that fails the script under `set -e`. `|| true` keeps it safe on a
# clean checkout; rm -rf is the fallback when the trash tool is absent.
if command -v mavis-trash >/dev/null 2>&1; then
  mavis-trash dist || true
else
  rm -rf dist
fi

echo "→ vite build"
npx vite build

cp dist/client/index.html dist/client/404.html

echo "→ cp -r functions dist/client/functions (Pages Functions ship with dist)"
cp -r functions dist/client/functions

COMMIT_HASH="$(git rev-parse --short HEAD)"
COMMIT_MESSAGE="${1:-$(git log -1 --pretty=%s)}"

echo "→ wrangler pages deploy dist/client ($COMMIT_HASH)"
npx --yes wrangler pages deploy dist/client \
  --project-name phuket-smart-bus \
  --branch=main \
  --commit-dirty=true \
  --commit-hash="$COMMIT_HASH" \
  --commit-message="$COMMIT_MESSAGE"

# The research rate limit is a Worker route, not a Pages binding
# (pages deploy rejects [[ratelimits]]). Deploy it after the origin
# exists so /api/research/* can be fetched from pages.dev.
echo "→ wrangler deploy research gate"
npx --yes wrangler deploy -c wrangler.research.toml

echo
echo "→ verify deployed bytes and live API"
# `set -e` would exit on the failure before the code could be read, so the
# call is made safe explicitly and the code is captured.
VERIFY_CODE=0
bash scripts/verify-deploy.sh || VERIFY_CODE=$?
if [ "$VERIFY_CODE" -eq 0 ]; then
  echo
  echo "✓ deployed and verified"
  exit 0
fi
echo
if [ "$VERIFY_CODE" -eq 1 ]; then
  # Exit 1 = the GATE failed. The bytes above were verified as live and
  # identical to this build, so the upload worked and the finding is the
  # thing to fix.
  echo "✗ the bytes ARE deployed and live — the upload worked."
  echo "  What failed is the gate above, and a failed gate is not a failed upload:"
  echo "  read the finding, fix the finding, deploy again."
else
  # Exit 2 = the BYTES were not verified live inside the wait window. That
  # is the fact, and it is the only fact: the check cannot tell an upload
  # that never landed from an edge that has not caught up, and MEASURED
  # 2026-10-23 the second one happened — the upload reported success, the
  # alias passed, and the custom domain was still serving the previous
  # deployment's chunks a minute later. So this message does NOT say the
  # upload failed, because that is not what was measured. The operator has
  # to check the deployment list and the edge before re-uploading.
  echo "✗ the bytes were not verified live within the wait window."
  echo "  What was measured is that the host did not serve this build in time."
  echo "  That does NOT mean the upload failed: the edge may still be propagating,"
  echo "  or the upload may not have landed. Check the deployment list for this"
  echo "  commit, and whether the edge has caught up, before re-uploading; and do"
  echo "  not read the finding above as a layout problem."
fi
exit 1
