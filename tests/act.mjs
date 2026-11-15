// Tests for scripts that act through tools: manifest, caps, approval, log, replay, gateway.
//   node tests/act.mjs
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { act, approve, approvedBy, policyProblem, prepare, replay } from '../src/act.mjs';
import { showManifest } from '../src/manifest.mjs';

const cli = fileURLToPath(new URL('../src/cli.mjs', import.meta.url));
const example = fileURLToPath(new URL('../examples/agent-actions/', import.meta.url));
let passed = 0, failed = 0;
const report = (name, ok, detail = '') => { if (ok) passed++; else { failed++; console.log(`FAIL  ${name}\n      ${String(detail).slice(0, 900)}`); } };
const tmp = mkdtempSync(join(tmpdir(), 'avisoq-act-'));
const at = (name) => join(tmp, name);

const TOOLS = `
tool read_note(id: Int) -> Str
tool write_note(id: Int, text: Str) -> Str
  at most 2
tool pay(account: Int, cents: Int) -> Str
  at most 3
  total cents at most 1000
  requires cents > 0
tool ping() -> Int
`;
const planOf = async (body) => (await prepare(at('p.avq'), { source: TOOLS + body })).plan;
const toolOf = (plan, entry, tool) => plan.entries.find((e) => e.name === entry).tools.find((t) => t.name === tool);

// ---- what the compiler can say before anything runs ----
{
  const plan = await planOf(`
fn straight(id: Int) -> Str uses tools { let a = read_note(id)
  return write_note(id, a) }
fn either(id: Int) -> Str uses tools { if id > 0 { return write_note(id, "a") } else { let x = write_note(id, "b")
  return write_note(id, x) } }
fn looping(n: Int) -> Int uses tools { var t = 0
  for i in 0..n { t += len(read_note(i)) }
  return t }
fn capped_loop(n: Int) -> Int uses tools { var t = 0
  for i in 0..n { t += len(write_note(i, "x")) }
  return t }
fn helper(id: Int) -> Str uses tools { return read_note(id) }
fn through_helper(id: Int) -> Str uses tools { return helper(id) + helper(id + 1) }
fn recursive(n: Int) -> Int uses tools { if n == 0 { return 0 }
  return ping() + recursive(n - 1) }
fn nothing(n: Int) -> Int { return n + 1 }
fn pays(n: Int) -> Str uses tools { return pay(n, 5) + pay(n, 6) + pay(n, 7) + pay(n, 8) }
`);
  const t = (e, n) => toolOf(plan, e, n);
  report('calls in a row are counted', t('straight', 'read_note').calls === 1 && t('straight', 'read_note').bound === 'proven' && t('straight', 'write_note').calls === 1, JSON.stringify(plan.entries[0]));
  report('branches count as the larger one', t('either', 'write_note').calls === 2 && t('either', 'write_note').bound === 'proven', JSON.stringify(t('either', 'write_note')));
  report('a loop without a cap is unlimited', t('looping', 'read_note').bound === 'unlimited' && t('looping', 'read_note').calls === null, JSON.stringify(t('looping', 'read_note')));
  report('a loop with a cap is enforced, not proven', t('capped_loop', 'write_note').bound === 'enforced' && t('capped_loop', 'write_note').calls === 2, JSON.stringify(t('capped_loop', 'write_note')));
  report('calls through other functions are followed', t('through_helper', 'read_note').calls === 2 && t('through_helper', 'read_note').bound === 'proven', JSON.stringify(t('through_helper', 'read_note')));
  report('recursion is unlimited', t('recursive', 'ping').bound === 'unlimited', JSON.stringify(t('recursive', 'ping')));
  report('a function without tools lists none', plan.entries.find((e) => e.name === 'nothing').tools.length === 0);
  report('more call sites than the cap: the cap wins, enforced', t('pays', 'pay').calls === 3 && t('pays', 'pay').bound === 'enforced' && t('pays', 'pay').totals[0].max === 1000 && t('pays', 'pay').rules[0] === 'cents > 0', JSON.stringify(t('pays', 'pay')));
  const text = showManifest(plan, 'capped_loop');
  report('the manifest says it in words', /at most 2 times \(stopped if it tries more\)/.test(text) && /It cannot print/.test(text), text);
  report('unlimited is said plainly', /any number of times/.test(showManifest(plan, 'looping')));
}
{
  const bad = await prepare(at('p.avq'), { source: `${TOOLS}fn f() -> Str { return read_note(1) }\n` }).then(() => 'compiled', (e) => e.diagnostics?.[0]?.code);
  report('calling a tool needs "uses tools"', bad === 'E0301', String(bad));
  const undeclared = await prepare(at('p.avq'), { source: 'fn f() -> Str uses tools { return delete_everything(1) }\n' }).then(() => 'compiled', (e) => e.diagnostics?.[0]?.code);
  report('a tool that is not declared cannot be called', undeclared === 'E0203', String(undeclared));
  const total = await prepare(at('p.avq'), { source: 'tool t(name: Str) -> Str\n  total name at most 3\n' }).then(() => 'compiled', (e) => e.diagnostics?.[0]?.code);
  report('total needs an Int parameter', total === 'E0001', String(total));
}

