// Avisoq code generator: checked AST -> WebAssembly module.
import { Module, I32, I64, F64, uleb, sleb, f64bytes } from './wasm.mjs';

import { FAIL } from './fail.mjs';
import { containerTest, elemOf, isArr, isMap, mapParts, walk } from './types.mjs';

export { FAIL };
const MAX_ARRAY_LEN = 1n << 27n;

const wt = (t) => (t === 'Int' ? I64 : t === 'Float' ? F64 : I32);
const elemShift = (t) => (t === 'Int' || t === 'Float' ? 3 : t === 'Bool' ? 0 : 2);
// Storage class of an array element: Bool is packed into one byte.
const elemClass = (t) => (t === 'Int' ? 'i64' : t === 'Float' ? 'f64' : t === 'Bool' ? 'i8' : 'i32');

// Opcodes
const UNREACHABLE = 0x00, BLOCK = 0x02, LOOP = 0x03, IF = 0x04, ELSE = 0x05, END = 0x0b, BR = 0x0c, BR_IF = 0x0d,
  CALL = 0x10, DROP = 0x1a, LGET = 0x20, LSET = 0x21, LTEE = 0x22, GGET = 0x23, GSET = 0x24,
  I32_LOAD = 0x28, I64_LOAD = 0x29, F64_LOAD = 0x2b, I32_LOAD8_U = 0x2d, I32_STORE8 = 0x3a, I32_STORE = 0x36, I64_STORE = 0x37, F64_STORE = 0x39,
  MEM_SIZE = 0x3f, MEM_GROW = 0x40, I32_CONST = 0x41, I64_CONST = 0x42, F64_CONST = 0x44,
  I32_EQZ = 0x45, I32_EQ = 0x46, I32_NE = 0x47, I32_LT_U = 0x49, I32_GT_U = 0x4b, I32_GE_U = 0x4f,
  I64_EQZ = 0x50, I64_EQ = 0x51, I64_NE = 0x52, I64_LT_S = 0x53, I64_GT_S = 0x55, I64_GT_U = 0x56, I64_LE_S = 0x57,
  I64_GE_S = 0x59, I64_GE_U = 0x5a,
  F64_EQ = 0x61, F64_NE = 0x62, F64_LT = 0x63, F64_GT = 0x64, F64_LE = 0x65, F64_GE = 0x66,
  I32_ADD = 0x6a, I32_SUB = 0x6b, I32_MUL = 0x6c, I32_AND = 0x71, I32_OR = 0x72, I32_SHL = 0x74, I32_SHR_U = 0x76,
  I64_ADD = 0x7c, I64_SUB = 0x7d, I64_MUL = 0x7e, I64_DIV_S = 0x7f, I64_REM_S = 0x81, I64_AND = 0x83, I64_OR = 0x84,
  I64_XOR = 0x85, I64_SHR_S = 0x87, I64_SHR_U = 0x88, I64_LT_U = 0x54,
  F64_NEG = 0x9a, F64_SQRT = 0x9f, F64_ADD = 0xa0, F64_SUB = 0xa1, F64_MUL = 0xa2, F64_DIV = 0xa3,
  I32_WRAP = 0xa7, I64_EXTEND_U = 0xad, I64_TRUNC_F64 = 0xb0, F64_CONVERT_I64 = 0xb9, VOID = 0x40;

