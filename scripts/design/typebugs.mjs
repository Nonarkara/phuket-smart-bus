import { chromium } from 'playwright';
const ROUTES = ['/', '/ops', '/fleet', '/study', '/research', '/capacity', '/toolkit'];
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await c.newPage();
for (const r of ROUTES) {
  await p.goto('https://bus.nonarkara.org' + r, { waitUntil: 'load', timeout: 30000 });
  await p.waitForTimeout(3000);
  const bad = await p.evaluate(() => {
    const out = [];
    for (const e of document.querySelectorAll('*')) {
      if (!e.textContent || !e.textContent.trim()) continue;
      const cs = getComputedStyle(e);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      const fam = cs.fontFamily.toLowerCase();
      const isSerif = /times|georgia|garamond|serif/.test(fam) && !/source sans|josefin/.test(fam);
      const isMono = /mono|courier|consolas|menlo/.test(fam) && !/source sans|josefin/.test(fam);
      const isDisplaySmall = /josefin/.test(fam) && parseFloat(cs.fontSize) < 32;
      if (isSerif || isMono || isDisplaySmall) {
        out.push({
          why: isSerif ? 'SERIF' : isMono ? 'MONO' : 'DISPLAY<32',
          tag: e.tagName.toLowerCase(),
          cls: (e.className || '').toString().slice(0, 70),
          fam: cs.fontFamily.split(',')[0].replace(/["']/g, ''),
          wt: cs.fontWeight,
          size: cs.fontSize,
          txt: (e.textContent || '').trim().slice(0, 55),
        });
      }
    }
    return out;
  });
  const seen = new Set();
  const uniq = bad.filter(x => { const k = x.why + x.cls + x.size; if (seen.has(k)) return false; seen.add(k); return true; });
  console.log('\n=== ' + r + ' === ' + bad.length + ' hits, ' + uniq.length + ' distinct');
  for (const u of uniq.slice(0, 14)) console.log(`  [${u.why}] <${u.tag} class="${u.cls}"> ${u.fam} ${u.wt} ${u.size}  "${u.txt}"`);
}
await b.close();
