#!/usr/bin/env bash
#
# Proves the shipability instrument can fail.
#
# A gate that has never failed is a gate that might never work. The
# shipability audit checks six things:
#
#   CONSOLE HEALTH    — an uncaught exception on a page
#   VISITOR COLLECTOR — the page reports the visitor somewhere
#   DISCLOSURE        — the page collects and says nothing about it
#   DEAD ENDPOINT     — the page calls an API that does not exist
#   SECRETS           — a secret-shaped string in the tree
#   GATE COVERAGE     — the app serves a route the design gate never measures
#
# and this runs the REAL instrument against a fixture for each of them, plus
# a clean control that must report nothing:
#
#   the console fixture    → must report the console, and exit non-zero
#   the collector fixture  → must report the collector, and exit non-zero
#   the no-notice fixture  → must report the disclosure, and exit non-zero
#   the collector WITH a
#     notice               → must NOT report a disclosure gap
#   the dead-endpoint one  → must report the endpoint, and exit non-zero
#   the dirty tree         → must report the secret, and exit non-zero
#   the gate missing a
#     route                → must report the coverage gap, and exit non-zero
#   the clean control      → must report nothing, and exit zero
#
set -uo pipefail
cd "$(dirname "$0")/../.."

PORT="${PORT:-}"
if [ -z "$PORT" ]; then
  for try in 8131 8132 8133 8134 8135 8136; do
    if ! nc -z 127.0.0.1 "$try" 2>/dev/null; then PORT="$try"; break; fi
  done
fi
[ -n "$PORT" ] || { echo "no free port for the fixture server"; exit 2; }

FIXTURES="scripts/design/fixtures"

node "$FIXTURES/serve.mjs" "$PORT" >/dev/null 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null || true' EXIT

for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -sf "http://127.0.0.1:$PORT/ship.html" -o /dev/null; then break; fi
  sleep 0.3
done
if ! curl -sf "http://127.0.0.1:$PORT/ship.html" -o /dev/null; then
  echo "the fixture server never answered on port $PORT — refusing to prove anything"
  exit 2
fi

BASE="http://127.0.0.1:$PORT"
fail=0

# run <label> <expect-finding|expect-clean> <extra args…>
run() {
  local label="$1"; shift
  local want="$1"; shift
  local out code
  out=$(node scripts/design/shipaudit.mjs --base "$BASE" --routes "/ship.html" "$@" 2>&1)
  code=$?
  echo "$out" | grep -E "^===|^  /ship|^total shipability" | sed 's/^/  /'
  if [ "$want" = "fail" ]; then
    if [ "$code" -ne 0 ]; then
      echo "  ✓ $label"
    else
      echo "  ✗ $label — the instrument passed a case it must fail"
      fail=1
    fi
  else
    if [ "$code" -eq 0 ]; then
      echo "  ✓ $label"
    else
      echo "  ✗ $label — the instrument cried wolf"
      fail=1
    fi
  fi
}

echo "── CONSOLE HEALTH: an uncaught exception must be caught ─────────────"
OUT=$(node scripts/design/shipaudit.mjs --base "$BASE" --routes "/ship.html?variant=console" 2>&1)
code=$?
echo "$OUT" | grep -E "^===|^  /ship|^total shipability" | sed 's/^/  /'
if echo "$OUT" | grep -q "CONSOLE HEALTH" && [ "$code" -ne 0 ]; then
  echo "  ✓ an uncaught exception is caught"
else
  echo "  ✗ an uncaught exception was not caught — the check is decoration"
  fail=1
fi

echo
echo "── VISITOR COLLECTOR: a beacon must be caught ────────────────────────"
OUT=$(node scripts/design/shipaudit.mjs --base "$BASE" --routes "/ship.html?variant=collector" 2>&1)
code=$?
echo "$OUT" | grep -E "^===|^  /ship|^total shipability" | sed 's/^/  /'
if echo "$OUT" | grep -q "VISITOR COLLECTOR" && [ "$code" -ne 0 ]; then
  echo "  ✓ a collector is caught"
else
  echo "  ✗ a collector was not caught — the check is decoration"
  fail=1
fi

echo
echo "── DISCLOSURE: collecting without saying so must be caught ───────────"
OUT=$(node scripts/design/shipaudit.mjs --base "$BASE" --routes "/ship.html?variant=no-disclosure" 2>&1)
code=$?
echo "$OUT" | grep -E "^===|^  /ship|^total shipability" | sed 's/^/  /'
if echo "$OUT" | grep -q "DISCLOSURE" && [ "$code" -ne 0 ]; then
  echo "  ✓ a collection with no notice is caught"
else
  echo "  ✗ a collection with no notice was not caught — the check is decoration"
  fail=1
fi

echo
echo "── DISCLOSURE: a collection WITH a notice must not be a finding ─────"
OUT=$(node scripts/design/shipaudit.mjs --base "$BASE" --routes "/ship.html?variant=collector" 2>&1)
code=$?
echo "$OUT" | grep -E "^===|^  /ship|^total shipability" | sed 's/^/  /'
if echo "$OUT" | grep -q "DISCLOSURE" && [ "$code" -ne 0 ]; then
  echo "  ✗ a page that DOES say what it collects was still called a gap — the check cries wolf"
  fail=1
else
  echo "  ✓ a page that says what it collects is not called a gap"
fi

echo
echo "── DEAD ENDPOINT: a call to an API that does not exist must be caught ─"
OUT=$(node scripts/design/shipaudit.mjs --base "$BASE" --routes "/ship.html?variant=dead-endpoint" 2>&1)
code=$?
echo "$OUT" | grep -E "^===|^  /ship|^total shipability" | sed 's/^/  /'
if echo "$OUT" | grep -q "DEAD ENDPOINT" && [ "$code" -ne 0 ]; then
  echo "  ✓ a dead endpoint is caught"
else
  echo "  ✗ a dead endpoint was not caught — the check is decoration"
  fail=1
fi

echo
echo "── SECRETS: a secret-shaped string in the tree must be caught ────────"
OUT=$(node scripts/design/shipaudit.mjs --base "$BASE" --routes "/ship.html?variant=clean" \
  --scan "$FIXTURES/dirty-tree" 2>&1)
code=$?
echo "$OUT" | grep -E "^===|^  /ship|^total shipability" | sed 's/^/  /'
if echo "$OUT" | grep -q "SECRETS" && [ "$code" -ne 0 ]; then
  echo "  ✓ a secret in the tree is caught"
else
  echo "  ✗ a secret in the tree was not caught — the check is decoration"
  fail=1
fi

echo
echo "── GATE COVERAGE: a route the gate never measures must be caught ─────"
OUT=$(node scripts/design/shipaudit.mjs --base "$BASE" --routes "/ship.html?variant=clean" \
  --gate "$FIXTURES/gate-missing.txt" 2>&1)
code=$?
echo "$OUT" | grep -E "^===|^  /ship|^total shipability" | sed 's/^/  /'
if echo "$OUT" | grep -q "GATE COVERAGE" && [ "$code" -ne 0 ]; then
  echo "  ✓ an ungated route is caught"
else
  echo "  ✗ an ungated route was not caught — the check is decoration"
  fail=1
fi

echo
echo "── the control: a clean page must report nothing ────────────────────"
run "the clean control is clean" clean

echo
if [ "$fail" -ne 0 ]; then
  echo "shipability instrument: NOT PROVEN."
  exit 1
fi
echo "shipability instrument: PROVEN — it bites, and it stays quiet."
