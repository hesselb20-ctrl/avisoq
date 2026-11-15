// Attempts to get around the limits, the manifest and the approval. Every one must fail.
//   node tests/attack.mjs
// Each case is something a script, or whoever can write files next to it, might try. A case
// that "passes" here means the attempt was stopped.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { act, approve, approvedBy, importOutside, keygen, policyProblem, prepare, readApprovers, replay } from '../src/act.mjs';

const cli = fileURLToPath(new URL('../src/cli.mjs', import.meta.url));
let passed = 0, failed = 0;
const report = (name, ok, detail = '') => { if (ok) passed++; else { failed++; console.log(`NOT STOPPED  ${name}\n      ${String(detail).slice(0, 900)}`); } };
const tmp = mkdtempSync(join(tmpdir(), 'avisoq-attack-'));
const at = (name) => join(tmp, name);
process.env.AVISOQ_HOME = at('home');

const TOOLS = `
struct Order { id: Int, email: Str, shipping_cents: Int }
tool lookup(order: Int) -> Result[Order, Str]
tool pay(account: Int, cents: Int) -> Str
  at most 2
  total cents at most 1000
  requires cents > 0
tool send(to: Str, body: Str) -> Result[Str, Str]
  at most 1
tool wipe() -> Str
  at most 0
`;
const paid = [];
const tools = {
  lookup: (id) => { if (id === 404) throw new Error('no such order'); return { id, email: 'a@example.com', shipping_cents: 100 }; },
  pay: (account, cents) => { paid.push([account, Number(cents)]); return 'paid'; },
  send: (to) => { if (to === 'bounce') throw new Error('mailbox full'); return 'queued'; },
  wipe: () => { paid.push(['WIPED']); return 'gone'; },
};
const run = (body, entry, args = [], extra = {}) => { paid.length = 0; return act(at('s.avq'), args, { source: TOOLS + body, entry, tools, ...extra }); };
const planOf = async (body) => (await prepare(at('s.avq'), { source: TOOLS + body })).plan;
const bound = (plan, entry, tool) => plan.entries.find((e) => e.name === entry).tools.find((t) => t.name === tool);

// ---- 1. spending more than the cap, by every route the language has ----
{
  const body = `
fn helper(a: Int) -> Str uses tools { return pay(a, 1) }
fn via_helper() -> Str uses tools { return helper(1) + helper(2) + helper(3) }
fn via_lambda() -> Int uses tools { var n = 0
  for i in 0..5 { n += len(pay(i, 1)) }
  return n }
fn rec(n: Int) -> Int uses tools { if n == 0 { return 0 }
  let p = pay(n, 1)
  return 1 + rec(n - 1) }
fn via_branches(k: Int) -> Str uses tools { var out = ""
  if k > 0 { out += pay(1, 1) } else { out += pay(2, 1) }
  if k > 1 { out += pay(3, 1) } else { out += pay(4, 1) }
  if k > 2 { out += pay(5, 1) }
  return out }
fn via_match(o: Option[Int]) -> Str uses tools { return match o { Some(value) => pay(value, 1) + pay(value, 1) + pay(value, 1), None => "" } }
fn via_while() -> Int uses tools { var n = 0
  while true { let p = pay(n, 1)
    n += 1 }
  return n }
fn zero_cap() -> Str uses tools { return wipe() }
fn catch_and_retry() -> Str uses tools { var out = ""
  for i in 0..4 { out += match send("x", "y") { Ok(value) => value, Err(error) => "E" } }
  return out }
`;
  for (const [entry, args] of [['via_helper', []], ['via_lambda', []], ['rec', [9]], ['via_branches', [3]], ['via_match', [{ variant: 'Some', value: 7 }]], ['via_while', []]]) {
    const r = await run(body, entry, args);
    report(`a third payment ${entry.replace(/_/g, ' ')}`, !r.ok && r.error.kind === 'limit' && paid.length === 2, `${JSON.stringify(r.error ?? r.result)} paid ${paid.length}`);
  }
  const z = await run(body, 'zero_cap');
  report('calling a tool capped at zero', !z.ok && z.error.kind === 'limit' && paid.length === 0, JSON.stringify(z));
  const c = await run(body, 'catch_and_retry');
  report('handling the refusal as an ordinary failure and carrying on', !c.ok && c.error.kind === 'limit', JSON.stringify(c));
  const plan = await planOf(body);
  report('the manifest never promises less than can happen', bound(plan, 'via_helper', 'pay').calls === 2 && bound(plan, 'rec', 'pay').bound === 'enforced' && bound(plan, 'via_while', 'pay').bound === 'enforced' && bound(plan, 'via_match', 'pay').calls === 2, JSON.stringify(plan.entries.map((e) => [e.name, e.tools.map((t) => `${t.name}:${t.calls}:${t.bound}`)])));
}

