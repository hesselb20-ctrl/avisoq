// Compile-time contract checking.
//
// For every call to a function with `requires` clauses, every `return` of a function with
// `ensures` clauses and every loop `invariant`, the prover decides whether the condition always
// holds, never holds, or cannot be decided. It combines two kinds of knowledge:
//   - ranges: the interval each Int value and each array length can lie in
//   - relations: linear facts between values, such as i < len(xs) or lo <= hi, gathered from
//     conditions, loop bounds, asserts, assignments and the function's own contracts
// A condition is proven when adding its negation to the known facts is contradictory, which is
// decided by Fourier-Motzkin elimination. Always-false is a compile error. Run-time checks are
// never removed, so a gap here can only cost a missed proof, never safety.
import { children, isArr, walk } from './types.mjs';

const MAX_LEN = 1n << 27n;
const TOP = { lo: null, hi: null };
const mk = (lo, hi) => ({ lo, hi });
const minOf = (a, b) => (a === null ? b : b === null ? a : a < b ? a : b); // null = unbounded on that side
const maxOf = (a, b) => (a === null ? b : b === null ? a : a > b ? a : b);
const show = (iv) => (iv.lo !== null && iv.lo === iv.hi ? `${iv.lo}` : iv.lo === null && iv.hi === null ? 'unknown'
  : iv.lo === null ? `at most ${iv.hi}` : iv.hi === null ? `at least ${iv.lo}` : `between ${iv.lo} and ${iv.hi}`);

function alwaysReturns(stmts) {
  const last = stmts[stmts.length - 1];
  if (!last) return false;
  if (last.kind === 'Return') return true;
  if (last.kind === 'If') return !!last.els && alwaysReturns(last.then) && alwaysReturns(last.els);
  if (last.kind === 'Match') return !!last.exhaustive && last.arms.every((a) => alwaysReturns(a.body));
  return false;
}

// ---- linear facts: sum(coef * symbol) + c <= 0 ----
const lin = (terms, c) => ({ terms, c });
const scale = (a, k) => lin(new Map([...a.terms].map(([s, v]) => [s, v * k])), a.c * k);
function add(a, b) {
  const terms = new Map(a.terms);
  for (const [s, v] of b.terms) {
    const n = (terms.get(s) ?? 0n) + v;
    if (n === 0n) terms.delete(s); else terms.set(s, n);
  }
  return lin(terms, a.c + b.c);
}
const neg = (a) => scale(a, -1n);
const plus = (a, k) => lin(a.terms, a.c + k);

// Is the conjunction of the constraints impossible? (Over the rationals, which is sound for
// integers: no rational solution means no integer solution.)
function contradictory(constraints) {
  let cs = constraints;
  for (let round = 0; round < 40; round++) {
    if (cs.some((k) => k.terms.size === 0 && k.c > 0n)) return true;
    const vars = new Map();
    for (const k of cs) for (const s of k.terms.keys()) vars.set(s, (vars.get(s) ?? 0) + 1);
    if (vars.size === 0) return false;
    // Eliminate the variable that produces the fewest new constraints.
    let best = null, bestCost = Infinity;
    for (const s of vars.keys()) {
      let p = 0, n = 0;
      for (const k of cs) { const v = k.terms.get(s); if (v > 0n) p++; else if (v < 0n) n++; }
      if (p * n < bestCost) { bestCost = p * n; best = s; }
    }
    const pos = [], negs = [], rest = [];
    for (const k of cs) { const v = k.terms.get(best); if (v === undefined) rest.push(k); else if (v > 0n) pos.push(k); else negs.push(k); }
    if (rest.length + pos.length * negs.length > 600) return false; // too large: give up, which is always safe
    for (const a of pos) for (const b of negs) rest.push(add(scale(a, -b.terms.get(best)), scale(b, a.terms.get(best))));
    cs = rest;
  }
  return false;
}

