// Tests for calling Avisoq as a native shared library: node tests/embed-native.mjs
// Needs GCC and node:ffi (Node 26). Every answer is compared with the WebAssembly route.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load, open, AvisoqError } from '../src/index.mjs';
import { findGcc, LIB_EXT } from '../src/compiler.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const file = fileURLToPath(new URL('../examples/embed/scoring.avq', import.meta.url));
const cli = fileURLToPath(new URL('../src/cli.mjs', import.meta.url));
let passed = 0, failed = 0;
const report = (name, ok, detail = '') => { if (ok) passed++; else { failed++; console.log(`FAIL  ${name}\n      ${detail}`); } };
const text = (v) => JSON.stringify(v, (k, x) => (typeof x === 'bigint' ? `${x}n` : x)) ?? 'nothing';
const outcome = (f) => { try { return text(f()); } catch (e) { return e instanceof AvisoqError ? `error ${e.kind}: ${e.message}` : `crash ${e.message}`; } };

let ffiThere = true;
try { await import('node:ffi'); } catch { ffiThere = false; }
if (!findGcc() || !ffiThere) {
  console.log(`[embed-native] skipped: ${findGcc() ? 'this Node has no node:ffi' : 'GCC is not installed'}`);
  process.exit(0);
}

// ---- the example file: native and WebAssembly must agree on everything ----
const native = await load(file, { native: true });
const wasm = await load(file);
const calls = [
  ['score', [[3, -1, 50, 8], 10]], ['score', [[], 0]], ['summarise', [[1, 2, 4], 'week']], ['words', ['  a  bc d ']], ['words', ['']], ['words', ['héllo wörld ✓']],
  ['divmod', [17, 5]], ['divmod', [-17, 5]], ['parse_port', ['80']], ['parse_port', ['x']], ['parse_port', ['70000']], ['factorial', [30]], ['factorial', [200]],
  ['double_it', [21]], ['double_it', [-4611686018427387904n]], ['double_it', [4611686018427387903n]], ['double_it', ['12']],
  ['double_it', [9223372036854775807n]], ['divmod', [1, 0]], ['score', ['abc', 1]], ['score', [[1.5], 1]], ['score', [[1]]], ['score', [[1], -1]], ['greet', ['you']],
];
for (const [name, args] of calls) {
  const a = outcome(() => native[name](...args)), b = outcome(() => wasm[name](...args));
  report(`${name}(${text(args).slice(1, -1)}) is the same on both routes`, a === b, `native: ${a}\n      wasm:   ${b}`);
}
report('the callable functions are the same list', text(native.$functions) === text(wasm.$functions), text(native.$functions.map((f) => f.name)));
report('private functions are not callable', native.filter_words === undefined && native.$native === true);
{
  for (let i = 0; i < 200000; i++) native.words('a few words in a longer sentence to allocate');
  report('still correct after many calls', native.score([1, 2, 3], 5) === 6 && text(native.words('x y')) === '["x","y"]');
}

// ---- every kind of value, in both directions ----
const shapes = `
struct Point { x: Int, y: Float, tags: [Str], ok: Bool }
enum Shape { Circle(radius: Float), Box(width: Int, height: Int), Empty }
fn echo_point(p: Point) -> Point { return copy(p) }
fn points(n: Int) -> [Point] {
  var out: [Point] = []
  for i in 0..n { push(out, Point(x: i, y: float(i) / 2.0, tags: [str(i), "t"], ok: i % 2 == 0)) }
  return out
}
fn area(s: Shape) -> Float {
  match s {
    Circle(radius) => { return 3.0 * radius * radius }
    Box(width, height) => { return float(width * height) }
    Empty => { return 0.0 }
  }
}
fn grow(s: Shape) -> Shape {
  match s {
    Circle(radius) => { return Circle(radius: radius * 2.0) }
    Box(width, height) => { return Box(width: width + 1, height: height + 1) }
    Empty => { return Empty }
  }
}
fn swap(t: (Int, Str)) -> (Str, Int) {
  let (a, b) = t
  return (b, a)
}
fn invert(bs: [Bool]) -> [Bool] {
  var out: [Bool] = []
  for b in bs { push(out, not b) }
  return out
}
fn rows(xs: [[Int]]) -> [Int] {
  var out: [Int] = []
  for row in xs {
    var total = 0
    for x in row { total += x }
    push(out, total)
  }
  return out
}
fn halves(xs: [Float]) -> [Float] {
  var out: [Float] = []
  for x in xs { push(out, x / 2.0) }
  return out
}
fn first_even(xs: [Int]) -> Option[Int] {
  for x in xs { if x % 2 == 0 { return Some(value: x) } }
  return None
}
fn at(xs: [Int], i: Int) -> Int { return xs[i] }
fn count_up(n: Int) -> [Int] {
  var out: [Int] = []
  for i in 0..n { push(out, i * 1000003) }
  return out
}
fn nothing(n: Int) { assert n >= 0 }
fn deep(n: Int) -> Int { if n == 0 { return 0 } return 1 + deep(n - 1) }
`;
const path = join(here, 'embed_native_values.avq');
const n2 = await load(path, { native: true, source: shapes });
const w2 = await load(path, { source: shapes });
const big = Array.from({ length: 5000 }, (_, i) => i - 2500);
const more = [
  ['echo_point', [{ x: -7, y: 1.5, tags: ['a', 'ß✓', ''], ok: true }]], ['points', [3]], ['points', [0]],
  ['area', [{ variant: 'Circle', radius: 2 }]], ['area', [{ variant: 'Box', width: 3, height: 4 }]], ['area', [{ variant: 'Empty' }]], ['area', [{ variant: 'Nope' }]],
  ['grow', [{ variant: 'Box', width: 3, height: 4 }]], ['grow', [{ variant: 'Empty' }]], ['swap', [[5, 'five']]], ['swap', [[5]]],
  ['invert', [[true, false, true]]], ['invert', [[1]]], ['rows', [[[1, 2], [], [3, 4, 5]]]], ['halves', [[1, 2.5, -0]]], ['halves', [['x']]],
  ['first_even', [[1, 3, 4]]], ['first_even', [[1, 3]]], ['at', [[1, 2, 3], 2]], ['at', [[1, 2, 3], 3]], ['at', [[1, 2, 3], -1]],
  ['count_up', [5000]], ['rows', [[big, big]]], ['nothing', [1]], ['nothing', [-1]], ['deep', [1000]],
  ['echo_point', [{ x: 1, y: 2, tags: 'no', ok: true }]], ['echo_point', [null]], ['at', [[2n ** 62n, 9007199254740993n], 1]],
];
for (const [name, args] of more) {
  const a = outcome(() => n2[name](...args)), b = outcome(() => w2[name](...args));
  report(`${name} is the same on both routes`, a === b, `args:   ${text(args).slice(0, 120)}\n      native: ${a.slice(0, 200)}\n      wasm:   ${b.slice(0, 200)}`);
}
report('a failure does not stop later calls', outcome(() => n2.at([1], 9)).startsWith('error bounds') && n2.at([1, 2], 1) === 2);
report('a result larger than the first buffer arrives whole', n2.count_up(100000).length === 100000 && n2.count_up(100000)[99999] === 99999 * 1000003);

