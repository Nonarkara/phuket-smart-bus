#!/usr/bin/env bash
#
# Proves the spatial-hallucination instrument can fail.
#
# A gate that has never failed is a gate that might never work. This runs
# the instrument against a fixture that carries one deliberate instance of
# every failure mode, and against a clean control that carries none:
#
#   the fixture  → must report EVERY mode, and exit non-zero
#   the control  → must report NOTHING, and exit zero
#
# If the instrument stops biting, or starts crying wolf, this fails.
#
set -uo pipefail
cd "$(dirname "$0")/../.."

# A port collision is silent and deadly: the request lands on somebody
# else's server, the fixture 404s, and the instrument "passes" against a
# page that was never there. Pick a free port and PROVE the server answers.
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
  if curl -sf "http://127.0.0.1:$PORT/space.html" -o /dev/null; then break; fi
  sleep 0.3
done
if ! curl -sf "http://127.0.0.1:$PORT/space.html" -o /dev/null; then
  echo "the fixture server never answered on port $PORT — refusing to prove anything"
  exit 2
fi

fail=0

echo "── the fixture: every mode must be caught ──────────────────────────"
OUT=$(node scripts/design/space.mjs /space.html --base "http://127.0.0.1:$PORT" 2>&1)
echo "$OUT" | sed 's/^/  /'
for mode in "CLIPPED CONTENT" "DEAD SPACE" "ORPHAN" "SCATTERED actions" "EQUAL-WEIGHT peers" "ACCIDENTAL WRAP" "EMPTY SCREEN" "SCROLL TRAP"; do
  if echo "$OUT" | grep -q "$mode"; then
    echo "  ✓ $mode is caught"
  else
    echo "  ✗ $mode is NOT caught — the instrument is blind here"
    fail=1
  fi
done

echo
echo "── the control: a well-formed page must report nothing ─────────────"
CLEAN=$(node scripts/design/space.mjs /space-clean.html --base "http://127.0.0.1:$PORT" 2>&1)
echo "$CLEAN" | sed 's/^/  /'
if echo "$CLEAN" | grep -q "total spatial-hallucination findings: 0"; then
  echo "  ✓ the control is clean — the instrument does not cry wolf"
else
  echo "  ✗ the control reported findings — the instrument cries wolf"
  fail=1
fi

echo
if [ "$fail" -eq 0 ]; then
  echo "space instrument: PROVEN — it bites, and it stays quiet."
else
  echo "space instrument: NOT PROVEN."
fi
exit "$fail"
