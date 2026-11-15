// Tests for limits per call, host functions and `avisoq mcp`: node tests/mcp.mjs
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { load, AvisoqError } from '../src/index.mjs';
import { findGcc } from '../src/compiler.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const tools = fileURLToPath(new URL('../examples/agent-tools/tools.avq', import.meta.url));
const hostFile = fileURLToPath(new URL('../examples/agent-tools/host.mjs', import.meta.url));
const cli = fileURLToPath(new URL('../src/cli.mjs', import.meta.url));
let passed = 0, failed = 0;
const report = (name, ok, detail = '') => { if (ok) passed++; else { failed++; console.log(`FAIL  ${name}\n      ${detail}`); } };
const outcome = (f) => { const t = performance.now(); try { return { value: f(), ms: performance.now() - t }; } catch (e) { return { kind: e instanceof AvisoqError ? e.kind : 'crash', message: e.message, ms: performance.now() - t }; } };

const runaway = `
fn spin(n: Int) -> Int {
  var x = 0
  while x >= 0 { x = (x + n) % 1000003 }
  return x
}
fn recurse(n: Int) -> Int { if n < 2 { return n } return recurse(n - 1) + recurse(n - 2) }
fn sum_loop() -> Int { return sum(i in 0..4000000000: i % 7) }
fn build() -> [Int] { return [i in 0..4000000000: i] }
fn hog(n: Int) -> Int {
  var xs: [Int] = []
  for i in 0..n { push(xs, i) }
  return len(xs)
}
fn churn(n: Int) -> Int {
  var total = 0
  for i in 0..n {
    let row = array(1000, i)
    total += len(row)
  }
  return total
}
fn fine(n: Int) -> Int { return n + 1 }
`;

// ---- limits: the same on both routes ----
let ffiThere = true;
try { await import('node:ffi'); } catch { ffiThere = false; }
const routes = [false, ...(findGcc() && ffiThere ? [true] : [])];
if (routes.length === 1) console.log('(GCC or node:ffi is missing: limits were tested on the WebAssembly route only)');
for (const native of routes) {
  const route = native ? 'native' : 'wasm';
  const m = await load(`${here}limits_probe.avq`, { source: runaway, native, timeLimitMs: 150, memoryLimitMb: 32 });
  for (const [name, call] of [['an endless loop', () => m.spin(3)], ['endless recursion work', () => m.recurse(70)], ['an endless sum', () => m.sum_loop()]]) {
    const r = outcome(call);
    report(`${route}: ${name} stops at the time limit`, r.kind === 'time_limit' && r.ms < 1500 && /150 ms/.test(r.message), JSON.stringify(r));
  }
  const big = outcome(() => m.hog(100000000));
  report(`${route}: too much memory stops the call`, big.kind === 'out_of_memory' && /32 MB/.test(big.message), JSON.stringify(big));
  const huge = outcome(() => m.build());
  report(`${route}: an impossible array is refused`, ['out_of_memory', 'array_size'].includes(huge.kind), JSON.stringify(huge));
  report(`${route}: work inside the limits is untouched`, m.hog(1000000) === 1000000 && m.churn(200000) === 200000000 && m.recurse(20) === 6765);
  report(`${route}: the module still works after every kind of stop`, m.fine(1) === 2 && outcome(() => m.spin(1)).kind === 'time_limit' && m.fine(2) === 3);
}
{
  const free = await load(`${here}limits_probe.avq`, { source: runaway });
  report('without limits nothing is counted', free.hog(3000000) === 3000000 && free.fine(1) === 2);
}

