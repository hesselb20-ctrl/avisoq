// Compile-time contract checking by interval reasoning.
//
// For every call to a function with `requires` clauses, and every `return` of a function with
// `ensures` clauses, the prover works out the range each Int value (and each array length) can
// have at that point. A clause that holds for the whole range is proven; one that fails for the
// whole range is a compile error; anything else stays a run-time check. Run-time checks are
// never removed, so a gap in the prover can only cost a missed proof, never safety.
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

export function prove(program, diags) {
  const stats = { proven: 0, runtime: 0 };
  const err = (code, message, node, hint) => {
    diags.push({ code, severity: 'error', message, ...(node.file ? { file: node.file } : {}), line: node.line, col: node.col, hint });
  };

  // env: Map from symbol to interval (the value of an Int, or the length of an array)
  const lenOf = (e, env) => {
    if (e.kind === 'ArrayLit') return mk(BigInt(e.elems.length), BigInt(e.elems.length));
    if (e.kind === 'Name' && e.sym) return env.get(e.sym) ?? mk(0n, e.ty === 'Str' || !isArr(e.ty) ? null : MAX_LEN);
    if (e.kind === 'Call' && !e.fn && e.name === 'array') { const n = int(e.args[0], env); return mk(maxOf(n.lo, 0n), n.hi === null ? MAX_LEN : minOf(n.hi, MAX_LEN)); }
    if (e.kind === 'Comp') {
      const s = int(e.start, env), en = int(e.end, env);
      const hi = en.hi === null || s.lo === null ? MAX_LEN : maxOf(en.hi - s.lo, 0n);
      const lo = en.lo === null || s.hi === null ? 0n : maxOf(en.lo - s.hi, 0n);
      return mk(lo, hi);
    }
    if (e.kind === 'Call' && e.fn && isArr(e.ty)) return fromEnsures(e.fn, mk(0n, MAX_LEN));
    return mk(0n, e.ty && isArr(e.ty) ? MAX_LEN : null);
  };

  // What a function promises about its result, read from its ensures clauses.
  const fromEnsures = (fn, start) => {
    if (!fn.ensures.length || !fn.resultSym) return start;
    const env = new Map([[fn.resultSym, start]]);
    for (const c of fn.ensures) refine(c.expr, env, true);
    return env.get(fn.resultSym) ?? start;
  };

  function int(e, env) {
    switch (e.kind) {
      case 'IntLit': return mk(e.value, e.value);
      case 'Name': return (e.sym && env.get(e.sym)) || TOP;
      case 'Unary': {
        if (e.op !== '-') return TOP;
        const a = int(e.operand, env);
        return mk(a.hi === null ? null : -a.hi, a.lo === null ? null : -a.lo);
      }
      case 'Binary': {
        const a = int(e.left, env), b = int(e.right, env);
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
          if (e.name === 'len') return lenOf(e.args[0], env);
          if (e.name === 'byte_at') return mk(0n, 255n);
          return TOP;
        }
        return e.ty === 'Int' ? fromEnsures(e.fn, TOP) : TOP;
      default: return TOP;
    }
  }

  // 'T' always true, 'F' always false, 'U' unknown
  function bool(e, env) {
    switch (e.kind) {
      case 'BoolLit': return e.value ? 'T' : 'F';
      case 'Unary': {
        if (e.op !== 'not') return 'U';
        const v = bool(e.operand, env);
        return v === 'T' ? 'F' : v === 'F' ? 'T' : 'U';
      }
      case 'Binary': {
        if (e.op === 'and' || e.op === 'or') {
          const l = bool(e.left, env);
          const inner = new Map(env);
          refine(e.left, inner, e.op === 'and');
          const r = bool(e.right, inner);
          if (e.op === 'and') return l === 'F' || r === 'F' ? 'F' : l === 'T' && r === 'T' ? 'T' : 'U';
          return l === 'T' || r === 'T' ? 'T' : l === 'F' && r === 'F' ? 'F' : 'U';
        }
        if (e.left.ty !== 'Int') return 'U';
        const a = int(e.left, env), b = int(e.right, env);
        const lt = (x, y) => (x.hi !== null && y.lo !== null && x.hi < y.lo ? 'T' : x.lo !== null && y.hi !== null && x.lo >= y.hi ? 'F' : 'U');
        const le = (x, y) => (x.hi !== null && y.lo !== null && x.hi <= y.lo ? 'T' : x.lo !== null && y.hi !== null && x.lo > y.hi ? 'F' : 'U');
        const not = (v) => (v === 'T' ? 'F' : v === 'F' ? 'T' : 'U');
        switch (e.op) {
          case '<': return lt(a, b);
          case '<=': return le(a, b);
          case '>': return lt(b, a);
          case '>=': return le(b, a);
          case '==': case '!=': {
            const single = a.lo !== null && a.lo === a.hi && b.lo !== null && b.lo === b.hi && a.lo === b.lo;
            const apart = lt(a, b) === 'T' || lt(b, a) === 'T';
            const eq = single ? 'T' : apart ? 'F' : 'U';
            return e.op === '==' ? eq : not(eq);
          }
          default: return 'U';
        }
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
  const FLIP = { '<': '>', '<=': '>=', '>': '<', '>=': '<=', '==': '==', '!=': '!=' };
  const NEG = { '<': '>=', '<=': '>', '>': '<=', '>=': '<', '==': '!=', '!=': '==' };

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
  }

  function run(owner, isTest) {
    const where = (node) => ({ file: node.file ?? owner.file, line: node.line, col: node.col });

    // Checks the contracts at every call inside an expression, innermost first.
    function visit(e, env) {
      if (e.kind === 'Binary' && (e.op === 'and' || e.op === 'or')) {
        visit(e.left, env);
        const inner = new Map(env);
        inner.dead = env.dead;
        refine(e.left, inner, e.op === 'and');
        visit(e.right, inner);
        return;
      }
      if (e.kind === 'Sum' || e.kind === 'Comp') {
        visit(e.start, env);
        visit(e.end, env);
        const inner = new Map(env);
        inner.dead = env.dead;
        const s = int(e.start, env), en = int(e.end, env);
        inner.set(e.sym, mk(s.lo, en.hi === null ? null : en.hi - 1n));
        visit(e.body, inner);
        return;
      }
      for (const c of children(e)) visit(c, env);
      if (e.kind !== 'Call' || !e.fn || !e.fn.requires.length || env.dead) return;
      const callee = new Map();
      e.fn.paramSyms.forEach((sym, i) => {
        if (sym.ty === 'Int') callee.set(sym, int(e.args[i], env));
        else if (isArr(sym.ty)) callee.set(sym, lenOf(e.args[i], env));
      });
      for (const c of e.fn.requires) {
        const v = bool(c.expr, callee);
        if (v === 'T') { stats.proven++; refine(c.expr, callee, true); continue; }
        if (v === 'U') { stats.runtime++; refine(c.expr, callee, true); continue; }
        const facts = e.fn.paramSyms.filter((sym) => callee.has(sym))
          .map((sym) => `${isArr(sym.ty) ? `len(${sym.name})` : sym.name} is ${show(callee.get(sym))}`).join(', ');
        err('E0501', `this call always breaks the contract of '${e.fn.generic ?? e.fn.name}': requires ${c.text}`, where(e),
          facts ? `here ${facts}` : 'the condition can never hold at this call');
      }
    }

    const killAssigned = (stmts, env) => {
      for (const st of stmts) walk(st, (n) => { if (n.kind === 'Assign' && n.target.kind === 'Name' && n.target.sym) env.delete(n.target.sym); });
    };
    const fork = (env) => { const c = new Map(env); c.dead = env.dead; return c; };
    const join = (a, b) => {
      if (a.dead) return b;
      if (b.dead) return a;
      const out = new Map();
      for (const [sym, x] of a) {
        const y = b.get(sym);
        if (y) out.set(sym, mk(x.lo === null || y.lo === null ? null : minOf(x.lo, y.lo), x.hi === null || y.hi === null ? null : maxOf(x.hi, y.hi)));
      }
      return out;
    };
    const bind = (sym, init, env) => {
      if (sym.ty === 'Int') env.set(sym, int(init, env));
      else if (isArr(sym.ty)) env.set(sym, lenOf(init, env));
      else env.delete(sym);
    };

    // Returns the environment after the statements.
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
                if (owner.ret === 'Int') at.set(owner.resultSym, int(s.value, env));
                else if (isArr(owner.ret)) at.set(owner.resultSym, lenOf(s.value, env));
                for (const c of owner.ensures) {
                  const v = bool(c.expr, at);
                  if (v === 'T') stats.proven++;
                  else if (v === 'U') stats.runtime++;
                  else {
                    err('E0502', `this return always breaks the promise of '${owner.generic ?? owner.name}': ensures ${c.text}`, where(s.value),
                      at.has(owner.resultSym) ? `the returned value is ${show(at.get(owner.resultSym))}` : 'the condition can never hold for this return');
                  }
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
            const after = join(block(s.then, t), s.els ? block(s.els, f) : f);
            env.clear();
            for (const [k, v] of after) env.set(k, v);
            env.dead = after.dead;
            break;
          }
          case 'While': {
            killAssigned(s.body, env);
            visit(s.cond, env);
            const b = fork(env);
            refine(s.cond, b, true);
            block(s.body, b);
            refine(s.cond, env, false);
            break;
          }
          case 'For': {
            visit(s.start, env);
            visit(s.end, env);
            killAssigned(s.body, env);
            const b = fork(env);
            const st = int(s.start, env), en = int(s.end, env);
            b.set(s.sym, mk(st.lo, en.hi === null ? null : en.hi - 1n));
            if (st.lo !== null && en.hi !== null && st.lo >= en.hi) b.dead = true; // the loop never runs
            block(s.body, b);
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