export function codegen(program, opts = {}) {
  const checked = opts.checked !== false;
  const m = new Module();
  const sites = [{ fn: '<runtime>', line: 0, col: 0, text: '' }];
  const used = program.usedBuiltins;

  const imp = { fail: m.addImport('env', 'fail', [I32, I32], []) };
  if (used.has('print')) {
    imp.print_i64 = m.addImport('io', 'print_i64', [I64], []);
    imp.print_f64 = m.addImport('io', 'print_f64', [F64], []);
    imp.print_bool = m.addImport('io', 'print_bool', [I32], []);
    imp.print_str = m.addImport('io', 'print_str', [I32], []);
    imp.print_end = m.addImport('io', 'print_end', [], []);
  }
  if (used.has('now_ms')) imp.now_ms = m.addImport('time', 'now_ms', [], [F64]);
  if (program.usesStrings) {
    // String operations are pure helpers supplied by the host; they need no capability.
    imp.str_concat = m.addImport('rt', 'str_concat', [I32, I32], [I32]);
    imp.str_append = m.addImport('rt', 'str_append', [I32, I32, I32, I32], [I32, I32]);
    imp.str_eq = m.addImport('rt', 'str_eq', [I32, I32], [I32]);
    imp.str_cmp = m.addImport('rt', 'str_cmp', [I32, I32], [I32]);
    imp.str_from_i64 = m.addImport('rt', 'str_from_i64', [I64], [I32]);
    imp.str_from_f64 = m.addImport('rt', 'str_from_f64', [F64], [I32]);
    imp.str_from_bool = m.addImport('rt', 'str_from_bool', [I32], [I32]);
    imp.substr = m.addImport('rt', 'substr', [I32, I64, I64, I32], [I32]);
    imp.byte_at = m.addImport('rt', 'byte_at', [I32, I64, I32], [I64]);
    imp.str_from_byte = m.addImport('rt', 'str_from_byte', [I64, I32], [I32]);
  }

  if (['read_file', 'write_file', 'file_exists'].some((b) => used.has(b))) {
    imp.read_file = m.addImport('fs', 'read_file', [I32], [I32]);
    imp.write_file = m.addImport('fs', 'write_file', [I32, I32], [I64]);
    imp.file_exists = m.addImport('fs', 'file_exists', [I32], [I32]);
  }
  if (used.has('http_get')) imp.http_get = m.addImport('net', 'http_get', [I32], [I32]);
  if (used.has('http_post')) imp.http_post = m.addImport('net', 'http_post', [I32, I32, I32], [I32]);
  if (['read_file', 'write_file', 'http_get', 'http_post'].some((b) => used.has(b))) imp.last_ok = m.addImport('rt', 'last_ok', [], [I32]);
  if (program.usesMaps) {
    // Maps are kept by the host and addressed by handle.
    const add = (name, params, results) => { imp[name] = m.addImport('rt', name, params, results); };
    add('map_new', [], [I32]);
    add('map_len', [I32], [I64]);
    add('map_copy', [I32], [I32]);
    add('map_remove_i', [I32, I64], [I32]);
    add('map_remove_s', [I32, I32], [I32]);
    for (const [kc, kt] of [['i', I64], ['s', I32]]) {
      add(`map_has_${kc}`, [I32, kt], [I32]);
      add(`map_keys_${kc}`, [I32], [I32]);
      for (const [vc, vt] of [['i64', I64], ['f64', F64], ['i32', I32]]) {
        add(`map_put_${kc}_${vc}`, [I32, kt, vt], []);
        add(`map_get_${kc}_${vc}`, [I32, kt, I32], [vt]);
        add(`map_get_or_${kc}_${vc}`, [I32, kt, vt], [vt]);
      }
    }
  }

  const i32c = (n) => [I32_CONST, ...sleb(n)];
  const i64c = (n) => [I64_CONST, ...sleb(n)];
  const failConst = (kind, site) => [...i32c(kind), ...i32c(site), CALL, ...uleb(imp.fail), UNREACHABLE];

  // ---- runtime helpers -------------------------------------------------
  // alloc(bytes: i32) -> i32      locals: 1 = p, 2 = end
  const alloc = m.declareFunc([I32], [I32]);
  alloc.locals = [I32, I32];
  alloc.body = [
    GGET, 0, LSET, 1,
    LGET, 1, LGET, 0, I32_ADD, ...i32c(7), I32_ADD, ...i32c(-8), I32_AND, LSET, 2,
    LGET, 2, LGET, 1, I32_LT_U, IF, VOID, ...failConst(FAIL.OOM, 0), END,
    LGET, 2, MEM_SIZE, 0, ...i32c(16), I32_SHL, I32_GT_U,
    IF, VOID,
    LGET, 2, MEM_SIZE, 0, ...i32c(16), I32_SHL, I32_SUB, ...i32c(65535), I32_ADD, ...i32c(16), I32_SHR_U,
    MEM_GROW, 0, ...i32c(-1), I32_EQ, IF, VOID, ...failConst(FAIL.OOM, 0), END,
    END,
    LGET, 2, GSET, 0,
    LGET, 1,
  ];

  // mul(a: i64, b: i64, site: i32) -> i64     local 3 = r
  const mul = m.declareFunc([I64, I64, I32], [I64]);
  mul.locals = [I64];
  const failSite2 = [...i32c(FAIL.OVERFLOW), LGET, 2, CALL, ...uleb(imp.fail), UNREACHABLE];
  const MIN = -(1n << 63n);
  mul.body = [
    LGET, 0, ...i64c(2147483648n), I64_ADD, LGET, 1, ...i64c(2147483648n), I64_ADD, I64_OR,
    ...i64c(32), I64_SHR_U, I64_EQZ,
    IF, I64,
    LGET, 0, LGET, 1, I64_MUL,
    ELSE,
    LGET, 0, I64_EQZ, LGET, 1, I64_EQZ, I32_OR,
    IF, I64,
    ...i64c(0),
    ELSE,
    LGET, 0, ...i64c(-1), I64_EQ, LGET, 1, ...i64c(MIN), I64_EQ, I32_AND,
    LGET, 1, ...i64c(-1), I64_EQ, LGET, 0, ...i64c(MIN), I64_EQ, I32_AND,
    I32_OR, IF, VOID, ...failSite2, END,
    LGET, 0, LGET, 1, I64_MUL, LTEE, 3, LGET, 1, I64_DIV_S, LGET, 0, I64_NE,
    IF, VOID, ...failSite2, END,
    LGET, 3,
    END,
    END,
  ];

  // arr_new(n: i64, init: T, site: i32) -> i32     locals: 3 = p, 4 = cur, 5 = end
  const arrNew = {};
  for (const [cls, vt, size, storeOp, align] of [['i64', I64, 8, I64_STORE, 3], ['f64', F64, 8, F64_STORE, 3], ['i8', I32, 1, I32_STORE8, 0], ['i32', I32, 4, I32_STORE, 2]]) {
    const f = m.declareFunc([I64, vt, I32], [I32]);
    f.locals = [I32, I32, I32];
    f.body = [
      LGET, 0, ...i64c(MAX_ARRAY_LEN), I64_GT_U,
      IF, VOID, ...i32c(FAIL.ARRSIZE), LGET, 2, CALL, ...uleb(imp.fail), UNREACHABLE, END,
      LGET, 0, I32_WRAP, ...i32c(size), I32_MUL, ...i32c(8), I32_ADD, CALL, ...uleb(alloc.index), LTEE, 3,
      LGET, 0, I32_WRAP, I32_STORE, 2, 0,
      LGET, 3, LGET, 0, I32_WRAP, I32_STORE, 2, 4,
      LGET, 3, ...i32c(8), I32_ADD, LSET, 4,
      LGET, 4, LGET, 0, I32_WRAP, ...i32c(size), I32_MUL, I32_ADD, LSET, 5,
      BLOCK, VOID, LOOP, VOID,
      LGET, 4, LGET, 5, I32_GE_U, BR_IF, 1,
      LGET, 4, LGET, 1, storeOp, align, 0,
      LGET, 4, ...i32c(size), I32_ADD, LSET, 4,
      BR, 0,
      END, END,
      LGET, 3,
    ];
    arrNew[cls] = f;
  }

  // room(arr: i32, shift: i32) -> i32: the array itself if it has spare capacity, else a copy
  // with twice the capacity.   locals: 2 = len, 3 = cap, 4 = new
  const room = m.declareFunc([I32, I32], [I32]);
  room.locals = [I32, I32, I32];
  room.body = [
    LGET, 0, I32_LOAD, 2, 0, LSET, 2, LGET, 0, I32_LOAD, 2, 4, LSET, 3,
    LGET, 2, LGET, 3, I32_LT_U,
    IF, I32,
    LGET, 0,
    ELSE,
    LGET, 3, I32_EQZ, IF, I32, ...i32c(4), ELSE, LGET, 3, ...i32c(1), I32_SHL, END, LSET, 3,
    LGET, 3, ...i32c(Number(MAX_ARRAY_LEN)), I32_GT_U, IF, VOID, ...failConst(FAIL.ARRSIZE, 0), END,
    LGET, 3, LGET, 1, I32_SHL, ...i32c(8), I32_ADD, CALL, ...uleb(alloc.index), LSET, 4,
    LGET, 4, LGET, 2, I32_STORE, 2, 0, LGET, 4, LGET, 3, I32_STORE, 2, 4,
    LGET, 4, ...i32c(8), I32_ADD, LGET, 0, ...i32c(8), I32_ADD, LGET, 2, LGET, 1, I32_SHL, 0xfc, 0x0a, 0x00, 0x00, // memory.copy
    LGET, 4,
    END,
  ];

  // ---- string literals --------------------------------------------------
  const strings = new Map();
  const enc = new TextEncoder();
  const intern = (s) => {
    if (!strings.has(s)) {
      while (m.data.length % 4) m.data.push(0);
      strings.set(s, 8 + m.data.length);
      const bytes = enc.encode(s);
      const len = bytes.length;
      m.data.push(len & 255, (len >> 8) & 255, (len >> 16) & 255, (len >> 24) & 255);
      for (const b of bytes) m.data.push(b);
    }
    return strings.get(s);
  };

  // ---- copy(x): deep copies, one generated function per type --------------
  const hasContainer = containerTest(program.types);
  const copyFns = new Map();
  const cls = (t) => (t === 'Int' ? 'i64' : t === 'Float' ? 'f64' : 'i32');
  const LD = { i64: I64_LOAD, f64: F64_LOAD, i32: I32_LOAD, i8: I32_LOAD8_U }, ST = { i64: I64_STORE, f64: F64_STORE, i32: I32_STORE, i8: I32_STORE8 };
  function copyFn(t) {
    if (!hasContainer(t)) return null;
    if (copyFns.has(t)) return copyFns.get(t).index;
    if (isMap(t)) return imp.map_copy;
    const f = m.declareFunc([I32], [I32]); // param 0 = source; locals 1 = copy, 2 = i, 3 = n
    copyFns.set(t, f);
    f.locals = [I32, I32, I32];
    const c = [];
    const slot = (ft, off) => { // copies one 8-byte slot holding a value of type ft
      const k = cls(ft), al = k === 'i32' ? 2 : 3, inner = copyFn(ft);
      c.push(LGET, 1, LGET, 0, LD[k], al, ...uleb(off));
      if (inner !== null) c.push(CALL, ...uleb(inner));
      c.push(ST[k], al, ...uleb(off));
    };
    if (isArr(t)) {
      const et = elemOf(t), k = elemClass(et), sh = elemShift(et), inner = copyFn(et);
      c.push(LGET, 0, I32_LOAD, 2, 0, LSET, 3);
      c.push(LGET, 3, ...i32c(sh), I32_SHL, ...i32c(8), I32_ADD, CALL, ...uleb(alloc.index), LTEE, 1, LGET, 3, I32_STORE, 2, 0);
      c.push(LGET, 1, LGET, 3, I32_STORE, 2, 4);
      c.push(...i32c(0), LSET, 2, BLOCK, VOID, LOOP, VOID, LGET, 2, LGET, 3, I32_GE_U, BR_IF, 1);
      c.push(LGET, 1, LGET, 2, ...i32c(sh), I32_SHL, I32_ADD);
      c.push(LGET, 0, LGET, 2, ...i32c(sh), I32_SHL, I32_ADD, LD[k], sh, 8);
      if (inner !== null) c.push(CALL, ...uleb(inner));
      c.push(ST[k], sh, 8, LGET, 2, ...i32c(1), I32_ADD, LSET, 2, BR, 0, END, END);
    } else if (program.types.structs.has(t)) {
      const fields = program.types.structs.get(t).fields;
      c.push(...i32c(8 * fields.length), CALL, ...uleb(alloc.index), LSET, 1);
      fields.forEach((fd, i) => slot(fd.ty, 8 * i));
    } else {
      const vs = program.types.enums.get(t).variants;
      const slots = 1 + Math.max(...vs.map((v) => v.fields.length));
      c.push(...i32c(8 * slots), CALL, ...uleb(alloc.index), LSET, 1);
      for (const v of vs) {
        c.push(LGET, 0, I64_LOAD, 3, 0, ...i64c(v.index), I64_EQ, IF, VOID, LGET, 1, ...i64c(v.index), I64_STORE, 3, 0);
        v.fields.forEach((fd, i) => slot(fd.ty, 8 * (i + 1)));
        c.push(END);
      }
    }
    c.push(LGET, 1);
    f.body = c;
    return f.index;
  }

  // ---- user functions ---------------------------------------------------
  for (const f of program.fns) {
    // An array parameter that may grow is handed back as an extra result, so the caller can follow a reallocation.
    f.wasm = m.declareFunc(f.params.map((p) => wt(p.ty)), [...(f.ret === 'Unit' ? [] : [wt(f.ret)]), ...f.params.filter((p) => p.grows).map(() => I32)]);
  }
  for (const t of program.tests) t.wasm = m.declareFunc([], []);

  function genFn(owner, isTest) {
    const fnName = isTest ? `test "${owner.name}"` : owner.name;
    const c = [];
    let depth = 0;
    const params = isTest ? [] : owner.paramSyms;
    let idx = 0;
    for (const p of params) p.idx = idx++;
    const localTypes = [];
    const addLocal = (ty) => { localTypes.push(ty); return idx++; };
    for (const s of owner.locals) s.idx = addLocal(wt(s.ty));
    const t1 = addLocal(I64), t2 = addLocal(I64), t3 = addLocal(I64), p1 = addLocal(I32);

    const emit = (...bytes) => { for (const b of bytes) c.push(b); };
    const site = (node, text = '') => { sites.push({ fn: fnName, file: node.file ?? owner.file, line: node.line, col: node.col, text }); return sites.length - 1; };
    const fail = (kind, node, text) => emit(...failConst(kind, site(node, text)));
    const lget = (i) => emit(LGET, ...uleb(i));
    const lset = (i) => emit(LSET, ...uleb(i));
    const ltee = (i) => emit(LTEE, ...uleb(i));
    const call = (i) => emit(CALL, ...uleb(i));

    // Stack: [a, b] -> [a op b], trapping on signed overflow.
    function checkedAddSub(isAdd, node) {
      if (!checked) { emit(isAdd ? I64_ADD : I64_SUB); return; }
      lset(t2); lset(t1);
      lget(t1); lget(t2); emit(isAdd ? I64_ADD : I64_SUB); lset(t3);
      if (isAdd) {
        lget(t3); lget(t1); emit(I64_XOR); lget(t3); lget(t2); emit(I64_XOR);
      } else {
        lget(t1); lget(t2); emit(I64_XOR); lget(t1); lget(t3); emit(I64_XOR);
      }
      emit(I64_AND, ...i64c(0), I64_LT_S, IF, VOID);
      fail(FAIL.OVERFLOW, node);
      emit(END);
      lget(t3);
    }

    // Stack: [] -> [address of element]; leaves nothing else. Performs the bounds check.
    // The index is evaluated before the array is read: an index (or a stored value) that calls a
    // function which grows the array would otherwise leave a stale address behind.
    function elemAddr(e) {
      expr(e.index);
      expr(e.base);
      lset(p1); lset(t1);
      lget(t1); lget(p1); emit(I32_LOAD, 2, 0, I64_EXTEND_U, I64_GE_U, IF, VOID);
      fail(FAIL.BOUNDS, e);
      emit(END);
      lget(p1); lget(t1); emit(I32_WRAP, ...i32c(elemShift(elemOf(e.base.ty))), I32_SHL, I32_ADD);
    }
    const LOAD = { i64: I64_LOAD, f64: F64_LOAD, i8: I32_LOAD8_U, i32: I32_LOAD };
    const STORE = { i64: I64_STORE, f64: F64_STORE, i8: I32_STORE8, i32: I32_STORE };
    const fieldClass = (t) => (t === 'Int' ? 'i64' : t === 'Float' ? 'f64' : 'i32');
    const loadElem = (t) => emit(LOAD[elemClass(t)], elemShift(t), 8);
    const storeElem = (t) => emit(STORE[elemClass(t)], elemShift(t), 8);

    const storeTemps = new Map();
    const storeTemp = (ty) => { if (!storeTemps.has(ty)) storeTemps.set(ty, addLocal(ty)); return storeTemps.get(ty); };
    const storeIndex = addLocal(I64);
    // Reads a string that is being built without keeping it: its length or one of its bytes.
    const quiet = (e) => { if (e.kind === 'Name' && e.sym.wb) lget(e.sym.idx); else expr(e); };
    function expr(e) {
      switch (e.kind) {
        case 'Held': lget(storeIndex); break;
        case 'Cond': expr(e.cond); emit(IF, wt(e.ty)); expr(e.then); emit(ELSE); expr(e.els); emit(END); break;
        case 'IntLit': emit(...i64c(e.value)); break;
        case 'FloatLit': emit(F64_CONST, ...f64bytes(e.value)); break;
        case 'BoolLit': emit(...i32c(e.value ? 1 : 0)); break;
        case 'StrLit': emit(...i32c(intern(e.value))); break;
        case 'Name':
          // a string that is being built: anything that keeps its value stops it growing in place
          if (e.sym.wb) { emit(...i32c(1)); lset(e.sym.wb.shared); }
          lget(e.sym.idx);
          break;
        case 'Unary':
          if (e.op === 'not') { expr(e.operand); emit(I32_EQZ); }
          else if (e.ty === 'Float') { expr(e.operand); emit(F64_NEG); }
          else { emit(...i64c(0)); expr(e.operand); checkedAddSub(false, e); }
          break;
        case 'Binary': binary(e); break;
        case 'Index': elemAddr(e); loadElem(e.ty); break;
        case 'ArrayLit': {
          const et = elemOf(e.ty), sh = elemShift(et), tmp = e.tmpSym.idx;
          emit(...i32c(8 + (e.elems.length << sh))); call(alloc.index); ltee(tmp);
          emit(...i32c(e.elems.length), I32_STORE, 2, 0);
          lget(tmp); emit(...i32c(e.elems.length), I32_STORE, 2, 4);
          e.elems.forEach((el, k) => {
            lget(tmp); expr(el);
            emit(STORE[elemClass(et)], sh, ...uleb(8 + (k << sh)));
          });
          lget(tmp);
          break;
        }
        case 'Call': callExpr(e); break;
        case 'New': {
          // Struct values live on the heap, one 8-byte slot per field. They are immutable, so sharing is safe.
          // An enum variant has its tag in slot 0 and its fields after it.
          const tmp = e.tmpSym.idx, isVariant = e.variantIndex !== null, base = isVariant ? 1 : 0;
          emit(...i32c(8 * (e.fields.length + base))); call(alloc.index); lset(tmp);
          if (isVariant) { lget(tmp); emit(...i64c(e.variantIndex), I64_STORE, 3, 0); }
          e.fields.forEach((f, k) => {
            lget(tmp); expr(f.expr);
            emit(STORE[fieldClass(f.expr.ty)], fieldClass(f.expr.ty) === 'i32' ? 2 : 3, ...uleb(8 * (k + base)));
          });
          lget(tmp);
          break;
        }
        case 'Field':
          expr(e.base);
          emit(LOAD[fieldClass(e.ty)], fieldClass(e.ty) === 'i32' ? 2 : 3, ...uleb(8 * e.fieldIndex));
          break;
        case 'Sum': sumExpr(e); break;
        case 'Comp': compExpr(e); break;
        case 'MapLit': call(imp.map_new); break;
        default: throw new Error(`codegen: unknown expr ${e.kind}`);
      }
    }

    // Sequential evaluation; the Int total is kept in 128 bits so the result does not
    // depend on evaluation order, matching the parallel native backend.
    // Region marks: save the heap pointer, and put it back once the allocations are dead.
    const markHeap = () => { const mk = addLocal(I32); emit(GGET, 0); lset(mk); return mk; };
    // In a poison build the reclaimed bytes are overwritten first (memory.fill), so a value that
    // was handed back too early cannot go unnoticed.
    const resetHeap = (mk) => {
      if (opts.poison) { lget(mk); emit(...i32c(0xa5), GGET, 0); lget(mk); emit(0x6b, 0xfc, 0x0b, 0x00); }
      lget(mk); emit(GSET, 0);
    };

    function compExpr(e) {
      const i = e.sym.idx, end = e.endSym.idx, arr = e.arrSym.idx, cur = e.curSym.idx;
      const et = e.ty.slice(1, -1), sh = elemShift(et);
      expr(e.start); lset(i);
      expr(e.end); lset(end);
      lget(end); lget(i); emit(I64_GT_S, IF, I64); lget(end); lget(i); emit(I64_SUB, ELSE, ...i64c(0), END); lset(t1);
      lget(t1); emit(...i64c(MAX_ARRAY_LEN), I64_GT_U, IF, VOID);
      fail(FAIL.ARRSIZE, e);
      emit(END);
      lget(t1); emit(I32_WRAP, ...i32c(sh), I32_SHL, ...i32c(8), I32_ADD); call(alloc.index); ltee(arr);
      lget(t1); emit(I32_WRAP, I32_STORE, 2, 0);
      lget(arr); lget(t1); emit(I32_WRAP, I32_STORE, 2, 4);
      lget(arr); emit(...i32c(8), I32_ADD); lset(cur);
      emit(BLOCK, VOID, LOOP, VOID);
      lget(i); lget(end); emit(I64_GE_S, BR_IF, 1);
      const mk = e.iterReset ? markHeap() : null;
      lget(cur); expr(e.body); emit(STORE[elemClass(et)], sh, 0);
      if (e.iterReset) resetHeap(mk);
      lget(cur); emit(...i32c(1 << sh), I32_ADD); lset(cur);
      lget(i); emit(...i64c(1), I64_ADD); lset(i);
      emit(BR, 0, END, END);
      lget(arr);
    }

    function sumExpr(e) {
      const i = e.sym.idx, end = e.endSym.idx, lo = e.accSym.idx, hi = e.accHiSym.idx;
      expr(e.start); lset(i);
      expr(e.end); lset(end);
      if (e.ty === 'Float') emit(F64_CONST, ...f64bytes(0)); else emit(...i64c(0));
      lset(lo);
      emit(...i64c(0)); lset(hi);
      emit(BLOCK, VOID, LOOP, VOID);
      lget(i); lget(end); emit(I64_GE_S, BR_IF, 1);
      const mk = e.iterReset ? markHeap() : null;
      if (e.ty === 'Float') {
        lget(lo); expr(e.body); emit(F64_ADD); lset(lo);
      } else {
        expr(e.body); lset(t1);
        lget(lo); lget(t1); emit(I64_ADD); lset(lo);
        lget(hi); lget(t1); emit(...i64c(63), I64_SHR_S, I64_ADD);
        lget(lo); lget(t1); emit(I64_LT_U, I64_EXTEND_U, I64_ADD); lset(hi);
      }
      if (e.iterReset) resetHeap(mk);
      lget(i); emit(...i64c(1), I64_ADD); lset(i);
      emit(BR, 0, END, END);
      if (e.ty !== 'Float') {
        lget(hi); lget(lo); emit(...i64c(63), I64_SHR_S, I64_NE, IF, VOID);
        fail(FAIL.OVERFLOW, e);
        emit(END);
      }
      lget(lo);
    }

    function binary(e) {
      const { op } = e;
      if (op === 'and') { expr(e.left); emit(IF, I32); expr(e.right); emit(ELSE, ...i32c(0), END); return; }
      if (op === 'or') { expr(e.left); emit(IF, I32, ...i32c(1), ELSE); expr(e.right); emit(END); return; }
      const t = e.left.ty;
      expr(e.left);
      expr(e.right);
      if (t === 'Str') {
        if (op === '+') call(imp.str_concat);
        else if (op === '==' || op === '!=') { call(imp.str_eq); if (op === '!=') emit(I32_EQZ); }
        else { call(imp.str_cmp); emit(...i32c(0), { '<': 0x48, '>': 0x4a, '<=': 0x4c, '>=': 0x4e }[op]); } // i32 signed compares
      } else if (t === 'Float') {
        emit({ '+': F64_ADD, '-': F64_SUB, '*': F64_MUL, '/': F64_DIV, '==': F64_EQ, '!=': F64_NE, '<': F64_LT, '>': F64_GT, '<=': F64_LE, '>=': F64_GE }[op]);
      } else if (t === 'Bool') {
        emit(op === '==' ? I32_EQ : I32_NE);
      } else if (op === '+' || op === '-') {
        checkedAddSub(op === '+', e);
      } else if (op === '*') {
        if (!checked) { emit(I64_MUL); return; }
        // Fast path inline: if both operands fit in 32 bits the product cannot overflow.
        lset(t2); lset(t1);
        lget(t1); emit(...i64c(2147483648n), I64_ADD); lget(t2); emit(...i64c(2147483648n), I64_ADD, I64_OR,
          ...i64c(32), I64_SHR_U, I64_EQZ, IF, I64);
        lget(t1); lget(t2); emit(I64_MUL, ELSE);
        lget(t1); lget(t2); emit(...i32c(site(e))); call(mul.index);
        emit(END);
      } else if (op === '/' || op === '%') {
        lset(t2); lget(t2); emit(I64_EQZ, IF, VOID);
        fail(FAIL.DIVZERO, e);
        emit(END);
        lget(t2); emit(op === '/' ? I64_DIV_S : I64_REM_S);
      } else {
        emit({ '==': I64_EQ, '!=': I64_NE, '<': I64_LT_S, '>': I64_GT_S, '<=': I64_LE_S, '>=': I64_GE_S }[op]);
      }
    }

    const hasCall = (n) => { let found = false; walk(n, (x) => { if (x.kind === 'Call') found = true; }); return found; };
    function callExpr(e) {
      if (e.fn) {
        // A growable array is passed by its current address and handed back after the call. If
        // another argument can itself grow that array (a nested call), the address must be read
        // after every other argument has been evaluated, or the nested growth is lost.
        const grows = e.fn.params.map((p) => p.grows);
        if (grows.some(Boolean) && e.args.some((a, i) => !grows[i] && hasCall(a))) {
          const held = e.args.map((a, i) => { if (grows[i]) return null; const t = addLocal(wt(e.fn.params[i].ty)); expr(a); lset(t); return t; });
          e.args.forEach((a, i) => { if (grows[i]) expr(a); else lget(held[i]); });
        } else {
          e.args.forEach(expr);
        }
        call(e.fn.wasm.index);
        for (let i = e.fn.params.length - 1; i >= 0; i--) if (e.fn.params[i].grows) lset(e.args[i].sym.idx);
        return;
      }
      switch (e.name) {
        case 'print':
          e.args.forEach((a, k) => { expr(a); lset(e.argTmps[k].idx); });
          e.args.forEach((a, k) => {
            lget(e.argTmps[k].idx);
            call({ Int: imp.print_i64, Float: imp.print_f64, Bool: imp.print_bool, Str: imp.print_str }[a.ty]);
          });
          call(imp.print_end);
          break;
        case 'len':
          quiet(e.args[0]);
          if (isMap(e.args[0].ty)) call(imp.map_len); else emit(I32_LOAD, 2, 0, I64_EXTEND_U);
          break;
        case 'push': {
          const arr = e.args[0].sym.idx, val = e.tmpSym.idx, et = e.args[1].ty, sh = elemShift(et);
          expr(e.args[1]); lset(val);
          lget(arr); emit(...i32c(sh)); call(room.index); lset(arr);
          lget(arr); lget(arr); emit(I32_LOAD, 2, 0, ...i32c(sh), I32_SHL, I32_ADD); lget(val); emit(STORE[elemClass(et)], sh, 8);
          lget(arr); lget(arr); emit(I32_LOAD, 2, 0, ...i32c(1), I32_ADD, I32_STORE, 2, 0);
          break;
        }
        case 'pop': {
          const sh = elemShift(e.ty);
          expr(e.args[0]); lset(p1);
          lget(p1); emit(I32_LOAD, 2, 0, I32_EQZ, IF, VOID);
          fail(FAIL.BOUNDS, e);
          emit(END);
          lget(p1); lget(p1); emit(I32_LOAD, 2, 0, ...i32c(1), I32_SUB, I32_STORE, 2, 0);
          lget(p1); lget(p1); emit(I32_LOAD, 2, 0, ...i32c(sh), I32_SHL, I32_ADD, LOAD[elemClass(e.ty)], sh, 8);
          break;
        }
        case 'copy': {
          expr(e.args[0]);
          const c = copyFn(e.ty);
          if (c !== null) call(c);
          break;
        }
        case 'read_file': case 'http_get': case 'http_post': case 'write_file': {
          // The host returns the value (or the reason for failure); last_ok says which.
          const tmp = e.tmpSym.idx, isWrite = e.name === 'write_file';
          e.args.forEach(expr);
          call(imp[e.name]);
          if (isWrite) lset(t1); else lset(p1);
          emit(...i32c(16)); call(alloc.index); lset(tmp);
          lget(tmp); call(imp.last_ok); emit(I32_EQZ, I64_EXTEND_U, I64_STORE, 3, 0);
          if (isWrite) {
            call(imp.last_ok); emit(IF, VOID); lget(tmp); lget(t1); emit(I64_STORE, 3, 8);
            emit(ELSE); lget(tmp); lget(t1); emit(I32_WRAP, I32_STORE, 2, 8, END);
          } else {
            lget(tmp); lget(p1); emit(I32_STORE, 2, 8);
          }
          lget(tmp);
          break;
        }
        case 'file_exists': expr(e.args[0]); call(imp.file_exists); break;
        case 'put': case 'get': case 'get_or': case 'has': case 'keys': case 'remove': {
          const [kt, vt] = mapParts(e.args[0].ty);
          const kc = kt === 'Str' ? 's' : 'i', vc = fieldClass(vt);
          e.args.forEach(expr);
          if (e.name === 'get') emit(...i32c(site(e)));
          if (e.name === 'remove') { call(imp[`map_remove_${kc}`]); break; }
          call(imp[{ put: `map_put_${kc}_${vc}`, get: `map_get_${kc}_${vc}`, get_or: `map_get_or_${kc}_${vc}`, has: `map_has_${kc}`, keys: `map_keys_${kc}` }[e.name]]);
          break;
        }
        case 'array':
          expr(e.args[0]); expr(e.args[1]);
          emit(...i32c(site(e)));
          call(arrNew[elemClass(e.args[1].ty)].index);
          break;
        case 'float': expr(e.args[0]); emit(F64_CONVERT_I64); break;
        case 'int': expr(e.args[0]); emit(I64_TRUNC_F64); break;
        case 'sqrt': expr(e.args[0]); emit(F64_SQRT); break;
        case 'bit_and': case 'bit_or': case 'bit_xor':
          expr(e.args[0]); expr(e.args[1]); emit({ bit_and: I64_AND, bit_or: I64_OR, bit_xor: I64_XOR }[e.name]);
          break;
        case 'shift_left': case 'shift_right':
          // the count must be 0 to 63; bits shifted out are dropped
          expr(e.args[0]); expr(e.args[1]); lset(t1); lset(t2);
          lget(t1); emit(...i64c(63), I64_GT_U, IF, VOID);
          fail(FAIL.OVERFLOW, e);
          emit(END);
          lget(t2); lget(t1); emit(e.name === 'shift_left' ? 0x86 : I64_SHR_S);
          break;
        case 'now_ms': call(imp.now_ms); break;
        case 'str':
          expr(e.args[0]);
          call({ Int: imp.str_from_i64, Float: imp.str_from_f64, Bool: imp.str_from_bool }[e.args[0].ty]);
          break;
        case 'substr':
          e.args.forEach(expr); emit(...i32c(site(e))); call(imp.substr);
          break;
        case 'byte_at':
          // a string is its length (4 bytes) followed by its bytes
          quiet(e.args[0]); expr(e.args[1]);
          lset(t1); lset(p1);
          lget(t1); lget(p1); emit(I32_LOAD, 2, 0, I64_EXTEND_U, I64_GE_U, IF, VOID);
          fail(FAIL.BOUNDS, e);
          emit(END);
          lget(p1); lget(t1); emit(I32_WRAP, I32_ADD, I32_LOAD8_U, 0, 4, I64_EXTEND_U);
          break;
        case 'chr':
          expr(e.args[0]); emit(...i32c(site(e))); call(imp.str_from_byte);
          break;
        default: throw new Error(`codegen: unknown builtin ${e.name}`);
      }
    }

    function block(stmts) { for (const s of stmts) stmt(s); }
    const loops = []; // { depth: block depth inside the body, mk: heap mark or null }
    function loopBody(s) {
      const mk = s.iterReset ? markHeap() : null;
      emit(BLOCK, VOID);
      depth++;
      loops.push({ depth, mk });
      block(s.body);
      loops.pop();
      depth--;
      emit(END);
      if (mk !== null) resetHeap(mk);
    }

    function stmt(s) {
      switch (s.kind) {
        case 'Let':
          expr(s.init); lset(s.sym.idx);
          if (s.mutable && s.sym.ty === 'Str') {
            s.sym.wb ??= { cap: addLocal(I32), shared: addLocal(I32) };
            emit(...i32c(0)); lset(s.sym.wb.cap);
            emit(...i32c(1)); lset(s.sym.wb.shared);
          }
          break;
        case 'Assign':
          if (s.target.kind === 'Name' && s.target.sym.wb) {
            // x = x + a + b: append in place when x owns its buffer and has room
            const sym = s.target.sym, added = [];
            let left = s.value;
            while (left.kind === 'Binary' && left.op === '+' && left.ty === 'Str') { added.unshift(left.right); left = left.left; }
            const mentions = (n) => { let found = false; walk(n, (x) => { if (x.kind === 'Name' && x.sym === sym) found = true; }); return found; };
            if (added.length && left.kind === 'Name' && left.sym === sym && !added.some(mentions)) {
              for (const a of added) {
                lget(sym.idx); expr(a); lget(sym.wb.cap); lget(sym.wb.shared);
                call(imp.str_append);
                lset(sym.wb.cap); lset(sym.idx);
                emit(...i32c(0)); lset(sym.wb.shared);
              }
            } else {
              expr(s.value); lset(sym.idx);
              emit(...i32c(1)); lset(sym.wb.shared);
            }
          } else if (s.target.kind === 'Name') { expr(s.value); lset(s.target.sym.idx); }
          else {
            const held = storeTemp(wt(s.target.ty));
            expr(s.target.index); lset(storeIndex);
            expr(s.value); lset(held);
            elemAddr({ ...s.target, index: { kind: 'Held' } });
            lget(held); storeElem(s.target.ty);
          }
          break;
        case 'If':
          expr(s.cond); emit(IF, VOID);
          depth++; block(s.then);
          if (s.els) { emit(ELSE); block(s.els); }
          depth--; emit(END);
          break;
        case 'While':
          contracts(s.invariants ?? [], FAIL.INVARIANT);
          emit(BLOCK, VOID, LOOP, VOID);
          expr(s.cond); emit(I32_EQZ, BR_IF, 1);
          depth += 2; loopBody(s); depth -= 2;
          contracts(s.invariants ?? [], FAIL.INVARIANT);
          emit(BR, 0, END, END);
          break;
        case 'For':
          expr(s.start); lset(s.sym.idx);
          expr(s.end); lset(s.endSym.idx);
          emit(BLOCK, VOID, LOOP, VOID);
          lget(s.sym.idx); lget(s.endSym.idx); emit(I64_GE_S, BR_IF, 1);
          depth += 2; loopBody(s); depth -= 2;
          lget(s.sym.idx); emit(...i64c(1), I64_ADD); lset(s.sym.idx);
          emit(BR, 0, END, END);
          break;
        case 'Match': {
          const sc = s.scrutSym.idx;
          expr(s.scrut); lset(sc);
          const arms = s.arms.filter((a) => a.variant !== null), other = s.arms.find((a) => a.variant === null);
          const go = (k) => {
            if (k === arms.length) { if (other) block(other.body); return; }
            const arm = arms[k];
            lget(sc); emit(I64_LOAD, 3, 0, ...i64c(arm.index), I64_EQ, IF, VOID);
            depth++;
            arm.syms.forEach((sym, i) => {
              if (!sym) return;
              const cls = fieldClass(sym.ty);
              lget(sc); emit(LOAD[cls], cls === 'i32' ? 2 : 3, ...uleb(8 * (i + 1))); lset(sym.idx);
            });
            block(arm.body);
            emit(ELSE);
            go(k + 1);
            depth--;
            emit(END);
          };
          go(0);
          break;
        }
        case 'Continue':
          emit(BR, ...uleb(depth - loops[loops.length - 1].depth));
          break;
        case 'Break': {
          const loop = loops[loops.length - 1];
          if (loop.mk !== null) resetHeap(loop.mk);
          emit(BR, ...uleb(depth - loop.depth + 2));
          break;
        }
        case 'Return':
          if (s.value) { expr(s.value); lset(owner.resultSym.idx); }
          emit(BR, ...uleb(depth));
          break;
        case 'Assert':
          expr(s.cond); emit(I32_EQZ, IF, VOID);
          fail(FAIL.ASSERT, s, s.text);
          emit(END);
          break;
        case 'ExprStmt':
          expr(s.expr);
          if (s.expr.ty !== 'Unit') emit(DROP);
          break;
        default: throw new Error(`codegen: unknown stmt ${s.kind}`);
      }
    }

    const contracts = (list, kind) => {
      for (const cl of list) {
        expr(cl.expr); emit(I32_EQZ, IF, VOID);
        fail(kind, cl, cl.text);
        emit(END);
      }
    };

    const fnMark = !isTest && owner.regionReset ? markHeap() : null;
    if (!isTest) contracts(owner.requires, FAIL.REQUIRES);
    emit(BLOCK, VOID);
    block(owner.body);
    if (!isTest && owner.ret !== 'Unit') emit(UNREACHABLE);
    emit(END);
    if (!isTest) {
      contracts(owner.ensures, FAIL.ENSURES);
      if (fnMark !== null) resetHeap(fnMark);
      if (owner.ret !== 'Unit') lget(owner.resultSym.idx);
      owner.params.forEach((p, i) => { if (p.grows) lget(owner.paramSyms[i].idx); });
    }
    owner.wasm.locals = localTypes;
    owner.wasm.body = c;
  }

  for (const f of program.fns) genFn(f, false);
  for (const t of program.tests) genFn(t, true);

  if (program.main) m.exportFunc('main', program.main.wasm.index);
  m.exportFunc('__alloc', alloc.index);
  program.tests.forEach((t, i) => m.exportFunc(`test_${i}`, t.wasm.index));

  m.heapStart = (8 + m.data.length + 7) & ~7;
  m.minPages = Math.max(1, Math.ceil((m.heapStart + 1) / 65536));

  const meta = {
    sites,
    effects: program.main ? [...program.main.effectSet] : [],
    tests: program.tests.map((t) => ({ name: t.name, line: t.line })),
    hasMain: !!program.main,
  };
  m.customs.push({ name: 'avisoq.meta', text: JSON.stringify(meta) });
  return { wasm: m.encode(), meta };
}