// ---- 2. spending more than the total ----
{
  const body = `
fn big() -> Str uses tools { return pay(1, 1001) }
fn split() -> Str uses tools { return pay(1, 600) + pay(1, 600) }
fn negative(c: Int) -> Str uses tools { return pay(1, c) }
fn zero(c: Int) -> Str uses tools { return pay(1, c) }
fn huge() -> Str uses tools { return pay(1, 9223372036854775807) + pay(1, 9223372036854775807) }
fn wrap() -> Str uses tools { let x = 9223372036854775807
  return pay(1, x + 2) }
`;
  for (const [entry, kinds] of [['big', ['limit']], ['split', ['limit']], ['negative', ['precondition', 'limit']], ['zero', ['precondition']], ['huge', ['limit']], ['wrap', ['overflow']]]) {
    const r = await run(body, entry, entry === 'negative' ? [-5000] : entry === 'zero' ? [0] : []);
    const sum = paid.reduce((n, p) => n + (p[1] ?? 0), 0);
    report(`a total over the limit: ${entry}`, !r.ok && kinds.includes(r.error.kind) && sum <= 1000, `${JSON.stringify(r.error ?? r.result)} paid ${JSON.stringify(paid)}`);
  }
}

{
  const always = await prepare(at('s.avq'), { source: TOOLS + 'fn f() -> Str uses tools { return pay(1, 0 - 5) }\n' }).then(() => 'compiled', (e) => e.diagnostics?.[0]?.code);
  report('a call that always breaks a tool rule does not even compile', always === 'E0501', String(always));
}

// ---- 3. reaching something that was not declared or not granted ----
{
  const cannot = async (source, code) => prepare(at('s.avq'), { source }).then(() => 'compiled', (e) => e.diagnostics?.[0]?.code ?? e.message);
  report('calling a tool that is not declared', await cannot('fn f() -> Str uses tools { return wipe_everything() }\n') === 'E0203');
  report('calling a tool without saying so', await cannot('tool t() -> Str\nfn f() -> Str { return t() }\n') === 'E0301');
  report('hiding a tool call inside a contract', await cannot('tool t() -> Int\nfn f(n: Int) -> Int uses tools\n  requires t() > 0\n{ return n }\n') === 'E0302');
  report('hiding a tool call inside a sum', await cannot('tool t() -> Int\nfn f(n: Int) -> Int uses tools { return sum(i in 0..n: t()) }\n') === 'E0305');
  report('a tool taking a function or a map', await cannot('tool t(m: Map[Str, Int]) -> Str\n') === 'E0802');
  report('redefining a declared tool as an ordinary function', /^E0/.test(await cannot('tool pay(a: Int) -> Str\nfn pay(a: Int) -> Str { return "free" }\nfn f() -> Str uses tools { return pay(1) }\n')));
  report('a second name for the same tool, to get a second allowance', await cannot('tool pay(a: Int) -> Str\n  at most 1\ntool pay_again(a: Int) -> Str as "pay"\n  at most 1\nfn f() -> Str uses tools { return pay(1) + pay_again(1) }\n') === 'E0803');
  const aliased = await prepare(at('s.avq'), { source: 'tool make(title: Str) -> Str as "create-issue"\n  at most 1\nfn f() -> Str uses tools { return make("x") }\n' });
  report('a policy is matched on the real name of a tool, not the name the script gave it', policyProblem({ tools: { make: {} } }, aliased.plan, 'f') !== null && policyProblem({ tools: { 'create-issue': { max: 1 } } }, aliased.plan, 'f') === null);
  const sneaky = await planOf('fn f(p: Str) -> Str uses tools, fs, io { print("x")\n  return unwrap_or_str(read_file(p)) }\nfn unwrap_or_str(r: Result[Str, Str]) -> Str { return match r { Ok(value) => value, Err(error) => error } }\n');
  report('files and printing show in the manifest', JSON.stringify(sneaky.entries.find((e) => e.name === 'f').effects.sort()) === '["fs","io"]');
  report('and a policy without them refuses the script', /capability 'fs'/.test(policyProblem({ tools: {} }, sneaky, 'f')) && /capability 'io'/.test(policyProblem({ tools: {} }, sneaky, 'f')));
  const denied = await act(at('s.avq'), ['C:/Windows/win.ini'], { source: 'fn f(p: Str) -> Str uses fs { return match read_file(p) { Ok(value) => value, Err(error) => "ERR " + error } }\n', tools: {} });
  report('reading a file without the grant', !denied.ok && denied.error.kind === 'capability_denied', JSON.stringify(denied).slice(0, 200));
  const missing = await run('fn f() -> Str uses tools { return pay(1, 1) }\n', 'f', [], { tools: {} });
  report('a declared tool that the setup does not provide', !missing.ok && missing.error.kind === 'capability_denied');
  const hog = await run('fn f() -> Int uses tools { var xs: [Int] = []\n  while true { push(xs, 1) }\n  return len(xs) }\n', 'f', [], { limits: { timeLimitMs: 2000, memoryLimitMb: 16 } });
  report('using memory without end', !hog.ok && ['out_of_memory', 'time_limit'].includes(hog.error.kind), JSON.stringify(hog.error));
  const spin = await run('fn f() -> Int uses tools { var x = 1\n  while x > 0 { x = x % 5 + 1 }\n  return x }\n', 'f', [], { limits: { timeLimitMs: 150 } });
  report('never finishing', !spin.ok && spin.error.kind === 'time_limit');
  const deep = await run('fn f(n: Int) -> Int uses tools { return 1 + f(n + 1) }\n', 'f', [0], { limits: { timeLimitMs: 3000 } });
  report('recursing without end', !deep.ok && ['stack_overflow', 'time_limit', 'overflow'].includes(deep.error.kind), JSON.stringify(deep.error));
}

