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
bash scripts/verify-deploy.sh

echo
echo "✓ deployed and verified"
