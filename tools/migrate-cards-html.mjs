#!/usr/bin/env node
// =============================================================================
// migrate-cards-html.mjs
// 一次性迁移脚本：把 interview/*_interview_cards.html 里的
//   const CARDS      = [...];
//   const CAT_GROUPS = [...];
// 两段裸字面量替换成
//   // <CARDS:BEGIN ...>
//   const CARDS = [];
//   const CAT_GROUPS = [];
//   // <CARDS:END>
// 占位标记（数据由 build-cards.mjs 从 interview/data/<slug>.json 注入）。
//
// 已经含有标记的文件会被跳过（幂等）。
//
// 用法:
//   node tools/migrate-cards-html.mjs architect
// =============================================================================
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const INTERVIEW_DIR = join(REPO_ROOT, 'interview');

const SLUG_TO_FILE = {
  architect: 'architect_interview_cards.html',
  cpp: 'cpp_interview_cards.html',
  em: 'em_interview_cards.html',
  pm: 'pm_interview_cards.html',
};

function fail(msg) { console.error(`[migrate] ERROR: ${msg}`); process.exit(1); }

// 同 extract-cards.mjs 的括号配对扫描，返回 { startIndex (含'['), endIndex (含']') }
function findArrayLiteral(source, varName) {
  const declRe = new RegExp(`const\\s+${varName}\\s*=\\s*\\[`);
  const m = declRe.exec(source);
  if (!m) fail(`Cannot find "const ${varName} = [" in source`);
  const startBracket = m.index + m[0].length - 1;
  const declStart = m.index; // 包括 "const X = " 整段开头
  let depth = 0;
  let i = startBracket;
  let inStr = null, inLineCmt = false, inBlockCmt = false;
  while (i < source.length) {
    const ch = source[i], next = source[i + 1];
    if (inLineCmt) { if (ch === '\n') inLineCmt = false; }
    else if (inBlockCmt) { if (ch === '*' && next === '/') { inBlockCmt = false; i++; } }
    else if (inStr) {
      if (ch === '\\') i++;
      else if (ch === inStr) inStr = null;
    } else {
      if (ch === '/' && next === '/') { inLineCmt = true; i++; }
      else if (ch === '/' && next === '*') { inBlockCmt = true; i++; }
      else if (ch === "'" || ch === '"' || ch === '`') inStr = ch;
      else if (ch === '[') depth++;
      else if (ch === ']') {
        depth--;
        if (depth === 0) {
          // 跳过紧跟的 ; 和 (可能的) 行尾换行
          let endIdx = i + 1;
          if (source[endIdx] === ';') endIdx++;
          return { declStart, endIndex: endIdx };
        }
      }
    }
    i++;
  }
  fail(`Unterminated array literal for ${varName}`);
}

// 把 [start, end) 这段所在的整行也吃掉 (从行首到行尾的 \n 之后)。
function expandToFullLines(source, start, end) {
  let s = start;
  while (s > 0 && source[s - 1] !== '\n') s--;
  let e = end;
  while (e < source.length && source[e] !== '\n') e++;
  if (e < source.length && source[e] === '\n') e++;
  return [s, e];
}

function migrate(slug) {
  const htmlName = SLUG_TO_FILE[slug];
  if (!htmlName) fail(`Unknown slug "${slug}"`);
  const htmlPath = join(INTERVIEW_DIR, htmlName);
  if (!existsSync(htmlPath)) fail(`HTML not found: ${htmlPath}`);

  let source = readFileSync(htmlPath, 'utf8');

  if (/\/\/\s*<CARDS:BEGIN/.test(source)) {
    console.log(`[migrate] ${slug}: already migrated (marker exists), skipping`);
    return;
  }

  // 定位两个 const 字面量
  const cardsLoc = findArrayLiteral(source, 'CARDS');
  const catLoc = findArrayLiteral(source, 'CAT_GROUPS');

  // 第二个一定在第一个之后，否则源文件结构有问题。
  if (catLoc.declStart < cardsLoc.endIndex) {
    fail(`Unexpected order: CAT_GROUPS appears before CARDS in ${htmlName}`);
  }

  // 删除 CAT_GROUPS 整段所在行 (它前后会有空行，一并清掉，留 1 行换行)。
  const [catLineStart, catLineEnd] = expandToFullLines(source, catLoc.declStart, catLoc.endIndex);
  // 删除 CAT_GROUPS 之前可能存在的一个空行（让前后衔接更干净）。
  let catEraseStart = catLineStart;
  if (catEraseStart >= 2 && source.slice(catEraseStart - 1, catEraseStart) === '\n' && source.slice(catEraseStart - 2, catEraseStart - 1) === '\n') {
    catEraseStart -= 1;
  }

  // 删除 CARDS 整段所在行 + 它上方紧贴的注释块 (// === / // 卡片数据 ... / // 字段 ... / // ===)
  const [cardsLineStart, cardsLineEnd] = expandToFullLines(source, cardsLoc.declStart, cardsLoc.endIndex);
  // 向上吃掉紧贴的 // 注释（最多 6 行，避免吃过多）。
  let eraseStart = cardsLineStart;
  for (let k = 0; k < 6; k++) {
    // 取上一行
    let prevLineEnd = eraseStart;
    if (prevLineEnd === 0) break;
    let prevLineStart = prevLineEnd - 1; // 跳过末尾 \n
    while (prevLineStart > 0 && source[prevLineStart - 1] !== '\n') prevLineStart--;
    const prevLine = source.slice(prevLineStart, prevLineEnd - 1); // 不含末尾 \n
    if (/^\s*\/\//.test(prevLine)) {
      eraseStart = prevLineStart;
    } else {
      break;
    }
  }

  const markerBlock =
`// <CARDS:BEGIN slug=${slug} — auto-generated from interview/data/${slug}.json. DO NOT EDIT BY HAND. Run \`npm run build:cards\` after editing the JSON.>
const CARDS = [];
const CAT_GROUPS = [];
// <CARDS:END>
`;

  // 注意先删后面（CAT_GROUPS）再删前面（CARDS），保持前面的索引有效。
  let next = source.slice(0, catEraseStart) + source.slice(catLineEnd);
  // CARDS 的范围在 catEraseStart 之前，索引未受 catEraseStart..catLineEnd 删除影响。
  next = next.slice(0, eraseStart) + markerBlock + next.slice(cardsLineEnd);

  writeFileSync(htmlPath, next, 'utf8');
  console.log(`[migrate] ${slug}: rewrote ${htmlName} with <CARDS:BEGIN/END> placeholder`);
  console.log(`[migrate] next step: node tools/build-cards.mjs ${slug}`);
}

function main() {
  const slug = process.argv[2];
  if (!slug) fail('Usage: node tools/migrate-cards-html.mjs <slug>\nSlugs: ' + Object.keys(SLUG_TO_FILE).join(' | '));
  migrate(slug);
}

main();
