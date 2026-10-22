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
# It also proves three rules that are easy to get wrong:
#
#   a 404 is NOT a clean route
#   a redirect is NOT the page you asked for
#   a marker on a rail is data, not an action — but only when BOTH members
#   of the pair are markers
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

# The fixture server answers 200, 404 and ONE redirect — the redirect is what
# proves the gate notices when it lands on a different page than it asked for.
node "$FIXTURES/serve.mjs" "$PORT" >/dev/null 2>&1 &
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
echo "── a route that is not there must not read as a clean route ──────────"
GONE=$(node scripts/design/space.mjs /no-such-route.html --base "http://127.0.0.1:$PORT" 2>&1)
echo "$GONE" | sed 's/^/  /'
if echo "$GONE" | grep -q "NOT MEASURED"; then
  echo "  ✓ a 404 is reported as a route that could not be measured"
else
  echo "  ✗ a 404 was measured as if it were a page — the gate can pass on a route that does not exist"
  fail=1
fi

echo
echo "── a redirect is not the page you asked for ────────────────────────"
REDIR=$(node scripts/design/space.mjs /redirect-to-clean.html --base "http://127.0.0.1:$PORT" 2>&1)
echo "$REDIR" | sed 's/^/  /'
if echo "$REDIR" | grep -q "NOT MEASURED"; then
  echo "  ✓ a redirect is reported as a route that could not be measured"
else
  echo "  ✗ a redirect was measured as if it were the requested route — the gate can pass on a page it never asked for"
  fail=1
fi

echo
echo "── a marker on a rail is data; an action is an action ───────────────"
MARKERS=$(node scripts/design/space.mjs "/space-marker.html?variant=pair-of-markers" --base "http://127.0.0.1:$PORT" 2>&1)
echo "$MARKERS" | sed 's/^/  /'
if echo "$MARKERS" | grep -q "SCATTERED actions"; then
  echo "  ✗ two bus markers on a rail were reported as scattered actions — the instrument reads data as layout"
  fail=1
else
  echo "  ✓ two markers on a rail are not scattered actions"
fi

MIXED=$(node scripts/design/space.mjs "/space-marker.html?variant=marker-and-action" --base "http://127.0.0.1:$PORT" 2>&1)
echo "$MIXED" | sed 's/^/  /'
if echo "$MIXED" | grep -q "SCATTERED actions"; then
  echo "  ✓ a marker and a real action are still a pair to measure"
else
  echo "  ✗ a marker excused a real scattered action — the marker exemption is too wide"
  fail=1
fi

PLACED=$(node scripts/design/space.mjs "/space-marker.html?variant=absolute-not-marker" --base "http://127.0.0.1:$PORT" 2>&1)
echo "$PLACED" | sed 's/^/  /'
if echo "$PLACED" | grep -q "SCATTERED actions"; then
  echo "  ✓ an action placed by a percentage is still an action"
else
  echo "  ✗ a placed action was excused because it is absolutely positioned — the marker exemption is generic"
  fail=1
fi

BOTH=$(node scripts/design/space.mjs "/space-marker.html?variant=both-placed" --base "http://127.0.0.1:$PORT" 2>&1)
echo "$BOTH" | sed 's/^/  /'
if echo "$BOTH" | grep -q "SCATTERED actions"; then
  echo "  ✓ two placed actions are still two actions — the exemption needs BOTH members to be markers"
else
  echo "  ✗ a pair of placed actions was excused — the marker exemption dropped both members"
  fail=1
fi

echo
if [ "$fail" -eq 0 ]; then
  echo "space instrument: PROVEN — it bites, and it stays quiet."
else
  echo "space instrument: NOT PROVEN."
fi
exit "$fail"
