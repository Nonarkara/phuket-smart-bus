#!/usr/bin/env node
// A tiny static server for the design fixtures.
//
// It does one thing the standard library server cannot: it REDIRECTS. The
// gate's rule — "the page you asked for is the page you got" — cannot be
// proven against a server that only ever answers 200 or 404.
//
//   node scripts/design/fixtures/serve.mjs <port>
//
//   /redirect-to-clean.html  →  302  /space-clean.html
//
// Every other path is served from this directory, or 404.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.argv[2] || 8123);
const ROOT = fileURLToPath(new URL(".", import.meta.url));

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

createServer(async (req, res) => {
  const path = (req.url || "/").split("?")[0];

  if (path === "/redirect-to-clean.html") {
    res.writeHead(302, { Location: "/space-clean.html" });
    res.end();
    return;
  }

  const rel = normalize(path).replace(/^[/\\]+/, "");
  if (!rel || rel.startsWith("..")) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("not found");
    return;
  }

  try {
    const body = await readFile(join(ROOT, rel));
    res.writeHead(200, {
      "content-type": TYPES[extname(rel).toLowerCase()] || "application/octet-stream",
      "cache-control": "no-store",
    });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("not found");
  }
}).listen(PORT, "127.0.0.1", () => {
  console.log(`fixtures on http://127.0.0.1:${PORT}`);
});