// ---- what the runner enforces ----
const made = [];
const fake = {
  read_note: async (id) => { made.push(['read', id]); await new Promise((r) => setTimeout(r, 40)); return `note ${id}`; },
  write_note: (id, text) => { made.push(['write', id, text]); return 'ok'; },
  pay: (account, cents) => { made.push(['pay', account, cents]); if (account === 13) throw new Error('account closed'); return `paid ${cents}`; },
  ping: () => 1,
};
const run = (body, entry, args, extra = {}) => { made.length = 0; return act(at('r.avq'), args, { source: TOOLS + body, entry, tools: fake, ...extra }); };
{
  const body = `
fn copy_note(id: Int) -> Str uses tools { return write_note(id + 1, read_note(id)) }
fn spam(n: Int) -> Int uses tools { var t = 0
  for i in 0..n { t += len(write_note(i, "x")) }
  return t }
fn pay_all(a: Int, b: Int, c: Int) -> Str uses tools { return pay(1, a) + "," + pay(2, b) + "," + pay(3, c) }
fn pay_closed() -> Str uses tools { return pay(13, 5) }
fn count() -> Int uses tools { return ping() + ping() }
`;
  const ok = await run(body, 'copy_note', [4]);
  report('a run returns its result and the calls it made', ok.ok && ok.result === 'ok' && ok.calls.length === 2 && ok.calls[0].result === 'note 4' && JSON.stringify(made) === '[["read",4],["write",5,"note 4"]]', JSON.stringify(ok));
  const spam = await run(body, 'spam', [10]);
  report('the call over the cap is refused before it is made', !spam.ok && spam.error.kind === 'limit' && made.length === 2 && spam.calls.filter((c) => c.refused).length === 1, JSON.stringify(spam));
  const over = await run(body, 'pay_all', [400, 500, 200]);
  report('a total is enforced across calls', !over.ok && over.error.kind === 'limit' && /at most 1000/.test(over.error.message) && made.length === 2, JSON.stringify(over));
  const within = await run(body, 'pay_all', [400, 500, 100]);
  report('and allows what fits', within.ok && within.result === 'paid 400,paid 500,paid 100', JSON.stringify(within));
  const rule = await run(body, 'pay_all', [400, 0, 100]);
  report('a rule on the arguments stops the call', !rule.ok && rule.error.kind === 'precondition' && made.length === 1, JSON.stringify(rule));
  const broken = await run(body, 'pay_closed', []);
  report('a tool that fails stops the script with its message', !broken.ok && broken.error.kind === 'tool' && /account closed/.test(broken.error.message) && broken.calls[0].error, JSON.stringify(broken));
  const ints = await run(body, 'count', []);
  report('tools can answer with numbers', ints.ok && ints.result === 2, JSON.stringify(ints));
  const none = await act(at('r.avq'), [4], { source: TOOLS + body, entry: 'copy_note', tools: {} });
  report('a tool nobody provides is refused', !none.ok && none.error.kind === 'capability_denied', JSON.stringify(none));
  const slow = await run(body, 'copy_note', [1], { limits: { timeLimitMs: 20 } });
  report('waiting for a tool does not use up the time limit', slow.ok, JSON.stringify(slow));
  const spin = await act(at('r.avq'), [], { source: `${TOOLS}fn spin() -> Int uses tools { var x = ping()\n  while x > 0 { x = x % 7 + 1 }\n  return x }\n`, tools: fake, limits: { timeLimitMs: 100 } });
  report('but its own work does', !spin.ok && spin.error.kind === 'time_limit', JSON.stringify(spin));
}

