/**
 * Minute alarm for the real-bus archive.
 *
 * Cloudflare Pages cannot run a cron. This worker only wakes the
 * Pages writer (`/api/collect/tick`), which owns the tracker parse
 * and the KV ledger. Two pokes per firing, 30 s apart: the tick
 * route itself drops anything inside a 25 s gap, so a double
 * schedule cannot double-count.
 *
 * The tick route only answers a request carrying TICK_TOKEN (a secret on
 * both this worker and the Pages project). This worker has no public URL and
 * no fetch handler: the cron is the only way in.
 *
 * Deploy: npx wrangler deploy -c wrangler.collector.toml
 */
const TICK_URL = "https://bus.nonarkara.org/api/collect/tick";

export type CollectorEnv = { TICK_TOKEN?: string };

async function ping(token: string): Promise<Response> {
  return fetch(TICK_URL, {
    headers: {
      accept: "application/json",
      "user-agent": "phuket-smart-bus-collector",
      authorization: `Bearer ${token}`,
    },
  });
}

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Two pokes, 30s apart. The wait is a timer, not CPU. */
export async function collectTwice(token: string, sleep: (ms: number) => Promise<void> = pause): Promise<void> {
  await ping(token).then((res) => res.text()).catch(() => {});
  await sleep(30_000);
  await ping(token).then((res) => res.text()).catch(() => {});
}

export default {
  async scheduled(_event: unknown, env: CollectorEnv, ctx: { waitUntil(promise: Promise<unknown>): void }) {
    const token = env.TICK_TOKEN?.trim();
    if (!token) { console.error("TICK_TOKEN is not set: the tick route will refuse this collector"); return; }
    ctx.waitUntil(collectTwice(token));
  },
};
