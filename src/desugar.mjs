// Rewrites the convenience forms into the core language, before checking:
//
//   (a, b)                 ->  Tuple2(first: a, second: b)
//   let (x, y) = e         ->  let t = e;  let x = t.first;  let y = t.second
//   let x = e?   (also var, x = e?, and a bare e?)
//                          ->  match e { Ok(v) => { let x = v; <rest of the block> }  Err(error) => { return Err(error: error) } }
//                              (Some / None for an Option). The arms are filled in by the checker,
//                              which knows whether e is a Result or an Option.
//
// The formatter works on the parser's output, so it still sees what was written.
import { children } from './types.mjs';

export const TUPLE_FIELDS = ['first', 'second', 'third', 'fourth'];

export function desugar(program) {
  let n = 0;
  const fresh = (p) => `__${p}${n++}`;

  const exprs = (node) => {
    if (!node || typeof node !== 'object') return;
    for (const c of children(node)) exprs(c);
    if (node.kind === 'Tuple') {
      const fields = node.elems.map((x, i) => ({ name: TUPLE_FIELDS[i], expr: x, line: x.line, col: x.col }));
      delete node.elems;
      Object.assign(node, { kind: 'New', name: `Tuple${fields.length}`, fields });
    }
  };

  const block = (stmts) => {
    const out = [];
    for (let i = 0; i < stmts.length; i++) {
      const s = stmts[i];
      const at = { line: s.line, col: s.col, endLine: s.endLine };
      if (s.kind === 'LetTuple') {
        const t = fresh('tup');
        const rest = [
          { kind: 'Let', mutable: false, name: t, ty: null, init: s.init, try: s.try, stmtLine: s.line, ...at },
          ...s.names.map((nm, k) => ({ kind: 'Let', mutable: s.mutable, name: nm.name, ty: null, init: { kind: 'Field', base: { kind: 'Name', name: t, ...at }, name: TUPLE_FIELDS[k], ...at }, line: nm.line, col: nm.col, endLine: s.endLine, stmtLine: s.line })),
          ...stmts.slice(i + 1),
        ];
        out.push(...block(rest));
        break;
      }
      if (s.try) {
        s.try = false;
        const scrut = s.kind === 'Let' ? s.init : s.kind === 'Assign' ? s.value : s.expr;
        let bind = null;
        const rest = stmts.slice(i + 1);
        if (s.kind !== 'ExprStmt') {
          bind = fresh('try');
          const value = { kind: 'Name', name: bind, ...at };
          if (s.kind === 'Let') s.init = value; else s.value = value;
          rest.unshift(s);
        }
        exprs(scrut);
        out.push({ kind: 'Match', scrut, arms: [], tryOf: { bind, first: bind ? s : null, rest: block(rest) }, ...at });
        break;
      }
      for (const key of ['then', 'els', 'body']) if (Array.isArray(s[key])) { const b = block(s[key]); b.closeLine = s[key].closeLine; s[key] = b; }
      if (s.kind === 'Match') for (const arm of s.arms) { const b = block(arm.body); b.closeLine = arm.body.closeLine; arm.body = b; }
      for (const key of ['init', 'value', 'target', 'cond', 'expr', 'scrut', 'start', 'end']) exprs(s[key]);
      for (const c of s.invariants ?? []) exprs(c.expr);
      out.push(s);
    }
    return out;
  };

  for (const o of [...program.fns, ...program.tests]) {
    for (const c of [...(o.requires ?? []), ...(o.ensures ?? [])]) exprs(c.expr);
    const b = block(o.body);
    b.closeLine = o.body.closeLine;
    o.body = b;
  }
  for (const c of program.consts ?? []) exprs(c.init);
}
