// Vow native backend: checked AST -> C (GNU C17), compiled by GCC.
import { readFileSync } from 'node:fs';
import { FAIL, failInfo } from './fail.mjs';
import { containerTest, elemOf, isArr, isMap, mangle, mapParts } from './types.mjs';

const RUNTIME = readFileSync(new URL('./runtime.c', import.meta.url), 'utf8');

const ctype = (t) => (t === 'Int' ? 'int64_t' : t === 'Float' ? 'double' : t === 'Bool' ? 'bool'
  : t === 'Str' ? 'const vstr*' : t === 'Unit' ? 'void' : isArr(t) ? 'varr*' : isMap(t) ? 'vmap*' : `struct S_${mangle(t)}`);
const cstring = (s) => JSON.stringify(s).replace(/[^\x20-\x7e]/g, (c) => [...Buffer.from(c, 'utf8')].map((b) => `\\${b.toString(8).padStart(3, '0')}`).join(''));
const isSimple = (e) => ['IntLit', 'FloatLit', 'BoolLit', 'StrLit', 'Name'].includes(e.kind);

function hasCall(e) {
  if (!e || typeof e !== 'object') return false;
  if (e.kind === 'Call' && e.fn) return true;
  if (e.kind === 'Sum' || e.kind === 'Comp') return true;
  return ['left', 'right', 'operand', 'base', 'index', 'body', 'start', 'end'].some((k) => hasCall(e[k]))
    || (e.args ?? []).some(hasCall) || (e.elems ?? []).some(hasCall) || (e.fields ?? []).some((f) => hasCall(f.expr));
}