// ---- approval is tied to what the script is and can do ----
{
  const body = 'fn go(id: Int) -> Str uses tools { return write_note(id, "hello") }\n';
  const file = at('a.avq');
  writeFileSync(file, TOOLS + body);
  const first = await prepare(file);
  report('a new script is not approved', approvedBy(file, first, 'go') === null);
  approve(file, first, 'go', { by: 'tester' });
  report('approving records who agreed to what', /approved by tester/.test(approvedBy(file, first, 'go')) && /write_note/.test(JSON.parse(readFileSync(`${file}.approval.json`, 'utf8')).entries.go.manifest));
  writeFileSync(file, `// a comment on top\n${TOOLS}${body}`);
  report('a comment does not undo an approval', approvedBy(file, await prepare(file), 'go') !== null);
  writeFileSync(file, TOOLS + body.replace('"hello"', '"goodbye"'));
  report('a change to the code does', approvedBy(file, await prepare(file), 'go') === null);
  writeFileSync(file, TOOLS.replace('at most 2', 'at most 20') + body);
  report('a looser limit does too', approvedBy(file, await prepare(file), 'go') === null);
}

// ---- policy ----
{
  const plan = await planOf(`
fn tidy(id: Int) -> Str uses tools { return write_note(id, read_note(id)) }
fn sweep(n: Int) -> Int uses tools { var t = 0
  for i in 0..n { t += len(read_note(i)) }
  return t }
fn settle(a: Int) -> Str uses tools { return pay(a, 10) }
fn chatty(id: Int) -> Str uses tools, io { print("x")
  return read_note(id) }
`);
  const p = (policy, entry) => policyProblem(policy, plan, entry);
  report('policy: listed tools pass', p({ tools: { read_note: {}, write_note: { max: 2 } } }, 'tidy') === null);
  report('policy: an unlisted tool does not', /does not allow the tool 'write_note'/.test(p({ tools: { read_note: {} } }, 'tidy')));
  report('policy: a tighter cap than the script has', /at most 0 times/.test(p({ tools: { read_note: { max: 1 }, write_note: { max: 0 } } }, 'tidy')), p({ tools: { read_note: { max: 1 }, write_note: { max: 0 } } }, 'tidy'));
  report('policy: unlimited calls fail a cap', /has no limit/.test(p({ tools: { read_note: { max: 100 } } }, 'sweep')));
  report('policy: unlimited calls pass when no cap is asked', p({ tools: { read_note: {} } }, 'sweep') === null);
  report('policy: totals must be declared and small enough', p({ tools: { pay: { totals: { cents: 1000 } } } }, 'settle') === null && /total of 500/.test(p({ tools: { pay: { totals: { cents: 500 } } } }, 'settle')));
  report('policy: other capabilities must be listed', /capability 'io'/.test(p({ tools: { read_note: {} } }, 'chatty')) && p({ tools: { read_note: {} }, effects: ['io'] }, 'chatty') === null);
}

// ---- which function a script starts at, and what a policy says in words ----
{
  const { entryOf, showPolicy } = await import('../src/act.mjs');
  const two = await planOf(`
fn one(id: Int) -> Str uses tools { return read_note(id) }
fn all(n: Int) -> Str uses tools { return one(n) + one(n + 1) }
`);
  report('a script starts at the function nothing else calls', entryOf(two) === 'all' && entryOf(two, 'one') === 'one');
  const many = await planOf('fn a() -> Int { return 1 }\nfn b() -> Int { return 2 }\n');
  let message = '';
  try { entryOf(many, undefined, 'in the "function" argument'); } catch (e) { message = e.message; }
  report('two starting points must be told apart', /say which function to start in the "function" argument \(there are: a, b\)/.test(message), message);
  const text = showPolicy({ tools: { read_note: {}, pay: { max: 1, totals: { cents: 500 } } } });
  report('a policy can be read by whoever writes scripts', /read_note: any number of calls/.test(text) && /pay: at most 1 call per run \(declare: at most 1\), cents adding up to at most 500/.test(text) && /no printing/.test(text), text);
  const both = policyProblem({ tools: { pay: { max: 1, totals: { cents: 5 } } } }, await planOf('fn f(a: Int) -> Str uses tools, io { print("x")\n  return pay(a, 1) + pay(a, 2) }\n'), 'f');
  report('every way a script falls outside the policy is reported at once', /at most 1 time/.test(both) && /total of 5/.test(both) && /capability 'io'/.test(both), both);
  const main = await prepare(at('m.avq'), { source: 'fn main(order: Int) -> Str { return "x" }\n' }).then(() => 'compiled', (e) => `${e.diagnostics?.[0]?.code} ${e.diagnostics?.[0]?.hint}`);
  report('main with parameters points to a named function', /^E0401 give the function another name/.test(main), main);
}

