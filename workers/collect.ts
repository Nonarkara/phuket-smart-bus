/**
 * Minute alarm for the real-bus archive.
 *
 * Cloudflare Pages cannot run a cron. This worker only wakes the
 * Pages writer (`/api/collect/tick`), which owns the tracker parse
 * and the KV ledger. Two pokes per firing, 30 s apart: the tick
 * route itself drops anything inside a 25 s gap, so a double
 * schedule cannot double-count.
 *
 * Deploy: npx wrangler deploy -c wrangler.collector.toml
 */
const TICK_URL = "https://bus.nonarkara.org/api/collect/tick";

async function ping(): Promise<Response> {
  return fetch(TICK_URL, {
    headers: {
      accept: "application/json",
      "user-agent": "phuket-smart-bus-collector",
    },
  });
}

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Two pokes, 30s apart. The wait is a timer, not CPU. */
export async function collectTwice(sleep: (ms: number) => Promise<void> = pause): Promise<void> {
  await ping().then((res) => res.text()).catch(() => {});
  await sleep(30_000);
  await ping().then((res) => res.text()).catch(() => {});
}

export default {
  async scheduled(_event: unknown, _env: unknown, ctx: { waitUntil(promise: Promise<unknown>): void }) {
    ctx.waitUntil(collectTwice());
  },
  async fetch() {
    const res = await ping();
    return new Response(await res.text(), {
      status: res.status,
      headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
    });
  },
};
