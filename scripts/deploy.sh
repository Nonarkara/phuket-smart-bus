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
# Likewise, dist/client/404.html must mirror dist/client/index.html for
# SPA fallback to work on Pages — Cloudflare serves 404.html for any
# path the router doesn't recognise.
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
if command -v mavis-trash >/dev/null 2>&1; then
  mavis-trash dist
else
  rm -rf dist
fi

echo "→ vite build"
npx vite build

echo "→ cp dist/client/index.html dist/client/404.html (SPA fallback)"
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
echo "✓ deployed. verify with:"
echo "  curl -sI https://bus.nonarkara.org/api/vehicles/last | head -1   # expect 200"
echo "  npx wrangler pages deployment list --project-name phuket-smart-bus | head -3"
