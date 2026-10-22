#!/usr/bin/env bash
#
# Proves the one-left-edge rule can fail — including the control-cluster
# carve-out added when the toolkit's source switcher moved into the header's
# own row, and the DECLARED ROLES that replaced the geometric guess.
#
# A gate that has never failed is a gate that might never work. Nine cases:
#
#   the clean control   → every band on the gutter, the switcher at the
#                         right of the header's row → must PASS
#   the band variant   → the bands below the header sit 80px to the left →
#                         must FAIL
#   the cluster variant→ the switcher is pushed LEFT of the gutter, still in
#                         the header's row, so only the cluster rule can see
#                         it → must FAIL
#   the shared-row band→ a BAND is dragged 400px right AND pulled into the
#                         header's row, which is where the old geometric
#                         guess excused it → must FAIL
#   the moved cluster  → a cluster drops to a second row but stays right of
#                         the gutter, which the old guess called a band and
#                         failed on → must FAIL (the declaration only holds
#                         while the cluster is IN its band)
#   the insights bridge→ the switcher IS a band on its own row → must PASS
#                         when it sits on the gutter, FAIL when it does not
#   the overhung cluster→ a cluster still in the header's row that hangs past
#                         the right edge of the screen → must FAIL (a cluster
#                         is exempt from the gutter, never from the viewport)
#   the bandless surface→ a surface that declares no band at all → must FAIL
#                         (a rule with nothing to measure must not print a
#                         pass — and the surface table is supplied from a file
#                         so the REAL instrument can be driven with it)
#
# The fourth case is the hole the geometric guess left open. The fifth is
# the false positive the same guess produced. Both were found by an
# independent review; a rule that cannot tell a band from a cluster by its
# own geometry cannot survive either. The last three cases were found by the
# NEXT independent review, which found the rules working but the PROOF not
# covering them: a rule that is never exercised cannot be proven.
#
set -uo pipefail
cd "$(dirname "$0")/../.."

PORT="${PORT:-}"
if [ -z "$PORT" ]; then
  for try in 8123 8124 8125 8126 8127 8128; do
    if ! nc -z 127.0.0.1 "$try" 2>/dev/null; then PORT="$try"; break; fi
  done
fi
[ -n "$PORT" ] || { echo "no free port for the fixture server"; exit 2; }

FIXTURES="scripts/design/fixtures"

python3 -m http.server "$PORT" --directory "$FIXTURES" >/dev/null 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null || true' EXIT

for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -sf "http://127.0.0.1:$PORT/gutter.html" -o /dev/null; then break; fi
  sleep 0.3
done
if ! curl -sf "http://127.0.0.1:$PORT/gutter.html" -o /dev/null; then
  echo "the fixture server never answered on port $PORT — refusing to prove anything"
  exit 2
fi

fail=0

run() { # variant, expected (pass|fail), surface
  local variant="$1" expect="$2" surface="${3:-toolkit}" out code
  out=$(node scripts/design/guttercheck.mjs --base "http://127.0.0.1:$PORT" --route "/gutter.html?variant=$variant" --surface "$surface" 2>&1)
  code=$?
  echo "$out" | sed 's/^/  /'
  if [ "$expect" = "pass" ] && [ "$code" -eq 0 ]; then
    echo "  ✓ the $variant case passes, as it must"
  elif [ "$expect" = "fail" ] && [ "$code" -ne 0 ]; then
    echo "  ✓ the $variant case fails, as it must"
  else
    echo "  ✗ the $variant case did not $expect — the instrument is blind here"
    fail=1
  fi
  echo
}

echo "── the control: every band on one left edge ─────────────────────────"
run clean pass

echo "── a band 80px to the left of the header ─────────────────────────────"
run band-off fail

echo "── a control cluster pushed left of the gutter ───────────────────────"
run cluster-left fail

echo "── a band dragged right while sharing the header's row ───────────────"
run shared-row-band fail

echo "── a control cluster that has left its band ─────────────────────────"
run cluster-moved fail toolkit

echo "── the insights bridge: a band on its own row ───────────────────────"
run insights pass insights
run insights-off fail insights

echo "── a control cluster that hangs past the right edge ───────────────────"
run overhung fail toolkit

echo "── a surface that declares no band at all ────────────────────────────"
# The rule "a surface that declares no band FAILS" cannot be exercised on a
# real surface — every real surface has a band. So the surface table is
# supplied from a file here, and the REAL instrument runs against it.
BANDLESS="$(mktemp -t bandless-surfaces).json"
cat > "$BANDLESS" <<'JSON'
[
  {
    "id": "bandless",
    "route": "/gutter.html?variant=clean",
    "label": "a surface that declares no band",
    "probes": [[".v2-source", "source switcher", "cluster"]]
  }
]
JSON
OUT=$(node scripts/design/guttercheck.mjs --base "http://127.0.0.1:$PORT" --surfaces "$BANDLESS" 2>&1)
code=$?
rm -f "$BANDLESS"
echo "$OUT" | sed 's/^/  /'
if echo "$OUT" | grep -q "declares no band" && [ "$code" -ne 0 ]; then
  echo "  ✓ the bandless case fails, as it must — a rule with nothing to measure cannot pass"
else
  echo "  ✗ the bandless case passed — a surface with no gutter printed a pass"
  fail=1
fi
echo

if [ "$fail" -eq 0 ]; then
  echo "gutter instrument: PROVEN — it bites, and it stays quiet."
else
  echo "gutter instrument: NOT PROVEN."
fi
exit "$fail"
