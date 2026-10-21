#!/usr/bin/env bash
#
# Proves the one-left-edge rule can fail — including the control-cluster
# carve-out added when the toolkit's source switcher moved into the header's
# own row.
#
# A gate that has never failed is a gate that might never work. Three cases:
#
#   the clean control   → every band on the gutter, the switcher at the
#                         right of the header's row → must PASS
#   the band variant   → the bands below the header sit 80px to the left →
#                         must FAIL
#   the cluster variant→ the switcher is pushed LEFT of the gutter, still in
#                         the header's row, so only the cluster rule can see
#                         it → must FAIL
#
# The third case is the one the refinement could have quietly switched off.
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

run() { # variant, expected (pass|fail)
  local variant="$1" expect="$2" out code
  out=$(node scripts/design/guttercheck.mjs --base "http://127.0.0.1:$PORT" --route "/gutter.html?variant=$variant" 2>&1)
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

if [ "$fail" -eq 0 ]; then
  echo "gutter instrument: PROVEN — it bites, and it stays quiet."
else
  echo "gutter instrument: NOT PROVEN."
fi
exit "$fail"
