/**
 * Wait for a page to FINISH before it is measured.
 *
 * WHY THIS EXISTS
 *   The gate waited a fixed number of seconds — five for most checks, two
 *   and a half for the type audit — and called that a page. The legacy
 *   consumer chain asks the server for its stops, gets a 404, waits three
 *   seconds and asks again. At two and a half seconds the stop list can
 *   still be EMPTY.
 *
 *   So the gate could measure half a page and call it clean. A green light
 *   on a check that measured nothing is the worst outcome a gate can have.
 *
 * WHAT WAS ACTUALLY WRONG — measured, not asserted
 *   This file used to say that the gate "measured 6,426px of a 9,251px
 *   page" and called it clean. That sentence was wrong, and it was wrong
 *   in the direction that flatters the code, so it was measured.
 *
 *   Measured 2026-10-23 against the local preview, `/info` @1440, the
 *   page height as `space.mjs` measures it (the tallest scrollable
 *   element — this app scrolls an inner frame, so the document is always
 *   one screen):
 *
 *     settle (floor 5s)   6532ms   6426px   704 elements   52 stop cards
 *     settle (minMs 0)    2220ms   6426px   704 elements   52 stop cards
 *     fixed 15s wait     15003ms   6426px   704 elements   52 stop cards
 *     fixed 30s wait     30004ms   6426px   704 elements   52 stop cards
 *
 *   The page is 6,426px at every wait from two seconds to thirty, and the
 *   stop list is FULL (52 cards) in every one of them.
 *
 *   What the old note claimed, and what is actually known:
 *   the 9,251px figure came from a DIFFERENT BUILD — one whose stop list
 *   was different enough for the gate to report 12 CLIPPED CONTENT
 *   findings on `.stop-list__items` in that run. **That build is not in
 *   this repository**: the two runs were 39 minutes apart with no commit
 *   between them, so its contents are recorded nowhere, and an
 *   explanation of it that cannot be checked is not an explanation. What
 *   can be checked is the table above, and it is the opposite of the old
 *   note: the page does not grow when the gate waits longer.
 *
 *   So this file does not say what the 9,251px page was. It says what
 *   today's page is, at four waits, and it says the old figure is not
 *   today's figure.
 *
 *   The floor is still the right answer, and its proof does not depend on
 *   this page at all: `scripts/design/prove-settle.sh` measures a FIXTURE
 *   whose content arrives on a timer with no request in flight, and shows
 *   that without the floor the instrument measures that page empty. The
 *   defect the floor closes is real, and it is real on any page whose
 *   content arrives on a timer — which is exactly what the fixture is.
 *
 * THE TWO SIGNALS
 *   1. THE NETWORK GOES QUIET. A page that is still waiting for data is
 *      not quiet, and the legacy chain's retry is network activity. The
 *      cap is there because a page with a live ticker never goes quiet,
 *      and "never" is not a reason to measure nothing.
 *   2. THE DOCUMENT STOPS CHANGING. A quiet network is not the same thing
 *      as a finished page — content can arrive from a timer — so the
 *      document has to hold still before it is measured.
 *
 *   The order matters: the network first, because that is where a slow
 *   answer shows up, and the document second, because that is where a
 *   late render shows up.
 *
 * THE FLOOR
 *   The first version of this settle had no floor. It waited for the
 *   network to go quiet and then for the document to hold still, and it
 *   RETURNED EARLIER than the fixed five-second wait it replaced: the
 *   legacy chain's first call 404s in about 200ms, the network is quiet
 *   at ~1s, and the document can be perfectly stable during the two
 *   seconds before the retry lands — because the stop list is empty and
 *   stays empty. "The document stops changing" is exactly what a page
 *   waiting on a timer looks like.
 *
 *   So the settle has a FLOOR: it never returns before `minMs`, which
 *   defaults to the five seconds the gate used to wait. A timer that
 *   fires inside the floor is caught by the stability check that runs
 *   after it. A timer that fires after the floor is not catchable by any
 *   generic signal — so the floor has to exceed the app's own longest
 *   scheduled work, and 5s exceeds the legacy chain's 3s retry.
 *
 *   The floor makes the gate slower, and it makes it measure MORE. That
 *   is the trade: a gate that is quick and measures half a page is worse
 *   than a gate that is slow and measures the page. The cost is real and
 *   it is reported: the gate takes about fifty minutes over its 24
 *   routes at two widths.
 */
export async function settle(
  page,
  { networkTimeoutMs = 9_000, maxMs = 25_000, minMs = 5_000 } = {}
) {
  const started = Date.now();
  await page.waitForLoadState("networkidle", { timeout: networkTimeoutMs }).catch(() => {});
  // THE FLOOR. Never return earlier than the wait this replaced.
  const remaining = minMs - (Date.now() - started);
  if (remaining > 0) await page.waitForTimeout(remaining);
  // The document stops changing — measured AFTER the floor, so a timer
  // that fired while we were waiting is caught here.
  let last = -1;
  let stable = 0;
  while (Date.now() - started < maxMs) {
    const signature = await page
      .evaluate(() => {
        const el = document.scrollingElement || document.documentElement;
        return el.scrollHeight * 1_000_000 + document.querySelectorAll("*").length;
      })
      .catch(() => -1);
    if (signature === last && signature !== -1) {
      stable += 1;
      if (stable >= 3) return;
    } else {
      stable = 0;
      last = signature;
    }
    await page.waitForTimeout(500);
  }
}

export default settle;
