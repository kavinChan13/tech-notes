// Renders pages in a real browser and reports horizontal overflow, i.e. the
// pages you can drag sideways on a phone. Nothing static can catch this:
// overflow is a layout result, not something greppable in the HTML.
//
//   node scripts/check_mobile_layout.mjs --all              every page @390px
//   node scripts/check_mobile_layout.mjs --all --width 1440 desktop regression
//   node scripts/check_mobile_layout.mjs cpp/lambda_deep_dive.html
//
// Both `--all` runs must end at `0 / N pages overflow` (see
// .cursor/rules/mobile-layout.mdc). Not wired into CI: it needs Playwright
// plus a browser, which the Python-only audit workflow does not have.
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const EXCLUDE = new Set(['assets', 'scripts', 'tools', 'node_modules', '.git', '.cursor', '.github', '.private']);

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDE.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith('.html')) acc.push(path.relative(root, p).split(path.sep).join('/'));
  }
  return acc;
}

const argv = process.argv.slice(2);
const widthArg = argv.indexOf('--width');
const width = widthArg === -1 ? 390 : Number(argv[widthArg + 1]);
const rest = argv.filter((a, i) => widthArg === -1 || (i !== widthArg && i !== widthArg + 1));
const all = rest.includes('--all');
const pages = all ? walk(root) : rest;

if (!pages.length) {
  console.error('usage: node scripts/check_mobile_layout.mjs (--all | <page.html> ...) [--width 390]');
  process.exit(2);
}

// Prefer a browser that is already on the machine — `playwright install
// chromium` is a 150MB download that a corporate network can drag out for
// 15+ minutes. Fall back to the bundled Chromium if none of them is there.
async function launch() {
  for (const channel of ['msedge', 'chrome', undefined]) {
    try {
      return await chromium.launch(channel ? { channel } : {});
    } catch { /* try the next one */ }
  }
  console.error('No browser found. Install Edge or Chrome, or run:  npx playwright install chromium');
  process.exit(2);
}
const browser = await launch();
const ctx = await browser.newContext({
  viewport: { width, height: 844 },
  deviceScaleFactor: 2,
  hasTouch: true,
});

const tally = new Map();
let overflowing = 0;

for (const rel of pages) {
  const page = await ctx.newPage();
  try {
    await page.goto(pathToFileURL(path.join(root, rel)).href, { waitUntil: 'load', timeout: 20000 });
    await page.waitForTimeout(all ? 80 : 300);
  } catch {
    console.log(`LOAD-FAIL  ${rel}`);
    await page.close();
    continue;
  }

  const res = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    // An element sticking out of an ancestor that scrolls or clips is fine —
    // that is exactly what .table-scroll and <pre> are for.
    const clipped = (el) => {
      const r = el.getBoundingClientRect();
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const cs = getComputedStyle(p);
        if (cs.overflowX !== 'visible' && r.right > p.getBoundingClientRect().right + 1) return true;
      }
      return false;
    };
    const bad = new Set();
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.right + window.scrollX > vw + 1 && !clipped(el)) bad.add(el);
    }
    const name = (el) => el.tagName.toLowerCase() +
      (el.className && typeof el.className === 'string' && el.className.trim()
        ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '');
    const out = [];
    for (const el of bad) {
      if (el.parentElement && bad.has(el.parentElement)) continue;   // outermost only
      const r = el.getBoundingClientRect();
      out.push({
        sel: name(el),
        parent: el.parentElement ? name(el.parentElement) : '',
        left: Math.round(r.left + window.scrollX), right: Math.round(r.right + window.scrollX),
        w: Math.round(r.width), ovf: getComputedStyle(el).overflowX,
        txt: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 50),
      });
    }
    return { vw, docW: document.documentElement.scrollWidth, offenders: out.sort((a, b) => b.right - a.right) };
  });

  if (res.docW > res.vw + 1) overflowing++;
  for (const o of res.offenders) tally.set(o.sel, (tally.get(o.sel) || 0) + 1);

  if (all) {
    if (res.docW > res.vw + 1) {
      const top = res.offenders.slice(0, 3).map((o) => `${o.sel}(${o.w})`).join(' ');
      console.log(`${String(res.docW).padStart(5)}  ${rel}  ${top}`);
    }
  } else {
    console.log('\n=== ' + rel);
    console.log(`  viewport=${res.vw} docScrollW=${res.docW}`);
    for (const o of res.offenders.slice(0, 8)) {
      console.log(`   ${o.sel}  [in ${o.parent}] x=${o.left}..${o.right} w=${o.w} overflow-x=${o.ovf}  "${o.txt}"`);
    }
  }
  await page.close();
}

console.log(`\n--- ${overflowing} / ${pages.length} pages overflow at ${width}px`);
if (all && tally.size) {
  console.log('--- offender selectors (element count):');
  for (const [k, v] of [...tally].sort((a, b) => b[1] - a[1]).slice(0, 30)) console.log(`   ${String(v).padStart(4)}  ${k}`);
}

await browser.close();
process.exit(overflowing ? 1 : 0);
