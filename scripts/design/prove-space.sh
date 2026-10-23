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
echo "── the permitted layouts: four legal shapes must report nothing ─────"
#   A · a BAR whose height is the data — the empty space under the label
#       is the bar's length, not the grid's leftover.
#   B · a PARAGRAPH that ends in bare text — the last line of a box is a
#       range over its text, not the bottom of its last element.
#   C · CONTENT in the clipper's padding — `overflow: hidden` clips at the
#       padding box, and a threshold line that overhangs the columns is
#       not cut off by anything.
#   D · a BAR whose width is the value — the space beside a 46% fill is the
#       rest of the money, not an item stranded in a row of its own.
ALLOWED=$(node scripts/design/space.mjs /space-allowed.html --base "http://127.0.0.1:$PORT" 2>&1)
echo "$ALLOWED" | sed 's/^/  /'
if echo "$ALLOWED" | grep -q "total spatial-hallucination findings: 0"; then
  echo "  ✓ the four permitted layouts report nothing"
else
  echo "  ✗ a permitted layout was reported — the rule is too strict"
  fail=1
fi

echo
echo "── a page measured before it has LOADED is not the page ──────────────"
# The gate waited five seconds and called that a page. The legacy consumer
# chain retries a missing API after three seconds, so at five seconds the
# stop list was still EMPTY and five routes reported "0 findings" on pages
# that turned out to be 9,251px tall. The fixture is 1,000px tall for the
# first seven seconds and 9,000px after that; the instrument reports the
# page's height, so it must report the tall one.
LATE=$(node scripts/design/space.mjs /late-load.html --base "http://127.0.0.1:$PORT" 2>&1 | grep -oE "page [0-9]+px tall" | head -1)
echo "  measured: $LATE"
LP=$(echo "$LATE" | grep -oE "[0-9]+" | head -1)
if [ -n "$LP" ] && [ "$LP" -gt 5000 ]; then
  echo "  ✓ the instrument waited for the content to arrive"
else
  echo "  ✗ the instrument measured the page before it loaded — the gate can pass a page it never saw"
  fail=1
fi

echo
echo "── a hash route must be a FRESH DOCUMENT at each width ───────────────"
# `goto` to the same URL with a different fragment is a SAME-DOCUMENT
# navigation: nothing reloads, and a page that fitted itself to the viewport
# at mount keeps the old fit at the new width. The fixture counts its own
# loads and makes the document that tall, and the instrument reports the
# page's height — so the second measurement must report a TALLER page.
H1=$(node scripts/design/space.mjs "/hash-reload.html#one" --base "http://127.0.0.1:$PORT" 2>&1 | grep -oE "page [0-9]+px tall" | head -1)
H2=$(node scripts/design/space.mjs "/hash-reload.html#two" --base "http://127.0.0.1:$PORT" 2>&1 | grep -oE "page [0-9]+px tall" | head -1)
echo "  first:  $H1"
echo "  second: $H2"
P1=$(echo "$H1" | grep -oE "[0-9]+" | head -1)
P2=$(echo "$H2" | grep -oE "[0-9]+" | head -1)
if [ -n "$P1" ] && [ -n "$P2" ] && [ "$P2" -gt "$P1" ]; then
  echo "  ✓ the second measurement of a hash route loaded a new document"
else
  echo "  ✗ the second measurement reused the first document — a page measured at two widths is TWO pages"
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
