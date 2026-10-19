#!/usr/bin/env bash
# Deploy the depa · USDOT toolkit (branch depa-usdot.nonarkara.org).
#
# This script CANNOT touch the production site. It deploys to a Pages PREVIEW
# deployment (--branch=depa-usdot.nonarkara.org) of the same project, so
# bus.nonarkara.org — the production branch — is never overwritten. The
# custom domain depa-usdot.nonarkara.org is held by the Worker in
# cloudflare/toolkit-domain-router.ts, which routes /api/* to the production
# Pages deployment (Pages Functions only run on the production branch).
#
# Usage:
#   scripts/deploy-usdot.sh
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

PAGES_PROJECT="phuket-smart-bus"
TOOLKIT_BRANCH="depa-usdot.nonarkara.org"

if [ ! -d functions ]; then
  echo "error: ./functions/ not found at $PROJECT_ROOT" >&2
  exit 1
fi

# Trashed dist defeats Vite's incremental-cache old-bundle-hash problem.
if command -v mavis-trash >/dev/null 2>&1; then
  mavis-trash dist || true
else
  rm -rf dist
fi

echo "→ vite build"
npx vite build

# The SPA shell, so an unknown path still renders the app (with a 404).
cp dist/client/index.html dist/client/404.html

# Pages Functions ship with the deploy directory.
cp -r functions dist/client/functions

COMMIT_HASH="$(git rev-parse --short HEAD)"
COMMIT_MESSAGE="$(git log -1 --pretty=%s)"

echo "→ wrangler pages deploy dist/client ($COMMIT_HASH) as preview branch ${TOOLKIT_BRANCH}"
npx --yes wrangler pages deploy dist/client \
  --project-name "$PAGES_PROJECT" \
  --branch="$TOOLKIT_BRANCH" \
  --commit-dirty=true \
  --commit-hash="$COMMIT_HASH" \
  --commit-message="$COMMIT_MESSAGE"

echo "→ wrangler deploy the domain router"
npx --yes wrangler deploy -c wrangler.toolkit.jsonc

echo
echo "→ verify"
bash scripts/verify-usdot-deploy.sh

echo
echo "✓ toolkit deployed and verified"
