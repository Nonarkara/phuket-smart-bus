// List every CSS rule that sets the display face, with its size + weight.
import fs from "node:fs";

const files = process.argv.slice(2);
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  const lines = src.split("\n");
  // crude rule splitter: selector { ... }
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(src))) {
    const sel = m[1].trim().replace(/\s+/g, " ");
    const body = m[2];
    if (!/var\(--font-display\)/.test(body)) continue;
    const line = src.slice(0, m.index).split("\n").length;
    const size = (body.match(/font-size:\s*([^;]+)/) || [])[1] || "-";
    const weight = (body.match(/font-weight:\s*([^;]+)/) || [])[1] || "-";
    const shorthand = (body.match(/font:\s*([^;]+)/) || [])[1] || "-";
    const letter = (body.match(/letter-spacing:\s*([^;]+)/) || [])[1] || "-";
    console.log(
      `${f}:${line}\n  sel: ${sel}\n  size: ${size} | weight: ${weight} | font-shorthand: ${shorthand} | ls: ${letter}`,
    );
  }
}
