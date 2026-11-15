// What a script can do, worked out before it runs.
//
// A script reaches the outside world only through the tools it declares:
//
//   tool refund(order: Int, amount_cents: Int) -> Str
//     at most 1
//     total amount_cents at most 5000
//     requires amount_cents > 0
//
// For every function that can be started from outside, this lists the tools it can reach, how
// often it can call each one, and the rules on their arguments. "How often" has two sources:
// the cap in the declaration, which the runtime enforces, and a count of the call sites, which
// is a proof when no call sits in a recursive function or in a loop whose length is not
// written out (for i in 0..3 counts as three rounds; for i in 0..n does not).
import { callableFns } from './exports.mjs';
import { showType, walk } from './types.mjs';

const MANY = Infinity;
const add = (a, b) => { const out = new Map(a); for (const [k, n] of b) out.set(k, (out.get(k) ?? 0) + n); return out; };
const max = (a, b) => { const out = new Map(a); for (const [k, n] of b) out.set(k, Math.max(out.get(k) ?? 0, n)); return out; };
const looped = (a) => new Map([...a].map(([k]) => [k, MANY]));
const repeated = (a, n) => new Map([...a].map(([k, v]) => [k, v * n]));
// How many rounds a loop from `start` to `end` makes, when both are written out as numbers.
const literal = (e) => (e && e.kind === 'IntLit' ? e.value : e && e.kind === 'Unary' && e.op === '-' && e.operand.kind === 'IntLit' ? -e.operand.value : null);
const rounds = (start, end) => { const a = literal(start), b = literal(end); return a === null || b === null || b - a > 100000n ? null : Number(b > a ? b - a : 0n); };
const inLoop = (body, start, end) => { const n = rounds(start, end); return n === null ? looped(body) : repeated(body, n); };

// tool name -> the most often `fn` can call it, counting every path.
function callBounds(program) {
  const memo = new Map(), active = new Set();
  const ofFn = (f) => {
    if (f.extern) return f.extern.tool ? new Map([[f.name, 1]]) : new Map();
    if (memo.has(f)) return memo.get(f);
    if (active.has(f)) return null; // recursion: whatever it reaches may repeat without bound
    active.add(f);
    let recursive = false;
    const expr = (e) => {
      if (!e || typeof e !== 'object') return new Map();
      let total = new Map();
      if (e.kind === 'Cond') return add(expr(e.cond), max(expr(e.then), expr(e.els)));
      if (e.kind === 'MatchExpr') return add(expr(e.scrut), e.arms.map((a) => expr(a.expr)).reduce(max, new Map()));
      if (e.kind === 'Sum' || e.kind === 'Comp') return add(add(expr(e.start), expr(e.end)), inLoop(expr(e.body), e.start, e.end));
      if (e.kind === 'New') { for (const fl of e.fields) total = add(total, expr(fl.expr)); return total; }
      for (const key of ['left', 'right', 'operand', 'base', 'index', 'cond', 'then', 'els', 'body']) if (e[key] && !Array.isArray(e[key])) total = add(total, expr(e[key]));
      for (const a of e.args ?? e.elems ?? []) total = add(total, expr(a));
      if (e.kind === 'Call' && e.fn) {
        const inner = ofFn(e.fn);
        if (inner === null) recursive = true; else total = add(total, inner);
      }
      return total;
    };
    const block = (stmts) => (stmts ?? []).map(stmt).reduce(add, new Map());
    const stmt = (s) => {
      switch (s.kind) {
        case 'If': return add(expr(s.cond), max(block(s.then), block(s.els)));
        case 'While': return looped(add(expr(s.cond), block(s.body)));
        case 'For': return add(add(expr(s.start), expr(s.end)), inLoop(block(s.body), s.start, s.end));
        case 'Match': return add(expr(s.scrut), s.arms.map((a) => block(a.body)).reduce(max, new Map()));
        case 'Let': return expr(s.init);
        case 'Assign': return add(expr(s.target), expr(s.value));
        case 'Return': return expr(s.value);
        case 'Assert': return expr(s.cond);
        case 'ExprStmt': return expr(s.expr);
        default: return new Map();
      }
    };
    let total = block(f.body);
    for (const c of [...(f.requires ?? []), ...(f.ensures ?? [])]) total = add(total, expr(c.expr));
    active.delete(f);
    if (recursive) total = looped(total);
    memo.set(f, total);
    return total;
  };
  return ofFn;
}

