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
#
# The branch worktree needs its own .env. It is gitignored, so a fresh
# worktree does not have one, and a build without VITE_GISTDA_API_KEY is a
# different product: the GISTDA incident layer is compiled out and the map's
# "Incidents" control is not offered. Copy the main worktree's .env here
# (cp <main>/.env .env) so this branch ships the same map production does.
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
#
# MEASURED 2026-10-20, and only the invariant is claimed: the local build
# and the CI build of one commit used to differ on this, because only the
# local build made the copy, and one commit shipped two different products.
# Both make it now. What status the edge answers with has been observed as
# both 404 and 200 across deployments of the same source, and which one
# applies is NOT visible from outside — Pages' clean-URL redirect on
# /404.html only says the path is not served as a file. So the rule is: the
# two builds must be identical, and the two hosts must agree, and
# scripts/verify-usdot-deploy.sh asserts the second.
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
if bash scripts/verify-usdot-deploy.sh; then
  echo
  echo "✓ toolkit deployed and verified"
else
  echo
  echo "✗ the bytes ARE deployed and live — the upload worked."
  echo "  What failed is the gate above, and a failed gate is not a failed upload:"
  echo "  read the finding, fix the finding, deploy again."
  exit 1
fi
