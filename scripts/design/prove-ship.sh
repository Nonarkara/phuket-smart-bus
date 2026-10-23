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
echo "── THIRD PARTY: a page that talks to one must say so ────────────────"
# A map tile is not a collector — it does not report the visitor anywhere —
# but the service still sees the request and therefore the visitor's IP
# address. The notice has to name the service. Before this check existed,
# the disclosure check could never fire for the hosts the site really
# contacts, which is why a false promise survived until a human read it.
OUT=$(node scripts/design/shipaudit.mjs --base "$BASE" --routes "/ship.html?variant=third-party" 2>&1)
code=$?
echo "$OUT" | grep -E "^===|^  /ship|^total shipability" | sed 's/^/  /'
if echo "$OUT" | grep -q "THIRD PARTY" && [ "$code" -ne 0 ]; then
  echo "  ✓ a third-party contact with no disclosure is caught"
else
  echo "  ✗ a third-party contact with no disclosure was not caught — the check is decoration"
  fail=1
fi

echo
echo "── THIRD PARTY: the same page, naming the service, must be quiet ───"
OUT=$(node scripts/design/shipaudit.mjs --base "$BASE" --routes "/ship.html?variant=third-party-notice" 2>&1)
code=$?
echo "$OUT" | grep -E "^===|^  /ship|^total shipability" | sed 's/^/  /'
if echo "$OUT" | grep -q "THIRD PARTY" && [ "$code" -ne 0 ]; then
  echo "  ✗ a page that names the service was still called a gap — the check cries wolf"
  fail=1
else
  echo "  ✓ a page that names the service is not called a gap"
fi

echo
echo "── SECRETS: a secret in the TREE must block, even under a path that
     mentions history ──────────────────────────────────────────────────────"
# The debt routing used to test `where.includes("history")` — a SUBSTRING
# test. A working-tree secret in a file called `history/leaked.txt` would
# therefore be reported as carried debt, which does not block a deploy.
# The repo has tracked files under public/toolkit/history/, so this was not
# a hypothetical directory name. The test that protects the tree has to
# protect it under a name that would have caught it.
OUT=$(node scripts/design/shipaudit.mjs --base "$BASE" --routes "/ship.html?variant=clean" \
  --scan "$FIXTURES/history-tree" 2>&1)
code=$?
echo "$OUT" | grep -E "^===|^  /ship|^total shipability|^total carried" | sed 's/^/  /'
if echo "$OUT" | grep -q "SECRETS" && [ "$code" -ne 0 ]; then
  echo "  ✓ a secret in the tree blocks the deploy, whatever the path is called"
else
  echo "  ✗ a secret in the tree was carried instead of blocking — the path's name decided the verdict"
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
echo "── GATE COVERAGE: a NESTED route must be caught ──────────────────────"
# `startsWith("/fleet/export")` is a different route from
# `startsWith("/fleet")`. A derivation that stopped at the first slash read
# the nested one as its parent — and the parent is already in the gate's
# list, so a new nested route was silently missed: the reader gets a page
# the design gate never measured.
OUT=$(node scripts/design/shipaudit.mjs --base "$BASE" --routes "/ship.html?variant=clean" \
  --app "$FIXTURES/app-nested-route.tsx" --gate "$FIXTURES/gate-missing.txt" 2>&1)
code=$?
echo "$OUT" | grep -E "^===|^  /ship|^total shipability" | sed 's/^/  /'
if echo "$OUT" | grep -q "GATE COVERAGE" && echo "$OUT" | grep -q "/fleet/export" && [ "$code" -ne 0 ]; then
  echo "  ✓ a nested route the gate does not measure is caught"
else
  echo "  ✗ a nested route was not caught — the derivation collapsed it into its parent"
  fail=1
fi

