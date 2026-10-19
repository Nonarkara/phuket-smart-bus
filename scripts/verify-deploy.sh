#!/usr/bin/env bash
# Prove the built JS and CSS reached both the Pages alias and the public host.
# Probe keys are disposable so a stale response cannot poison a user-facing URL.
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

CANONICAL="${CANONICAL:-https://phuket-smart-bus.pages.dev}"
CUSTOM="${CUSTOM:-https://bus.nonarkara.org}"
INDEX="dist/client/index.html"

if [ ! -f "$INDEX" ]; then
  echo "error: $INDEX is missing; build before verification" >&2
  exit 1
fi

hash_file() {
  shasum -a 256 "$1" | awk '{print $1}'
}

hash_url() {
  curl -fsS --max-time 20 "$1" | shasum -a 256 | awk '{print $1}'
}

asset_path() {
  sed -nE "$1" "$INDEX" | head -1
}

JS_PATH="$(asset_path 's@.*src="(/assets/[^\"]+\.js)".*@\1@p')"
CSS_PATH="$(asset_path 's@.*href="(/assets/[^\"]+\.css)".*@\1@p')"

if [ -z "$JS_PATH" ] || [ -z "$CSS_PATH" ]; then
  echo "error: could not resolve built JS/CSS from $INDEX" >&2
  exit 1
fi

probe_asset() {
  local host="$1" path="$2" want got attempt streak=0
  want="$(hash_file "dist/client${path}")"
  for attempt in 1 2 3 4 5 6 7 8 9 10 11 12; do
    got="$(hash_url "${host}${path}?probe=${attempt}-$(date +%s)" || true)"
    if [ -n "$got" ] && [ "$got" = "$want" ]; then
      streak=$((streak + 1))
      if [ "$streak" -ge 3 ]; then
        echo "ok: ${host}${path} matched 3 consecutive probes"
        return 0
      fi
    else
      streak=0
      sleep 3
    fi
  done
  echo "error: ${host}${path} did not converge" >&2
  return 1
}

probe_asset "$CANONICAL" "$JS_PATH"
probe_asset "$CANONICAL" "$CSS_PATH"
probe_asset "$CUSTOM" "$JS_PATH"
probe_asset "$CUSTOM" "$CSS_PATH"

curl -fsS --max-time 20 "$CUSTOM/api/live-buses?probe=$(date +%s)" | grep -q '"status":"live"'
echo "ok: live-bus edge function returned live JSON"
