// 检查「浅色模式下出现深底 / 深色模式下出现浅底」的图。
//
// 为什么必须真渲染：mermaid 的配色是 initialize() 时烘进 SVG 的，
// 静态 grep 只能看到 `theme:'dark'` 这一种写法，看不到 themeVariables
// 里逐项写死的深色，也看不到最终 SVG 上到底是什么颜色。
//
//   node scripts/check_diagram_contrast.mjs --all
//   node scripts/check_diagram_contrast.mjs system/io_linux_kernel_guide.html
//
// 判据：取每张图里面积最大的若干填充色，换算成相对亮度。
// 浅色模式下不该出现亮度 < 0.25 的大块填充；深色模式下不该出现 > 0.75 的。
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
const all = argv.includes('--all');
const pages = all ? walk(root) : argv.filter((a) => !a.startsWith('--'));
if (!pages.length) {
  console.error('usage: node scripts/check_diagram_contrast.mjs (--all | <page.html> ...)');
  process.exit(2);
}

async function launch() {
  for (const channel of ['msedge', 'chrome', undefined]) {
    try {
      return await chromium.launch(channel ? { channel } : {});
    } catch { /* next */ }
  }
  console.error('No browser found. Install Edge or Chrome, or run:  npx playwright install chromium');
  process.exit(2);
}

const probe = () => {
  // 只看「背景面」：近中性色（灰 / 深蓝灰）。
  // 图表里的深红柱、紫色多边形都是**数据色**，饱和度高，深一点是故意的，
  // 不该报。第一版没做这个区分，4 个页面全是这种误报。
  const lum = (c) => {
    const m = c && c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a] = m[1].split(',').map((x) => parseFloat(x));
    if (a !== undefined && a < 0.5) return null;          // 透明的不算
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx - mn > 70) return null;                        // 饱和 = 数据色，跳过
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  };
  const out = [];
  for (const svg of document.querySelectorAll('svg')) {
    // 只看图表：顶栏图标之类的小 svg 跳过
    const box = svg.getBoundingClientRect();
    if (box.width < 200 || box.height < 100) continue;
    const areas = new Map();
    for (const el of svg.querySelectorAll('rect, polygon, path, circle, ellipse')) {
      const r = el.getBoundingClientRect();
      const a = r.width * r.height;
      if (a < 2000) continue;                              // 忽略小色块
      const fill = getComputedStyle(el).fill;
      const l = lum(fill);
      if (l === null) continue;
      areas.set(l, (areas.get(l) || 0) + a);
    }
    if (!areas.size) continue;
    const top = [...areas.entries()].sort((x, y) => y[1] - x[1])[0];
    out.push({ lum: top[0], area: top[1], id: svg.id || svg.getAttribute('aria-label') || '' });
  }
  return out;
};

const browser = await launch();
let bad = 0;
for (const page of pages) {
  const url = pathToFileURL(path.join(root, page)).href;
  for (const mode of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await ctx.addInitScript((m) => {
      try { localStorage.setItem('theme', m); } catch { /* file:// */ }
    }, mode);
    const p = await ctx.newPage();
    try {
      // 90s 不是因为页面真有这么慢：并发跑几个实例时会互相抢资源，
      // 45s 下每轮都会有一两个页面随机超时，报出来的全是噪音。
      await p.goto(url, { waitUntil: 'load', timeout: 90000 });
      // mermaid 是滚到附近才画的（见 assets/mermaid-theme.js），
      // 不滚一遍就只能看到首屏那一张，后面的图全查不到。
      await p.evaluate(async () => {
        const total = document.querySelectorAll('.mermaid').length;
        for (let y = 0; y < document.body.scrollHeight; y += 600) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 30));
          if (total && document.querySelectorAll('.mermaid svg').length === total) break;
        }
        window.scrollTo(0, 0);
      });
      await p.waitForTimeout(1200);                        // 等最后几张画完
      const found = await p.evaluate(probe);
      for (const f of found) {
        const dark = f.lum < 0.25;
        const light = f.lum > 0.75;
        if ((mode === 'light' && dark) || (mode === 'dark' && light)) {
          console.log(`  ${page} [${mode}] 主色亮度 ${f.lum.toFixed(2)} ${f.id ? '· ' + f.id.slice(0, 50) : ''}`);
          bad++;
        }
      }
    } catch (e) {
      console.log(`  ${page} [${mode}] 打开失败: ${e.message.split('\n')[0]}`);
      bad++;
    }
    await ctx.close();
  }
}
await browser.close();
console.log(`\n--- ${bad} 处配色与当前主题相反（${pages.length} 个页面）`);
process.exit(bad ? 1 : 0);