echo
echo "── GATE COVERAGE: a nested route the gate DOES measure must be quiet ──"
OUT=$(node scripts/design/shipaudit.mjs --base "$BASE" --routes "/ship.html?variant=clean" \
  --app "$FIXTURES/app-nested-route.tsx" --gate "$FIXTURES/gate-with-nested.txt" 2>&1)
code=$?
echo "$OUT" | grep -E "^===|^  /ship|^total shipability" | sed 's/^/  /'
if echo "$OUT" | grep -q "GATE COVERAGE"; then
  echo "  ✗ a route the gate measures was still called ungated — the check cries wolf"
  fail=1
else
  echo "  ✓ a nested route the gate measures is not called ungated"
fi

echo
echo "── SECRETS: a secret in the HISTORY must be carried, not ignored ──────"
# A secret that was REMOVED is not removed — the value is in a published
# commit. The branch that finds it is the one that produced the
# deploy-blocking finding, and it had no case of its own.
#
# It is a CARRIED DEBT, not a finding: a deploy cannot unpublish a commit,
# and a gate that is red on its own repository forever is a gate that gets
# disabled. The debt must still be REPORTED, with the steps that clear it.
HIST=$(mktemp -d)
trap 'rm -rf "$HIST"; kill $SRV 2>/dev/null || true' EXIT
# The secret comes from the FIXTURE, never from a string in this script: a
# secret-shaped value written here would be a secret-shaped value in the
# repository, and the audit would rightly report this script.
(
  cd "$HIST" || exit 1
  git init -q .
  git config user.email proof@example.com
  git config user.name proof
  cp "$OLDPWD/$FIXTURES/dirty-tree/leaked.txt" config.ts
  git add -A && git commit -qm "a commit that holds a token"
  rm config.ts
  git add -A && git commit -qm "and the commit that removed it"
) >/dev/null 2>&1
OUT=$(node scripts/design/shipaudit.mjs --base "$BASE" --routes "/ship.html?variant=clean" \
  --scan "$HIST" --history 2>&1)
code=$?
echo "$OUT" | grep -E "^===|^  /ship|^total shipability|^total carried" | sed 's/^/  /'
if echo "$OUT" | grep -q "CARRIED DEBT" && echo "$OUT" | grep -q "SMARTBUS_BEARER_TOKEN"; then
  echo "  ✓ a secret in the history is reported as carried debt"
else
  echo "  ✗ a secret in the history was not reported — the branch is decoration"
  fail=1
fi
if [ "$code" -eq 0 ]; then
  echo "  ✓ carried debt does not block a deploy — no deploy can unpublish a commit"
else
  echo "  ✗ carried debt blocked the deploy — a gate that is red forever is a gate that gets disabled"
  fail=1
fi

echo
echo "── SECRETS: a repository with NO secret in its history must be quiet ──"
CLEANHIST=$(mktemp -d)
(
  cd "$CLEANHIST" || exit 1
  git init -q .
  git config user.email proof@example.com
  git config user.name proof
  printf 'export const timeout = 30;\n' > app.ts
  git add -A && git commit -qm "an ordinary commit"
) >/dev/null 2>&1
OUT=$(node scripts/design/shipaudit.mjs --base "$BASE" --routes "/ship.html?variant=clean" \
  --scan "$CLEANHIST" --history 2>&1)
echo "$OUT" | grep -E "^===|^  /ship|^total shipability|^total carried" | sed 's/^/  /'
if echo "$OUT" | grep -q "CARRIED DEBT"; then
  echo "  ✗ an ordinary repository was reported as carrying a secret — the check cries wolf"
  fail=1
else
  echo "  ✓ an ordinary repository carries no debt"
fi
rm -rf "$CLEANHIST"

echo
echo "── the control: a clean page must report nothing ────────────────────"
run "the clean control is clean" clean

echo
if [ "$fail" -ne 0 ]; then
  echo "shipability instrument: NOT PROVEN."
  exit 1
fi
echo "shipability instrument: PROVEN — it bites, and it stays quiet."
