#!/usr/bin/env node
/**
 * Compare the whole DEPLOYED asset graph against the local build, byte for byte.
 *
 * WHAT THIS EXISTS FOR
 *   The failure mode it exists for is "the deploy reported success but the
 *   public host is still serving the previous build". The previous version of
 *   scripts/verify-deploy.sh compared only the entry chunk. A Vite entry
 *   chunk NAMES its 8 lazy chunks and 4 lazy stylesheets but does not
 *   contain their bytes, so a commit that touched only a route's .tsx (or
 *   its route-scoped .css) produced an entry chunk with identical bytes.
 *   The guard printed "ok" for two builds whose shipped code differed.
 *
 * HOW IT WORKS
 *   1. Crawl the asset graph twice, with the same algorithm and the same
 *      resolution rules: once over dist/client, once over the live host.
 *      The crawl starts at the document and follows every script/style
 *      reference it finds, then follows the references inside those.
 *   2. Reduce each file to its LOGICAL name ("DashboardV2") plus the hash
 *      of its bytes with every content hash normalised away.
 *   3. Compare the two sets and the two digests.
 *
 * WHY THE HASH IS NORMALISED AWAY
 *   Vite names a chunk "<logical>-<8 char hash>.js" and the chunk's own
 *   bytes embed that name, because its siblings import it by name. Two
 *   builds of the SAME source therefore get different asset names, and
 *   every chunk that mentions a sibling differs in bytes too. Normalising
 *   the hash leaves the code, which is what two builds of the same source
 *   must share. The logical name is deliberately KEPT, so a chunk that was
 *   renamed shows up as a missing and an extra asset.
 *
 * WHY THE SETS ARE COMPARED AND NOT JUST THE BYTES
 *   A lazy chunk that is stale on the live host but absent from the local
 *   build, or present locally and missing live, is a broken route. The
 *   digest comparison alone would not see it.
 */