// ---- a library built ahead of time, and the command line ----
const tmp = mkdtempSync(join(tmpdir(), 'avisoq-shared-'));
{
  const lib = join(tmp, `scoring${LIB_EXT}`);
  const built = spawnSync(process.execPath, [cli, 'build', file, '--shared', '-o', lib], { encoding: 'utf8' });
  report('avisoq build --shared writes a library', built.status === 0 && existsSync(lib), built.stdout + built.stderr);
  const m = await open(lib);
  report('open() loads a library built earlier', m.score([3, 5, 8], 10) === 16 && m.$functions.some((f) => f.name === 'summarise'), text(m.$functions.map((f) => f.name)));
  report('a function that needs a capability the library lacks is refused', outcome(() => m.greet('x')).startsWith('error capability_denied'), outcome(() => m.greet('x')));
  const bad = outcome(() => null) && await open(join(tmp, 'missing.dll')).then(() => 'loaded', (e) => e.kind);
  report('a missing library is a clear error', bad === 'setup', String(bad));

  const call = spawnSync(process.execPath, [cli, 'call', file, 'divmod', '[17, 5]', '--native'], { encoding: 'utf8' });
  report('avisoq call --native', call.status === 0 && call.stdout.trim() === '[3,2]', call.stdout + call.stderr);
  const hello = spawnSync(process.execPath, [cli, 'call', file, 'greet', '["you"]', '--native', '--allow', 'io'], { encoding: 'utf8' });
  report('a library built with io can print', hello.status === 0 && hello.stdout.includes('hello, you'), hello.stdout + hello.stderr);

  // ---- from Python: ctypes loads the same library, without Node ----
  const script = [
    'import sys', `sys.path.insert(0, r"${fileURLToPath(new URL('../bindings/python', import.meta.url))}")`, 'import avisoq',
    `m = avisoq.open_library(r"${lib}")`,
    'out = [m.score([3, -1, 50, 8], 10), m.summarise([1, 2, 4], "week")["label"], m.words(" a  bc "), m.divmod(17, 5), m.parse_port("80")["value"], m.double_it(4611686018427387903), len(m.factorial(100))]',
    'for bad in (lambda: m.divmod(1, 0), lambda: m.greet("x"), lambda: m.score("abc", 1), lambda: m.double_it(2 ** 63)):',
    '    try:', '        bad()', '    except avisoq.AvisoqError as e:', '        out.append(e.kind)',
    'out.append(m.score(list(range(100000)), 3))',
    `n = avisoq.load(r"${file}", native=True)`, 'out.append(n.divmod(-17, 5))', 'print(out)',
  ].join('\n');
  const r = spawnSync('python', ['-c', script], { encoding: 'utf8', cwd: here });
  if (r.error) console.log('(Python is not installed: the native Python binding was not tested)');
  else report('the native Python binding', r.stdout.trim() === "[21, 'WEEK', ['a', 'bc'], [3, 2], 80, 9223372036854775806, 158, 'precondition', 'capability_denied', 'argument', 'argument', 299994, [-3, -2]]", r.stdout + r.stderr);
  m.$close();
}
try { rmSync(tmp, { recursive: true, force: true }); } catch { /* a loaded library cannot be deleted on Windows */ }

console.log(`[embed-native] ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
