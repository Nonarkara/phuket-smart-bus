// Proves cspsweep.mjs reports a violation and stays quiet on a clean page.
//
//   node scripts/design/prove-csp.mjs
//
// A gate that has never failed has not been shown to be a gate. This serves
// two pages under the same Report-Only policy the site uses — one that loads
// from a host the policy does not allow, one that does not — and runs the
// real instrument against both.
import http from "node:http";
import { execFile } from "node:child_process";

const POLICY = "default-src 'self'; img-src 'self' data:";
const page = (body) => `<!doctype html><meta charset="utf-8"><title>t</title><body>${body}</body>`;

const other = http.createServer((_, res) => { res.writeHead(200, { "content-type": "image/gif" }); res.end(Buffer.from("R0lGODlhAQABAAAAACw=", "base64")); });
await new Promise((r) => other.listen(0, "127.0.0.1", r));
const otherPort = other.address().port;

const site = http.createServer((req, res) => {
  const headers = { "content-type": "text/html; charset=utf-8", "content-security-policy-report-only": POLICY };
  if (req.url.startsWith("/violates")) {
    res.writeHead(200, headers);
    res.end(page(`<img src="http://127.0.0.1:${otherPort}/x.gif" alt="">`));
  } else if (req.url.startsWith("/clean")) {
    res.writeHead(200, headers);
    res.end(page(`<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt=""><p>nothing off-site</p>`));
  } else { res.writeHead(404); res.end("no"); }
});
await new Promise((r) => site.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${site.address().port}`;

// ASYNC on purpose: the fixture servers live in THIS process, so a synchronous
// spawn would freeze them and the browser would wait forever for a page that
// cannot be served — the first version of this proof did exactly that.
const run = (route) => new Promise((resolve) => {
  execFile("node", ["scripts/design/cspsweep.mjs", route, "--base", base], { encoding: "utf8" }, (err, stdout, stderr) => {
    resolve({ status: err ? (typeof err.code === "number" ? err.code : 1) : 0, stdout, stderr });
  });
});
const [bad, good, missing] = await Promise.all([run("/violates"), run("/clean"), run("/nope")]);
other.close(); site.close();

const results = [
  ["a page that loads from an unallowed host FAILS", bad.status === 1 && /img-src/.test(bad.stdout) && /127\.0\.0\.1/.test(bad.stdout)],
  ["a page inside the policy PASSES", good.status === 0 && /clean:/.test(good.stdout)],
  ["a route that is not there is a finding, not a pass", missing.status === 1 && /could not measure/.test(missing.stdout)],
];
let failed = 0;
for (const [name, ok] of results) { console.log(`${ok ? "  ok " : "  FAIL"}  ${name}`); if (!ok) failed++; }
if (failed) { console.log("\n--- violates ---\n" + bad.stdout + bad.stderr + "\n--- clean ---\n" + good.stdout + good.stderr + "\n--- missing ---\n" + missing.stdout + missing.stderr); }
process.exit(failed ? 1 : 0);
