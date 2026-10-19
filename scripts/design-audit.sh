#!/usr/bin/env bash
# Pre-ship anti-slop gate. Screenshots every route at 1440 / 1024 / 390 so the
# seven hard rules in CLAUDE.md can be checked by squinting, by a human or by a
# different agent. This script cannot judge the design — it only removes the
# excuse that nobody looked.
#
#   bash scripts/design-audit.sh                 # against production
#   BASE=http://127.0.0.1:4174 bash scripts/design-audit.sh   # against a local build
#
# Output: /tmp/screens/audit/<route>-<width>.png
set -uo pipefail

BASE="${BASE:-https://bus.nonarkara.org}"
OUT="${OUT:-/tmp/screens/audit}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROUTES="${ROUTES:-/ /ops /fleet /study /research /capacity /toolkit}"
WIDTHS="${WIDTHS:-1440 1024 390}"

EXE="${CHROME:-$HOME/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell}"

if [ ! -x "$EXE" ]; then
  echo "!! headless chrome not found at: $EXE" >&2
  echo "   set CHROME=/path/to/chrome or run: npx playwright install chromium" >&2
  exit 2
fi

mkdir -p "$OUT"
# The probe must live inside the repo: it imports playwright, and ESM resolves
# node_modules from the importing file's directory, not from cwd.
PROBE="$ROOT/.design-audit.probe.mjs"
trap 'rm -f "$PROBE"' EXIT

cat > "$PROBE" <<'JS'
import { chromium } from 'playwright';
const [,, base, out, routesArg, widthsArg, exe] = process.argv;
const routes = routesArg.split('|');
const widths = widthsArg.split(',').map(Number);
const browser = await chromium.launch({ headless: true, executablePath: exe });
let shots = 0, errors = 0;
for (const w of widths) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: w < 500 ? 844 : 900 },
    deviceScaleFactor: 1,
    isMobile: w < 500,
    hasTouch: w < 500,
  });
  for (const route of routes) {
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message.slice(0, 100)));
    const slug = route === '/' ? 'root' : route.replace(/^\//, '');
    try {
      await page.goto(base + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(7000);
      await page.screenshot({ path: `${out}/${slug}-${w}.png` });
      shots++;
      if (errs.length) { errors += errs.length; console.log(`  ! ${route} @${w}: ${errs[0]}`); }
      else console.log(`  ok ${route} @${w}`);
    } catch (e) {
      errors++;
      console.log(`  ERR ${route} @${w}: ${e.message.slice(0, 80)}`);
    }
    await page.close();
  }
  await ctx.close();
}
await browser.close();
console.log(`${shots} screenshots -> ${out} (${errors} page errors)`);
JS

echo "design audit: $BASE"
node "$PROBE" "$BASE" "$OUT" "$(echo "$ROUTES" | tr ' ' '|')" "$(echo "$WIDTHS" | tr ' ' ',')" "$EXE"

cat <<'EOF'

Now check every screenshot against the seven hard rules in CLAUDE.md and list
each hit with the element that hit it:

  1 boxes fit content      2 balanced composition   3 readable line length
  4 no AI-slop fonts       5 no lazy ornaments      6 something must win
  7 more slop to kill

A different agent or the human reviews the result. Never self-review.
EOF