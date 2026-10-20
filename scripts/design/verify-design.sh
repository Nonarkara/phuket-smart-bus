#!/usr/bin/env bash
# The design gate, run against a DEPLOYED site.
#
# WHY THIS EXISTS
#   The toolkit view once rendered every text element at 13, 15 or 28px,
#   because sixteen of its type declarations named a token the view's scope
#   did not define. A declaration whose var() has no value is invalid at
#   computed-value time: the property silently inherits, so the page lost
#   the hierarchy it had been designed with and NOTHING failed. The same
#   page had three left margins — the header at 24px, the body at 104px —
#   so the top of the page and the page under it looked like two teams'
#   work.
#
#   Those defects are invisible to a screenshot review and invisible to an
#   instrument that only counts RENDERED sizes. These are the checks that
#   see them:
#
#     tokenscope  — no rule may name a type token its scope does not define,
#                   and every scope that defines tokens defines all eight
#     guttercheck — every band of a page starts on the same line
#     offscale    — every size a page renders is a size the scale names
#     typeaudit2  — the ≤8 ramp law, and no heavy grotesque posing as type
#
#   Each one is proven to FAIL: tokenscope named 17 dead declarations and
#   guttercheck reported 80px of disagreement against the build that had
#   the bug. An instrument that cannot fail is decoration.
#
#   AND EACH ONE MUST CHECK SOMETHING. The first version of this gate
#   passed the routes to offscale as `--fleet/raw --fleet --study` — flags,
#   not arguments — and offscale drops anything that starts with `--`. It
#   therefore received ZERO routes, reported "total off-scale elements: 0",
#   and the gate printed "ok" for a check that had never run. A green light
#   on a check that checked nothing is the worst outcome a gate can have,
#   because it looks like evidence.
#
#   Usage: scripts/design/verify-design.sh [baseUrl]
set -uo pipefail

BASE="${1:-https://bus.nonarkara.org}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

failed=0

run() {
  local name="$1"; shift
  echo ""
  echo "── $name ──"
  if "$@"; then
    echo "ok: $name"
  else
    echo "FAIL: $name" >&2
    failed=$((failed + 1))
  fi
}

# The routes the type checks cover. Every route the app serves, so a rule
# that holds on seven of nineteen is not a rule.
ROUTES=(
  "/" "/ops" "/fleet" "/fleet/raw" "/study" "/research" "/capacity"
  "/toolkit" "/roi" "/driver" "/v2" "/governor" "/info" "/more"
  "/stops" "/pass" "/ride" "/compare"
)

run "type tokens resolve where they are used" \
  node scripts/design/tokenscope.mjs --render --base "$BASE"

run "one left edge per page" \
  node scripts/design/guttercheck.mjs --base "$BASE"

# The routes go as ARGUMENTS. A route that begins with "--" is a flag, and
# offscale drops flags — that is how this check spent a week passing
# nothing at all.
run "every rendered size is on the scale" \
  node scripts/design/offscale.mjs "${ROUTES[@]}" --base "$BASE"

run "the ramp law, and no grotesque posing as type" \
  BASE="$BASE" node scripts/design/typeaudit2.mjs

echo ""
if [ "$failed" -gt 0 ]; then
  echo "design gate: $failed check(s) FAILED against $BASE" >&2
  exit 1
fi
echo "design gate: all checks pass against $BASE"