// The manifest of a checked program: one entry per function that can be started from outside.
export function manifestOf(program) {
  const bounds = callBounds(program);
  const tools = program.fns.filter((f) => f.extern && f.extern.tool);
  const describe = (t, counted) => {
    const cap = t.extern.tool.max;
    const proven = Number.isFinite(counted);
    return {
      name: t.name,
      real: t.extern.tool.remote ?? t.name,
      signature: `${t.extern.tool.remote ?? t.name}(${t.params.map((p) => `${p.name}: ${showType(p.ty)}`).join(', ')})${t.ret === 'Unit' ? '' : ` -> ${showType(t.ret)}`}`,
      // the smaller of what the declaration allows and what the code can reach
      calls: cap === null ? (proven ? counted : null) : (proven ? Math.min(cap, counted) : cap),
      // 'proven': the code has no way to call it more often. 'enforced': stopped at run time.
      // 'unlimited': nothing bounds it.
      bound: cap === null && !proven ? 'unlimited' : proven && (cap === null || counted <= cap) ? 'proven' : 'enforced',
      cap,
      totals: t.extern.tool.totals.map((x) => ({ param: x.param, max: x.max })),
      rules: t.requires.map((c) => c.text),
    };
  };
  const entries = callableFns(program).concat(program.main && !callableFns(program).includes(program.main) ? [program.main] : []);
  // A function no other function of the script calls is where the script starts.
  const called = new Set();
  for (const f of program.fns) if (!f.extern) for (const st of f.body) walk(st, (n) => { if (n.kind === 'Call' && n.fn) called.add(n.fn); });
  return {
    tools: tools.map((t) => ({ name: t.name, real: t.extern.tool.remote ?? t.name, params: t.params.map((p) => ({ name: p.name, ty: p.ty })), ret: t.ret, max: t.extern.tool.max, totals: t.extern.tool.totals, rules: t.requires.map((c) => c.text) })),
    entries: entries.map((f) => {
      const counted = bounds(f) ?? new Map();
      return {
        name: f.name,
        root: !called.has(f),
        signature: `${f.name}(${f.params.map((p) => `${p.name}: ${showType(p.ty)}`).join(', ')})${f.ret === 'Unit' ? '' : ` -> ${showType(f.ret)}`}`,
        effects: [...f.effectSet].filter((e) => e !== 'tools'),
        tools: tools.filter((t) => counted.has(t.name)).map((t) => describe(t, counted.get(t.name))),
        requires: f.requires.map((c) => c.text),
      };
    }),
  };
}

const times = (n) => (n === 1 ? 'once' : `${n} times`);

// The manifest of one entry as text a person can approve.
export function showManifest(m, entryName, { file = 'script', hash = '', limits = null, notes = {} } = {}) {
  const entry = m.entries.find((e) => e.name === entryName);
  if (!entry) return `${file} has no function '${entryName}' that can be started`;
  const lines = [`${file}: ${entry.signature}${hash ? `   [${hash.slice(0, 12)}]` : ''}`, ''];
  if (!entry.tools.length) lines.push('It calls no tools.');
  else {
    lines.push('It can call:');
    for (const t of entry.tools) {
      const often = t.bound === 'unlimited' ? 'any number of times' : `at most ${times(t.calls)} (${t.bound === 'proven' ? 'the code cannot do more' : 'stopped if it tries more'})`;
      lines.push(`  ${t.signature}${notes[t.name] ? `   ${notes[t.name]}` : ''}`);
      lines.push(`      ${often}`);
      for (const x of t.totals) lines.push(`      ${x.param} adds up to at most ${x.max} over the whole run`);
      for (const r of t.rules) lines.push(`      every call must satisfy: ${r}`);
    }
  }
  const other = entry.effects;
  lines.push('', other.length ? `Besides tools it can: ${other.map((e) => ({ io: 'print', fs: 'read and write files', net: 'use the network', run: 'start programs', time: 'read the clock', ffi: 'call C code', host: 'call functions of the host program' }[e] ?? e)).join(', ')}.` : 'It cannot print, read or write files, use the network, start programs, or call any other tool.');
  if (entry.requires.length) lines.push(`It refuses to start unless: ${entry.requires.join('; ')}.`);
  if (limits) lines.push(`Each run is stopped after ${limits.timeLimitMs} ms of its own work or ${limits.memoryLimitMb} MB.`);
  return lines.join('\n');
}
