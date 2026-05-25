#!/usr/bin/env node
// =============================================================================
// extract-cards.mjs
// 一次性迁移脚本：从 interview/*_interview_cards.html 中提取
//   const CARDS      = [...]   (卡片数据)
//   const CAT_GROUPS = [...]   (分类分组)
// 转成 interview/data/<slug>.json，便于后续单点编辑。
//
// 用法:
//   node tools/extract-cards.mjs <slug>
//   node tools/extract-cards.mjs architect
//
// 只读取 HTML，不修改它。修改 HTML 加注入标记是后一步的事，由人工操作或后续脚本处理。
// =============================================================================
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const INTERVIEW_DIR = join(REPO_ROOT, 'interview');
const DATA_DIR = join(INTERVIEW_DIR, 'data');

const SLUG_TO_FILE = {
  architect: 'architect_interview_cards.html',
  cpp: 'cpp_interview_cards.html',
  em: 'em_interview_cards.html',
  pm: 'pm_interview_cards.html',
};

function fail(msg) {
  console.error(`[extract-cards] ${msg}`);
  process.exit(1);
}

function extractBlock(source, varName) {
  // 匹配 `const <varName> = ` 后面的数组字面量 [ ... ];
  // 通过括号配对而不是正则，避免被字符串里的 [/]/ 干扰。
  const declRe = new RegExp(`const\\s+${varName}\\s*=\\s*\\[`);
  const m = declRe.exec(source);
  if (!m) fail(`Cannot find "const ${varName} = [" in source`);
  const startIdx = m.index + m[0].length - 1; // points at '['
  // 从 '[' 开始括号配对，注意跳过字符串/模板字符串/注释
  let depth = 0;
  let i = startIdx;
  let inStr = null; // "'" or '"' or '`'
  let inLineCmt = false;
  let inBlockCmt = false;
  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];
    if (inLineCmt) {
      if (ch === '\n') inLineCmt = false;
    } else if (inBlockCmt) {
      if (ch === '*' && next === '/') { inBlockCmt = false; i++; }
    } else if (inStr) {
      if (ch === '\\') { i++; } // skip escaped next char
      else if (ch === inStr) { inStr = null; }
    } else {
      if (ch === '/' && next === '/') { inLineCmt = true; i++; }
      else if (ch === '/' && next === '*') { inBlockCmt = true; i++; }
      else if (ch === "'" || ch === '"' || ch === '`') { inStr = ch; }
      else if (ch === '[') depth++;
      else if (ch === ']') {
        depth--;
        if (depth === 0) {
          // 找到结尾 ']'。包含自身。
          const arrayLiteral = source.slice(startIdx, i + 1);
          return { arrayLiteral, endIndex: i };
        }
      }
    }
    i++;
  }
  fail(`Unterminated array literal for ${varName}`);
}

function evalArray(literal) {
  // 用 vm 在沙盒里 eval，零副作用、零全局污染。
  const ctx = vm.createContext({});
  // 包成表达式
  return vm.runInContext(`(${literal})`, ctx, { timeout: 1000 });
}

function normalizeCard(c) {
  // 清理 / 标准化字段顺序，便于 diff 稳定。
  const out = { id: c.id };
  if (Array.isArray(c.cats)) out.cats = c.cats;
  if (c.diff) out.diff = c.diff;
  if (c.q != null) out.q = c.q;
  if (c.ans != null) out.ans = c.ans;
  if (c.code != null) out.code = c.code;
  if (c.bonus != null) out.bonus = c.bonus;
  if (c.trap != null) out.trap = c.trap;
  if (c.ref != null) out.ref = c.ref;
  // 把未识别的字段也带上，以防数据集有额外字段
  for (const k of Object.keys(c)) {
    if (!(k in out)) out[k] = c[k];
  }
  return out;
}

function main() {
  const slug = process.argv[2];
  if (!slug) fail('Usage: node tools/extract-cards.mjs <slug>\nSlugs: ' + Object.keys(SLUG_TO_FILE).join(' | '));
  const htmlName = SLUG_TO_FILE[slug];
  if (!htmlName) fail(`Unknown slug "${slug}". Valid: ${Object.keys(SLUG_TO_FILE).join(' | ')}`);

  const htmlPath = join(INTERVIEW_DIR, htmlName);
  if (!existsSync(htmlPath)) fail(`HTML not found: ${htmlPath}`);

  const source = readFileSync(htmlPath, 'utf8');

  const { arrayLiteral: cardsLit } = extractBlock(source, 'CARDS');
  const { arrayLiteral: catLit } = extractBlock(source, 'CAT_GROUPS');

  const cards = evalArray(cardsLit).map(normalizeCard);
  const catGroups = evalArray(catLit);

  console.log(`[extract-cards] ${slug}: ${cards.length} cards, ${catGroups.length} category groups`);

  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  const outPath = join(DATA_DIR, `${slug}.json`);
  const json = {
    slug,
    sourceHtml: htmlName,
    cardCount: cards.length,
    categoryGroups: catGroups,
    cards,
  };
  writeFileSync(outPath, JSON.stringify(json, null, 2) + '\n', 'utf8');
  console.log(`[extract-cards] wrote ${outPath}`);
}

main();