// ---- host functions ----
{
  const calls = [];
  const m = await load(tools, { host: { unit_price: (p) => { calls.push(p); return { widget: 250 }[p] ?? -1; } } });
  const q = m.quote(' Widget ', 12);
  report('a host function is called with converted values', q.variant === 'Ok' && q.value.total === 2700 && q.value.discount === 300 && calls[0] === 'widget', JSON.stringify(q));
  report('its answer flows back', m.quote('nothing', 1).variant === 'Err');
  const none = await load(tools);
  report('a host function that was not provided is refused', outcome(() => none.quote('widget', 1)).kind === 'capability_denied', JSON.stringify(outcome(() => none.quote('widget', 1))));
  const bad = await load(tools, { host: { unit_price: () => 'cheap' } });
  report('a host function returning the wrong type is an error', outcome(() => bad.quote('widget', 1)).kind === 'host', JSON.stringify(outcome(() => bad.quote('widget', 1))));
  const thrower = await load(tools, { host: { unit_price: () => { throw new Error('database is down'); } } });
  const t = outcome(() => thrower.quote('widget', 1));
  report('a host function that throws is an error with its message', t.kind === 'host' && /database is down/.test(t.message), JSON.stringify(t));
  report('functions that need no host still work without one', none.fibonacci(50) === 12586269025 && none.monthly_payment(1000000, 6.0, 12) === 86066, String(none.monthly_payment(1000000, 6.0, 12)));
  report('the host effect is listed', m.$functions.find((f) => f.name === 'quote').effects.includes('host') && m.$functions.find((f) => f.name === 'fibonacci').effects.length === 0);
  if (routes.includes(true)) {
    const n = await load(tools, { native: true });
    const r = outcome(() => n.quote('widget', 1));
    report('the native route says host functions need WebAssembly', r.kind === 'unsupported' || r.kind === 'capability_denied', JSON.stringify(r));
  }
}

// ---- limits from Python, on both of its routes ----
{
  const { spawnSync } = await import('node:child_process');
  const { writeFileSync, rmSync } = await import('node:fs');
  const probe = `${here}limits_probe_py.avq`;
  writeFileSync(probe, runaway);
  const script = [
    'import sys', `sys.path.insert(0, r"${fileURLToPath(new URL('../bindings/python', import.meta.url))}")`, 'import avisoq', 'out = []',
    `for native in (${routes.includes(true) ? 'False, True' : 'False,'}):`,
    `    m = avisoq.load(r"${probe}", native=native, time_limit_ms=150, memory_limit_mb=32)`,
    '    for bad in (lambda: m.spin(3), lambda: m.hog(100000000)):',
    '        try:', '            bad()', '            out.append("no error")', '        except avisoq.AvisoqError as e:', '            out.append(e.kind)',
    '    out.append(m.fine(1))', '    m.close()', 'print(out)',
  ].join('\n');
  const r = spawnSync('python', ['-c', script], { encoding: 'utf8', cwd: here });
  rmSync(probe, { force: true });
  const want = routes.includes(true) ? "['time_limit', 'out_of_memory', 2, 'time_limit', 'out_of_memory', 2]" : "['time_limit', 'out_of_memory', 2]";
  if (r.error) console.log('(Python is not installed: limits from Python were not tested)');
  else report('limits from Python', r.stdout.trim() === want, r.stdout + r.stderr);
}