{
  report('a submitted script importing a file from disk', importOutside('import "std/json"\n  import "C:/Users/someone/secrets.avq"\nfn f() { }\n') === 'C:/Users/someone/secrets.avq' && importOutside('import "../x"') === '../x' && importOutside('import "std/../../x"') === 'std/../../x');
  report('(the standard library is fine)', importOutside('import "std/json"\nimport "std/strings"\nfn f() { }\n') === null);
}

// ---- 4. a tool that lies or fails ----
{
  const body = `
fn email_of(id: Int) -> Str uses tools { return match lookup(id) { Ok(value) => value.email, Err(error) => "none: " + error } }
`;
  report('a failing tool is a value the script handles', (await run(body, 'email_of', [404])).result === "none: tool 'lookup' failed: no such order");
  const liar = await act(at('s.avq'), [1], { source: TOOLS + body, entry: 'email_of', tools: { ...tools, lookup: () => ({ id: 'not a number', email: 5 }) } });
  report('a tool answering with the wrong shape cannot corrupt the script', liar.ok && /^none: /.test(liar.result), JSON.stringify(liar));
  const strict = await act(at('s.avq'), [], { source: 'struct P { x: Int }\ntool fetch() -> P\nfn f() -> Int uses tools { return fetch().x }\n', tools: { fetch: () => ({ x: 1.5 }) } });
  report('and stops it when the script did not ask for a Result', !strict.ok && strict.error.kind === 'tool', JSON.stringify(strict));
  const big = await act(at('s.avq'), [], { source: 'tool fetch() -> Int\nfn f() -> Int uses tools { return fetch() + 1 }\n', tools: { fetch: () => 2n ** 80n } });
  report('a number too large for an Int is refused, not wrapped', !big.ok && big.error.kind === 'tool', JSON.stringify(big));
}

