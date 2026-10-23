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

# TWO FAILURES, TWO EXIT CODES.
#   2 — the BYTES did not reach the host. The build is missing, the live
#       asset graph is not the local build, the production deployment
#       carries another commit, the edge function is not answering, or the
#       two hosts disagree. Nothing is live that was meant to be.
#   1 — the GATE failed. The bytes are live and correct; the design gate or
#       the shipability audit found something.
#
# Why the difference matters: the deploy script reports the outcome to a
# human, and there are exactly two things it can say. "The upload worked and
# the gate failed" sends the operator to fix a finding. "The upload worked"
# — said when the upload did NOT work — sends them nowhere, and the site
# stays on the old build while the log says it shipped. A message that
# cannot be false is worth two exit codes.
EXIT_BYTES=2
EXIT_GATE=1

# EVERY UNHANDLED FAILURE IS A BYTES FAILURE.
#
# The contract is "2 = the bytes did not reach the host, 1 = the gate
# failed", and the explicit checks below all say which they are. But a
# command that fails without an explicit `exit` — a `sort` that errors, a
# `git rev-parse` outside a repository, a curl that cannot connect — used
# to end the script with 1, and 1 means "the gate failed", so the deploy
# would print "the bytes ARE deployed and live" after a check that never
# finished. The trap makes the implicit paths explicit: anything that
# stops the script before the gate is a bytes failure, which is what it
# actually is.
trap 'echo "error: the verification stopped before the gate — the bytes were not fully checked" >&2; exit "$EXIT_BYTES"' ERR

CANONICAL="${CANONICAL:-https://phuket-smart-bus.pages.dev}"
CUSTOM="${CUSTOM:-https://bus.nonarkara.org}"
PROJECT="${PAGES_PROJECT:-phuket-smart-bus}"
INDEX="dist/client/index.html"

if [ ! -f "$INDEX" ]; then
  echo "error: $INDEX is missing; build before verification" >&2
  exit "$EXIT_BYTES"
fi

# ── the commit we are shipping ────────────────────────────────────────────
# The commit is a CROSS-CHECK, not the check: the byte graph above is what
# proves the right code is live. So a repository that cannot answer the
# question degrades to "byte check only" — the same way the wrangler
# lookup does — instead of stopping the run.
if HEAD_SHORT="$(git rev-parse --short HEAD 2>/dev/null)"; then
  :
else
  HEAD_SHORT=""
  echo "warn: could not read the commit from git; byte check only"
fi

# ── the whole asset graph, on both hosts ─────────────────────────────────
BASE_URL="$CANONICAL" node scripts/verify-assets.mjs || exit "$EXIT_BYTES"
BASE_URL="$CUSTOM" node scripts/verify-assets.mjs || exit "$EXIT_BYTES"

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
      exit "$EXIT_BYTES"
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
# A pipe that cannot be read is not a reason to stop: the list is a
# CROSS-CHECK on top of the byte graph, and an unreadable list means the
# cross-check is unavailable, not that the bytes failed. It says so.
DEPLOY_URLS="$(printf '%s\n' "$DEPLOY_ROWS" | awk -F'│' -v sha="$HEAD_SHORT" '
  {
    src = $5; url = $6;
    gsub(/[[:space:]]/, "", src); gsub(/[[:space:]]/, "", url);
    if (src != "" && url != "" && index(src, sha) == 1) print url
  }' | sort -u || true)"
if [ -z "$DEPLOY_URLS" ]; then
  echo "warn: no deployment list for this commit could be read; byte check only"
fi

CHECKED=0
while IFS= read -r url; do
  [ -n "$url" ] || continue
  case "$url" in
    "$CANONICAL" | "$CUSTOM") continue ;; # already compared above
  esac
  echo "→ comparing deployment $url"
  BASE_URL="$url" node scripts/verify-assets.mjs || exit "$EXIT_BYTES"
  CHECKED=$((CHECKED + 1))
done <<< "$DEPLOY_URLS"

if [ "$CHECKED" -gt 0 ]; then
  echo "ok: $CHECKED further deployment(s) of ${HEAD_SHORT} serve identical bytes"
else
  echo "warn: no further deployment of ${HEAD_SHORT} was found to compare"
fi

curl -fsS --max-time 20 "$CUSTOM/api/live-buses?probe=$(date +%s)" | grep -q '"status":"live"' || {
  echo "error: the live-bus edge function did not answer live JSON" >&2
  exit "$EXIT_BYTES"
}
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
  exit "$EXIT_BYTES"
fi
if [ "${custom_type%%;*}" != "text/html" ]; then
  echo "error: an unknown path answers ${custom_type}, not the app shell" >&2
  exit "$EXIT_BYTES"
fi
echo "ok: an unknown path answers ${custom_status} with the app shell on both hosts"

# ── the design gate ────────────────────────────────────────────────────────
# The bytes can be perfect and the page can still be wrong: a type token
# that no scope defines, a band that starts on a different line, a size
# that no token names. Those are the defects a byte check cannot see, and
# they have shipped before. The gate runs against the site that is LIVE.
if [ "${SKIP_DESIGN_GATE:-0}" != "1" ]; then
  if command -v node >/dev/null 2>&1 && [ -d node_modules/playwright ]; then
    bash scripts/design/verify-design.sh "$CUSTOM" || exit "$EXIT_GATE"
  else
    echo "warn: playwright is not installed — the design gate did not run"
  fi
fi

# ── the shipability audit ──────────────────────────────────────────────────
# The gate measures the LAYOUT. This measures whether the thing can be
# HANDED OVER: no page throws, no page reports the visitor to a third
# party, no page calls an API that does not exist, no secret is in the
# tree, and every route the app serves is one the gate measures.
#
# It also scans the git HISTORY, because a token that was removed is not
# removed — and that scan is slow, so it runs on the DEPLOY rather than on
# every local check.
if [ "${SKIP_SHIPABILITY:-0}" != "1" ]; then
  if command -v node >/dev/null 2>&1 && [ -d node_modules/playwright ]; then
    node scripts/design/shipaudit.mjs --base "$CUSTOM" --history || exit "$EXIT_GATE"
  else
    echo "warn: playwright is not installed — the shipability audit did not run"
  fi
else
  # A silent skip is the one thing a gate must never be. The escape hatch
  # exists for the owner, who may be mid-decision on a finding only they can
  # clear — but the hatch has to announce itself, in the deploy log, every
  # time it is used.
  echo "warn: THE SHIPABILITY AUDIT WAS SKIPPED (SKIP_SHIPABILITY=1)."
  echo "warn: this deploy was NOT checked for hand-over. Do not hand it over."
fi