// ---- the command line, against a real MCP server ----
const script = at('refund_late_order.avq');
copyFileSync(join(example, 'refund_late_order.avq'), script);
const toolsFile = at('tools.json');
writeFileSync(toolsFile, JSON.stringify({ servers: { shop: { command: process.execPath, args: [join(example, 'shop-server.mjs')], env: { SHOP_STATE: at('shop-state.json') } } } }));
const policyFile = join(example, 'policy.json');
const avisoq = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', cwd: tmp });
const state = () => JSON.parse(readFileSync(at('shop-state.json'), 'utf8'));
{
  const listed = avisoq('tools', '--tools', toolsFile);
  report('avisoq tools prints declarations', listed.status === 0 && /tool refund\(order: Int, amount_cents: Int\) -> Str/.test(listed.stdout) && /only reads/.test(listed.stdout), listed.stdout + listed.stderr);
  const plan = avisoq('plan', script, '--tools', toolsFile);
  report('avisoq plan shows the manifest with where each tool comes from', plan.status === 0 && /refund\(order: Int, amount_cents: Int\) -> Str   \[shop, can destroy\]/.test(plan.stdout) && /Not approved yet/.test(plan.stdout), plan.stdout + plan.stderr);
  const refused = avisoq('act', script, '[7]', '--tools', toolsFile);
  report('avisoq act runs nothing without approval', refused.status === 77 && /has not been approved/.test(refused.stderr) && !existsSync(at('shop-state.json')), refused.stdout + refused.stderr);
  const ok = avisoq('approve', script, '--tools', toolsFile);
  report('avisoq approve', ok.status === 0 && /Approved\./.test(ok.stdout), ok.stdout + ok.stderr);
  const ran = avisoq('act', script, '[7]', '--tools', toolsFile);
  report('an approved script runs and acts', ran.status === 0 && ran.stdout.trim() === 'refunded 499 cents on order 7' && state().refunds.length === 1 && state().emails[0].to === 'ada@example.com' && /approved by/.test(ran.stderr), ran.stdout + ran.stderr);
  const again = avisoq('replay', script);
  report('avisoq replay reproduces the run without calling anything', again.status === 0 && /^same: 3 tool calls/.test(again.stdout) && state().refunds.length === 1, again.stdout + again.stderr);
  const log = `${script}.runs.jsonl`;
  writeFileSync(log, readFileSync(log, 'utf8').replace('"shipping_cents":499', '"shipping_cents":450'));
  const changed = avisoq('replay', script);
  report('replay notices when the run would differ', changed.status === 1 && /different from the logged run/.test(changed.stdout), changed.stdout + changed.stderr);
  const big = avisoq('act', script, '[9]', '--tools', toolsFile, '--json');
  const j = JSON.parse(big.stdout);
  report('a refund over the total is refused and nothing is paid', big.status === 2 && j.error.kind === 'limit' && state().refunds.length === 1 && j.calls.some((c) => c.refused), big.stdout + big.stderr);
  const missing = avisoq('act', script, '[99]', '--tools', toolsFile);
  report('a tool failure the script handles is a result, not a stop', missing.status === 0 && /could not look up order 99/.test(missing.stdout) && /there is no order 99/.test(missing.stdout), missing.stdout + missing.stderr);
  writeFileSync(script, readFileSync(script, 'utf8').replace('total amount_cents at most 2000', 'total amount_cents at most 200000'));
  const edited = avisoq('act', script, '[9]', '--tools', toolsFile);
  report('an edited script needs a new approval', edited.status === 77 && state().refunds.length === 1, edited.stdout + edited.stderr);
  const byPolicy = avisoq('act', script, '[9]', '--tools', toolsFile, '--policy', policyFile);
  report('and the policy does not cover the looser version', byPolicy.status === 77 && /The policy does not cover this script/.test(byPolicy.stderr), byPolicy.stdout + byPolicy.stderr);
  copyFileSync(join(example, 'refund_late_order.avq'), script);
  rmSync(`${script}.approval.json`);
  const allowed = avisoq('act', script, '[8]', '--tools', toolsFile, '--policy', policyFile);
  report('a policy lets a tight script run without a person', allowed.status === 0 && /does not qualify/.test(allowed.stdout) && /allowed by the policy/.test(allowed.stderr), allowed.stdout + allowed.stderr);
  const wrong = at('wrong.avq');
  writeFileSync(wrong, 'tool refund(order: Str) -> Str\nfn go() -> Str uses tools { return refund("7") }\n');
  const mismatch = avisoq('plan', wrong, '--tools', toolsFile);
  report('a declaration that does not fit the real tool is refused', mismatch.status !== 0 && /does not fit the server 'shop'/.test(mismatch.stderr), mismatch.stdout + mismatch.stderr);
}

