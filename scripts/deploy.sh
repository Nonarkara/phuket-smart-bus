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
# dist/client/404.html (a copy of index.html) catches everything else with
# status 404 — keep it, or Pages' SPA mode serves HTML 200 for /assets/nope.js.
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
  --commit-dirty=true \
  --commit-hash="$COMMIT_HASH" \
  --commit-message="$COMMIT_MESSAGE"

echo
echo "→ verify deployed bytes and live API"
bash scripts/verify-deploy.sh

echo
echo "✓ deployed and verified"
