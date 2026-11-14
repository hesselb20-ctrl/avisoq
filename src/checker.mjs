// Avisoq checker: types, generics, effects, contracts, mutability and sharing.
// Annotates the AST for the backends and instantiates generic declarations on demand.
import { elemOf, isArr, isMap, mangle, mapParts, showType, substType, typeArgs, typeHead, unify, walk } from './types.mjs';

export const EFFECTS = new Set(['io', 'time', 'fs', 'net']);
const BUILTIN_EFFECTS = { print: 'io', now_ms: 'time', read_file: 'fs', write_file: 'fs', file_exists: 'fs', http_get: 'net', http_post: 'net' };
const BUILTINS = new Set(['print', 'len', 'array', 'float', 'int', 'sqrt', 'now_ms', 'str', 'substr', 'byte_at',
  'put', 'get', 'get_or', 'has', 'keys', 'remove', 'copy', 'push', 'pop', 'read_file', 'write_file', 'file_exists', 'http_get', 'http_post']);
const BASE_TYPES = new Set(['Int', 'Float', 'Bool', 'Str']);
const RESERVED_TYPES = new Set([...BASE_TYPES, 'Unit', 'Map', 'Fn']);
// Constraints a type parameter can carry: fn max[T: Ord](a: T, b: T) -> T
const BOUNDS = {
  Ord: { types: new Set(['Int', 'Float', 'Str']), what: 'ordering with < and >' },
  Eq: { types: new Set(['Int', 'Float', 'Bool', 'Str']), what: 'comparison with == and !=' },
  Num: { types: new Set(['Int', 'Float']), what: 'arithmetic' },
};

