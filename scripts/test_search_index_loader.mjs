// Smoke test for assets/search-index-loader.js against a minimal DOM shim:
// verifies URL resolution, load-once semantics, callback flushing, and that
// the two tiers (lite index / per-topic shards) fetch only what they need.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync('assets/search-index-loader.js', 'utf8');

function run(scriptSrc, onInject) {
  const injected = [];
  const head = {
    appendChild(node) {
      injected.push(node);
      if (onInject) onInject(node);
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
    setTimeout,
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

const LOADER = 'file:///C:/site/assets/search-index-loader.js';

// 1. URL resolution from a nested page (../assets/...)
{
  const { api, injected } = run(LOADER);
  api.loadLite(() => {});
  check('loadLite resolves sibling search-index-lite.js',
    injected[0].src === 'file:///C:/site/assets/search-index-lite.js');

  api.loadTopic('ai-native', () => {});
  check('loadTopic resolves search-index/<topic>.js',
    injected[1].src === 'file:///C:/site/assets/search-index/ai-native.js');
}

// 2. a directory page must fetch its own shard and nothing else. This is the
//    whole point of the split: before it, filtering 6 pages pulled all 20
//    topics (14.7 MB).
{
  let node;
  const { api, injected, sandbox } = run(LOADER, (n) => { node = n; });
  let got = null;
  api.loadTopic('reinforcement', (recs) => { got = recs; });
  check('one <script> for one shard', injected.length === 1);
  sandbox.window.TN_SEARCH_SHARD = { reinforcement: [{ u: 'reinforcement/a.html', t: 'A', c: 'RL', s: [] }] };
  node.onload();
  check('loadTopic hands back just that topic', got && got.length === 1);
  check('no other shard was requested', injected.length === 1);
}

// 3. loads once even when called repeatedly, and every callback fires
{
  let node;
  const { api, injected, sandbox } = run(LOADER, (n) => { node = n; });
  let calls = 0;
  api.loadLite(() => calls++);
  api.loadLite(() => calls++);
  api.loadLite(() => calls++);
  check('injects exactly one <script> for three loadLite calls', injected.length === 1);
  sandbox.window.TN_SEARCH_LITE = [{ u: 'a.html', t: 'A', c: 'X', s: [{ a: 's1', h: 'H' }] }];
  sandbox.window.TN_SEARCH_TOPICS = ['x'];
  node.onload();
  check('all three callbacks fired', calls === 3);
  check('lite() returns the lite index', api.lite().length === 1);

  let late = 0;
  api.loadLite(() => late++);
  check('late loadLite calls back immediately', late === 1);
  check('still only one <script>', injected.length === 1);
}

// 4. load() pulls the lite file for the topic list, then every shard
{
  const nodes = [];
  const { api, injected, sandbox } = run(LOADER, (n) => nodes.push(n));
  let all = null;
  api.load((recs) => { all = recs; });

  check('load() starts with the lite index', injected.length === 1
    && injected[0].src.endsWith('search-index-lite.js'));
  check('not ready before the shards are in', api.ready === false);

  sandbox.window.TN_SEARCH_TOPICS = ['cpp', 'system'];
  sandbox.window.TN_SEARCH_LITE = [];
  nodes[0].onload();
  check('then requests one <script> per topic', injected.length === 3);

  sandbox.window.TN_SEARCH_SHARD = {
    cpp: [{ u: 'cpp/a.html', t: 'A', c: 'C++', s: [{ a: 's1', h: 'H', x: 'body' }] }],
    system: [{ u: 'system/b.html', t: 'B', c: 'Linux', s: [] }],
  };
  nodes[1].onload();
  nodes[2].onload();
  check('load() callback gets every record', all && all.length === 2);
  check('ready flips to true', api.ready === true);
  check('get() returns the merged index', api.get().length === 2);
}

// 5. a failed fetch must not hang consumers
{
  let node;
  const { api } = run(LOADER, (n) => { node = n; });
  let called = false;
  api.loadTopic('cpp', () => { called = true; });
  node.onerror();
  check('onerror still invokes the callback', called === true);
  check('get() degrades to an empty index', Array.isArray(api.get()) && api.get().length === 0);
}

// 6. an unknown topic must not throw or hang
{
  const { api } = run(LOADER);
  let called = false;
  api.loadTopic('', (recs) => { called = Array.isArray(recs) && recs.length === 0; });
  check('loadTopic("") calls back with an empty list', called === true);
}

console.log(failures ? `\n${failures} failure(s)` : '\nall checks passed');
process.exit(failures ? 1 : 0);
