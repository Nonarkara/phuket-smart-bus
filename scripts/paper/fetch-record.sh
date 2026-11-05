#!/usr/bin/env bash
# Download the research record the preprint analyses, from the public research
# endpoints of the live site, into paper/data/ (git-ignored: ~100 MB raw).
#
#   bash scripts/paper/fetch-record.sh [FROM] [THROUGH] [BASE]
#     FROM     first service day (default 2026-09-22 — before the record began;
#              empty days come back as header-only CSVs and are skipped)
#     THROUGH  last service day (default: yesterday, Bangkok)
#     BASE     default https://bus.nonarkara.org
#
# What it fetches, and from where:
#   fixes/<date>.csv.gz   /api/research/fixes?date=&format=csv — every distinct
#                         GPS fix of both PKSB feeds for that 03:00→03:00 day
#   week/<from>.json      /api/collect/week?from=&days=7&detail=vehicles — the
#                         study archive's per-bus km, runs and hours moving
#   meta/period.json      /api/research/period — the server's own trip analysis,
#                         kept to cross-check the local re-analysis
#
# Research reads are rate-limited (90/min/IP), so it waits between requests.
set -euo pipefail

FROM="${1:-2026-09-22}"
THROUGH="${2:-$(TZ=Asia/Bangkok date -d yesterday +%F 2>/dev/null || TZ=Asia/Bangkok date -v-1d +%F)}"
BASE="${3:-https://bus.nonarkara.org}"
OUT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/paper/data"
UA="phuket-smart-bus-preprint/1.0"

mkdir -p "$OUT/fixes" "$OUT/week" "$OUT/meta"
get() { curl -fsS --retry 6 --retry-all-errors --retry-delay 12 --max-time 180 -A "$UA" "$1"; }
# GNU date and BSD date (macOS) disagree on arithmetic; this works on both.
next_day() { python3 -c "import datetime,sys;print(datetime.date.fromisoformat(sys.argv[1])+datetime.timedelta(days=int(sys.argv[2])))" "$1" "$2"; }

printf '{"exportedAt":"%s","from":"%s","through":"%s","source":"%s"}\n' \
  "$(date -u +%FT%TZ)" "$FROM" "$THROUGH" "$BASE" > "$OUT/meta/export.json"
: > "$OUT/meta/fix-counts.csv"

d="$FROM"
while [[ ! "$d" > "$THROUGH" ]]; do
  tmp="$(mktemp)"
  if get "$BASE/api/research/fixes?date=$d&format=csv" > "$tmp"; then
    n=$(( $(wc -l < "$tmp") - 1 ))
    if (( n > 0 )); then
      gzip -9 -c "$tmp" > "$OUT/fixes/$d.csv.gz"
      echo "$d,$n" >> "$OUT/meta/fix-counts.csv"
    fi
    echo "$d  $n fixes"
  else
    echo "$d  FAILED" | tee -a "$OUT/meta/failures.txt" >&2
  fi
  rm -f "$tmp"
  sleep 1
  d="$(next_day "$d" 1)"
done

w="$FROM"
while [[ ! "$w" > "$THROUGH" ]]; do
  get "$BASE/api/collect/week?from=$w&days=7&detail=vehicles" > "$OUT/week/$w.json" \
    || echo "week $w FAILED" | tee -a "$OUT/meta/failures.txt" >&2
  sleep 1
  w="$(next_day "$w" 7)"
done

get "$BASE/api/research/period" > "$OUT/meta/period.json" \
  || echo "period FAILED" | tee -a "$OUT/meta/failures.txt" >&2

echo
du -sh "$OUT"
echo "$(ls "$OUT/fixes" | wc -l | tr -d ' ') service days with fixes → $OUT"
