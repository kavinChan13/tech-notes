// Smoke test for assets/search-index-loader.js against a minimal DOM shim:
// verifies URL resolution, load-once semantics and callback flushing.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync('assets/search-index-loader.js', 'utf8');

function run(scriptSrc, onInject) {
  const injected = [];
  const head = {
    appendChild(node) {
      injected.push(node);
      onInject(node);
    },
  };
  const sandbox = {
    window: {},
    document: {
      currentScript: { src: scriptSrc },
      head,
      documentElement: head,
      createElement: () => ({ set src(v) { this._src = v; }, get src() { return this._src; } }),
    },
  };
  sandbox.window.document = sandbox.document;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return { api: sandbox.window.TNSearchIndex, injected, sandbox };
}

let failures = 0;
function check(label, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`);
  if (!cond) failures++;
}

// 1. URL resolution from a nested page (../assets/...)
{
  const { api, injected } = run('file:///C:/site/assets/search-index-loader.js', (n) => {
    setTimeout(() => n.onload(), 0);
  });
  api.load(() => {});
  check('resolves sibling search-index.js',
    injected[0].src === 'file:///C:/site/assets/search-index.js');
}

// 2. loads once even when called repeatedly, and every callback fires
{
  let node;
  const { api, injected, sandbox } = run('http://x/assets/search-index-loader.js', (n) => { node = n; });
  let calls = 0;
  api.load(() => calls++);
  api.load(() => calls++);
  api.load(() => calls++);
  check('injects exactly one <script>', injected.length === 1);
  check('not ready before load completes', api.ready === false);
  sandbox.window.TN_SEARCH_INDEX = [{ u: 'a.html', t: 'A', c: 'X', s: [] }];
  node.onload();
  check('all three callbacks fired', calls === 3);
  check('ready flips to true', api.ready === true);
  check('get() returns the index', api.get().length === 1);
  // a load() after completion must still call back synchronously
  let late = 0;
  api.load(() => late++);
  check('late load() calls back immediately', late === 1);
  check('still only one <script>', injected.length === 1);
}

// 3. a failed fetch must not hang consumers
{
  let node;
  const { api } = run('http://x/assets/search-index-loader.js', (n) => { node = n; });
  let called = false;
  api.load(() => { called = true; });
  node.onerror();
  check('onerror still invokes the callback', called === true);
  check('get() degrades to an empty index', Array.isArray(api.get()) && api.get().length === 0);
}

console.log(failures ? `\n${failures} failure(s)` : '\nall checks passed');
process.exit(failures ? 1 : 0);
