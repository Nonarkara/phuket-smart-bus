#!/usr/bin/env bash
#
# Proves the type instrument can fail.
#
# A gate that has never failed is a gate that might never work. The type
# audit checks three laws:
#
#   the 11px FLOOR — no text a reader is asked to read is smaller
#   the ≤8 RAMP    — a surface renders at most eight distinct sizes
#   the BANDS      — the display face is never below 18px, never 600+
#                    below 40px, and never a serif
#
# and this runs it against a fixture that breaks the first, a fixture that
# breaks the second, and a clean control that breaks neither:
#
#   the floor fixture → must report the floor, and exit non-zero
#   the ramp fixture  → must report the ramp law, and exit non-zero
#   the control       → must report nothing, and exit zero
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

node "$FIXTURES/serve.mjs" "$PORT" >/dev/null 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null || true' EXIT

for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -sf "http://127.0.0.1:$PORT/type-clean.html" -o /dev/null; then break; fi
  sleep 0.3
done
if ! curl -sf "http://127.0.0.1:$PORT/type-clean.html" -o /dev/null; then
  echo "the fixture server never answered on port $PORT — refusing to prove anything"
  exit 2
fi

fail=0
BASE="http://127.0.0.1:$PORT"

echo "── the floor: text below 11px must be caught ────────────────────────"
OUT=$(node scripts/design/typeaudit2.mjs /type-floor.html --base "$BASE" 2>&1)
code=$?
echo "$OUT" | sed 's/^/  /'
if echo "$OUT" | grep -q "text below the 11px floor" && [ "$code" -ne 0 ]; then
  echo "  ✓ a 10px line is caught"
else
  echo "  ✗ a 10px line was not caught — the floor is decoration"
  fail=1
fi

echo
echo "── the ramp: more than eight sizes must be caught ──────────────────"
OUT=$(node scripts/design/typeaudit2.mjs /type-ramp.html --base "$BASE" 2>&1)
code=$?
echo "$OUT" | sed 's/^/  /'
if echo "$OUT" | grep -q "ramp law" && [ "$code" -ne 0 ]; then
  echo "  ✓ a nine-size surface is caught"
else
  echo "  ✗ a nine-size surface was not caught — the ramp law is decoration"
  fail=1
fi

echo
echo "── the control: a well-formed page must report nothing ─────────────"
OUT=$(node scripts/design/typeaudit2.mjs /type-clean.html --base "$BASE" 2>&1)
code=$?
echo "$OUT" | sed 's/^/  /'
if echo "$OUT" | grep -q "TOTAL VIOLATIONS: 0" && [ "$code" -eq 0 ]; then
  echo "  ✓ the control is clean — the instrument does not cry wolf"
else
  echo "  ✗ the control reported violations — the instrument cries wolf"
  fail=1
fi

echo
if [ "$fail" -eq 0 ]; then
  echo "type instrument: PROVEN — it bites, and it stays quiet."
else
  echo "type instrument: NOT PROVEN."
fi
exit "$fail"
