/**
 * Wait for a page to FINISH before it is measured.
 *
 * WHY THIS EXISTS
 *   The gate waited a fixed number of seconds — five for most checks, two
 *   and a half for the type audit — and called that a page. The legacy
 *   consumer chain asks the server for its stops, gets a 404, waits three
 *   seconds and asks again. At two and a half seconds the stop list was
 *   still EMPTY.
 *
 *   So the gate measured half a page and called it clean: `/info`, `/more`,
 *   `/stops`, `/ride` and `/compare` all reported "0 findings" and a
 *   four-size type ramp, on pages that turned out to be 9,251px tall with
 *   a ten-size ramp once the data arrived. A green light on a check that
 *   measured nothing is the worst outcome a gate can have, and this was
 *   it — the gate was green on pages it had not finished loading.
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
 */
export async function settle(page, { networkTimeoutMs = 9_000, maxMs = 25_000 } = {}) {
  await page.waitForLoadState("networkidle", { timeout: networkTimeoutMs }).catch(() => {});
  const started = Date.now();
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
