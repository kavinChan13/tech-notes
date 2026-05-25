#!/usr/bin/env node
// =============================================================================
// build-cards.mjs
// 从 interview/data/*.json 生成对应 interview/*_interview_cards.html 的
//   <CARDS:BEGIN> ... <CARDS:END>
// 注入区块。卡片数据是 JSON，HTML 保持单文件可离线（双击即开），
// 不需要 fetch、不需要 file:// 限制、可以 PR Pages 直接发布。
//
// 用法:
//   node tools/build-cards.mjs              # 构建所有
//   node tools/build-cards.mjs architect    # 只构建指定 slug
//   node tools/build-cards.mjs --check      # CI 模式: 只检查是否已是最新, 不写文件
// =============================================================================
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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

const BEGIN_RE = /\/\/\s*<CARDS:BEGIN[^>]*>/;
const END_MARK = '// <CARDS:END>';

function fail(msg) {
  console.error(`[build-cards] ERROR: ${msg}`);
  process.exit(1);
}

function buildBlock(data) {
  // 用 JSON.stringify 生成 JS 字面量。
  // JSON 是 JS 对象字面量的严格子集 (键名带双引号、值是 JSON 类型),
  // 直接拼成 const X = <json>; 就是合法 JS, 不需要任何转换。
  const cardsJs = `const CARDS = ${JSON.stringify(data.cards, null, 2)};`;
  const catsJs = `const CAT_GROUPS = ${JSON.stringify(data.categoryGroups, null, 2)};`;
  return [
    `// <CARDS:BEGIN slug=${data.slug} cards=${data.cards.length} groups=${data.categoryGroups.length} auto-generated from interview/data/${data.slug}.json — DO NOT EDIT BY HAND. Run \`npm run build:cards\` after editing the JSON.>`,
    cardsJs,
    '',
    catsJs,
    END_MARK,
  ].join('\n');
}

function injectBlock(html, newBlock, slug) {
  const beginMatch = BEGIN_RE.exec(html);
  if (!beginMatch) {
    fail(`No "// <CARDS:BEGIN ...>" marker found in HTML for ${slug}.\n` +
         `Make sure the HTML has both markers in its <script> block. See tools/README.md.`);
  }
  const beginIdx = beginMatch.index;
  const endIdx = html.indexOf(END_MARK, beginIdx);
  if (endIdx === -1) {
    fail(`No "${END_MARK}" marker found after BEGIN in HTML for ${slug}.`);
  }
  return html.slice(0, beginIdx) + newBlock + html.slice(endIdx + END_MARK.length);
}

function buildOne(slug, opts) {
  const htmlName = SLUG_TO_FILE[slug];
  if (!htmlName) fail(`Unknown slug "${slug}". Valid: ${Object.keys(SLUG_TO_FILE).join(' | ')}`);

  const dataPath = join(DATA_DIR, `${slug}.json`);
  if (!existsSync(dataPath)) {
    if (opts.allowMissing) {
      console.log(`[build-cards] skip ${slug}: data file not found (${dataPath})`);
      return { skipped: true };
    }
    fail(`Data file not found: ${dataPath}`);
  }
  const htmlPath = join(INTERVIEW_DIR, htmlName);
  if (!existsSync(htmlPath)) fail(`HTML not found: ${htmlPath}`);

  const data = JSON.parse(readFileSync(dataPath, 'utf8'));
  if (data.slug !== slug) {
    fail(`Data slug mismatch: file is for "${data.slug}" but you asked for "${slug}".`);
  }

  const html = readFileSync(htmlPath, 'utf8');
  const newBlock = buildBlock(data);
  const newHtml = injectBlock(html, newBlock, slug);

  if (newHtml === html) {
    console.log(`[build-cards] ${slug}: up-to-date (${data.cards.length} cards)`);
    return { changed: false };
  }
  if (opts.check) {
    console.error(`[build-cards] ${slug}: OUT OF DATE — run \`npm run build:cards\` and commit ${htmlName}.`);
    return { changed: true, check: true };
  }
  writeFileSync(htmlPath, newHtml, 'utf8');
  console.log(`[build-cards] ${slug}: wrote ${htmlName} (${data.cards.length} cards, ${data.categoryGroups.length} groups)`);
  return { changed: true };
}

function main() {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const positional = args.filter(a => !a.startsWith('--'));
  const slugs = positional.length ? positional : Object.keys(SLUG_TO_FILE);

  let anyOutOfDate = false;
  for (const slug of slugs) {
    const r = buildOne(slug, { check, allowMissing: positional.length === 0 });
    if (r.check && r.changed) anyOutOfDate = true;
  }
  if (check && anyOutOfDate) {
    console.error(`[build-cards] check failed — HTML out of sync with JSON.`);
    process.exit(1);
  }
}

main();