export function cgen(program, opts = {}) {
  const checked = opts.checked !== false;
  const sites = [
    { kind: 'out_of_memory', message: 'out of memory' },
    { kind: 'trap', message: 'integer overflow' },
    { kind: 'trap', message: 'float out of Int range' },
    { kind: 'capability_denied', message: 'file path is outside the folders granted with --allow fs:<folder>' },
  ];
  const strings = new Map();
  let tmpCount = 0;
  const tmp = () => `_t${tmpCount++}`;
  const intern = (s) => {
    if (!strings.has(s)) strings.set(s, `vs_${strings.size}`);
    return `((const vstr*)&${strings.get(s)})`;
  };

  // Evaluates operands strictly left to right. C leaves operand order unspecified, so when
  // more than one operand is non-trivial each is bound to a temporary first.
  function seq(parts, build) {
    if (parts.filter((p) => !p.simple).length < 2) return build(parts.map((p) => p.c));
    const names = [], decls = [];
    for (const p of parts) {
      if (p.simple) { names.push(p.c); continue; }
      const n = tmp();
      decls.push(`${ctype(p.ty)} ${n} = ${p.c};`);
      names.push(n);
    }
    return `({ ${decls.join(' ')} ${build(names)}; })`;
  }

  // ---- lane (SPMD) code generation --------------------------------------------------------
  // A pure Int/Float/Bool computation can be evaluated for 8 loop indexes at once. Values
  // become vectors and control flow becomes a mask of active lanes. Anything outside the
  // supported subset throws Unsupported and the caller falls back to ordinary scalar code.
  class Unsupported extends Error {}
  const simd = opts.simd !== false;
  const vecText = [];
  const vecNames = new Map();
  const floatLit = (x) => {
    if (!Number.isFinite(x)) return '(1.0/0.0)';
    const t = String(x);
    return /[.e]/.test(t) ? t : `${t}.0`;
  };

  function laneGen(fnLabel) {
    const env = new Map();
    const lines = [];
    // Cost facts: lanes pay off for floating-point work and lose on integer division.
    const stats = { floatOps: 0, intDiv: 0 };
    const L = (t) => lines.push(`  ${t}`);
    const site = (kind, node, text = '') => {
      sites.push(failInfo(kind, { fn: fnLabel, line: node.line, col: node.col, text }));
      return sites.length - 1;
    };
    const vt = (t) => {
      if (t === 'Int' || t === 'Bool') return 'vi';
      if (t === 'Float') return 'vd';
      throw new Unsupported();
    };
    const bind = (t, c) => { const n = tmp(); L(`${vt(t)} ${n} = ${c};`); return n; };

    function addSub(op, a, b, node, m) {
      const r = bind('Int', `(vi)((vu)${a} ${op} (vu)${b})`);
      if (checked) {
        const of = op === '+' ? `(${a} ^ ${r}) & (${b} ^ ${r})` : `(${a} ^ ${b}) & (${a} ^ ${r})`;
        L(`VCHECK(${m} & (vi)((${of}) < 0), ${site(FAIL.OVERFLOW, node)});`);
      }
      return r;
    }

    function vexpr(e, m) {
      switch (e.kind) {
        case 'IntLit': return `VI(INT64_C(${e.value}))`;
        case 'FloatLit': return `VD(${floatLit(e.value)})`;
        case 'BoolLit': return e.value ? 'VI(INT64_C(-1))' : 'VI(INT64_C(0))';
        case 'Name': {
          if (env.has(e.sym)) return env.get(e.sym);
          vt(e.ty);
          // A value from the enclosing scalar code: the same in every lane.
          const n = `v_${e.sym.name}`;
          return e.ty === 'Int' ? `VI(${n})` : e.ty === 'Float' ? `VD(${n})` : `VB(${n})`;
        }
        case 'Unary': {
          const x = vexpr(e.operand, m);
          if (e.op === 'not') return bind('Bool', `~${x}`);
          if (e.ty === 'Float') return bind('Float', `-${x}`);
          return addSub('-', 'VI(INT64_C(0))', x, e, m);
        }
        case 'Binary': {
          const { op } = e;
          if (op === 'and' || op === 'or') {
            // The right side only runs in lanes where the left side has not decided the result.
            const l = vexpr(e.left, m);
            const m2 = bind('Bool', op === 'and' ? `${m} & ${l}` : `${m} & ~${l}`);
            const r = vexpr(e.right, m2);
            return bind('Bool', op === 'and' ? `${l} & ${r}` : `${l} | ${r}`);
          }
          const t = e.left.ty;
          vt(t);
          const a = vexpr(e.left, m), b = vexpr(e.right, m);
          if (t === 'Bool') return bind('Bool', op === '==' ? `~(${a} ^ ${b})` : `${a} ^ ${b}`);
          if (['==', '!=', '<', '<=', '>', '>='].includes(op)) return bind('Bool', `(vi)(${a} ${op} ${b})`);
          if (t === 'Float') { stats.floatOps++; return bind('Float', `${a} ${op} ${b}`); }
          if (op === '+' || op === '-') return addSub(op, a, b, e, m);
          if (op === '*') {
            if (checked) {
              const lit = e.right.kind === 'IntLit' ? e.right : e.left.kind === 'IntLit' ? e.left : null;
              if (!lit || lit.value < 1n) throw new Unsupported();
              const x = lit === e.right ? a : b;
              L(`VCHECK(${m} & ((vi)(${x} > VI(INT64_MAX / INT64_C(${lit.value}))) | (vi)(${x} < VI(INT64_MIN / INT64_C(${lit.value})))), ${site(FAIL.OVERFLOW, e)});`);
            }
            return bind('Int', `(vi)((vu)${a} * (vu)${b})`);
          }
          // Division and remainder: only by a positive literal, which can never trap.
          if (e.right.kind !== 'IntLit' || e.right.value < 1n) throw new Unsupported();
          stats.intDiv++;
          return bind('Int', `${a} ${op} ${b}`);
        }
        case 'Call': {
          if (e.fn) {
            const { name, stats: cs } = laneFn(e.fn);
            stats.floatOps += cs.floatOps;
            stats.intDiv += cs.intDiv;
            const args = e.args.map((x) => vexpr(x, m));
            return bind(e.ty, `${name}(${[m, ...args].join(', ')})`);
          }
          if (e.name === 'float') return bind('Float', `__builtin_convertvector(${vexpr(e.args[0], m)}, vd)`);
          if (e.name === 'sqrt') return bind('Float', `vsqrtv(${vexpr(e.args[0], m)})`);
          if (e.name === 'int') {
            const x = vexpr(e.args[0], m);
            const ok = bind('Bool', `(vi)(${x} > VD(-9223372036854777856.0)) & (vi)(${x} < VD(9223372036854775808.0))`);
            L(`VCHECK(${m} & ~${ok}, VSITE_FLOAT_RANGE);`);
            return bind('Int', `__builtin_convertvector(VSELD(${ok}, ${x}, VD(0.0)), vi)`);
          }
          throw new Unsupported();
        }
        default: throw new Unsupported();
      }
    }

    function vstmt(st, m) {
      switch (st.kind) {
        case 'Let': {
          const x = vexpr(st.init, m);
          const n = `w_${st.sym.name}_${tmpCount++}`;
          L(`${vt(st.sym.ty)} ${n} = ${x};`);
          env.set(st.sym, n);
          break;
        }
        case 'Assign': {
          if (st.target.kind !== 'Name' || !env.has(st.target.sym)) throw new Unsupported();
          const x = vexpr(st.value, m), n = env.get(st.target.sym);
          L(`${n} = ${st.target.ty === 'Float' ? 'VSELD' : 'VSELI'}(${m}, ${x}, ${n});`);
          break;
        }
        case 'If': {
          const c = vexpr(st.cond, m);
          const mt = bind('Bool', `${m} & ${c}`);
          L(`if (vany(${mt})) {`);
          for (const x of st.then) vstmt(x, mt);
          L('}');
          if (st.els) {
            const me = bind('Bool', `${m} & ~${c}`);
            L(`if (vany(${me})) {`);
            for (const x of st.els) vstmt(x, me);
            L('}');
          }
          break;
        }
        case 'While': {
          const live = tmp();
          L(`{ vi ${live} = ${m}; for (;;) {`);
          const c = vexpr(st.cond, live);
          L(`${live} &= ${c}; if (!vany(${live})) break;`);
          for (const x of st.body) vstmt(x, live);
          L('} }');
          break;
        }
        case 'For': {
          const s0 = vexpr(st.start, m), e0 = vexpr(st.end, m);
          const i = `w_${st.sym.name}_${tmpCount++}`, en = tmp(), live = tmp();
          env.set(st.sym, i);
          L(`{ vi ${i} = ${s0}; vi ${en} = ${e0}; vi ${live} = ${m}; for (;;) {`);
          L(`${live} &= (vi)(${i} < ${en}); if (!vany(${live})) break;`);
          for (const x of st.body) vstmt(x, live);
          L(`${i} = ${i} - ${live};`); // active lanes hold -1, so this adds one to exactly those
          L('} }');
          break;
        }
        case 'Assert': {
          const c = vexpr(st.cond, m);
          L(`VCHECK(${m} & ~${c}, ${site(FAIL.ASSERT, st, st.text)});`);
          break;
        }
        default: throw new Unsupported(); // early return, effects, array stores
      }
    }
    return { env, lines, L, site, vt, bind, vexpr, vstmt, stats };
  }

  // Lane version of a whole function, or Unsupported. Recursion is not supported.
  function laneFn(fn) {
    if (vecNames.has(fn)) {
      const known = vecNames.get(fn);
      if (!known) throw new Unsupported();
      return known;
    }
    vecNames.set(fn, null);
    const g = laneGen(fn.name);
    const params = fn.params.map((p, k) => {
      g.env.set(fn.paramSyms[k], `w_${p.name}`);
      return `${g.vt(p.ty)} w_${p.name}`;
    });
    const rt = g.vt(fn.ret);
    for (const c of fn.requires) g.L(`VCHECK(_m & ~${g.vexpr(c.expr, '_m')}, ${g.site(FAIL.REQUIRES, c, c.text)});`);
    const last = fn.body[fn.body.length - 1];
    if (!last || last.kind !== 'Return') throw new Unsupported();
    for (const st of fn.body.slice(0, -1)) g.vstmt(st, '_m');
    const res = g.bind(fn.ret, g.vexpr(last.value, '_m'));
    g.env.set(fn.resultSym, res);
    for (const c of fn.ensures) g.L(`VCHECK(_m & ~${g.vexpr(c.expr, '_m')}, ${g.site(FAIL.ENSURES, c, c.text)});`);
    const name = `fv_${fn.cname}`;
    vecText.push(`static ${rt} ${name}(${['vi _m', ...params].join(', ')}) {\n${g.lines.join('\n')}\n  return ${res};\n}\n`);
    vecNames.set(fn, { name, stats: g.stats });
    return vecNames.get(fn);
  }

  // ---- copy(x): a deep, independent copy of anything that holds arrays or maps ----
  const hasContainer = containerTest(program.types);
  const copyNames = new Map();
  const copyProtos = [], copyBodies = [];
  function copyFn(t) {
    if (!hasContainer(t)) return null;
    if (copyNames.has(t)) return copyNames.get(t);
    const name = `cp_${mangle(t)}`, T = ctype(t);
    copyNames.set(t, name);
    copyProtos.push(`static ${T} ${name}(${T} x);`);
    const fieldCopies = (fields, path) => fields.filter((f) => hasContainer(f.ty)).map((f) => `r.${path}f_${f.name} = ${copyFn(f.ty)}(x.${path}f_${f.name});`).join(' ');
    let body;
    if (isArr(t)) {
      const E = ctype(elemOf(t)), c = copyFn(elemOf(t));
      body = `varr* r = vow_arr_alloc(x->len, sizeof(${E}), 0, false); `
        + (c ? `for (int64_t i = 0; i < x->len; i++) VDATA(${E}, r)[i] = ${c}(VDATA(${E}, x)[i]);`
          : `if (x->len) memcpy(VDATA(${E}, r), VDATA(${E}, x), (size_t)x->len * sizeof(${E}));`) + ' return r;';
    } else if (isMap(t)) {
      const [kt, vt] = mapParts(t);
      body = `vmap* r = vmap_new(sizeof(${ctype(vt)}), ${kt === 'Str' ? 1 : 0}); `
        + 'for (int64_t i = 0; i < x->len; i++) memcpy(vmap_put(r, x->keys[i]), x->vals + i * x->vsize, (size_t)x->vsize); return r;';
    } else if (program.types.structs.has(t)) {
      body = `${T} r = x; ${fieldCopies(program.types.structs.get(t).fields, '')} return r;`;
    } else {
      const cases = program.types.enums.get(t).variants.filter((v) => v.fields.some((f) => hasContainer(f.ty)))
        .map((v) => `case ${v.index}: ${fieldCopies(v.fields, `u.v${v.index}.`)} break;`).join(' ');
      body = `${T} r = x; switch (x.tag) { ${cases} default: break; } return r;`;
    }
    copyBodies.push(`static ${T} ${name}(${T} x) { ${body} }`);
    return name;
  }

  function genFn(owner, isTest, cname) {
    const fnName = isTest ? `test "${owner.name}"` : owner.name;
    const ret = isTest ? 'Unit' : owner.ret;
    const reset = !isTest && owner.regionReset;
    const useGoto = !isTest && (owner.ensures.length > 0 || reset);
    const lines = [];
    let ind = 1;
    const line = (s) => lines.push('  '.repeat(ind) + s);
    const site = (kind, node, text = '') => {
      sites.push(failInfo(kind, { fn: fnName, file: node.file ?? owner.file, line: node.line, col: node.col, text }));
      return sites.length - 1;
    };
    const part = (e) => ({ c: expr(e), ty: e.ty, simple: isSimple(e) });
    const v = (sym) => (sym.isResult ? '_res' : `v_${sym.name}`);

    function expr(e) {
      switch (e.kind) {
        case 'IntLit': return `INT64_C(${e.value})`;
        case 'FloatLit': {
          if (!Number.isFinite(e.value)) return '(1.0/0.0)';
          const s = String(e.value);
          return /[.e]/.test(s) ? s : `${s}.0`;
        }
        case 'BoolLit': return e.value ? 'true' : 'false';
        case 'StrLit': return intern(e.value);
        case 'Name': return v(e.sym);
        case 'Unary': {
          const x = expr(e.operand);
          if (e.op === 'not') return `(!${x})`;
          if (e.ty === 'Float') return `(-${x})`;
          return checked ? `vsub(0, ${x}, ${site(FAIL.OVERFLOW, e)})` : `vwsub(0, ${x})`;
        }
        case 'Binary': return binary(e);
        case 'Index': {
          const a = tmp(), i = tmp();
          return `({ varr* ${a} = ${expr(e.base)}; int64_t ${i} = ${expr(e.index)}; `
            + `if (VUNLIKELY((uint64_t)${i} >= (uint64_t)${a}->len)) vow_fail(${site(FAIL.BOUNDS, e)}); `
            + `VDATA(${ctype(e.ty)}, ${a})[${i}]; })`;
        }
        case 'Field': return `(${expr(e.base)}).f_${e.name}`;
        case 'New': {
          const T = ctype(e.ty), k = e.variantIndex;
          if (k === null) return seq(e.fields.map((f) => part(f.expr)), (xs) => `((${T}){ ${xs.join(', ')} })`);
          if (!e.fields.length) return `((${T}){ .tag = ${k} })`;
          return seq(e.fields.map((f) => part(f.expr)), (xs) => `((${T}){ .tag = ${k}, .u.v${k} = { ${xs.join(', ')} } })`);
        }
        case 'ArrayLit': {
          const a = tmp(), d = tmp(), et = ctype(elemOf(e.ty));
          return `({ varr* ${a} = vow_arr_alloc(${e.elems.length}, sizeof(${et}), 0, false); ${et}* ${d} = VDATA(${et}, ${a}); `
            + e.elems.map((el, k) => `${d}[${k}] = ${expr(el)};`).join(' ') + ` ${a}; })`;
        }
        case 'Sum': return sumExpr(e);
        case 'Comp': return compExpr(e);
        case 'MapLit': {
          const [kt, vt] = mapParts(e.ty);
          return `vmap_new(sizeof(${ctype(vt)}), ${kt === 'Str' ? 1 : 0})`;
        }
        case 'Call': return callExpr(e);
        default: throw new Error(`cgen: unknown expr ${e.kind}`);
      }
    }

    // Shared pieces of sum and comprehension loops. The trip count is computed without
    // signed overflow; iterations run on any core in any order (the body is pure).
    const rangeDecl = (e, s, en, n) => `int64_t ${s} = ${expr(e.start)}; int64_t ${en} = ${expr(e.end)}; `
      + `int64_t ${n} = ${en} > ${s} ? (int64_t)((uint64_t)${en} - (uint64_t)${s}) : 0;`;
    const chunkDecl = (ch, n) => `int64_t ${ch} = ${n} / ((int64_t)omp_get_max_threads() * 32); if (${ch} < 1) ${ch} = 1;`;
    const parallelIf = (e, n) => `if(${n} >= ${hasCall(e.body) ? 2 : 100000})`;
    const inRegion = (e, stmt) => {
      if (!e.iterReset) return stmt;
      const m = tmp();
      return `vmark ${m} = vow_mark(); ${stmt} vow_reset(${m});`;
    };

    function sumExpr(e) {
      const s = tmp(), en = tmp(), n = tmp(), acc = tmp(), k = tmp(), ch = tmp(), i = v(e.sym);
      const range = rangeDecl(e, s, en, n);
      const body = expr(e.body);
      const head = `for (int64_t ${k} = 0; ${k} < ${n}; ${k}++) { const int64_t ${i} = ${s} + ${k};`;
      if (simd && e.ty === 'Int' && e.simd !== false) {
        // Eight iterations per step when the body is plain numeric code.
        try {
          const g = laneGen(fnName);
          g.env.set(e.sym, '_ix');
          const res = g.vexpr(e.body, '_m');
          // Use lanes only where they pay: floating-point work, and no integer division
          // (which has no fast 8-wide form and usually marks branchy integer code whose
          // lanes finish at very different times).
          if (g.stats.floatOps === 0 || g.stats.intDiv > 0) throw new Unsupported();
          const nb = tmp();
          return `({ ${range} __int128 ${acc} = 0; int64_t ${nb} = ${n} / 8 + (${n} % 8 != 0); ${chunkDecl(ch, nb)}\n`
            + `#pragma omp parallel for reduction(+:${acc}) schedule(dynamic, ${ch}) ${parallelIf(e, n)}\n`
            + `for (int64_t ${k} = 0; ${k} < ${nb}; ${k}++) {\n`
            + `  const vi _ix = (vi)((vu)VI(${s} + ${k} * 8) + (vu)VLANES);\n`
            + `  const vi _m = (vi)((VI(${k} * 8) + VLANES) < VI(${n}));\n`
            + `${g.lines.join('\n')}\n`
            + `  ${acc} += vhsum(${res} & _m);\n}\n`
            + `if (VUNLIKELY(${acc} != (__int128)(int64_t)${acc})) vow_fail(${site(FAIL.OVERFLOW, e)}); (int64_t)${acc}; })`;
        } catch (err) {
          if (!(err instanceof Unsupported)) throw err;
        }
      }
      if (e.ty === 'Float') {
        // Float addition is not associative, so a Float sum always runs in order.
        return `({ ${range} double ${acc} = 0.0; ${head} ${inRegion(e, `${acc} += ${body};`)} } ${acc}; })`;
      }
      // The total is accumulated in 128 bits: the result is the same for every schedule.
      return `({ ${range} __int128 ${acc} = 0; ${chunkDecl(ch, n)}\n`
        + `#pragma omp parallel for reduction(+:${acc}) schedule(dynamic, ${ch}) ${parallelIf(e, n)}\n`
        + `${head} ${inRegion(e, `${acc} += (int64_t)(${body});`)} }\n`
        + `if (VUNLIKELY(${acc} != (__int128)(int64_t)${acc})) vow_fail(${site(FAIL.OVERFLOW, e)}); (int64_t)${acc}; })`;
    }

    // [i in start..end: expr] -- every iteration writes its own slot, so it is race-free by construction.
    function compExpr(e) {
      const s = tmp(), en = tmp(), n = tmp(), a = tmp(), d = tmp(), k = tmp(), ch = tmp(), i = v(e.sym);
      const T = ctype(elemOf(e.ty));
      const range = rangeDecl(e, s, en, n);
      const body = expr(e.body);
      return `({ ${range} varr* ${a} = vow_arr_alloc(${n}, sizeof(${T}), ${site(FAIL.ARRSIZE, e)}, false); `
        + `${T}* ${d} = VDATA(${T}, ${a}); ${chunkDecl(ch, n)}\n`
        + `#pragma omp parallel for schedule(dynamic, ${ch}) ${parallelIf(e, n)}\n`
        + `for (int64_t ${k} = 0; ${k} < ${n}; ${k}++) { const int64_t ${i} = ${s} + ${k}; ${inRegion(e, `${d}[${k}] = ${body};`)} }\n`
        + `${a}; })`;
    }

    function mapCall(e) {
      const [kt, vt] = mapParts(e.args[0].ty);
      const key = (k) => (kt === 'Str' ? `(uint64_t)(uintptr_t)${k}` : `(uint64_t)${k}`);
      const V = ctype(vt);
      if (e.name === 'keys') return `vmap_keys(${expr(e.args[0])}, 0)`;
      if (e.name === 'has') return seq(e.args.map(part), ([m, k]) => `(vmap_find(${m}, ${key(k)}) >= 0)`);
      if (e.name === 'remove') return seq(e.args.map(part), ([m, k]) => `vmap_remove(${m}, ${key(k)})`);
      if (e.name === 'get') {
        const st = site(FAIL.KEY, e);
        return seq(e.args.map(part), ([m, k]) => `(*(${V}*)vmap_get(${m}, ${key(k)}, ${st}))`);
      }
      // put and get_or: every argument is evaluated, in order, before the map is touched.
      const m = tmp(), k = tmp(), val = tmp(), p = tmp();
      const args = `vmap* ${m} = ${expr(e.args[0])}; ${ctype(kt)} ${k} = ${expr(e.args[1])}; ${V} ${val} = ${expr(e.args[2])};`;
      if (e.name === 'put') return `({ ${args} *(${V}*)vmap_put(${m}, ${key(k)}) = ${val}; })`;
      return `({ ${args} ${V}* ${p} = (${V}*)vmap_peek(${m}, ${key(k)}); ${p} ? *${p} : ${val}; })`;
    }

    function binary(e) {
      const { op } = e;
      if (op === 'and') return `(${expr(e.left)} && ${expr(e.right)})`;
      if (op === 'or') return `(${expr(e.left)} || ${expr(e.right)})`;
      const t = e.left.ty;
      const parts = [part(e.left), part(e.right)];
      if (t === 'Str') {
        return seq(parts, ([a, b]) => (op === '+' ? `vstr_concat(${a}, ${b})` : `${op === '!=' ? '!' : ''}vstr_eq(${a}, ${b})`));
      }
      if (t === 'Int' && ['+', '-', '*'].includes(op)) {
        const f = { '+': 'add', '-': 'sub', '*': 'mul' }[op];
        if (!checked) return seq(parts, ([a, b]) => `vw${f}(${a}, ${b})`);
        const s = site(FAIL.OVERFLOW, e);
        if (op === '*') {
          // Multiplying by a literal: test the range of the other operand instead of the result.
          const lit = e.right.kind === 'IntLit' ? e.right : e.left.kind === 'IntLit' ? e.left : null;
          if (lit && lit.value >= 1n) return `vmulc(${lit === e.right ? parts[0].c : parts[1].c}, INT64_C(${lit.value}), ${s})`;
        }
        return seq(parts, ([a, b]) => `v${f}(${a}, ${b}, ${s})`);
      }
      if (t === 'Int' && (op === '/' || op === '%')) {
        const s = site(FAIL.DIVZERO, e);
        return seq(parts, ([a, b]) => `${op === '/' ? 'vdiv' : 'vmod'}(${a}, ${b}, ${s})`);
      }
      return seq(parts, ([a, b]) => `(${a} ${op} ${b})`);
    }

    function callExpr(e) {
      if (e.fn) return seq(e.args.map(part), (xs) => `f_${e.fn.cname}(${xs.join(', ')})`);
      switch (e.name) {
        case 'print': {
          const fn = { Int: 'vp_i64', Float: 'vp_f64', Bool: 'vp_bool', Str: 'vp_str' };
          return seq(e.args.map(part), (xs) => `(${[...xs.map((x, k) => `${fn[e.args[k].ty]}(${x})`), 'vp_end()'].join(', ')})`);
        }
        case 'len': return `(${expr(e.args[0])})->len`;
        case 'array': {
          const init = e.args[1], et = ctype(init.ty);
          const zero = (init.kind === 'IntLit' && init.value === 0n) || (init.kind === 'BoolLit' && !init.value)
            || (init.kind === 'FloatLit' && Object.is(init.value, 0));
          const n = tmp(), a = tmp(), val = tmp(), d = tmp(), k = tmp();
          const s = site(FAIL.ARRSIZE, e);
          if (zero) return `vow_arr_alloc(${expr(e.args[0])}, sizeof(${et}), ${s}, true)`;
          return `({ int64_t ${n} = ${expr(e.args[0])}; ${et} ${val} = ${expr(init)}; `
            + `varr* ${a} = vow_arr_alloc(${n}, sizeof(${et}), ${s}, false); ${et}* ${d} = VDATA(${et}, ${a}); `
            + `for (int64_t ${k} = 0; ${k} < ${n}; ${k}++) ${d}[${k}] = ${val}; ${a}; })`;
        }
        case 'float': return `((double)${expr(e.args[0])})`;
        case 'int': return `vf2i(${expr(e.args[0])})`;
        case 'sqrt': return `sqrt(${expr(e.args[0])})`;
        case 'now_ms': return 'vow_now_ms()';
        case 'str': return `${{ Int: 'vstr_from_i64', Float: 'vstr_from_f64', Bool: 'vstr_from_bool' }[e.args[0].ty]}(${expr(e.args[0])})`;
        case 'substr': {
          const s = site(FAIL.BOUNDS, e);
          return seq(e.args.map(part), (xs) => `vstr_substr(${xs.join(', ')}, ${s})`);
        }
        case 'byte_at': {
          const s = site(FAIL.BOUNDS, e);
          return seq(e.args.map(part), (xs) => `vstr_byte_at(${xs.join(', ')}, ${s})`);
        }
        case 'put': case 'get': case 'get_or': case 'has': case 'keys': case 'remove': return mapCall(e);
        case 'copy': { const c = copyFn(e.ty); return c ? `${c}(${expr(e.args[0])})` : expr(e.args[0]); }
        case 'read_file': return `vow_read_file(${expr(e.args[0])}, ${site(FAIL.IO, e)})`;
        case 'file_exists': return `vow_file_exists(${expr(e.args[0])})`;
        case 'write_file': { const st = site(FAIL.IO, e); return seq(e.args.map(part), (xs) => `vow_write_file(${xs.join(', ')}, ${st})`); }
        default: throw new Error(`cgen: unknown builtin ${e.name}`);
      }
    }

    function block(stmts) {
      ind++;
      for (const s of stmts) stmt(s);
      ind--;
    }

    // A loop body whose allocations cannot outlive the iteration hands them back each time round.
    function loopBody(s) {
      if (!s.iterReset) { block(s.body); return; }
      const m = tmp();
      ind++; line(`vmark ${m} = vow_mark();`); ind--;
      block(s.body);
      ind++; line(`vow_reset(${m});`); ind--;
    }

    function stmt(s) {
      switch (s.kind) {
        case 'Let': line(`${ctype(s.sym.ty)} ${v(s.sym)} = ${expr(s.init)};`); break;
        case 'Assign':
          if (s.target.kind === 'Name') {
            line(`${v(s.target.sym)} = ${expr(s.value)};`);
          } else {
            const a = tmp(), i = tmp(), t = s.target;
            line(`{ varr* ${a} = ${expr(t.base)}; int64_t ${i} = ${expr(t.index)}; `
              + `if (VUNLIKELY((uint64_t)${i} >= (uint64_t)${a}->len)) vow_fail(${site(FAIL.BOUNDS, t)}); `
              + `VDATA(${ctype(t.ty)}, ${a})[${i}] = ${expr(s.value)}; }`);
          }
          break;
        case 'If':
          line(`if (${expr(s.cond)}) {`);
          block(s.then);
          if (s.els) { line('} else {'); block(s.els); }
          line('}');
          break;
        case 'While':
          line(`while (${expr(s.cond)}) {`);
          loopBody(s);
          line('}');
          break;
        case 'For': {
          const en = tmp(), i = v(s.sym), st = tmp();
          line(`{ int64_t ${st} = ${expr(s.start)}; int64_t ${en} = ${expr(s.end)};`);
          line(`for (int64_t ${i} = ${st}; ${i} < ${en}; ${i}++) {`);
          loopBody(s);
          line('} }');
          break;
        }
        case 'Match': {
          const sc = tmp(), en = program.types.enums.get(s.scrut.ty);
          line(`{ ${ctype(s.scrut.ty)} ${sc} = ${expr(s.scrut)}; switch (${sc}.tag) {`);
          let hasElse = false;
          for (const arm of s.arms) {
            if (arm.variant === null) { hasElse = true; line('default: {'); } else line(`case ${arm.index}: {`);
            ind++;
            arm.syms.forEach((sym, i) => {
              if (sym) line(`${ctype(sym.ty)} v_${sym.name} = ${sc}.u.v${arm.index}.f_${en.variants[arm.index].fields[i].name};`);
            });
            ind--;
            block(arm.body);
            line('} break;');
          }
          if (!hasElse) line('default: __builtin_unreachable();');
          line('} }');
          break;
        }
        case 'Return':
          if (useGoto) line(s.value ? `{ _res = ${expr(s.value)}; goto done; }` : 'goto done;');
          else line(s.value ? `return ${expr(s.value)};` : 'return;');
          break;
        case 'Assert':
          line(`if (VUNLIKELY(!${expr(s.cond)})) vow_fail(${site(FAIL.ASSERT, s, s.text)});`);
          break;
        case 'ExprStmt': line(`(void)${expr(s.expr)};`); break;
        default: throw new Error(`cgen: unknown stmt ${s.kind}`);
      }
    }

    const params = isTest ? 'void' : owner.params.map((p) => `${ctype(p.ty)} v_${p.name}`).join(', ') || 'void';
    const sig = `static ${ctype(ret)} ${cname}(${params})`;
    if (!isTest) {
      for (const c of owner.requires) line(`if (VUNLIKELY(!${expr(c.expr)})) vow_fail(${site(FAIL.REQUIRES, c, c.text)});`);
    }
    if (reset) line('vmark _rm = vow_mark();');
    if (useGoto && ret !== 'Unit') line(`${ctype(ret)} _res;`);
    ind--;
    block(owner.body);
    ind++;
    if (useGoto) {
      line('done:;');
      for (const c of owner.ensures) line(`if (VUNLIKELY(!${expr(c.expr)})) vow_fail(${site(FAIL.ENSURES, c, c.text)});`);
      if (reset) line('vow_reset(_rm);');
      if (ret !== 'Unit') line('return _res;');
    } else if (ret !== 'Unit') {
      line('__builtin_unreachable();');
    }
    return { sig, text: `${sig} {\n${lines.join('\n')}\n}\n` };
  }

  const fnOut = program.fns.map((f) => genFn(f, false, `f_${f.cname}`));
  const testOut = program.tests.map((t, i) => genFn(t, true, `t_${i}`));

  const out = [];
  out.push('// Generated by the Vow compiler. Do not edit.');
  out.push('#include <stdint.h>');
  out.push(`static const char* const vow_sites[] = {\n${sites.map((s) => `  ${cstring(JSON.stringify(s))},`).join('\n')}\n};`);
  const fsg = opts.grants?.fs ?? { any: false, roots: [] };
  out.push(`static const int vow_fs_any = ${fsg.any ? 1 : 0};`);
  out.push(`static const char* const vow_fs_roots[] = { ${[...fsg.roots.map((r) => cstring(r)), 'NULL'].join(', ')} };`);
  out.push(RUNTIME);
  out.push('#ifndef _OPENMP\nstatic inline int omp_get_max_threads(void) { return 1; }\n#endif');
  for (const [s, name] of strings) {
    const len = Buffer.byteLength(s, 'utf8');
    out.push(`static const struct { int64_t len; char data[${len + 1}]; } ${name} = { ${len}, ${cstring(s)} };`);
  }
  const fieldList = (fields) => fields.map((f) => `${ctype(f.ty)} f_${f.name};`).join(' ');
  for (const t of program.typeOrder) {
    if (t.kind === 'struct') { out.push(`${ctype(t.name)} { ${fieldList(t.fields)} };`); continue; }
    const withFields = t.variants.filter((v) => v.fields.length);
    const un = withFields.length ? ` union { ${withFields.map((v) => `struct { ${fieldList(v.fields)} } v${v.index};`).join(' ')} } u;` : '';
    out.push(`${ctype(t.name)} { int64_t tag;${un} };`);
  }
  for (const x of copyProtos) out.push(x);
  for (const x of copyBodies) out.push(x);
  for (const f of [...fnOut, ...testOut]) out.push(`${f.sig};`);
  for (const t of vecText) out.push(t);
  for (const f of [...fnOut, ...testOut]) out.push(f.text);
  out.push(`int main(int argc, char** argv) {
  vow_init();
  if (argc >= 3 && strcmp(argv[1], "--test") == 0) {
    switch (atoi(argv[2])) {
${program.tests.map((t, i) => `      case ${i}: t_${i}(); break;`).join('\n')}
      default: return 64;
    }
    fflush(stdout);
    return 0;
  }
${program.main ? '  f_main();' : ''}
  fflush(stdout);
  return 0;
}`);

  const meta = {
    effects: program.main ? [...program.main.effectSet] : [],
    tests: program.tests.map((t) => ({ name: t.name, line: t.line })),
    hasMain: !!program.main,
  };
  return { c: out.join('\n') + '\n', meta };
}
