// Avisoq parser: tokens -> AST.
import { lex, AvisoqError } from './lexer.mjs';

const CMP = new Set(['==', '!=', '<', '<=', '>', '>=']);

export function parse(src) {
  const toks = lex(src);
  const eof = toks[toks.length - 1];
  let p = 0;
  const INT_MIN_MAGNITUDE = 2n ** 63n;
  let prevEnd = 0;
  let prevLine = 1;

  const peek = () => toks[p];
  const ahead = (n) => toks[p + n] ?? eof;
  const next = () => { const t = toks[p++]; prevEnd = t.end; prevLine = t.line; return t; };
  const is = (kind, value) => toks[p].kind === kind && (value === undefined || toks[p].value === value);
  const isOp = (v) => is('op', v);
  const isKw = (v) => is('kw', v);
  const show = (t) => (t.kind === 'eof' ? 'end of file' : t.kind === 'str' ? 'string literal' : `'${t.value}'`);
  const fail = (msg, hint, t = peek()) => { throw new AvisoqError('E0001', msg, t.line, t.col, hint); };
  const expect = (kind, value, hint) => {
    if (!is(kind, value)) fail(`expected '${value ?? kind}' but found ${show(peek())}`, hint);
    return next();
  };
  const ident = (what) => {
    if (!is('id')) {
      fail(`expected ${what} but found ${show(peek())}`,
        peek().kind === 'kw' ? `'${peek().value}' is a reserved keyword and cannot be used as a name` : undefined);
    }
    return next();
  };
  // Marks where a declaration or statement ends, for the formatter.
  const ended = (node) => { node.endLine = prevLine; return node; };

  // Types are canonical strings: Int, [T], Map[K,V], Name, Name[A,B].
  function parseType() {
    if (isOp('(')) {
      // A tuple type: (A, B) is kept as Tuple2[A,B]
      const open = next();
      const parts = [parseType()];
      while (isOp(',')) { next(); parts.push(parseType()); }
      expect('op', ')', 'a tuple type is written (A, B)');
      if (parts.length < 2 || parts.length > 4) fail('a tuple has 2 to 4 parts', 'for more values, declare a struct with named fields', open);
      return `Tuple${parts.length}[${parts.join(',')}]`;
    }
    if (isOp('[')) {
      next();
      const inner = parseType();
      expect('op', ']');
      return `[${inner}]`;
    }
    if (isKw('fn')) {
      // A function type: fn(A, B) -> R, kept as Fn[R,A,B]
      next();
      expect('op', '(', 'a function type is written fn(ArgType, ...) -> ResultType');
      const args = [];
      while (!isOp(')')) { args.push(parseType()); if (!isOp(')')) expect('op', ','); }
      next();
      let ret = 'Unit';
      if (isOp('->')) { next(); ret = parseType(); }
      return `Fn[${[ret, ...args].join(',')}]`;
    }
    const t = ident('a type');
    if (isOp('[') && !peek().nl) {
      next();
      const args = [parseType()];
      while (isOp(',')) { next(); args.push(parseType()); }
      expect('op', ']', 'type arguments are written Name[A, B]');
      return `${t.value}[${args.join(',')}]`;
    }
    return t.value;
  }

  // Optional [T, U] after a declared name.
  // Optional [T, U: Ord] after a declared name. Returns the names; bounds go into `into`.
  function parseTypeParams(into) {
    const params = [];
    into.typeBounds = {};
    if (!isOp('[')) return params;
    next();
    do {
      const p = ident('a type parameter name').value;
      params.push(p);
      if (isOp(':')) { next(); into.typeBounds[p] = ident('a constraint such as Ord, Eq or Num').value; }
    } while (isOp(',') && next());
    expect('op', ']');
    return params;
  }

  function parseFields(close, what) {
    const fields = [];
    while (!isOp(close)) {
      const fnm = ident(`a ${what} name`);
      expect('op', ':', `every ${what} needs a type: name: Type`);
      const tyTok = peek();
      fields.push({ name: fnm.value, ty: parseType(), line: fnm.line, col: fnm.col, tyLine: tyTok.line, tyCol: tyTok.col });
      if (isOp(',')) next();
    }
    next();
    return fields;
  }

  function parseStruct() {
    next();
    const name = ident('a struct name');
    const extra = {};
    const typeParams = parseTypeParams(extra);
    expect('op', '{');
    const fields = parseFields('}', 'field');
    return ended({ kind: 'Struct', name: name.value, typeParams, ...extra, fields, line: name.line, col: name.col });
  }

  function parseEnum() {
    next();
    const name = ident('an enum name');
    const extra = {};
    const typeParams = parseTypeParams(extra);
    expect('op', '{');
    const variants = [];
    while (!isOp('}')) {
      const v = ident('a variant name');
      let fields = [];
      if (isOp('(')) { next(); fields = parseFields(')', 'field'); }
      variants.push({ name: v.value, fields, line: v.line, col: v.col });
      if (isOp(',')) next();
    }
    next();
    if (variants.length === 0) {
      throw new AvisoqError('E0106', `enum '${name.value}' has no variants`, name.line, name.col, 'an enum needs at least one variant');
    }
    return ended({ kind: 'Enum', name: name.value, typeParams, ...extra, variants, line: name.line, col: name.col });
  }

  function parseImport() {
    const kw = next();
    const path = expect('str', undefined, 'an import names a file: import "std/strings"');
    return ended({ kind: 'Import', path: path.value, line: kw.line, col: kw.col });
  }

  function parseFn() {
    const kw = next();
    const name = ident('a function name');
    const extra = {};
    const typeParams = parseTypeParams(extra);
    expect('op', '(');
    const params = [];
    while (!isOp(')')) {
      const pn = ident('a parameter name');
      expect('op', ':', 'every parameter needs a type: name: Type');
      let mut = false;
      if (isKw('mut')) { next(); mut = true; }
      const ty = parseType();
      if (mut && (['Int', 'Float', 'Bool', 'Str'].includes(ty) || ty.startsWith('Fn['))) {
        throw new AvisoqError('E0001', `a ${ty} parameter cannot be 'mut'`, pn.line, pn.col,
          'arrays, maps and structs can be mut parameters; for a single number, return the new value or keep it in a struct');
      }
      // A mut struct is handed back to the caller's variable when the function returns.
      const byValue = mut && ty[0] !== '[' && !ty.startsWith('Map[');
      params.push({ name: pn.value, ty, mut, ...(byValue ? { grows: true, mutValue: true } : {}), line: pn.line, col: pn.col });
      if (!isOp(')')) expect('op', ',');
    }
    next();
    let ret = 'Unit';
    if (isOp('->')) { next(); ret = parseType(); }
    const effects = [];
    if (isKw('uses')) {
      next();
      do {
        const e = ident('an effect name');
        effects.push({ name: e.value, line: e.line, col: e.col });
      } while (isOp(',') && next());
    }
    const requires = [], ensures = [];
    while (isKw('requires') || isKw('ensures')) {
      const k = next();
      const start = peek().pos;
      const expr = parseExpr();
      (k.value === 'requires' ? requires : ensures).push({ expr, text: src.slice(start, prevEnd), line: k.line, col: k.col });
    }
    const body = parseBlock();
    return ended({ kind: 'Fn', name: name.value, typeParams, ...extra, params, ret, effects, requires, ensures, body, line: kw.line, col: name.col });
  }

  function parseTest() {
    const kw = next();
    const name = expect('str', undefined, 'a test needs a name: test "what it checks" { ... }');
    const body = parseBlock();
    return ended({ kind: 'Test', name: name.value, body, line: kw.line, col: kw.col });
  }

  function parseBlock() {
    expect('op', '{');
    const stmts = [];
    while (!isOp('}')) {
      if (is('eof')) fail("expected '}' but reached end of file", 'a block opened with { was never closed');
      stmts.push(ended(parseStmt()));
    }
    stmts.closeLine = next().line; // where the block's } is, for the formatter
    return stmts;
  }

  // A trailing ? on a let, an assignment or a call statement: pass an Err or None up to the caller.
  const tryMark = () => { if (isOp('?') && !peek().nl) { next(); return true; } return false; };

  function parseStmt() {
    const t = peek();
    const at = { line: t.line, col: t.col };
    if (t.kind === 'kw') {
      switch (t.value) {
        case 'let':
        case 'var': {
          next();
          if (isOp('(')) {
            // let (a, b) = pair
            next();
            const names = [];
            while (!isOp(')')) { const b = ident('a variable name'); names.push({ name: b.value, line: b.line, col: b.col }); if (!isOp(')')) expect('op', ','); }
            next();
            if (names.length < 2 || names.length > 4) fail('a tuple pattern has 2 to 4 names', 'write: let (a, b) = value');
            expect('op', '=', 'every variable must be initialised: let (a, b) = value');
            const init = parseExpr();
            return { kind: 'LetTuple', mutable: t.value === 'var', names, init, try: tryMark(), ...at };
          }
          const name = ident('a variable name');
          let ty = null;
          if (isOp(':')) { next(); ty = parseType(); }
          expect('op', '=', 'every variable must be initialised: let name = value');
          const init = parseExpr();
          return { kind: 'Let', mutable: t.value === 'var', name: name.value, ty, init, try: tryMark(), line: name.line, col: name.col, stmtLine: t.line };
        }
        case 'if':
          return parseIf();
        case 'while': {
          next();
          const cond = parseExpr();
          // invariant: a condition that holds before the loop and after every iteration
          const invariants = [];
          while (isKw('invariant')) {
            const k = next();
            const start = peek().pos;
            const expr = parseExpr();
            invariants.push({ expr, text: src.slice(start, prevEnd), line: k.line, col: k.col });
          }
          const body = parseBlock();
          return { kind: 'While', cond, invariants, body, ...at };
        }
        case 'for': {
          next();
          const name = ident('a loop variable name');
          let second = null;
          if (isOp(',')) { next(); second = ident('a name for the element'); }
          expect('kw', 'in', 'loops are written: for i in start..end { ... } or for x in items { ... }');
          const start = parseExpr();
          if (second || !isOp('..')) {
            // for x in items, or for i, x in items: every element of an array, or every byte of a Str
            const body = parseBlock();
            return { kind: 'ForIn', index: second ? { name: name.value, line: name.line, col: name.col } : null, name: (second ?? name).value, nameLine: (second ?? name).line, nameCol: (second ?? name).col, iter: start, body, line: name.line, col: name.col, stmtLine: t.line };
          }
          expect('op', '..', 'loops are written: for i in start..end { ... } (end is exclusive)');
          const end = parseExpr();
          const body = parseBlock();
          return { kind: 'For', name: name.value, start, end, body, line: name.line, col: name.col, stmtLine: t.line };
        }
        case 'match':
          return parseMatch();
        case 'break':
          next();
          return { kind: 'Break', ...at };
        case 'continue':
          next();
          return { kind: 'Continue', ...at };
        case 'return': {
          next();
          let value = null;
          if (!isOp('}') && !peek().nl) value = parseExpr();
          return { kind: 'Return', value, ...at };
        }
        case 'assert': {
          next();
          const start = peek().pos;
          const cond = parseExpr();
          return { kind: 'Assert', cond, text: src.slice(start, prevEnd), ...at };
        }
        default:
          break;
      }
    }
    const expr = parseExpr();
    const compound = ['+=', '-=', '*=', '/=', '%='].find((o) => isOp(o));
    if (compound) {
      next();
      if (expr.kind !== 'Name' && expr.kind !== 'Index' && expr.kind !== 'Field') {
        throw new AvisoqError('E0001', `left side of ${compound} must be a variable, an array element or a field`, expr.line, expr.col);
      }
      const rhs = parseExpr();
      // x += e  means  x = x + e
      return { kind: 'Assign', target: expr, compound: compound[0], rhs, value: { kind: 'Binary', op: compound[0], left: structuredClone(expr), right: rhs, line: expr.line, col: expr.col }, ...at };
    }
    if (isOp('=') && expr.kind === 'Tuple' && expr.elems.every((x) => x.kind === 'Name' || x.kind === 'Index' || x.kind === 'Field')) {
      // (a, b) = pair: assign each part
      next();
      return { kind: 'AssignTuple', targets: expr.elems, value: parseExpr(), ...at };
    }
    if (isOp('=')) {
      next();
      if (expr.kind !== 'Name' && expr.kind !== 'Index' && expr.kind !== 'Field') {
        throw new AvisoqError('E0001', 'left side of = must be a variable, an array element or a field', expr.line, expr.col,
          'to compare values use ==');
      }
      const value = parseExpr();
      return { kind: 'Assign', target: expr, value, try: tryMark(), ...at };
    }
    return { kind: 'ExprStmt', expr, try: tryMark(), ...at };
  }

  function parseIf() {
    const t = next();
    const cond = parseExpr();
    const then = parseBlock();
    let els = null;
    if (isKw('else')) {
      next();
      els = isKw('if') ? [ended(parseIf())] : parseBlock();
    }
    return { kind: 'If', cond, then, els, line: t.line, col: t.col };
  }

  // match value { Variant(a, b) => { ... }  Other => { ... }  else => { ... } }
  function parseMatch() {
    const t = next();
    const scrut = parseExpr();
    expect('op', '{', 'a match is written: match value { Variant(x) => { ... } }');
    const arms = [];
    while (!isOp('}')) {
      const at = { line: peek().line, col: peek().col };
      let variant = null;
      const binds = [];
      if (isKw('else')) {
        next();
      } else {
        variant = ident('a variant name').value;
        if (isOp('(')) {
          next();
          while (!isOp(')')) {
            const b = ident('a name for the field');
            binds.push({ name: b.value, line: b.line, col: b.col });
            if (!isOp(')')) expect('op', ',');
          }
          next();
        }
      }
      expect('op', '=>', 'each match arm is written: Variant(x) => { ... }');
      const body = parseBlock();
      arms.push({ variant, binds, body, endLine: prevLine, ...at });
    }
    next();
    return { kind: 'Match', scrut, arms, line: t.line, col: t.col };
  }

  function parseExpr() { return parseOr(); }

  function binLoop(sub, match) {
    let left = sub();
    while (!peek().nl && match(peek())) {
      const op = next();
      const right = sub();
      left = { kind: 'Binary', op: op.value, left, right, line: op.line, col: op.col };
    }
    return left;
  }
  const parseOr = () => binLoop(parseAnd, (t) => t.kind === 'kw' && t.value === 'or');
  const parseAnd = () => binLoop(parseNot, (t) => t.kind === 'kw' && t.value === 'and');

  function parseNot() {
    if (isKw('not')) {
      const t = next();
      return { kind: 'Unary', op: 'not', operand: parseNot(), line: t.line, col: t.col };
    }
    return parseCmp();
  }

  function parseCmp() {
    const left = parseAdd();
    if (!peek().nl && peek().kind === 'op' && CMP.has(peek().value)) {
      const op = next();
      const right = parseAdd();
      if (!peek().nl && peek().kind === 'op' && CMP.has(peek().value)) {
        fail('comparisons cannot be chained', 'write a < b and b < c instead of a < b < c');
      }
      return { kind: 'Binary', op: op.value, left, right, line: op.line, col: op.col };
    }
    return left;
  }

  const parseAdd = () => binLoop(parseMul, (t) => t.kind === 'op' && (t.value === '+' || t.value === '-'));
  const parseMul = () => binLoop(parseUnary, (t) => t.kind === 'op' && (t.value === '*' || t.value === '/' || t.value === '%'));

  function parseUnary() {
    // -9223372036854775808 is one literal: its positive half does not fit in Int
    if (isOp('-') && toks[p + 1] && toks[p + 1].kind === 'int' && toks[p + 1].value === INT_MIN_MAGNITUDE) {
      const t = next();
      next();
      return { kind: 'IntLit', value: -INT_MIN_MAGNITUDE, raw: '-9223372036854775808', line: t.line, col: t.col };
    }
    if (isOp('-')) {
      const t = next();
      return { kind: 'Unary', op: '-', operand: parseUnary(), line: t.line, col: t.col };
    }
    return parsePostfix();
  }

  function parsePostfix() {
    let e = parsePrimary();
    for (;;) {
      if (isOp('[') && !peek().nl) {
        const t = next();
        const index = parseExpr();
        if (isOp('..')) {
          // s[a..b] is the part of a string from byte a up to, not including, byte b
          next();
          const end = parseExpr();
          expect('op', ']');
          e = { kind: 'Call', name: 'substr', slice: true, args: [e, index, end], line: e.line, col: e.col };
          continue;
        }
        expect('op', ']');
        e = { kind: 'Index', base: e, index, line: t.line, col: t.col };
      } else if (isOp('.') && !peek().nl) {
        next();
        const f = ident('a field name');
        e = { kind: 'Field', base: e, name: f.value, line: f.line, col: f.col };
      } else {
        return e;
      }
    }
  }

  // i in start..end: body   (shared by sum(...) and [...])
  function parseRange(what, close) {
    const v = next();
    next();
    const start = parseExpr();
    expect('op', '..', `a ${what} is written with a range: i in start..end: expression`);
    const end = parseExpr();
    expect('op', ':', `a ${what} is written with a range: i in start..end: expression`);
    const body = parseExpr();
    expect('op', close);
    return { name: v.value, start, end, body, nameLine: v.line, nameCol: v.col };
  }

  function parsePrimary() {
    const t = peek();
    const at = { line: t.line, col: t.col };
    if (t.kind === 'int') {
      if (t.value === INT_MIN_MAGNITUDE) throw new AvisoqError('E0002', `integer literal ${t.raw} does not fit in Int (64-bit signed)`, t.line, t.col, 'Int holds values from -9223372036854775808 to 9223372036854775807');
      next();
      return { kind: 'IntLit', value: t.value, raw: t.raw, ...at };
    }
    if (t.kind === 'float') { next(); return { kind: 'FloatLit', value: t.value, raw: t.raw, ...at }; }
    if (t.kind === 'str') { next(); return { kind: 'StrLit', value: t.value, ...at }; }
    if (t.kind === 'kw' && (t.value === 'true' || t.value === 'false')) {
      next();
      return { kind: 'BoolLit', value: t.value === 'true', ...at };
    }
    if (t.kind === 'id') {
      next();
      const call = isOp('(') && !peek().nl;
      const a1 = ahead(1), a2 = ahead(2);
      if (call && t.value === 'sum' && a1.kind === 'id' && a2.kind === 'kw' && a2.value === 'in') {
        next();
        return { kind: 'Sum', ...parseRange('sum', ')'), ...at };
      }
      if (call && a1.kind === 'id' && a2.kind === 'op' && a2.value === ':') {
        // Struct or enum variant construction with named fields: Point(x: 1.0, y: 2.0)
        next();
        const fields = [];
        while (!isOp(')')) {
          const fnm = ident('a field name');
          expect('op', ':', 'fields are given by name: Type(field: value, ...)');
          fields.push({ name: fnm.value, expr: parseExpr(), line: fnm.line, col: fnm.col });
          if (!isOp(')')) expect('op', ',');
        }
        next();
        return { kind: 'New', name: t.value, fields, ...at };
      }
      if (call) {
        next();
        const args = [];
        while (!isOp(')')) {
          args.push(parseExpr());
          if (!isOp(')')) expect('op', ',');
        }
        next();
        return { kind: 'Call', name: t.value, args, ...at };
      }
      return { kind: 'Name', name: t.value, ...at };
    }
    if (isKw('if')) {
      // A conditional expression: if c then a else b
      next();
      const cond = parseExpr();
      expect('kw', 'then', 'a conditional expression is written: if condition then value else other');
      const then = parseExpr();
      expect('kw', 'else', 'a conditional expression needs both values: if condition then value else other');
      const els = parseExpr();
      return { kind: 'Cond', cond, then, els, ...at };
    }
    if (isKw('fn')) {
      // A lambda: fn(x, y) => expression
      next();
      expect('op', '(', 'a lambda is written fn(x) => expression');
      const params = [];
      while (!isOp(')')) {
        const pn = ident('a parameter name');
        params.push({ name: pn.value, line: pn.line, col: pn.col });
        if (!isOp(')')) expect('op', ',');
      }
      next();
      expect('op', '=>', 'a lambda is written fn(x) => expression; its parameter types come from where it is used');
      return { kind: 'Lambda', params, body: parseExpr(), ...at };
    }
    if (isOp('(')) {
      next();
      const e = parseExpr();
      if (isOp(',')) {
        const elems = [e];
        while (isOp(',')) { next(); elems.push(parseExpr()); }
        expect('op', ')', 'a tuple is written (a, b)');
        if (elems.length > 4) fail('a tuple has 2 to 4 parts', 'for more values, declare a struct with named fields', t);
        return { kind: 'Tuple', elems, ...at };
      }
      expect('op', ')');
      return e;
    }
    if (isOp('[')) {
      next();
      if (is('id') && ahead(1).kind === 'kw' && ahead(1).value === 'in') {
        return { kind: 'Comp', ...parseRange('comprehension', ']'), ...at };
      }
      const elems = [];
      while (!isOp(']')) {
        elems.push(parseExpr());
        if (!isOp(']')) expect('op', ',');
      }
      next();
      return { kind: 'ArrayLit', elems, ...at };
    }
    if (isOp('{') && ahead(1).kind === 'op' && ahead(1).value === '}') {
      next();
      next();
      return { kind: 'MapLit', ...at };
    }
    fail(`expected an expression but found ${show(t)}`,
      t.kind === 'kw' && t.value === 'not' ? "'not' binds looser than comparisons; put it in brackets: a == (not b)"
        : t.kind === 'op' && t.value === '?' ? 'the ? operator goes at the very end of a let, an assignment or a call statement: let x = f()?'
          : undefined);
  }

  const program = { fns: [], tests: [], structs: [], enums: [], consts: [], imports: [], decls: [], comments: toks.comments };
  while (!is('eof')) {
    let d;
    // private: usable only inside the file that declares it
    const isPrivate = isKw('private');
    if (isPrivate) {
      next();
      if (!isKw('fn') && !isKw('struct') && !isKw('enum') && !isKw('let')) fail(`'private' must be followed by fn, struct or enum, but found ${show(peek())}`);
    }
    if (isKw('fn')) { d = parseFn(); program.fns.push(d); }
    else if (isKw('test')) { d = parseTest(); program.tests.push(d); }
    else if (isKw('struct')) { d = parseStruct(); program.structs.push(d); }
    else if (isKw('enum')) { d = parseEnum(); program.enums.push(d); }
    else if (isKw('import')) { d = parseImport(); program.imports.push(d); }
    else if (isKw('let')) {
      // A constant: let LIMIT = 5000
      const kw = next();
      const name = ident('a constant name');
      expect('op', '=', 'a constant is written: let NAME = value');
      d = ended({ kind: 'Const', name: name.value, init: parseExpr(), line: kw.line, col: name.col });
      program.consts.push(d);
    }
    else {
      fail(`expected 'fn', 'struct', 'enum', 'let', 'import' or 'test' at top level but found ${show(peek())}`,
        isKw('var') ? 'there are no global variables; a top-level let is a constant' : 'all code lives inside functions; the program starts at fn main()');
    }
    if (isPrivate) d.private = true;
    program.decls.push(d);
  }
  return program;
}