import { readFileSync, existsSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

const LOCAL_ROOT = "dist/client";
const BASE = process.env.BASE_URL || "https://bus.nonarkara.org";

// ── normalisation ────────────────────────────────────────────────────────────
const HASHED_NAME = /-([A-Za-z0-9_-]{8})(\.[A-Za-z0-9]+)/g;
const normalise = (buf) => buf.toString("latin1").replace(HASHED_NAME, "-HASH$2");
const digest = (buf) => createHash("sha256").update(normalise(buf)).digest("hex");

/** "DashboardV2-CQeGei9l.js" -> "DashboardV2" (the stem is kept, the hash is not) */
const logicalName = (file) => file.replace(/-[A-Za-z0-9_-]{8}(\.[A-Za-z0-9]+)$/, "-HASH$1");

/**
 * Every asset reference a built file can contain. Vite writes two shapes:
 * a relative "./Chunk-hash.js" (relative to the referring chunk) and a
 * base-relative "assets/Chunk-hash.css" (relative to the site root). CSS
 * also references fonts and images through url().
 */
const ASSET_REF = /["'`]([^"'`\s]*?\.(?:js|css|woff2?|png|jpe?g|svg|webp|gif))["'`]/g;
const CSS_URL_REF = /url\(\s*["']?([^"')]+?)["']?\s*\)/g;
const EXT = /\.(?:js|css|woff2?|png|jpe?g|svg|webp|gif)$/;

/**
 * A reference is worth following when its LAST path segment has a stem:
 * "index-abc.js" and "/assets/index-abc.js" and "assets/x.css" are, while
 * ".css" (a bare extension, which Vite writes for a chunk family) is not.
 */
function isAssetRef(ref) {
  if (!EXT.test(ref)) return false;
  const last = ref.split("/").pop() ?? "";
  return /^[A-Za-z0-9_][A-Za-z0-9._-]*\./.test(last);
}

function refsIn(buf) {
  const text = buf.toString("latin1");
  const out = new Set();
  for (const m of text.matchAll(ASSET_REF)) if (isAssetRef(m[1])) out.add(m[1]);
  for (const m of text.matchAll(CSS_URL_REF)) {
    const v = m[1];
    if (v.startsWith("data:") || v.startsWith("#")) continue;
    if (isAssetRef(v)) out.add(v);
  }
  return [...out];
}

// ── the crawler ─────────────────────────────────────────────────────────────
/**
 * @param root     the document to start from
 * @param read     (target) -> Buffer | null
 * @param resolve  (from, ref) -> target
 */
async function crawl(root, read, resolve) {
  const assets = new Map(); // file name -> { logical, digest }
  const queue = [root];
  const seen = new Set();
  while (queue.length) {
    const target = queue.shift();
    if (seen.has(target)) continue;
    seen.add(target);
    const bytes = await read(target);
    if (!bytes) continue;
    const file = target.split("/").pop().split("?")[0];
    const logical = logicalName(file);
    // The document itself is not an asset; everything it pulls in is.
    if (target !== root) {
      if (!assets.has(file)) assets.set(file, { logical, digest: digest(bytes) });
    }
    for (const ref of refsIn(bytes)) queue.push(resolve(target, ref));
  }
  return assets;
}

// ── local side ──────────────────────────────────────────────────────────────
const localRead = (p) => {
  try {
    if (!existsSync(p) || !statSync(p).isFile()) return null;
    return readFileSync(p);
  } catch {
    return null;
  }
};
const resolveLocal = (from, ref) => {
  if (ref.startsWith("./")) return path.normalize(path.join(path.dirname(from), ref));
  return path.normalize(path.join(LOCAL_ROOT, ref));
};

// ── live side ───────────────────────────────────────────────────────────────
/**
 * A static host answers ANY unmatched path with the SPA shell: 200,
 * text/html. So a status code cannot tell you that a file is published.
 * The control is the content type — a real .js is application/javascript,
 * a real .css is text/css, and the shell is text/html for every path.
 */
const liveRead = async (url) => {
  try {
    const res = await fetch(url, { headers: { "cache-control": "no-cache" } });
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") || "").split(";")[0].trim();
    const path = url.split("?")[0];
    // The document itself is the shell, which is correct. An ASSET path
    // answered with the shell is a path that was never published.
    const assetShaped = /\.(js|css|woff2?|png|jpe?g|svg|webp|gif|json|webmanifest|xml|txt|pdf|mp4|ico)$/i.test(path);
    if (type === "text/html" && assetShaped) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
};
const resolveLive = (from, ref) => {
  if (ref.startsWith("./")) return new URL(ref, from).href;
  return new URL("/" + ref.replace(/^\/+/, ""), BASE).href;
};

// ── run ─────────────────────────────────────────────────────────────────────
const localIndex = path.join(LOCAL_ROOT, "index.html");
if (!existsSync(localIndex)) {
  console.error(`error: ${localIndex} is missing; build before verification`);
  process.exit(1);
}

const localAssets = await crawl(localIndex, localRead, resolveLocal);
const liveRoot = new URL("/", BASE).href;
const liveAssets = await crawl(liveRoot, liveRead, resolveLive);

const byLogical = (assets) => {
  const m = new Map();
  for (const [file, info] of assets) m.set(info.logical, { file, ...info });
  return m;
};
const localByLogical = byLogical(localAssets);
const liveByLogical = byLogical(liveAssets);

const problems = [];
for (const [logical, live] of liveByLogical) {
  const local = localByLogical.get(logical);
  if (!local) {
    problems.push(`live serves "${logical}" (${live.file}) but the local build has no such asset`);
  } else if (local.digest !== live.digest) {
    problems.push(
      `"${logical}" differs: local ${local.file} ${local.digest.slice(0, 12)} vs live ${live.file} ${live.digest.slice(0, 12)}`
    );
  }
}
for (const [logical, local] of localByLogical) {
  if (!liveByLogical.has(logical)) {
    problems.push(`the local build has "${logical}" (${local.file}) but the live host does not serve it`);
  }
}

if (problems.length) {
  console.error(`error: the deployed asset graph does not match the local build (${problems.length} problem(s)):`);
  for (const p of problems) console.error(`  - ${p}`);
  console.error(
    "\nhint: a build-time variable is the usual cause when the difference is one chunk.\n" +
      "      VITE_GISTDA_API_KEY must carry the SAME value in .env and in the\n" +
      "      repository secret, or the GISTDA incident layer is compiled out of\n" +
      "      one of the two builds and the two builds of one commit are two\n" +
      "      different products."
  );
  process.exit(1);
}

console.log(
  `ok: ${BASE} serves the built code — ${localAssets.size} assets compared (entry + every lazy chunk and stylesheet), bytes identical`
);