// ---- 5. forging or stretching an approval ----
{
  const file = at('pay.avq');
  const body = 'fn settle(a: Int) -> Str uses tools { return pay(a, 10) }\nfn other(a: Int) -> Str uses tools { return pay(a, 999) }\n';
  writeFileSync(file, TOOLS + body);
  const approversFile = at('avisoq.approvers.json');
  keygen('alice', approversFile);
  const approvers = readApprovers(approversFile);
  const p = await prepare(file);
  approve(file, p, 'settle', { by: 'alice' });
  const why = {};
  report('a signed approval by a listed person counts', /signed by alice/.test(approvedBy(file, p, 'settle', approvers) ?? ''));
  report('approving one function does not approve another', approvedBy(file, p, 'other', approvers) === null);

  const original = readFileSync(`${file}.approval.json`, 'utf8');
  const forge = (change) => { const a = JSON.parse(original); change(a); writeFileSync(`${file}.approval.json`, JSON.stringify(a)); return approvedBy(file, p, a.target ?? 'settle', approvers, why); };
  report('writing an approval file by hand, unsigned', forge((a) => { delete a.entries.settle.signature; }) === null && /not signed/.test(why.reason), why.reason);
  report('copying the signature onto another function', forge((a) => { a.entries.other = a.entries.settle; a.target = 'other'; }) === null);
  report('signing as someone who is not listed', (() => { keygen('mallory', at('other.approvers.json')); approve(file, p, 'settle', { by: 'mallory' }); const r = approvedBy(file, p, 'settle', approvers, why); return r === null && /not in the approvers file/.test(why.reason); })(), why.reason);
  report('claiming to be alice with another key', forge((a) => { a.entries.settle.signature = Buffer.from('x'.repeat(64)).toString('base64'); }) === null && /signature/.test(why.reason), why.reason);
  report('changing the date on a real approval', forge((a) => { a.entries.settle.at = '2030-01-01T00:00:00.000Z'; }) === null);

  writeFileSync(`${file}.approval.json`, original);
  writeFileSync(file, TOOLS.replace('total cents at most 1000', 'total cents at most 100000') + body);
  const loosened = await prepare(file);
  report('raising a limit after approval', approvedBy(file, loosened, 'settle', approvers, why) === null && /changed after it was approved/.test(why.reason), why.reason);
  report('and pasting the new hash into the old approval', (() => { const a = JSON.parse(original); a.hash = loosened.hash; writeFileSync(`${file}.approval.json`, JSON.stringify(a)); return approvedBy(file, loosened, 'settle', approvers) === null; })());

  // a change in a file the script imports is a change to the script
  writeFileSync(at('rates.avq'), 'fn amount() -> Int { return 10 }\n');
  writeFileSync(file, `import "rates.avq"\n${TOOLS}fn settle(a: Int) -> Str uses tools { return pay(a, amount()) }\n`);
  let imported = null;
  try { imported = await prepare(file); } catch { /* importing a neighbour file may not be supported: then there is nothing to attack */ }
  if (imported) {
    approve(file, imported, 'settle', { by: 'alice' });
    writeFileSync(at('rates.avq'), 'fn amount() -> Int { return 999 }\n');
    report('changing an imported file after approval', approvedBy(file, await prepare(file), 'settle', approvers) === null);
  }

  // the command line enforces the same thing
  writeFileSync(file, TOOLS + body);
  const avisoq = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', cwd: tmp, env: { ...process.env, AVISOQ_APPROVER: 'alice' } });
  const a1 = JSON.parse(original);
  delete a1.entries.settle.signature;
  writeFileSync(`${file}.approval.json`, JSON.stringify(a1));
  const refused = avisoq('act', file, '[1]', '--fn', 'settle');
  report('act with a hand-written approval in a folder that wants signatures', refused.status === 77 && /not signed/.test(refused.stderr), refused.stdout + refused.stderr);
  const real = avisoq('approve', file, '--fn', 'settle');
  report('(a real approval is signed)', real.status === 0 && /Approved and signed/.test(real.stdout), real.stdout + real.stderr);
}

// ---- 6. rewriting history ----
{
  const file = at('h.avq'), log = at('h.jsonl');
  writeFileSync(file, `${TOOLS}fn go(a: Int) -> Str uses tools { return pay(a, 10) + pay(a, 20) }\n`);
  await act(file, [3], { tools, log });
  const clean = readFileSync(log, 'utf8');
  report('(an untouched log replays the same)', (await replay(file, log)).same);
  for (const [what, edit] of [
    ['hiding a call', (t) => t.split('\n').filter((l) => !/"n":2/.test(l)).join('\n')],
    ['changing what was paid', (t) => t.replace('"args":[3,20]', '"args":[3,2]')],
    ['adding a call that never happened', (t) => t.replace(/(\{"event":"end")/, '{"event":"call","n":3,"tool":"wipe","args":[],"result":"gone","ms":0}\n$1')],
    ['changing how it ended', (t) => t.replace('"result":"paidpaid"', '"result":"nothing happened"')],
  ]) {
    writeFileSync(log, edit(clean));
    const r = await replay(file, log);
    report(`replay after ${what} in the log`, !r.same, JSON.stringify(r.differences));
  }
  writeFileSync(log, clean);
  writeFileSync(file, `${TOOLS}fn go(a: Int) -> Str uses tools { return pay(a, 10) + pay(a, 21) }\n`);
  report('replay of a log against a script that was changed since', !(await replay(file, log)).same);
}

try { rmSync(tmp, { recursive: true, force: true }); } catch { /* best effort */ }
console.log(`[attack] ${passed} attempts stopped, ${failed} not stopped`);
process.exit(failed ? 1 : 0);