// ---- the gateway an agent talks to ----
{
  rmSync(at('shop-state.json'), { force: true });
  const child = spawn(process.execPath, [cli, 'gateway', '--tools', toolsFile, '--policy', policyFile, '--dir', at('scripts')], { stdio: ['pipe', 'pipe', 'inherit'], cwd: tmp });
  const lines = [];
  let buffer = '';
  child.stdout.on('data', (d) => { buffer += d; let i; while ((i = buffer.indexOf('\n')) >= 0) { lines.push(JSON.parse(buffer.slice(0, i))); buffer = buffer.slice(i + 1); } });
  let id = 0;
  const ask = (method, params) => new Promise((done) => { const want = lines.length + 1; child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params })}\n`); const t = setInterval(() => { if (lines.length >= want) { clearInterval(t); done(lines[want - 1]); } }, 2); });
  const call = async (name, args = {}) => { const r = (await ask('tools/call', { name, arguments: args })).result; return { text: r.content[0].text, isError: r.isError }; };
  await ask('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } });
  const names = (await ask('tools/list', {})).result.tools.map((t) => t.name);
  report('gateway: the agent gets four tools and none of the real ones', names.join() === 'avisoq_guide,avisoq_tools,avisoq_check,avisoq_run', names.join());
  const offered = await call('avisoq_tools');
  report('gateway: it lists the real tools as declarations', /tool refund\(order: Int, amount_cents: Int\) -> Str/.test(offered.text) && /at most 1/.test(offered.text), offered.text);
  report('gateway: it hands out the language guide', /uses tools/.test((await call('avisoq_guide')).text));
  const tight = readFileSync(join(example, 'refund_late_order.avq'), 'utf8');
  const checked = await call('avisoq_check', { script: tight, name: 'refund late order' });
  report('gateway: check shows the manifest and that the policy covers it', !checked.isError && /at most once \(the code cannot do more\)/.test(checked.text) && /may run without asking/.test(checked.text), checked.text);
  const ran = await call('avisoq_run', { script: tight, name: 'refund late order', arguments: [7] });
  report('gateway: a covered script runs at once, with its calls reported', !ran.isError && /Result: refunded 499 cents on order 7/.test(ran.text) && /refund\(7,499\) -> "receipt R-1"/.test(ran.text) && state().refunds.length === 1, ran.text);
  const loose = `tool list_late_orders() -> Str\ntool refund(order: Int, amount_cents: Int) -> Str\nimport "std/json"\nfn refund_all() -> Int uses tools {\n  var n = 0\n  match json_parse(list_late_orders()) {\n    Err(error) => { return 0 }\n    Ok(ids) => {\n      for i in 0..json_len(ids) {\n        let done = refund(unwrap_or(json_int(json_at(ids, i)), 0), 999999)\n        n += 1\n      }\n    }\n  }\n  return n\n}\n`;
  const held = await call('avisoq_run', { script: loose, name: 'refund everything' });
  report('gateway: a script the policy does not cover is not run', held.isError && /Nothing was run/.test(held.text) && /any number of times/.test(held.text) && /avisoq approve/.test(held.text) && state().refunds.length === 1, held.text);
  const path = /avisoq approve "([^"]+)"/.exec(held.text)[1];
  const approved = avisoq('approve', path, '--tools', toolsFile);
  const after = await call('avisoq_run', { script: loose, name: 'refund everything' });
  report('gateway: after a person approves, the same script runs', approved.status === 0 && !after.isError && /Result: 1/.test(after.text) && state().refunds.length === 2, approved.stderr + after.text);
  const typo = await call('avisoq_check', { script: 'tool lookup_order(order: Int) -> Str\nfn go() -> Str { return lookup_order(1) }\n' });
  report('gateway: compile errors come back with their fix', typo.isError && /error\[E0301\]/.test(typo.text) && /fix: add 'uses tools'/.test(typo.text), typo.text);
  const unknown = await call('avisoq_check', { script: 'tool wipe_database() -> Str\nfn go() -> Str uses tools { return wipe_database() }\n' });
  report('gateway: a tool that does not exist cannot be declared into being', unknown.isError && /no server in the tools file offers/.test(unknown.text), unknown.text);
  child.stdin.end();
}

try { rmSync(tmp, { recursive: true, force: true }); } catch { /* a server may still hold a file for a moment */ }
console.log(`[act] ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