// ---- avisoq mcp ----
{
  const child = spawn(process.execPath, [cli, 'mcp', tools, '--host', hostFile, '--time-limit', '200'], { stdio: ['pipe', 'pipe', 'inherit'] });
  const lines = [];
  let buffer = '';
  child.stdout.on('data', (d) => { buffer += d; let i; while ((i = buffer.indexOf('\n')) >= 0) { lines.push(JSON.parse(buffer.slice(0, i))); buffer = buffer.slice(i + 1); } });
  let id = 0;
  const ask = (method, params) => new Promise((done) => { const want = lines.length + 1; child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params })}\n`); const t = setInterval(() => { if (lines.length >= want) { clearInterval(t); done(lines[want - 1]); } }, 2); });
  const call = async (name, args) => (await ask('tools/call', { name, arguments: args })).result;

  const init = await ask('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } });
  report('mcp: initialize', init.result.protocolVersion === '2025-06-18' && init.result.capabilities.tools && /tools\.avq/.test(init.result.serverInfo.name), JSON.stringify(init));
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);
  const list = (await ask('tools/list', {})).result.tools;
  const byName = Object.fromEntries(list.map((t) => [t.name, t]));
  report('mcp: every callable function is a tool', ['quote', 'monthly_payment', 'fibonacci', 'word_counts', 'spin'].every((n) => byName[n]) && !byName.unit_price, list.map((t) => t.name).join(' '));
  report('mcp: the schema comes from the types', byName.monthly_payment.inputSchema.properties.yearly_rate_percent.type === 'number' && byName.quote.inputSchema.properties.quantity.type === 'integer' && byName.quote.inputSchema.required.join() === 'product,quantity', JSON.stringify(byName.quote.inputSchema));
  report('mcp: the description is the comment, and names the capabilities', /Prices an order/.test(byName.quote.description) && /Capabilities it uses: host/.test(byName.quote.description) && /uses no capabilities/.test(byName.fibonacci.description), byName.quote.description);

  const q = await call('quote', { product: 'gadget', quantity: 10 });
  report('mcp: a call through the host function', q.isError === false && q.structuredContent.variant === 'Ok' && q.structuredContent.value.total === 17991, JSON.stringify(q));
  const f = await call('fibonacci', { n: 90 });
  report('mcp: a plain result is text', f.isError === false && f.content[0].text === '2880067194370816120', JSON.stringify(f));
  const w = await call('word_counts', { text: 'the cat and the hat and the bat' });
  report('mcp: arrays of tuples', w.content[0].text === '[["the",3],["and",2],["cat",1],["hat",1],["bat",1]]', w.content[0].text);
  const over = await call('fibonacci', { n: 100 });
  report('mcp: an overflow is a tool error, not a wrong number', over.isError === true && /^overflow: /.test(over.content[0].text), JSON.stringify(over));
  const pre = await call('quote', { product: 'gadget', quantity: 0 });
  report('mcp: a broken contract is a tool error', pre.isError === true && /^precondition: /.test(pre.content[0].text), JSON.stringify(pre));
  const wrong = await call('fibonacci', { n: 'ten' });
  report('mcp: a wrong argument type is a tool error', wrong.isError === true && /^argument: /.test(wrong.content[0].text), JSON.stringify(wrong));
  const missing = await call('quote', { product: 'gadget' });
  report('mcp: a missing argument is a tool error', missing.isError === true && /missing quantity/.test(missing.content[0].text), JSON.stringify(missing));
  const started = performance.now();
  const hung = await call('spin', {});
  report('mcp: a tool that never finishes is stopped', hung.isError === true && /^time_limit: /.test(hung.content[0].text) && performance.now() - started < 3000, JSON.stringify(hung));
  const after = await call('fibonacci', { n: 10 });
  report('mcp: and the server keeps answering', after.content[0].text === '55', JSON.stringify(after));
  const nope = await ask('tools/call', { name: 'unit_price', arguments: { product: 'widget' } });
  report('mcp: host functions are not tools', !!nope.error, JSON.stringify(nope));
  const other = await ask('resources/list', {});
  report('mcp: an unsupported method is refused politely', other.error && other.error.code === -32601, JSON.stringify(other));
  const ping = await ask('ping', {});
  report('mcp: ping', ping.result && Object.keys(ping.result).length === 0, JSON.stringify(ping));
  child.stdin.end();
}
{
  // a file that does not compile: the client is told why
  const child = spawn(process.execPath, [cli, 'mcp', `${here}no_such_file.avq`], { stdio: ['pipe', 'pipe', 'inherit'] });
  let buffer = '';
  child.stdout.on('data', (d) => { buffer += d; });
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' })}\n`);
  await new Promise((done) => { const t = setInterval(() => { if (buffer.includes('\n')) { clearInterval(t); done(); } }, 2); });
  report('mcp: a file that cannot be loaded gives an error, not silence', !!JSON.parse(buffer.split('\n')[0]).error, buffer);
  child.stdin.end();
}

console.log(`[mcp] ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