export function prove(program, diags) {
  const stats = { proven: 0, runtime: 0 };
  const err = (code, message, node, hint) => {
    diags.push({ code, severity: 'error', message, ...(node.file ? { file: node.file } : {}), line: node.line, col: node.col, hint });
  };

  // env: Map from symbol to interval (the value of an Int, or the length of an array),
  // plus env.facts (linear relations) and env.dead (this path cannot be reached).
  const fork = (env) => { const c = new Map(env); c.dead = env.dead; c.facts = [...(env.facts ?? [])]; return c; };
  const kill = (env, sym) => {
    env.delete(sym);
    if (env.facts) env.facts = env.facts.filter((f) => !f.terms.has(sym));
  };
  const lenRange = (ty) => mk(0n, ty && isArr(ty) ? MAX_LEN : null);

  // subst maps a callee's parameter symbols to the argument expressions at a call.
  const lenOf = (e, env, subst) => {
    if (e.kind === 'Name' && e.sym && subst?.has(e.sym)) return lenOf(subst.get(e.sym), env, null);
    if (e.kind === 'ArrayLit') return mk(BigInt(e.elems.length), BigInt(e.elems.length));
    if (e.kind === 'Name' && e.sym) return env.get(e.sym) ?? lenRange(e.ty);
    if (e.kind === 'Call' && !e.fn && e.name === 'array') { const n = int(e.args[0], env, subst); return mk(maxOf(n.lo, 0n), n.hi === null ? MAX_LEN : minOf(n.hi, MAX_LEN)); }
    if (e.kind === 'Comp') {
      const s = int(e.start, env, subst), en = int(e.end, env, subst);
      const hi = en.hi === null || s.lo === null ? MAX_LEN : maxOf(en.hi - s.lo, 0n);
      const lo = en.lo === null || s.hi === null ? 0n : maxOf(en.lo - s.hi, 0n);
      return mk(lo, hi);
    }
    if (e.kind === 'Call' && e.fn && isArr(e.ty)) return fromEnsures(e.fn, mk(0n, MAX_LEN));
    return lenRange(e.ty);
  };

  // What a function promises about its result, read from its ensures clauses.
  const fromEnsures = (fn, start) => {
    if (!fn.ensures.length || !fn.resultSym) return start;
    const env = new Map([[fn.resultSym, start]]);
    env.facts = [];
    for (const c of fn.ensures) refine(c.expr, env, true);
    return env.get(fn.resultSym) ?? start;
  };

  function int(e, env, subst) {
    switch (e.kind) {
      case 'IntLit': return mk(e.value, e.value);
      case 'Name':
        if (e.sym && subst?.has(e.sym)) return int(subst.get(e.sym), env, null);
        return (e.sym && env.get(e.sym)) || TOP;
      case 'Unary': {
        if (e.op !== '-') return TOP;
        const a = int(e.operand, env, subst);
        return mk(a.hi === null ? null : -a.hi, a.lo === null ? null : -a.lo);
      }
      case 'Binary': {
        const a = int(e.left, env, subst), b = int(e.right, env, subst);
        if (e.op === '+') return mk(a.lo === null || b.lo === null ? null : a.lo + b.lo, a.hi === null || b.hi === null ? null : a.hi + b.hi);
        if (e.op === '-') return mk(a.lo === null || b.hi === null ? null : a.lo - b.hi, a.hi === null || b.lo === null ? null : a.hi - b.lo);
        if (e.op === '*') {
          if ([a.lo, a.hi, b.lo, b.hi].includes(null)) return TOP;
          const c = [a.lo * b.lo, a.lo * b.hi, a.hi * b.lo, a.hi * b.hi];
          return mk(c.reduce((x, y) => (y < x ? y : x)), c.reduce((x, y) => (y > x ? y : x)));
        }
        if ((e.op === '/' || e.op === '%') && b.lo !== null && b.lo === b.hi && b.lo > 0n) {
          const k = b.lo;
          if (e.op === '/') return mk(a.lo === null ? null : a.lo / k, a.hi === null ? null : a.hi / k);
          return a.lo !== null && a.lo >= 0n ? mk(0n, a.hi === null ? k - 1n : minOf(a.hi, k - 1n)) : mk(-(k - 1n), k - 1n);
        }
        return TOP;
      }
      case 'Call':
        if (!e.fn) {
          if (e.name === 'len') return lenOf(e.args[0], env, subst);
          if (e.name === 'byte_at') return mk(0n, 255n);
          return TOP;
        }
        return e.ty === 'Int' ? fromEnsures(e.fn, TOP) : TOP;
      default: return TOP;
    }
  }

  // An Int expression as a linear combination of symbols, or null when it is not linear.
  function linear(e, env, subst) {
    switch (e.kind) {
      case 'IntLit': return lin(new Map(), e.value);
      case 'Name':
        if (!e.sym || e.ty !== 'Int') return null;
        if (subst?.has(e.sym)) return linear(subst.get(e.sym), env, null);
        return lin(new Map([[e.sym, 1n]]), 0n);
      case 'Unary': {
        if (e.op !== '-') return null;
        const a = linear(e.operand, env, subst);
        return a && neg(a);
      }
      case 'Binary': {
        if (!['+', '-', '*'].includes(e.op)) break;
        const a = linear(e.left, env, subst), b = linear(e.right, env, subst);
        if (!a || !b) break;
        if (e.op === '+') return add(a, b);
        if (e.op === '-') return add(a, neg(b));
        if (a.terms.size === 0) return scale(b, a.c);
        if (b.terms.size === 0) return scale(a, b.c);
        break;
      }
      case 'Call':
        if (!e.fn && e.name === 'len') {
          let arg = e.args[0];
          if (arg.kind === 'Name' && arg.sym && subst?.has(arg.sym)) arg = subst.get(arg.sym);
          if (arg.kind === 'Name' && arg.sym && isArr(arg.ty)) return lin(new Map([[arg.sym, 1n]]), 0n);
        }
        break;
      default: break;
    }
    // Not linear, but a known constant still helps.
    const iv = int(e, env, subst);
    return iv.lo !== null && iv.lo === iv.hi ? lin(new Map(), iv.lo) : null;
  }

  // The constraints that say "a op b", for a comparison between two Int expressions.
  function atoms(op, a, b) {
    const d = add(a, neg(b)); // a - b
    switch (op) {
      case '<': return [plus(d, 1n)];
      case '<=': return [d];
      case '>': return [plus(neg(d), 1n)];
      case '>=': return [neg(d)];
      case '==': return [d, neg(d)];
      default: return null;
    }
  }
  const NEG = { '<': '>=', '<=': '>', '>': '<=', '>=': '<', '==': '!=', '!=': '==' };
  const FLIP = { '<': '>', '<=': '>=', '>': '<', '>=': '<=', '==': '==', '!=': '!=' };

  // Everything known in env, as constraints.
  function known(env) {
    const cs = [...(env.facts ?? [])];
    for (const [sym, iv] of env) {
      if (iv.lo !== null) cs.push(lin(new Map([[sym, -1n]]), iv.lo));
      if (iv.hi !== null) cs.push(lin(new Map([[sym, 1n]]), -iv.hi));
    }
    // Array lengths are never negative, whether or not anything else is known about them.
    for (const f of env.facts ?? []) for (const sym of f.terms.keys()) if (isArr(sym.ty) && !env.has(sym)) cs.push(lin(new Map([[sym, -1n]]), 0n));
    return cs;
  }
  // Does "a op b" follow from what is known? Each constraint of the goal is checked separately.
  const follows = (env, op, a, b) => {
    const goal = atoms(op, a, b);
    if (!goal) return false;
    const base = known(env);
    for (const sym of [...a.terms.keys(), ...b.terms.keys()]) if (isArr(sym.ty) && !env.has(sym)) base.push(lin(new Map([[sym, -1n]]), 0n));
    return goal.every((g) => contradictory([...base, plus(neg(g), 1n)]));
  };

  // 'T' always true, 'F' always false, 'U' unknown
  function bool(e, env, subst) {
    switch (e.kind) {
      case 'BoolLit': return e.value ? 'T' : 'F';
      case 'Unary': {
        if (e.op !== 'not') return 'U';
        const v = bool(e.operand, env, subst);
        return v === 'T' ? 'F' : v === 'F' ? 'T' : 'U';
      }
      case 'Binary': {
        if (e.op === 'and' || e.op === 'or') {
          const l = bool(e.left, env, subst);
          const inner = fork(env);
          if (!subst) refine(e.left, inner, e.op === 'and');
          const r = bool(e.right, inner, subst);
          if (e.op === 'and') return l === 'F' || r === 'F' ? 'F' : l === 'T' && r === 'T' ? 'T' : 'U';
          return l === 'T' || r === 'T' ? 'T' : l === 'F' && r === 'F' ? 'F' : 'U';
        }
        if (e.left.ty !== 'Int' || !(e.op in NEG)) return 'U';
        const a = int(e.left, env, subst), b = int(e.right, env, subst);
        const lt = (x, y) => (x.hi !== null && y.lo !== null && x.hi < y.lo ? 'T' : x.lo !== null && y.hi !== null && x.lo >= y.hi ? 'F' : 'U');
        const le = (x, y) => (x.hi !== null && y.lo !== null && x.hi <= y.lo ? 'T' : x.lo !== null && y.hi !== null && x.lo > y.hi ? 'F' : 'U');
        const not = (v) => (v === 'T' ? 'F' : v === 'F' ? 'T' : 'U');
        let quick;
        switch (e.op) {
          case '<': quick = lt(a, b); break;
          case '<=': quick = le(a, b); break;
          case '>': quick = lt(b, a); break;
          case '>=': quick = le(b, a); break;
          default: {
            const single = a.lo !== null && a.lo === a.hi && b.lo !== null && b.lo === b.hi && a.lo === b.lo;
            const apart = lt(a, b) === 'T' || lt(b, a) === 'T';
            const eq = single ? 'T' : apart ? 'F' : 'U';
            quick = e.op === '==' ? eq : not(eq);
          }
        }
        if (quick !== 'U') return quick;
        // Ranges alone do not decide it: use the relations between values.
        const la = linear(e.left, env, subst), lb = linear(e.right, env, subst);
        if (!la || !lb) return 'U';
        if (e.op === '!=') return follows(env, '==', la, lb) ? 'F' : follows(env, '<', la, lb) || follows(env, '>', la, lb) ? 'T' : 'U';
        if (follows(env, e.op, la, lb)) return 'T';
        if (e.op === '==') return follows(env, '<', la, lb) || follows(env, '>', la, lb) ? 'F' : 'U';
        return follows(env, NEG[e.op], la, lb) ? 'F' : 'U';
      }
      default: return 'U';
    }
  }

  // The symbol a comparison side talks about: a variable, or the length of an array variable.
  const subject = (e) => {
    if (e.kind === 'Name' && e.sym && e.ty === 'Int') return e.sym;
    if (e.kind === 'Call' && !e.fn && e.name === 'len' && e.args[0].kind === 'Name' && e.args[0].sym && isArr(e.args[0].ty)) return e.args[0].sym;
    return null;
  };

  // Narrows env with the knowledge that e is true (or false).
  function refine(e, env, truth) {
    if (e.kind === 'Unary' && e.op === 'not') { refine(e.operand, env, !truth); return; }
    if (e.kind !== 'Binary') return;
    if (e.op === 'and' || e.op === 'or') {
      if ((e.op === 'and') === truth) { refine(e.left, env, truth); refine(e.right, env, truth); }
      return;
    }
    if (!(e.op in FLIP) || e.left.ty !== 'Int') return;
    const narrow = (sym, op, other, isLen) => {
      const cur = env.get(sym) ?? (isLen ? mk(0n, MAX_LEN) : TOP);
      let { lo, hi } = cur;
      if (op === '<' && other.hi !== null) hi = minOf(hi, other.hi - 1n);
      if (op === '<=' && other.hi !== null) hi = minOf(hi, other.hi);
      if (op === '>' && other.lo !== null) lo = maxOf(lo, other.lo + 1n);
      if (op === '>=' && other.lo !== null) lo = maxOf(lo, other.lo);
      if (op === '==') { lo = maxOf(lo, other.lo); hi = minOf(hi, other.hi); }
      env.set(sym, mk(lo, hi));
      if (lo !== null && hi !== null && lo > hi) env.dead = true; // this path cannot be reached
    };
    const op = truth ? e.op : NEG[e.op];
    const l = subject(e.left), r = subject(e.right);
    const li = int(e.left, env), ri = int(e.right, env);
    if (l) narrow(l, op, ri, e.left.kind === 'Call');
    if (r) narrow(r, FLIP[op], li, e.right.kind === 'Call');
    // Remember the relation itself when both sides are linear and it involves a variable.
    const la = linear(e.left, env), lb = linear(e.right, env);
    const found = la && lb && (la.terms.size || lb.terms.size) ? atoms(op, la, lb) : null;
    if (found) {
      env.facts = [...(env.facts ?? []), ...found];
      if (env.facts.length > 60) env.facts = env.facts.slice(-60);
      if (contradictory(known(env))) env.dead = true;
    }
  }

  function run(owner, isTest) {
    const where = (node) => ({ file: node.file ?? owner.file, line: node.line, col: node.col });
    const decide = (v) => { if (v === 'T') stats.proven++; else if (v === 'U') stats.runtime++; return v; };

    // Checks the contracts at every call inside an expression, innermost first.
    function visit(e, env) {
      if (e.kind === 'Binary' && (e.op === 'and' || e.op === 'or')) {
        visit(e.left, env);
        const inner = fork(env);
        refine(e.left, inner, e.op === 'and');
        visit(e.right, inner);
        return;
      }
      if (e.kind === 'Sum' || e.kind === 'Comp') {
        visit(e.start, env);
        visit(e.end, env);
        const inner = fork(env);
        range(e, inner);
        visit(e.body, inner);
        return;
      }
      for (const c of children(e)) visit(c, env);
      // push and pop change a length; so may any function that receives the array as mut.
      if (e.kind === 'Call' && !e.fn && (e.name === 'push' || e.name === 'pop') && e.args[0].sym) kill(env, e.args[0].sym);
      if (e.kind === 'Call' && e.fn) e.fn.params.forEach((p, i) => { if (p.grows && e.args[i].sym) kill(env, e.args[i].sym); });
      if (e.kind !== 'Call' || !e.fn || !e.fn.requires.length || env.dead) return;
      // Each clause is judged with the parameters standing for the actual arguments.
      const subst = new Map(e.fn.paramSyms.map((sym, i) => [sym, e.args[i]]));
      for (const c of e.fn.requires) {
        if (decide(bool(c.expr, env, subst)) !== 'F') continue;
        const facts = e.fn.paramSyms.map((sym, i) => {
          if (sym.ty === 'Int') return `${sym.name} is ${show(int(e.args[i], env))}`;
          if (isArr(sym.ty)) return `len(${sym.name}) is ${show(lenOf(e.args[i], env))}`;
          return null;
        }).filter(Boolean).join(', ');
        err('E0501', `this call always breaks the contract of '${e.fn.generic ?? e.fn.name}': requires ${c.text}`, where(e),
          facts ? `here ${facts}` : 'the condition can never hold at this call');
      }
    }

    // The loop variable of a for loop, sum or comprehension: start <= i < end.
    function range(node, env) {
      const st = int(node.start, env), en = int(node.end, env);
      env.set(node.sym, mk(st.lo, en.hi === null ? null : en.hi - 1n));
      if (st.lo !== null && en.hi !== null && st.lo >= en.hi) env.dead = true; // never runs
      const i = lin(new Map([[node.sym, 1n]]), 0n);
      const ls = linear(node.start, env), le = linear(node.end, env);
      env.facts = [...(env.facts ?? []), ...(ls ? atoms('>=', i, ls) : []), ...(le ? atoms('<', i, le) : [])];
    }

    const killAssigned = (stmts, env) => {
      for (const st of stmts) {
        walk(st, (n) => {
          if (n.kind === 'Assign' && n.target.kind === 'Name' && n.target.sym) kill(env, n.target.sym);
          if (n.kind === 'Call' && !n.fn && (n.name === 'push' || n.name === 'pop') && n.args[0].sym) kill(env, n.args[0].sym);
          if (n.kind === 'Call' && n.fn) n.fn.params.forEach((p, i) => { if (p.grows && n.args[i].sym) kill(env, n.args[i].sym); });
        });
      }
    };
    const key = (f) => `${[...f.terms].map(([s, v]) => `${s.name}@${s.decl?.line ?? 0}:${s.decl?.col ?? 0}*${v}`).sort().join('+')}+${f.c}`;
    const join = (a, b) => {
      if (a.dead) return b;
      if (b.dead) return a;
      const out = new Map();
      for (const [sym, x] of a) {
        const y = b.get(sym);
        if (y) out.set(sym, mk(x.lo === null || y.lo === null ? null : minOf(x.lo, y.lo), x.hi === null || y.hi === null ? null : maxOf(x.hi, y.hi)));
      }
      const inB = new Set((b.facts ?? []).map(key));
      out.facts = (a.facts ?? []).filter((f) => inB.has(key(f)));
      return out;
    };
    const adopt = (env, from) => {
      env.clear();
      for (const [k, v] of from) env.set(k, v);
      env.dead = from.dead;
      env.facts = from.facts ?? [];
    };
    // sym now holds the value of init.
    const bind = (sym, init, env) => {
      const value = sym.ty === 'Int' ? int(init, env) : isArr(sym.ty) ? lenOf(init, env) : null;
      // The relation to other values, unless the new value is defined in terms of the old one.
      let rel = null;
      if (sym.ty === 'Int') rel = linear(init, env);
      else if (isArr(sym.ty) && init.kind === 'Name' && init.sym) rel = lin(new Map([[init.sym, 1n]]), 0n);
      else if (isArr(sym.ty) && init.kind === 'Call' && !init.fn && init.name === 'array') rel = linear(init.args[0], env);
      if (rel && rel.terms.has(sym)) {
        // x = x + k: everything known about the old x holds for the new one, shifted by k.
        if (rel.terms.size === 1 && rel.terms.get(sym) === 1n) {
          const k = rel.c, old = env.get(sym);
          env.facts = (env.facts ?? []).map((f) => (f.terms.has(sym) ? lin(f.terms, f.c - f.terms.get(sym) * k) : f));
          if (old) env.set(sym, mk(old.lo === null ? null : old.lo + k, old.hi === null ? null : old.hi + k));
          return;
        }
        rel = null;
      }
      kill(env, sym);
      if (value) env.set(sym, value);
      if (rel && rel.terms.size) env.facts = [...(env.facts ?? []), ...atoms('==', lin(new Map([[sym, 1n]]), 0n), rel)];
    };
    const checkInvariants = (s, env, first) => {
      for (const c of s.invariants ?? []) {
        const v = decide(bool(c.expr, env));
        if (v === 'F' && first && !env.dead) {
          err('E0503', `this loop invariant is false before the loop starts: invariant ${c.text}`, where(c), 'an invariant must hold before the first iteration and after every iteration');
        }
      }
    };

    // Returns the environment after the statements.
    const loops = [];
    function block(stmts, env) {
      for (const s of stmts) {
        switch (s.kind) {
          case 'Let': visit(s.init, env); bind(s.sym, s.init, env); break;
          case 'Assign':
            visit(s.target, env);
            visit(s.value, env);
            if (s.target.kind === 'Name' && s.target.sym) bind(s.target.sym, s.value, env);
            break;
          case 'ExprStmt': visit(s.expr, env); break;
          case 'Assert': visit(s.cond, env); refine(s.cond, env, true); break;
          case 'Return':
            if (s.value) {
              visit(s.value, env);
              if (!isTest && owner.ensures.length && !env.dead) {
                const at = fork(env);
                if (owner.ret === 'Int' || isArr(owner.ret)) bind(owner.resultSym, s.value, at);
                for (const c of owner.ensures) {
                  if (decide(bool(c.expr, at)) !== 'F') continue;
                  err('E0502', `this return always breaks the promise of '${owner.generic ?? owner.name}': ensures ${c.text}`, where(s.value),
                    at.has(owner.resultSym) && show(at.get(owner.resultSym)) !== 'unknown' ? `the returned value is ${show(at.get(owner.resultSym))}` : 'the condition can never hold for this return');
                }
              }
            }
            env.dead = true; // nothing after a return runs on this path
            break;
          case 'If': {
            visit(s.cond, env);
            const t = fork(env), f = fork(env);
            refine(s.cond, t, true);
            refine(s.cond, f, false);
            adopt(env, join(block(s.then, t), s.els ? block(s.els, f) : f));
            break;
          }
          case 'Break':
            env.dead = true; // the rest of this path does not run; what holds after the loop is handled at the loop
            break;
          case 'Continue': {
            const loop = loops[loops.length - 1];
            if (loop && loop.kind === 'While' && !env.dead) checkInvariants(loop, env, false);
            env.dead = true;
            break;
          }
          case 'While': {
            for (const c of s.invariants ?? []) visit(c.expr, env);
            if (!env.dead) checkInvariants(s, env, true);
            killAssigned(s.body, env);
            // After a break neither the invariants nor the negated condition are known to hold.
            const afterBreak = s.hasBreak ? fork(env) : null;
            for (const c of s.invariants ?? []) refine(c.expr, env, true); // holds at the top of every iteration
            visit(s.cond, env);
            const b = fork(env);
            refine(s.cond, b, true);
            loops.push(s);
            const end = block(s.body, b);
            loops.pop();
            if (!end.dead) checkInvariants(s, end, false);
            refine(s.cond, env, false);
            if (afterBreak) adopt(env, afterBreak);
            break;
          }
          case 'For': {
            visit(s.start, env);
            visit(s.end, env);
            killAssigned(s.body, env);
            const b = fork(env);
            range(s, b);
            loops.push(s);
            block(s.body, b);
            loops.pop();
            break;
          }
          case 'Match': {
            visit(s.scrut, env);
            const wasDead = env.dead;
            let allDead = s.exhaustive;
            for (const arm of s.arms) {
              const a = fork(env);
              a.dead = wasDead;
              if (!block(arm.body, a).dead) allDead = false;
            }
            for (const arm of s.arms) killAssigned(arm.body, env);
            env.dead = wasDead || allDead;
            break;
          }
          default: break;
        }
      }
      return env;
    }

    const env = new Map();
    env.facts = [];
    if (!isTest) {
      for (const sym of owner.paramSyms) if (isArr(sym.ty)) env.set(sym, mk(0n, MAX_LEN));
      for (const c of owner.requires) refine(c.expr, env, true);
      for (const c of [...owner.requires, ...owner.ensures]) visit(c.expr, fork(env));
    }
    block(owner.body, env);
  }

  for (const f of program.fns) run(f, false);
  for (const t of program.tests) run(t, true);
  return stats;
}