export function check(program, diags) {
  let currentFile;
  const err = (code, message, node, hint) => {
    const file = node.file ?? currentFile;
    diags.push({ code, severity: 'error', message, ...(file ? { file } : {}), line: node.line, col: node.col, ...(hint ? { hint } : {}) });
  };

  // ---- declarations ----
  const typeDecls = new Map(); // struct and enum declarations by name (generic or not)
  const variants = new Map(); // variant name -> { decl, index }
  const structs = new Map(); // concrete type string -> { name, fields }
  const enums = new Map(); // concrete type string -> { name, variants }
  const fns = new Map(); // concrete functions by name
  const fnTemplates = new Map(); // generic functions by name
  const fnInstances = new Map(); // 'name[Args]' -> instantiated function
  let lambdaCount = 0;
  const growCalls = []; // every call, for working out which array parameters may grow
  const taken = (name) => typeDecls.has(name) || variants.has(name) || fns.has(name) || fnTemplates.has(name);

  for (const d of [...program.structs, ...program.enums]) {
    currentFile = d.file;
    const what = d.kind === 'Struct' ? 'struct' : 'enum';
    if (RESERVED_TYPES.has(d.name)) err('E0102', `'${d.name}' is a built-in type and cannot be redefined`, d);
    else if (taken(d.name)) err('E0102', `'${d.name}' is defined more than once`, d, 'type and variant names must be unique in a program');
    else typeDecls.set(d.name, d);
    if (d.kind === 'Struct') {
      const seen = new Set();
      if (d.fields.length === 0) err('E0106', `struct '${d.name}' has no fields`, d, 'a struct needs at least one field');
      for (const f of d.fields) {
        if (seen.has(f.name)) err('E0102', `field '${f.name}' appears twice in ${what} '${d.name}'`, f);
        seen.add(f.name);
      }
    }
  }
  for (const d of program.enums) {
    currentFile = d.file;
    d.variants.forEach((v, index) => {
      if (RESERVED_TYPES.has(v.name) || taken(v.name)) {
        err('E0102', `variant '${v.name}' clashes with another type, variant or function of the same name`, v, 'variant names must be unique in a program');
      } else {
        variants.set(v.name, { decl: d, index });
      }
    });
  }

  // A private declaration can only be named from the file that declares it.
  const visible = (decl, node) => {
    const from = node.file ?? currentFile;
    if (!decl.private || decl.file === from) return true;
    err('E0702', `'${decl.name}' is private to ${decl.file ?? 'its module'}`, node, 'only declarations without private can be used from another file');
    return false;
  };

  function instantiateType(decl, args, t) {
    const map = new Map(decl.typeParams.map((p, i) => [p, args[i]]));
    const fieldsOf = (fields) => fields.map((f) => ({ ...f, ty: substType(f.ty, map), file: decl.file }));
    if (decl.kind === 'Struct') {
      const s = { name: t, decl, fields: fieldsOf(decl.fields) };
      structs.set(t, s);
      for (const f of s.fields) f.ok = validType(f.ty, { line: f.tyLine, col: f.tyCol, file: decl.file });
    } else {
      const e = { name: t, decl, variants: decl.variants.map((v, index) => ({ name: v.name, index, fields: fieldsOf(v.fields) })) };
      enums.set(t, e);
      for (const v of e.variants) for (const f of v.fields) f.ok = validType(f.ty, { line: f.tyLine, col: f.tyCol, file: decl.file });
    }
  }

  function validType(t, node) {
    if (isArr(t)) return validType(elemOf(t), node);
    if (BASE_TYPES.has(t)) return true;
    if (structs.has(t) || enums.has(t)) return visible((structs.get(t) ?? enums.get(t)).decl, node);
    const head = typeHead(t), args = typeArgs(t);
    if (head === 'Fn') {
      err('E0230', 'a function type can only be the type of a parameter', node,
        'functions can be passed to other functions, but not stored in variables, fields or arrays, and not returned');
      return false;
    }
    if (head === 'Map') {
      if (args.length !== 2) { err('E0214', 'a map type is written Map[KeyType, ValueType]', node); return false; }
      if (args[0] !== 'Int' && args[0] !== 'Str') {
        err('E0107', `map keys must be Int or Str, but got ${args[0]}`, node, 'use an Int id or a Str name as the key');
        return false;
      }
      return validType(args[1], node);
    }
    const decl = typeDecls.get(head);
    if (!decl) {
      err('E0005', `unknown type '${head}'`, node,
        `types are Int, Float, Bool, Str, arrays written [T], maps written Map[K, V]${typeDecls.size ? `, and the declared types ${[...typeDecls.keys()].join(', ')}` : ', and structs and enums you define'}`);
      return false;
    }
    if (!visible(decl, node)) return false;
    if (decl.typeParams.length !== args.length) {
      err('E0214', `'${head}' takes ${decl.typeParams.length} type argument${decl.typeParams.length === 1 ? '' : 's'}, but ${args.length} ${args.length === 1 ? 'was' : 'were'} given`, node,
        decl.typeParams.length ? `write ${head}[${decl.typeParams.join(', ')}] with real types` : `write just ${head}`);
      return false;
    }
    if (t.length > 300) { err('E0105', `type '${head}' expands without end`, node); return false; }
    if (!args.every((a) => validType(a, node))) return false;
    if (!checkBounds(decl, new Map(decl.typeParams.map((tp, i) => [tp, args[i]])), node)) return false;
    instantiateType(decl, args, t);
    return true;
  }

  // Non-generic types exist from the start.
  for (const d of typeDecls.values()) {
    currentFile = d.file;
    if (d.typeParams.length === 0) validType(d.name, d);
  }

  // Does a value of this type hold an array or a map anywhere inside it?
  const containerMemo = new Map();
  function hasContainer(t) {
    if (isArr(t) || isMap(t)) return true;
    if (containerMemo.has(t)) return containerMemo.get(t);
    containerMemo.set(t, false);
    const s = structs.get(t), e = enums.get(t);
    const r = s ? s.fields.some((f) => hasContainer(f.ty)) : e ? e.variants.some((v) => v.fields.some((f) => hasContainer(f.ty))) : false;
    containerMemo.set(t, r);
    return r;
  }
  const mapOfContainers = (t, seen = new Set()) => {
    if (isArr(t)) return mapOfContainers(elemOf(t), seen);
    if (isMap(t)) return hasContainer(mapParts(t)[1]);
    if (seen.has(t)) return false;
    seen.add(t);
    const s = structs.get(t), e = enums.get(t);
    if (s) return s.fields.some((f) => mapOfContainers(f.ty, seen));
    if (e) return e.variants.some((v) => v.fields.some((f) => mapOfContainers(f.ty, seen)));
    return false;
  };

  // ---- function signatures ----
  function setupSignature(f) {
    currentFile = f.file;
    f.cname = mangle(f.name);
    f.effectSet = new Set();
    for (const e of f.effects) {
      if (!EFFECTS.has(e.name)) err('E0304', `unknown effect '${e.name}'`, e, `known effects are: ${[...EFFECTS].join(', ')}`);
      else f.effectSet.add(e.name);
    }
    for (const p of f.params) if (!validType(p.ty, p)) p.ty = '?';
    if (f.ret !== 'Unit' && !validType(f.ret, f)) f.ret = '?';
  }
  const concreteFns = [];
  for (const f of program.fns) {
    currentFile = f.file;
    if (BUILTINS.has(f.name) || f.name === 'sum') {
      err('E0102', `'${f.name}' is a built-in function and cannot be redefined`, f, 'pick a different function name');
    } else if (taken(f.name)) {
      err('E0102', `'${f.name}' is defined more than once`, f, 'function, type and variant names must be unique in a program');
    } else if (f.typeParams.length || f.params.some((prm) => typeHead(prm.ty) === 'Fn')) {
      fnTemplates.set(f.name, f);
      continue;
    } else {
      fns.set(f.name, f);
    }
    if (!fnTemplates.has(f.name) || fnTemplates.get(f.name) !== f) { setupSignature(f); concreteFns.push(f); }
  }
  program.usedBuiltins = new Set();
  program.usesStrings = false;
  program.usesSum = false;
  program.usesMaps = false;
  program.copyTypes = new Set();

  // Does the type bound to a constrained parameter support what the constraint promises?
  function checkBounds(decl, bound, node) {
    let ok = true;
    for (const tp of decl.typeParams) {
      const need = decl.typeBounds?.[tp];
      if (!need) continue;
      if (!BOUNDS[need]) {
        err('E0220', `unknown constraint '${need}' on type parameter ${tp} of '${decl.name}'`, decl, `constraints are: ${Object.keys(BOUNDS).join(', ')}`);
        ok = false;
      } else if (!BOUNDS[need].types.has(bound.get(tp))) {
        err('E0220', `'${decl.name}' needs a type that supports ${BOUNDS[need].what} (${tp}: ${need}), but ${showType(bound.get(tp))} does not`, node,
          `${need} is satisfied by: ${[...BOUNDS[need].types].join(', ')}`);
        ok = false;
      }
    }
    return ok;
  }

  // fnArgs: parameter index -> { fn, captures: [{ ty, node }] } for function-valued parameters.
  // Such a parameter disappears: the instance calls the given function directly, and the
  // values a lambda captured arrive as extra hidden parameters.
  function instantiateFn(tmpl, bound, fnArgs = new Map(), node = tmpl) {
    const args = tmpl.typeParams.map((tp) => bound.get(tp));
    const key = `${tmpl.name}${args.length ? `[${args.join(',')}]` : ''}${fnArgs.size ? `<${[...fnArgs.values()].map((b) => b.fn.name).join(',')}>` : ''}`;
    if (fnInstances.has(key)) return fnInstances.get(key);
    if (!checkBounds(tmpl, bound, node)) return null;
    const f = structuredClone(tmpl);
    const map = new Map(tmpl.typeParams.map((tp, i) => [tp, args[i]]));
    f.name = key;
    f.generic = tmpl.name;
    f.typeParams = [];
    for (const prm of f.params) prm.ty = substType(prm.ty, map);
    if (f.ret !== 'Unit') f.ret = substType(f.ret, map);
    for (const st of f.body) walk(st, (n) => { if (n.kind === 'Let' && n.ty) n.ty = substType(n.ty, map); });
    f.fnParams = new Map();
    const kept = [], hidden = [];
    f.params.forEach((prm, i) => {
      const b = fnArgs.get(i);
      if (!b) { kept.push(prm); return; }
      const capNames = b.captures.map((c, k) => {
        hidden.push({ name: `__cap${i}_${k}`, ty: c.ty, mut: false, line: prm.line, col: prm.col, file: prm.file });
        return `__cap${i}_${k}`;
      });
      f.fnParams.set(prm.name, { fn: b.fn, capNames, ty: prm.ty });
    });
    f.params = [...kept, ...hidden];
    fnInstances.set(key, f);
    const saved = currentFile;
    setupSignature(f);
    for (const b of fnArgs.values()) for (const eff of b.fn.effectSet) f.effectSet.add(eff);
    concreteFns.push(f);
    checkBody(f, false);
    currentFile = saved;
    return f;
  }

  function checkBody(owner, isTest) {
    currentFile = owner.file;
    const ret = isTest ? 'Unit' : owner.ret;
    const allowed = isTest ? new Set() : owner.effectSet;
    const label = isTest ? `test "${owner.name}"` : `function '${owner.name}'`;
    const locals = [];
    const scopes = [new Map()];
    let inContract = null;
    let inSum = 0;
    owner.locals = locals;
    let lambdaEffects = null; // effects used by the lambda being checked
    let inLambda = 0;
    const loopStack = []; // the loops (and sums, comprehensions) around the current code
    const moves = []; // whole values that may move into a new home if never used again

    const lookup = (name) => {
      for (let i = scopes.length - 1; i >= 0; i--) {
        const s = scopes[i].get(name);
        if (s) return s;
      }
      return null;
    };
    const declare = (name, ty, node, extra = {}) => {
      const sym = { name, ty, mutable: false, declLoop: loopStack[loopStack.length - 1] ?? null,
        decl: { file: node.file ?? currentFile, line: node.line, col: node.col }, ...extra };
      if (lookup(name)) {
        err('E0103', `'${name}' is already defined in this scope or an enclosing one`, node,
          'Avisoq does not allow shadowing; choose a new name');
      } else if (taken(name) || BUILTINS.has(name)) {
        err('E0103', `'${name}' is the name of a function, type or variant`, node, 'choose a different variable name');
      }
      scopes[scopes.length - 1].set(name, sym);
      if (!sym.isParam) locals.push(sym);
      return sym;
    };
    const temp = (ty) => { const s = { name: '<tmp>', ty }; locals.push(s); return s; };

    if (!isTest) {
      owner.paramSyms = owner.params.map((p) => declare(p.name, p.ty, p, { isParam: true, mutParam: p.mut }));
      // Function-valued parameters are names for the functions this instance was built with.
      for (const [name, b] of owner.fnParams ?? []) {
        scopes[0].set(name, { name, ty: b.ty, isParam: true, fnBinding: { fn: b.fn, captureSyms: b.capNames.map((n) => lookup(n)) } });
      }
      if (ret !== 'Unit') { owner.resultSym = { name: 'result', ty: ret, isResult: true }; locals.push(owner.resultSym); }
    }

    const useEffect = (effect, node, what) => {
      if (lambdaEffects) lambdaEffects.add(effect);
      if (inContract) {
        err('E0302', `${inContract} clauses must be pure, but ${what} uses the '${effect}' effect`, node,
          'contracts may only call functions that declare no effects');
      } else if (inSum) {
        err('E0305', `the body of a sum or comprehension must be pure, but ${what} uses the '${effect}' effect`, node,
          'iterations may run in parallel and in any order; use a for loop for effectful work');
      } else if (!allowed.has(effect)) {
        err('E0301', `${label} performs '${effect}' through ${what} but does not declare it`, node,
          isTest ? 'tests are pure; move the effectful call out of the test'
            : `add 'uses ${[...allowed, effect].join(', ')}' to the signature of '${owner.generic ?? owner.name}', or remove the call`);
      }
    };

    const mismatch = (t, expected, what, node) => {
      let hint;
      if (t === 'Int' && expected === 'Float') hint = 'convert explicitly with float(x); Avisoq never converts implicitly';
      if (t === 'Float' && expected === 'Int') hint = 'convert explicitly with int(x), which truncates toward zero';
      if (expected === 'Str' && ['Int', 'Float', 'Bool'].includes(t)) hint = 'convert explicitly with str(x)';
      err('E0201', `${what} must be ${expected} but is ${t}`, node, hint);
    };
    const want = (e, expected, what) => {
      if (e.kind === 'ArrayLit' && e.elems.length === 0 && isArr(expected)) {
        e.ty = expected;
        e.tmpSym = temp(expected);
        return expected;
      }
      if (e.kind === 'MapLit' && isMap(expected)) {
        e.ty = expected;
        program.usesMaps = true;
        return expected;
      }
      const t = expr(e, expected !== '?' ? expected : undefined);
      if (t !== '?' && expected !== '?' && t !== expected) mismatch(t, expected, what, e);
      return t;
    };

    // The binding a value lives in: a, a[i], a.f, get(a, k). Null for a freshly made value.
    const placeRoot = (e) => {
      for (;;) {
        if (e.kind === 'Index' || e.kind === 'Field') e = e.base;
        else if (e.kind === 'Call' && !e.fn && (e.name === 'get' || e.name === 'get_or')) e = e.args[0];
        else break;
      }
      return e.kind === 'Name' && e.sym ? e.sym : null;
    };
    const canMutate = (sym) => sym.mutable || sym.mutParam;
    // Arrays and maps are never shared between bindings: storing one somewhere new needs a fresh value.
    const owned = (e, what) => {
      if (!e.ty || e.ty === '?' || !hasContainer(e.ty)) return;
      const root = placeRoot(e);
      if (!root) return;
      const report = () => err('E0210', `${what} would share data with '${root.name}'`, e,
        `arrays and maps are never shared between bindings; wrap the value in copy(...), or make this the last use of '${root.name}' so it can move`);
      // A whole local value moves, without a copy, when this is the last time it is used.
      if (e.kind === 'Name' && !root.isParam && !root.view && !root.isLoop) {
        moves.push({ sym: root, node: e, loop: loopStack[loopStack.length - 1] ?? null, report });
        return;
      }
      report();
    };

    function expr(e, hint) {
      e.ty = exprInner(e, hint);
      return e.ty;
    }

    // Builds a struct or an enum variant. `decl` is the declaration, `declFields` its field list.
    function construct(e, decl, declFields, variantIndex, hint) {
      const label2 = variantIndex === null ? `struct '${decl.name}'` : `variant '${e.name}'`;
      const order = declFields.map((f) => f.name).join(', ');
      if (e.fields.length !== declFields.length || e.fields.some((f, i) => f.name !== declFields[i].name)) {
        err('E0209', declFields.length ? `${label2} must be built with exactly these fields in this order: ${order}` : `${label2} has no fields`, e,
          declFields.length ? `write ${e.name}(${declFields.map((f) => `${f.name}: ...`).join(', ')})` : `write just ${e.name}`);
        e.fields.forEach((f) => expr(f.expr));
        return '?';
      }
      const params = new Set(decl.typeParams), bound = new Map();
      if (hint && typeHead(hint) === decl.name) typeArgs(hint).forEach((a, i) => bound.set(decl.typeParams[i], a));
      let ok = true;
      e.fields.forEach((f, i) => {
        const open = [...declFields[i].ty.matchAll(/[A-Za-z_][A-Za-z0-9_]*/g)].some((m) => params.has(m[0]) && !bound.has(m[0]));
        if (!open) {
          const ft = substType(declFields[i].ty, bound);
          if (validType(ft, f)) want(f.expr, ft, `field '${f.name}'`); else { expr(f.expr); ok = false; }
        } else {
          const t = expr(f.expr);
          if (t === '?') ok = false;
          else if (!unify(declFields[i].ty, t, params, bound)) { mismatch(t, substType(declFields[i].ty, bound), `field '${f.name}'`, f.expr); ok = false; }
        }
        owned(f.expr, `field '${f.name}'`);
      });
      const missing = decl.typeParams.filter((p) => !bound.has(p));
      if (ok && missing.length) {
        err('E0213', `cannot work out type parameter ${missing.join(', ')} of '${decl.name}' here`, e,
          `give the value a type from context, for example: let x: ${decl.name}[${decl.typeParams.map(() => 'Int').join(', ')}] = ...`);
        ok = false;
      }
      if (!ok) return '?';
      const t = decl.typeParams.length ? `${decl.name}[${decl.typeParams.map((p) => bound.get(p)).join(',')}]` : decl.name;
      if (!validType(t, e)) return '?';
      e.variantIndex = variantIndex;
      e.tmpSym = temp(t);
      return t;
    }

    function exprInner(e, hint) {
      switch (e.kind) {
        case 'IntLit': return 'Int';
        case 'FloatLit': return 'Float';
        case 'BoolLit': return 'Bool';
        case 'StrLit': return 'Str';
        case 'Name': {
          if (e.name === 'result' && inContract === 'ensures' && owner.resultSym) {
            e.sym = owner.resultSym;
            return e.sym.ty;
          }
          const sym = lookup(e.name);
          if (sym && sym.fnBinding) {
            err('E0232', `'${e.name}' is a function parameter; it can only be called or passed to another function`, e);
            return '?';
          }
          if (sym) { e.sym = sym; (sym.uses ??= []).push(e); return sym.ty; }
          const v = variants.get(e.name);
          if (v) {
            // A variant without fields is written as a bare name.
            e.kind = 'New';
            e.fields = [];
            return construct(e, v.decl, v.decl.variants[v.index].fields, v.index, hint);
          }
          const td = typeDecls.get(e.name);
          err('E0101', `unknown name '${e.name}'`, e,
            fns.has(e.name) || fnTemplates.has(e.name) || BUILTINS.has(e.name) ? `'${e.name}' is a function; call it with ${e.name}(...)`
              : td && td.kind === 'Struct' ? `'${e.name}' is a struct; build a value with ${e.name}(${td.fields.map((f) => `${f.name}: ...`).join(', ')})`
                : td ? `'${e.name}' is an enum; use one of its variants: ${td.variants.map((x) => x.name).join(', ')}`
                  : e.name === 'result' ? "'result' is only available inside an ensures clause of a function that returns a value"
                    : 'declare it first with let or var');
          return '?';
        }
        case 'Unary': {
          if (e.op === 'not') { want(e.operand, 'Bool', "operand of 'not'"); return 'Bool'; }
          const t = expr(e.operand);
          if (t === '?') return '?';
          if (t !== 'Int' && t !== 'Float') {
            err('E0201', `unary '-' needs Int or Float but got ${t}`, e);
            return '?';
          }
          return t;
        }
        case 'Binary': {
          if (e.op === 'and' || e.op === 'or') {
            want(e.left, 'Bool', `left side of '${e.op}'`);
            want(e.right, 'Bool', `right side of '${e.op}'`);
            return 'Bool';
          }
          const l = expr(e.left), r = expr(e.right);
          const isCmp = ['==', '!=', '<', '<=', '>', '>='].includes(e.op);
          if (l === '?' || r === '?') return isCmp ? 'Bool' : '?';
          if (l !== r) {
            const mixed = (l === 'Int' && r === 'Float') || (l === 'Float' && r === 'Int');
            const strMix = e.op === '+' && (l === 'Str' || r === 'Str');
            err('E0201', `operator '${e.op}' needs both sides to have the same type, but got ${l} and ${r}`, e,
              mixed ? 'convert explicitly with float(x) or int(x); Avisoq never converts implicitly'
                : strMix ? 'convert the other side with str(x) before joining strings' : undefined);
            return isCmp ? 'Bool' : '?';
          }
          if (e.op === '==' || e.op === '!=') {
            if (!BASE_TYPES.has(l)) {
              err('E0201', `'${e.op}' is not defined for ${l}`, e,
                enums.has(l) ? 'use match to look inside an enum value' : 'only Int, Float, Bool and Str can be compared for equality; compare fields or elements instead');
            }
            if (l === 'Str') program.usesStrings = true;
            return 'Bool';
          }
          if (l === 'Str' && (e.op === '+' || isCmp)) { program.usesStrings = true; return isCmp ? 'Bool' : 'Str'; }
          if (l !== 'Int' && l !== 'Float') {
            err('E0201', `operator '${e.op}' is not defined for ${l}`, e, 'arithmetic and ordering work on Int and Float');
            return isCmp ? 'Bool' : '?';
          }
          if (e.op === '%' && l !== 'Int') {
            err('E0201', "operator '%' is only defined for Int", e);
            return '?';
          }
          return isCmp ? 'Bool' : l;
        }
        case 'Index': {
          const b = expr(e.base);
          want(e.index, 'Int', 'array index');
          if (b === '?') return '?';
          if (!isArr(b)) {
            err('E0201', `only arrays can be indexed, but this is ${b}`, e.base,
              b === 'Str' ? 'use byte_at(s, i) or substr(s, start, end) on strings' : isMap(b) ? 'use get(m, key) to read a map' : undefined);
            return '?';
          }
          return elemOf(b);
        }
        case 'Field': {
          const b = expr(e.base);
          if (b === '?') return '?';
          const s = structs.get(b);
          if (!s) {
            err('E0208', `${b} has no fields`, e,
              isArr(b) || isMap(b) || b === 'Str' ? 'use len(x) for the length' : enums.has(b) ? 'use match to read the fields of an enum variant' : undefined);
            return '?';
          }
          const idx = s.fields.findIndex((f) => f.name === e.name);
          if (idx < 0) {
            err('E0208', `struct '${b}' has no field '${e.name}'`, e, `fields of ${b} are: ${s.fields.map((f) => f.name).join(', ')}`);
            return '?';
          }
          e.fieldIndex = idx;
          return s.fields[idx].ok ? s.fields[idx].ty : '?';
        }
        case 'New': {
          const td = typeDecls.get(e.name);
          if (td && td.kind === 'Struct') { visible(td, e); return construct(e, td, td.fields, null, hint); }
          const v = variants.get(e.name);
          if (v) visible(v.decl, e);
          if (v) return construct(e, v.decl, v.decl.variants[v.index].fields, v.index, hint);
          err('E0203', `unknown struct or variant '${e.name}'`, e,
            fns.has(e.name) || fnTemplates.has(e.name) ? `'${e.name}' is a function; call it without field names`
              : td ? `'${e.name}' is an enum; build one of its variants: ${td.variants.map((x) => x.name).join(', ')}`
                : 'define it with: struct Name { field: Type }');
          e.fields.forEach((f) => expr(f.expr));
          return '?';
        }
        case 'ArrayLit': {
          if (e.elems.length === 0) {
            err('E0207', 'empty array literal has no element type', e, 'give the type from context, for example: let xs: [Int] = []');
            return '?';
          }
          const eh = hint && isArr(hint) ? elemOf(hint) : undefined;
          const t = expr(e.elems[0], eh);
          for (let i = 1; i < e.elems.length; i++) {
            if (t === '?') expr(e.elems[i]);
            else want(e.elems[i], t, 'array element');
          }
          for (const el of e.elems) owned(el, 'this array element');
          if (t === '?' || t === 'Unit') return '?';
          e.tmpSym = temp(`[${t}]`);
          return `[${t}]`;
        }
        case 'Lambda':
          err('E0232', 'a lambda can only be written as the argument for a function parameter', e, 'for example: map(xs, fn(x) => x * 2)');
          return '?';
        case 'MapLit':
          err('E0207', 'an empty map {} has no key and value type here', e, 'give the type from context, for example: var m: Map[Str, Int] = {}');
          return '?';
        case 'Sum':
        case 'Comp': {
          const isSum = e.kind === 'Sum';
          if (isSum) program.usesSum = true;
          want(e.start, 'Int', 'range start');
          want(e.end, 'Int', 'range end');
          scopes.push(new Map());
          e.sym = declare(e.name, 'Int', { line: e.nameLine, col: e.nameCol }, { isLoop: true });
          e.endSym = temp('Int');
          inSum++;
          loopStack.push(e);
          let t = expr(e.body, !isSum && hint && isArr(hint) ? elemOf(hint) : undefined);
          loopStack.pop();
          inSum--;
          scopes.pop();
          if (isSum) {
            if (t !== '?' && t !== 'Int' && t !== 'Float') {
              err('E0201', `a sum adds Int or Float values, but its body is ${t}`, e.body);
              t = '?';
            }
            e.accSym = temp(t === 'Float' ? 'Float' : 'Int');
            e.accHiSym = temp('Int');
            return t;
          }
          if (t === 'Unit') {
            err('E0201', 'the body of a comprehension must produce a value', e.body);
            t = '?';
          }
          if (t === '?') return '?';
          owned(e.body, 'each element');
          e.arrSym = temp(`[${t}]`);
          e.curSym = temp(`[${t}]`);
          return `[${t}]`;
        }
        case 'Call':
          return call(e, hint);
        default:
          throw new Error(`checker: unknown expr ${e.kind}`);
      }
    }

    const argc = (e, n) => {
      if (e.args.length !== n) {
        err('E0202', `'${e.name}' takes ${n} argument${n === 1 ? '' : 's'} but ${e.args.length} ${e.args.length === 1 ? 'was' : 'were'} given`, e);
        e.args.forEach((a) => expr(a));
        return false;
      }
      return true;
    };

    const impure = (e, what) => {
      if (inContract) err('E0302', `${inContract} clauses must be pure, but ${what}`, e);
      else if (inLambda) err('E0231', `a lambda cannot change data outside itself, but ${what}`, e, 'do the change in a for loop, or return the new value from the lambda');
      else if (inSum) err('E0305', `the body of a sum or comprehension must be pure, but ${what}`, e, 'iterations may run in parallel; use a for loop for this');
    };
    const needMutable = (arg, action) => {
      const root = placeRoot(arg);
      if (!root || !canMutate(root)) {
        err('E0204', `cannot ${action} ${root ? `'${root.name}'` : 'a temporary value'} because it is immutable`, arg,
          root && root.isParam ? `declare the parameter as '${root.name}: mut ${root.ty.replace(/,/g, ', ')}'`
            : root ? `declare it with 'var ${root.name}' instead of 'let ${root.name}'` : 'bind the value to a var first');
      }
    };

    function builtin(e, hint) {
      program.usedBuiltins.add(e.name);
      if (BUILTIN_EFFECTS[e.name]) useEffect(BUILTIN_EFFECTS[e.name], e, `built-in '${e.name}'`);
      switch (e.name) {
        case 'print':
          for (const a of e.args) {
            const t = expr(a);
            if (t !== '?' && !BASE_TYPES.has(t)) {
              err('E0201', `print cannot display a value of type ${t}`, a, 'print accepts Int, Float, Bool and Str; print fields or elements individually');
            }
          }
          e.argTmps = e.args.map((a) => temp(a.ty === '?' ? 'Int' : a.ty));
          return 'Unit';
        case 'len': {
          if (!argc(e, 1)) return 'Int';
          const t = expr(e.args[0]);
          if (t !== '?' && !isArr(t) && !isMap(t) && t !== 'Str') err('E0201', `len needs an array, a Map or a Str but got ${t}`, e.args[0]);
          return 'Int';
        }
        case 'array': {
          if (!argc(e, 2)) return '?';
          want(e.args[0], 'Int', 'array length');
          const t = expr(e.args[1], hint && isArr(hint) ? elemOf(hint) : undefined);
          if (t === '?' || t === 'Unit') return '?';
          if (hasContainer(t)) {
            err('E0210', 'array(n, value) would make every element share the same array or map', e.args[1],
              'build each element separately with a comprehension, for example [i in 0..n: array(m, 0)]');
          }
          return `[${t}]`;
        }
        case 'float': if (argc(e, 1)) want(e.args[0], 'Int', 'argument of float'); return 'Float';
        case 'int': if (argc(e, 1)) want(e.args[0], 'Float', 'argument of int'); return 'Int';
        case 'sqrt': if (argc(e, 1)) want(e.args[0], 'Float', 'argument of sqrt'); return 'Float';
        case 'now_ms': argc(e, 0); return 'Float';
        case 'str': {
          program.usesStrings = true;
          if (!argc(e, 1)) return 'Str';
          const t = expr(e.args[0]);
          if (t !== '?' && !['Int', 'Float', 'Bool'].includes(t)) err('E0201', `str converts Int, Float or Bool, but got ${t}`, e.args[0]);
          return 'Str';
        }
        case 'substr':
          program.usesStrings = true;
          if (argc(e, 3)) {
            want(e.args[0], 'Str', 'first argument of substr');
            want(e.args[1], 'Int', 'start of substr');
            want(e.args[2], 'Int', 'end of substr');
          }
          return 'Str';
        case 'byte_at':
          program.usesStrings = true;
          if (argc(e, 2)) {
            want(e.args[0], 'Str', 'first argument of byte_at');
            want(e.args[1], 'Int', 'index of byte_at');
          }
          return 'Int';
        case 'read_file': case 'http_get': case 'http_post': case 'write_file': {
          // Failures come back as values: Ok(value) or Err(error), never as a crash.
          program.usesStrings = true;
          const sig = { read_file: ['Str'], http_get: ['Str'], http_post: ['Str', 'Str', 'Str'], write_file: ['Str', 'Str'] }[e.name];
          if (argc(e, sig.length)) sig.forEach((t, i) => want(e.args[i], t, `argument ${i + 1} of ${e.name}`));
          const rt = e.name === 'write_file' ? 'Result[Int,Str]' : 'Result[Str,Str]';
          if (!typeDecls.has('Result') || !validType(rt, e)) return '?';
          e.tmpSym = temp(rt);
          return rt;
        }
        case 'file_exists':
          program.usesStrings = true;
          if (argc(e, 1)) want(e.args[0], 'Str', 'argument of file_exists');
          return 'Bool';
        case 'copy': {
          if (!argc(e, 1)) return '?';
          const t = expr(e.args[0], hint);
          if (t === '?') return '?';
          if (mapOfContainers(t)) {
            err('E0212', `copy cannot yet duplicate a map whose values hold arrays or maps (${t})`, e.args[0], 'copy the values one by one into a new map');
          } else if (hasContainer(t)) {
            program.copyTypes.add(t);
          }
          return t;
        }
        case 'push': case 'pop': {
          const isPush = e.name === 'push';
          if (!argc(e, isPush ? 2 : 1)) return isPush ? 'Unit' : '?';
          const at = expr(e.args[0]);
          if (at === '?' || !isArr(at)) {
            if (at !== '?') err('E0201', `${e.name} needs an array but got ${at}`, e.args[0]);
            if (isPush) expr(e.args[1]);
            return isPush ? 'Unit' : '?';
          }
          const a0 = e.args[0];
          impure(e, `${e.name} modifies an array`);
          if (a0.kind !== 'Name' || !a0.sym || !canMutate(a0.sym)) {
            err('E0221', `${e.name} needs a mutable array variable`, a0,
              a0.kind === 'Name' ? `declare '${a0.name}' with var, or as a mut parameter` : `${e.name} works on a named variable; bind the array to a var first`);
          } else if (isPush && a0.sym.isParam) {
            owner.params[owner.paramSyms.indexOf(a0.sym)].grows = true; // the caller's variable must follow a reallocation
          }
          if (!isPush) return elemOf(at);
          want(e.args[1], elemOf(at), 'pushed value');
          owned(e.args[1], 'the pushed value');
          e.tmpSym = temp(elemOf(at));
          return 'Unit';
        }
        case 'put': case 'get': case 'get_or': case 'has': case 'keys': case 'remove': {
          program.usesMaps = true;
          const n = { put: 3, get: 2, get_or: 3, has: 2, keys: 1, remove: 2 }[e.name];
          const fallback = e.name === 'has' || e.name === 'remove' ? 'Bool' : e.name === 'put' ? 'Unit' : '?';
          if (!argc(e, n)) return fallback;
          const mt = expr(e.args[0]);
          if (mt === '?' || !isMap(mt)) {
            if (mt !== '?') err('E0201', `${e.name} needs a Map but got ${mt}`, e.args[0]);
            e.args.slice(1).forEach((a) => expr(a));
            return fallback;
          }
          const [kt, vt] = mapParts(mt);
          if (n >= 2) want(e.args[1], kt, `key of ${e.name}`);
          if (n === 3) want(e.args[2], vt, e.name === 'put' ? 'value of put' : 'default of get_or');
          if (e.name === 'put' || e.name === 'remove') {
            impure(e, `${e.name} modifies a map`);
            needMutable(e.args[0], e.name === 'put' ? 'put into' : 'remove from');
            if (e.name === 'put') owned(e.args[2], 'the stored value');
            return e.name === 'put' ? 'Unit' : 'Bool';
          }
          if (e.name === 'get_or') owned(e.args[2], 'the default value');
          if (e.name === 'has') return 'Bool';
          if (e.name === 'keys') return `[${kt}]`;
          return vt;
        }
        default: throw new Error('unreachable');
      }
    }

    // Checks shared by plain and generic calls, once the callee and argument types are known.
    function finishCall(e, f) {
      e.fn = f;
      growCalls.push({ e, f, owner, isTest });
      for (const eff of f.effectSet) useEffect(eff, e, `call to '${f.generic ?? f.name}'`);
      f.params.forEach((p, i) => {
        if (!p.mut) return;
        const a = e.args[i];
        impure(a, `'${f.generic ?? f.name}' may modify its argument '${p.name}'`);
        const root = placeRoot(a);
        if (!root || !canMutate(root)) {
          err('E0303', `'${f.generic ?? f.name}' may modify its argument '${p.name}', so it needs a mutable array or map`, a,
            a.kind === 'Name' ? `declare '${a.name}' with var instead of let (or as a mut parameter)` : 'pass a var binding or a mut parameter');
        } else if (e.args.some((o, j) => j !== i && o.ty && o.ty !== '?' && hasContainer(o.ty) && placeRoot(o) === root)) {
          err('E0211', `'${root.name}' is passed to '${f.generic ?? f.name}' both as the mutable argument '${p.name}' and as another argument`, a,
            'the function could change data it is also reading; pass copy(...) for the other argument');
        }
      });
      return f.ret;
    }

    const nameNode = (sym, at) => ({ kind: 'Name', name: sym.name, sym, ty: sym.ty, line: at.line, col: at.col, file: at.file });

    // Works out which function is passed for a function-valued parameter.
    function bindFn(arg, prm, tmpl, params, bound, isOpen) {
      const parts = typeArgs(prm.ty), retPat = parts[0];
      const argTys = parts.slice(1).map((t) => substType(t, bound));
      if (parts.slice(1).some(isOpen)) {
        err('E0213', `cannot work out the argument types of the function given for '${prm.name}'`, arg, 'put the arguments that fix those types first');
        return null;
      }
      const bindRet = (t, node) => {
        if (retPat === 'Unit' ? t === 'Unit' : unify(retPat, t, params, bound)) return true;
        mismatch(t, retPat === 'Unit' ? 'Unit (no value)' : showType(substType(retPat, bound)), `the result of the function given for '${prm.name}'`, node);
        return false;
      };
      const fits = (f, n) => f.params.length - n === argTys.length && argTys.every((t, k) => f.params[k].ty === t && !f.params[k].mut);
      if (arg.kind === 'Lambda') {
        if (arg.params.length !== argTys.length) {
          err('E0202', `the function for '${prm.name}' takes ${argTys.length} argument${argTys.length === 1 ? '' : 's'}, but this lambda has ${arg.params.length}`, arg);
          return null;
        }
        const pristine = structuredClone(arg.body);
        const before = locals.length;
        scopes.push(new Map());
        arg.params.forEach((lp, k) => declare(lp.name, argTys[k], lp, { isLoop: true }));
        const outerEffects = lambdaEffects;
        lambdaEffects = new Set();
        inLambda++;
        const retHint = retPat !== 'Unit' && !isOpen(retPat) ? substType(retPat, bound) : undefined;
        const t = expr(arg.body, retHint);
        inLambda--;
        const effects = lambdaEffects;
        lambdaEffects = outerEffects;
        if (outerEffects) for (const x of effects) outerEffects.add(x);
        scopes.pop();
        if (t === '?' || !bindRet(t, arg.body)) return null;
        // Everything the body reads from outside is captured and passed along as a value.
        const inner = new Set(locals.slice(before));
        const caps = [];
        walk(arg.body, (n) => { if (n.kind === 'Name' && n.sym && !inner.has(n.sym) && !caps.includes(n.sym)) caps.push(n.sym); });
        const at = { line: arg.line, col: arg.col, file: arg.file };
        const lifted = {
          kind: 'Fn', name: `lambda#${++lambdaCount}`, typeParams: [], isLambda: true,
          params: [...arg.params.map((lp, k) => ({ name: lp.name, ty: argTys[k], mut: false, line: lp.line, col: lp.col, file: arg.file })),
            ...caps.map((s) => ({ name: s.name, ty: s.ty, mut: false, ...at }))],
          ret: t, effects: [], requires: [], ensures: [],
          body: [t === 'Unit' ? { kind: 'ExprStmt', expr: pristine, ...at } : { kind: 'Return', value: pristine, ...at }],
          ...at,
        };
        const saved = currentFile;
        setupSignature(lifted);
        for (const x of effects) lifted.effectSet.add(x);
        concreteFns.push(lifted);
        checkBody(lifted, false);
        currentFile = saved;
        return { fn: lifted, captures: caps.map((s) => ({ ty: s.ty, node: nameNode(s, at) })) };
      }
      if (arg.kind === 'Name') {
        const local = lookup(arg.name);
        if (local && local.fnBinding) {
          // A function parameter passed on to another function.
          const { fn: bf, captureSyms } = local.fnBinding;
          if (fits(bf, captureSyms.length) && bindRet(bf.ret, arg)) {
            return { fn: bf, captures: captureSyms.map((s) => ({ ty: s.ty, node: nameNode(s, arg) })) };
          }
          return null;
        }
        if (!local) {
          let f = fns.get(arg.name);
          const ft = fnTemplates.get(arg.name);
          if (!f && ft && ft.params.length === argTys.length && !ft.params.some((x) => typeHead(x.ty) === 'Fn')) {
            const fp = new Set(ft.typeParams), fb = new Map();
            if (ft.params.every((x, k) => unify(x.ty, argTys[k], fp, fb)) && ft.typeParams.every((tp) => fb.has(tp))) f = instantiateFn(ft, fb, new Map(), arg);
            currentFile = owner.file;
          }
          if (f && fits(f, 0)) return bindRet(f.ret, arg) ? { fn: f, captures: [] } : null;
          if (f) {
            err('E0201', `'${arg.name}' does not fit '${prm.name}', which needs ${showType(substType(prm.ty, bound))}`, arg,
              `'${arg.name}' takes (${f.params.map((x) => `${x.mut ? 'mut ' : ''}${showType(x.ty)}`).join(', ')})`);
            return null;
          }
        }
      }
      err('E0232', `'${prm.name}' needs a function: the name of a function, or a lambda such as fn(x) => x + 1`, arg);
      return null;
    }

    function call(e, hint) {
      if (BUILTINS.has(e.name)) return builtin(e, hint);
      const viaParam = lookup(e.name);
      if (viaParam && viaParam.fnBinding) {
        // Calling a function parameter: a direct call to the function this instance was built with.
        const { fn: bf, captureSyms } = viaParam.fnBinding;
        const n = bf.params.length - captureSyms.length;
        if (!argc(e, n)) return bf.ret;
        for (let i = 0; i < n; i++) want(e.args[i], bf.params[i].ty, `argument ${i + 1} of '${e.name}'`);
        e.args = [...e.args, ...captureSyms.map((s) => nameNode(s, e))];
        return finishCall(e, bf);
      }
      const f = fns.get(e.name);
      if (f) {
        visible(f, e);
        if (!argc(e, f.params.length)) return f.ret;
        f.params.forEach((p, i) => want(e.args[i], p.ty, `argument '${p.name}' of '${f.name}'`));
        return finishCall(e, f);
      }
      const tmpl = fnTemplates.get(e.name);
      if (tmpl) {
        visible(tmpl, e);
        if (!argc(e, tmpl.params.length)) return '?';
        const params = new Set(tmpl.typeParams), bound = new Map();
        const isOpen = (t) => [...t.matchAll(/[A-Za-z_][A-Za-z0-9_]*/g)].some((m) => params.has(m[0]) && !bound.has(m[0]));
        let ok = true;
        // Ordinary arguments first: they fix the type parameters the function arguments depend on.
        tmpl.params.forEach((prm, i) => {
          if (typeHead(prm.ty) === 'Fn') return;
          const open = isOpen(prm.ty);
          const t = open ? expr(e.args[i]) : want(e.args[i], substType(prm.ty, bound), `argument '${prm.name}' of '${tmpl.name}'`);
          if (t === '?') ok = false;
          else if (!unify(prm.ty, t, params, bound)) {
            if (open) mismatch(t, substType(prm.ty, bound), `argument '${prm.name}' of '${tmpl.name}'`, e.args[i]);
            ok = false;
          }
        });
        const fnArgs = new Map();
        tmpl.params.forEach((prm, i) => {
          if (!ok || typeHead(prm.ty) !== 'Fn') return;
          const b = bindFn(e.args[i], prm, tmpl, params, bound, isOpen);
          if (b) fnArgs.set(i, b); else ok = false;
        });
        if (ok && hint && tmpl.ret !== 'Unit') unify(tmpl.ret, hint, params, bound);
        const missing = tmpl.typeParams.filter((tp) => !bound.has(tp));
        if (ok && missing.length) {
          err('E0213', `cannot work out type parameter ${missing.join(', ')} of '${tmpl.name}' from the arguments`, e,
            'give the result a type from context, for example with a typed let');
          ok = false;
        }
        if (!ok) return '?';
        const inst = instantiateFn(tmpl, bound, fnArgs, e);
        currentFile = owner.file;
        if (!inst) return '?';
        // The call passes what the lambdas captured instead of the functions themselves.
        const captured = [...fnArgs.values()].flatMap((b) => b.captures.map((c) => c.node));
        e.args = [...e.args.filter((_, i) => !fnArgs.has(i)), ...captured];
        return finishCall(e, inst);
      }
      const td = typeDecls.get(e.name), v = variants.get(e.name);
      err('E0203', `unknown function '${e.name}'`, e,
        lookup(e.name) ? `'${e.name}' is a variable, not a function`
          : td && td.kind === 'Struct' ? `'${e.name}' is a struct; build it with named fields: ${e.name}(${td.fields.map((x) => `${x.name}: ...`).join(', ')})`
            : v ? `'${e.name}' is an enum variant; build it with named fields: ${e.name}(${v.decl.variants[v.index].fields.map((x) => `${x.name}: ...`).join(', ')})`
              : `built-ins are: ${[...BUILTINS].join(', ')}`);
      e.args.forEach((a) => expr(a));
      return '?';
    }

    function block(stmts) {
      scopes.push(new Map());
      for (const s of stmts) stmt(s);
      scopes.pop();
    }

    function stmt(s) {
      switch (s.kind) {
        case 'Let': {
          if (s.ty && !validType(s.ty, s)) s.ty = null;
          let t = s.ty ? want(s.init, s.ty, `initial value of '${s.name}'`) : expr(s.init);
          if (s.ty) t = s.ty;
          if (t === 'Unit') {
            err('E0201', `cannot bind '${s.name}' to a call that returns no value`, s.init);
            t = '?';
          }
          const extra = { mutable: s.mutable };
          if (s.mutable) {
            owned(s.init, `'${s.name}'`);
          } else if (s.init.ty && s.init.ty !== '?' && hasContainer(s.init.ty)) {
            const root = placeRoot(s.init);
            if (root && canMutate(root)) {
              err('E0210', `'${s.name}' would be a let that changes whenever '${root.name}' is modified`, s.init,
                'take an independent value with copy(...), or read the data directly where it is needed');
            } else if (root) {
              extra.view = true; // a read-only view of immutable data
              root.viewed = true;
            }
          }
          s.sym = declare(s.name, t, s, extra);
          break;
        }
        case 'Assign': {
          const tt = expr(s.target);
          const root = placeRoot(s.target);
          if (s.target.kind === 'Name') {
            if (root && !root.mutable) {
              err('E0204', `cannot assign to '${root.name}' because it is immutable`, s.target,
                root.isParam ? 'parameters are immutable; copy the value into a var first'
                  : root.isLoop ? 'loop variables are immutable'
                    : `declare it with 'var ${root.name}' instead of 'let ${root.name}'`);
            }
          } else if (tt !== '?' || root) {
            if (!root) {
              err('E0204', 'cannot modify elements of a temporary value', s.target, 'bind the array to a var first');
            } else if (!canMutate(root)) {
              err('E0204', `cannot modify elements of '${root.name}' because it is immutable`, s.target,
                root.isParam ? `declare the parameter as '${root.name}: mut ${root.ty}'`
                  : `declare it with 'var ${root.name}' instead of 'let ${root.name}'`);
            }
          }
          if (tt === '?') expr(s.value);
          else want(s.value, tt, 'assigned value');
          owned(s.value, 'this assignment');
          break;
        }
        case 'If':
          want(s.cond, 'Bool', 'if condition');
          block(s.then);
          if (s.els) block(s.els);
          break;
        case 'While':
          want(s.cond, 'Bool', 'while condition');
          for (const c of s.invariants ?? []) { inContract = 'invariant'; want(c.expr, 'Bool', 'loop invariant'); inContract = null; }
          loopStack.push(s);
          block(s.body);
          loopStack.pop();
          break;
        case 'For':
          want(s.start, 'Int', 'loop start');
          want(s.end, 'Int', 'loop end');
          scopes.push(new Map());
          s.sym = declare(s.name, 'Int', s, { isLoop: true });
          s.endSym = temp('Int');
          loopStack.push(s);
          for (const b of s.body) stmt(b);
          loopStack.pop();
          scopes.pop();
          break;
        case 'Match': {
          const t = expr(s.scrut);
          const scrutRoot = placeRoot(s.scrut);
          if (scrutRoot && s.arms.some((a) => a.binds.length)) scrutRoot.viewed = true;
          const en = enums.get(t);
          if (t !== '?' && !en) err('E0215', `match needs an enum value but got ${t}`, s.scrut, 'match works on values of an enum type');
          const seen = new Set();
          let hasElse = false;
          for (const arm of s.arms) {
            scopes.push(new Map());
            arm.syms = [];
            if (arm.variant === null) {
              if (hasElse) err('E0217', 'this match has more than one else arm', arm);
              hasElse = true;
            } else if (en) {
              const v = en.variants.find((x) => x.name === arm.variant);
              if (!v) {
                err('E0216', `'${arm.variant}' is not a variant of ${t}`, arm, `variants of ${t} are: ${en.variants.map((x) => x.name).join(', ')}`);
              } else {
                if (seen.has(v.name)) err('E0217', `variant '${v.name}' is matched more than once`, arm);
                seen.add(v.name);
                arm.index = v.index;
                if (arm.binds.length && arm.binds.length !== v.fields.length) {
                  err('E0218', `variant '${v.name}' has ${v.fields.length} field${v.fields.length === 1 ? '' : 's'} (${v.fields.map((f) => f.name).join(', ')}), but ${arm.binds.length} name${arm.binds.length === 1 ? ' was' : 's were'} given`, arm,
                    `write ${v.name}${v.fields.length ? `(${v.fields.map((f) => f.name).join(', ')})` : ''}, or leave the names out to ignore the fields`);
                } else {
                  arm.syms = arm.binds.map((b, i) => (b.name === '_' ? null : declare(b.name, v.fields[i].ok ? v.fields[i].ty : '?', b, { view: true, fieldIndex: i })));
                }
              }
            }
            for (const b of arm.body) stmt(b);
            scopes.pop();
          }
          if (en && !hasElse) {
            const missing = en.variants.filter((v) => !seen.has(v.name)).map((v) => v.name);
            if (missing.length) err('E0219', `match does not cover: ${missing.join(', ')}`, s, 'add an arm for each missing variant, or an else arm');
          }
          s.exhaustive = hasElse || (!!en && en.variants.every((v) => seen.has(v.name)));
          s.scrutSym = temp(en ? t : 'Int');
          break;
        }
        case 'Return':
          if (ret === 'Unit') {
            if (s.value) {
              expr(s.value);
              err('E0201', `${label} returns no value, but this return has one`, s.value,
                isTest ? undefined : `declare a return type: fn ${owner.generic ?? owner.name}(...) -> Type`);
            }
          } else if (!s.value) {
            err('E0201', `${label} must return a value of type ${ret}`, s);
          } else {
            want(s.value, ret, 'returned value');
            if (s.value.ty && s.value.ty !== '?' && hasContainer(s.value.ty)) {
              const root = placeRoot(s.value);
              if (root && (root.isParam || root.view)) {
                err('E0210', `returning this would share data with ${root.isParam ? `the caller's argument '${root.name}'` : `'${root.name}'`}`, s.value,
                  'return an independent value with copy(...)');
              }
            }
          }
          break;
        case 'Assert':
          want(s.cond, 'Bool', 'assert condition');
          break;
        case 'ExprStmt':
          if (s.expr.kind !== 'Call') {
            expr(s.expr);
            err('E0206', 'this expression computes a value that is never used', s.expr, 'bind it with let, return it, or remove it');
          } else {
            expr(s.expr);
          }
          break;
        default:
          throw new Error(`checker: unknown stmt ${s.kind}`);
      }
    }

    if (!isTest) {
      for (const c of owner.requires) { inContract = 'requires'; want(c.expr, 'Bool', 'requires clause'); }
      for (const c of owner.ensures) { inContract = 'ensures'; want(c.expr, 'Bool', 'ensures clause'); }
      inContract = null;
    }
    block(owner.body);

    for (const mv of moves) {
      const later = (mv.sym.uses ?? []).some((u) => u !== mv.node && (u.line > mv.node.line || (u.line === mv.node.line && u.col > mv.node.col)));
      if (mv.sym.viewed || mv.sym.declLoop !== mv.loop || later) mv.report(); else mv.node.moved = true;
    }

    if (ret !== 'Unit' && !alwaysReturns(owner.body)) {
      err('E0205', `${label} does not return a value on every path`, owner, `make sure every branch ends in a return of type ${ret}`);
    }
  }

  function alwaysReturns(stmts) {
    const last = stmts[stmts.length - 1];
    if (!last) return false;
    if (last.kind === 'Return') return true;
    if (last.kind === 'If') return !!last.els && alwaysReturns(last.then) && alwaysReturns(last.els);
    if (last.kind === 'Match') return !!last.exhaustive && last.arms.every((a) => alwaysReturns(a.body));
    return false;
  }

  for (const f of [...concreteFns]) checkBody(f, false);
  for (const t of program.tests) { t.cname = t.name; checkBody(t, true); }

  // An array parameter that may be pushed to can be reallocated, so the caller's variable has to
  // follow. That requirement spreads to every function that passes such a parameter along.
  for (let changed = true; changed;) {
    changed = false;
    for (const { e, f, owner, isTest } of growCalls) {
      f.params.forEach((p, i) => {
        if (!p.grows) return;
        const a = e.args[i];
        if (a.kind !== 'Name' || !a.sym) {
          if (!a.growReported) {
            a.growReported = true;
            currentFile = owner.file;
            err('E0221', `'${f.generic ?? f.name}' may add elements to its argument '${p.name}', so it needs a plain variable`, a, 'bind the array to a var first and pass that');
          }
          return;
        }
        if (!isTest && a.sym.isParam) {
          const pp = owner.params[owner.paramSyms.indexOf(a.sym)];
          if (!pp.grows) { pp.grows = true; changed = true; }
        }
      });
    }
  }
  for (const f of concreteFns) f.params.forEach((p, i) => { if (p.grows && f.paramSyms) f.paramSyms[i].byRef = true; });

  // A type may not contain itself by value (directly or through other structs and enums).
  const fieldTypes = (t) => (structs.get(t)?.fields ?? enums.get(t)?.variants.flatMap((v) => v.fields) ?? []).map((f) => f.ty);
  const byValue = (t) => fieldTypes(t).filter((x) => structs.has(x) || enums.has(x));
  const reaches = (from, target, seen = new Set()) => {
    if (seen.has(from)) return false;
    seen.add(from);
    return byValue(from).some((x) => x === target || reaches(x, target, seen));
  };
  const recursive = new Set();
  for (const t of [...structs.keys(), ...enums.keys()]) {
    if (reaches(t, t)) {
      const d = (structs.get(t) ?? enums.get(t)).decl;
      if (!d.reportedRecursive) {
        d.reportedRecursive = true;
        currentFile = d.file;
        err('E0105', `${d.kind === 'Struct' ? 'struct' : 'enum'} '${d.name}' contains itself`, d, `hold it through an array instead, for example a field of type [${d.name}]`);
      }
      recursive.add(t);
    }
  }
  // Order concrete types so that each comes after the types it holds by value.
  program.typeOrder = [];
  {
    const done = new Set();
    const visit = (t) => {
      if (done.has(t) || recursive.has(t)) return;
      done.add(t);
      for (const x of byValue(t)) visit(x);
      program.typeOrder.push(structs.has(t) ? { kind: 'struct', ...structs.get(t) } : { kind: 'enum', ...enums.get(t) });
    };
    for (const t of [...structs.keys(), ...enums.keys()]) visit(t);
  }
  program.types = { structs, enums };
  program.fns = concreteFns;

  const main = fns.get('main');
  program.main = null;
  if (main) {
    currentFile = main.file;
    if (main.params.length || main.ret !== 'Unit') {
      err('E0401', "'main' must take no parameters and return no value", main, 'write: fn main() uses io { ... }');
    } else {
      program.main = main;
    }
  }
}
