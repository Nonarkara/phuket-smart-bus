#!/usr/bin/env bash
#
# Proves the shared settle waits for a page that has FINISHED loading.
#
# Every gate instrument stands on this wait. A settle that returns early
# makes each of them measure a page that is not there — which is how five
# routes came to report "0 findings" on a page that was still empty.
#
# The case that matters is the TIMER: the legacy consumer chain retries a
# missing API after three seconds, and a page waiting on a timer looks
# exactly like a page that has finished — no requests, no mutations. The
# first settle had no floor and returned before the timer fired.
#
#   node scripts/design/prove-settle.mjs <base>
#
set -uo pipefail
cd "$(dirname "$0")/../.."

PORT="${PORT:-}"
if [ -z "$PORT" ]; then
  for try in 8141 8142 8143 8144 8145 8146; do
    if ! nc -z 127.0.0.1 "$try" 2>/dev/null; then PORT="$try"; break; fi
  done
fi
[ -n "$PORT" ] || { echo "no free port for the fixture server"; exit 2; }

FIXTURES="scripts/design/fixtures"

node "$FIXTURES/serve.mjs" "$PORT" >/dev/null 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null || true' EXIT

for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -sf "http://127.0.0.1:$PORT/timer-load.html" -o /dev/null; then break; fi
  sleep 0.3
done
if ! curl -sf "http://127.0.0.1:$PORT/timer-load.html" -o /dev/null; then
  echo "the fixture server never answered on port $PORT — refusing to prove anything"
  exit 2
fi

echo "── the settle must wait for a page that has FINISHED loading ─────────"
node scripts/design/prove-settle.mjs "http://127.0.0.1:$PORT"
exit $?
