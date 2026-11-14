// Tests for calling Avisoq from other languages: node tests/embed.mjs
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { load, AvisoqError } from '../src/index.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const file = fileURLToPath(new URL('../examples/embed/scoring.avq', import.meta.url));
const cli = fileURLToPath(new URL('../src/cli.mjs', import.meta.url));
let passed = 0, failed = 0;
const report = (name, ok, detail = '') => { if (ok) passed++; else { failed++; console.log(`FAIL  ${name}\n      ${detail}`); } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const fails = (f, kind) => { try { f(); return 'no error'; } catch (e) { return e instanceof AvisoqError && e.kind === kind ? true : `${e.kind}: ${e.message}`; } };

// ---- from JavaScript ----
const m = await load(file);
report('an Int function', m.score([3, -1, 50, 8], 10) === 21, String(m.score([3, -1, 50, 8], 10)));
report('a struct comes back as an object', same(m.summarise([1, 2, 4], 'week'), { count: 3, total: 7, mean: 7 / 3, label: 'WEEK' }), JSON.stringify(m.summarise([1, 2, 4], 'week')));
report('arrays of strings', same(m.words('  a  bc d '), ['a', 'bc', 'd']) && same(m.words(''), []), JSON.stringify(m.words('  a  bc d ')));
report('a tuple comes back as an array', same(m.divmod(17, 5), [3, 2]), JSON.stringify(m.divmod(17, 5)));
report('an enum comes back with its variant', same(m.parse_port('80'), { variant: 'Ok', value: 80 }) && m.parse_port('x').variant === 'Err', JSON.stringify(m.parse_port('x')));
report('large results', m.factorial(30) === '265252859812191058636308480000000', m.factorial(30));
report('Ints beyond the exact range of a number are bigints', m.double_it(4611686018427387903n) === 9223372036854775806n && m.double_it(21) === 42, String(m.double_it(4611686018427387903n)));
report('non-ASCII text survives', same(m.words('héllo wörld ✓'), ['héllo', 'wörld', '✓']), JSON.stringify(m.words('héllo wörld ✓')));
report('an overflow is an error, not a wrong number', fails(() => m.double_it(9223372036854775807n), 'overflow') === true, String(fails(() => m.double_it(9223372036854775807n), 'overflow')));
report('a broken contract is an error', fails(() => m.divmod(1, 0), 'precondition') === true, String(fails(() => m.divmod(1, 0), 'precondition')));
report('a wrong argument type is refused', fails(() => m.score('abc', 1), 'argument') === true && fails(() => m.score([1.5], 1), 'argument') === true && fails(() => m.score([1]), 'argument') === true, String(fails(() => m.score('abc', 1), 'argument')));
report('private functions are not callable', m.filter_words === undefined && typeof m.words === 'function');
report('printing needs the io capability', fails(() => m.greet('you'), 'capability_denied') === true, String(fails(() => m.greet('you'), 'capability_denied')));
{
  const io = await load(file, { allow: ['io'] });
  io.greet('you');
  report('granted output is collected', io.$output() === 'hello, you\n' && io.$output() === '');
}
{
  // memory is handed back after every call: many calls must not grow it without bound
  for (let i = 0; i < 20000; i++) m.words('a few words in a longer sentence to allocate');
  report('still correct after many calls', m.score([1, 2, 3], 5) === 6 && same(m.words('x y'), ['x', 'y']));
}
{
  let message = '';
  try { await load(file, { source: 'fn broken( {' }); } catch (e) { message = `${e.kind}|${e.message}`; }
  report('a compile error is reported with its position', message.startsWith('compile|') && message.includes('error[E0001]'), message);
}
report('the callable functions are listed with their types', m.$functions.some((f) => f.name === 'score' && f.ret === 'Int' && f.params[0].ty === '[Int]'), JSON.stringify(m.$functions.map((f) => f.name)));

// ---- the line protocol behind `avisoq serve` ----
{
  const child = spawn(process.execPath, [cli, 'serve', file], { stdio: ['pipe', 'pipe', 'inherit'] });
  const lines = [];
  let buffer = '';
  child.stdout.on('data', (d) => { buffer += d; let i; while ((i = buffer.indexOf('\n')) >= 0) { lines.push(JSON.parse(buffer.slice(0, i))); buffer = buffer.slice(i + 1); } });
  const ask = (req) => new Promise((done) => { const want = lines.length + 1; child.stdin.write(`${JSON.stringify(req)}\n`); const t = setInterval(() => { if (lines.length >= want) { clearInterval(t); done(lines[want - 1]); } }, 2); });
  await new Promise((done) => { const t = setInterval(() => { if (lines.length) { clearInterval(t); done(); } }, 2); });
  report('serve announces what can be called', lines[0].ready === true && lines[0].functions.length >= 6, JSON.stringify(lines[0]).slice(0, 200));
  const a = await ask({ id: 1, fn: 'score', args: [[3, 5, 8], 10] });
  const b = await ask({ id: 2, fn: 'divmod', args: [1, 0] });
  const c = await ask({ id: 3, fn: 'double_it', args: ['4611686018427387903'] });
  const d = await ask({ id: 4, fn: 'nope', args: [] });
  report('serve answers a call', a.ok && a.id === 1 && a.result === 16, JSON.stringify(a));
  report('serve reports a failure and keeps going', !b.ok && b.error.kind === 'precondition' && c.ok && c.result === '9223372036854775806' && !d.ok, JSON.stringify([b, c, d]));
  child.stdin.end();
}

// ---- from Python, when Python is installed ----
{
  const script = [
    'import sys', `sys.path.insert(0, r"${fileURLToPath(new URL('../bindings/python', import.meta.url))}")`, 'import avisoq',
    `m = avisoq.load(r"${file}")`,
    'out = [m.score([3, -1, 50, 8], 10), m.summarise([1, 2, 4], "week")["label"], m.words(" a  bc "), m.divmod(17, 5), m.parse_port("80")["value"], m.double_it(4611686018427387903), len(m.factorial(100))]',
    'try:', '    m.divmod(1, 0)', 'except avisoq.AvisoqError as e:', '    out.append(e.kind)',
    'try:', '    m.greet("x")', 'except avisoq.AvisoqError as e:', '    out.append(e.kind)',
    'm.close()', `io = avisoq.load(r"${file}", allow=["io"])`, 'io.greet("py")', 'out.append(io.output.strip())', 'io.close()', 'print(out)',
  ].join('\n');
  const r = spawnSync('python', ['-c', script], { encoding: 'utf8', cwd: here });
  if (r.error) console.log('(Python is not installed: the Python binding was not tested)');
  else report('the Python binding', r.stdout.trim() === "[21, 'WEEK', ['a', 'bc'], [3, 2], 80, 9223372036854775806, 158, 'precondition', 'capability_denied', 'hello, py']", r.stdout + r.stderr);
}

console.log(`[embed] ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
