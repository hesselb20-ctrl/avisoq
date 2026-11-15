// Using Avisoq from another language.
//
// From JavaScript:
//
//   import { load } from 'avisoq';
//   const scoring = await load('scoring.avq');           // compiles the file, sandboxed
//   scoring.score([3, 5, 8], "strict")                   // calls fn score(xs: [Int], mode: Str)
//
// From anything else, through `avisoq serve file.avq`, which answers one JSON request per line
// (see serve() below); bindings/python/avisoq.py wraps that for Python.
//
// Values cross the boundary like this:
//   Int      number or bigint in; number out when it is exact, bigint otherwise
//   Float    number            Bool   boolean            Str   string
//   [T]      array             (A, B) array              struct   object with its fields
//   enum     { variant: "Name", field: value, ... }
// A function can be called this way if it takes no `mut`, Map or function parameters.
// The module runs in the WebAssembly sandbox and gets only the capabilities in `allow`.
// With { native: true } it is compiled to machine code and called in this process instead:
// the speed of a native program, without the sandbox (see src/embed-native.mjs).
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { compile, instantiate } from './compiler.mjs';
import { elemOf, isArr, typeHead } from './types.mjs';

export class AvisoqError extends Error {
  constructor(message, info) { super(message); this.name = 'AvisoqError'; Object.assign(this, info); }
}

const I64_MIN = -(2n ** 63n), I64_MAX = 2n ** 63n - 1n;
const slot = (ty) => (ty === 'Int' ? 'i64' : ty === 'Float' ? 'f64' : 'i32');
const elemSize = (ty) => (ty === 'Int' || ty === 'Float' ? 8 : ty === 'Bool' ? 1 : 4);

// timeLimitMs and memoryLimitMb bound every call: one that runs too long or asks for too much
// memory stops with an AvisoqError of kind 'time_limit' or 'out_of_memory', and the module stays
// usable. They are what makes it reasonable to run code nobody has reviewed.
// host: { name: function } gives the code the functions it declares with extern "host"; they
// are its only way to reach your program.
export async function load(path, { allow = [], source, native = false, portable = false, timeLimitMs = 0, memoryLimitMb = 0, host = {}, waits = false } = {}) {
  // waits: true lets host functions return promises; every function of the module then returns one too.
  // native: true compiles to machine code and calls it in this process (src/embed-native.mjs).
  if (native) return (await import('./embed-native.mjs')).loadNative(path, { allow, source, portable, timeLimitMs, memoryLimitMb }, { AvisoqError });
  const src = source ?? readFileSync(path, 'utf8');
  const limits = { deadline: 0 };
  const compiled = compile(src, { backend: 'wasm', path, allow, exports: true, budget: timeLimitMs > 0, memoryLimitMb });
  if (!compiled.ok) {
    const d = compiled.diagnostics[0];
    throw new AvisoqError(`${path}:${d.line}:${d.col}: error[${d.code}]: ${d.message}`, { kind: 'compile', diagnostics: compiled.diagnostics });
  }
  let printed = '';
  const instance = await instantiate(compiled.wasm, compiled.meta, { allow, limits, host, waits, write: (s) => { printed += s; } });
  const ex = instance.exports;
  const { structs, enums } = compiled.meta.types;
  const enc = new TextEncoder(), dec = new TextDecoder();
  const view = () => new DataView(ex.memory.buffer);

  const put = (v, at, cls, raw) => (cls === 'i64' ? v.setBigInt64(at, raw, true) : cls === 'f64' ? v.setFloat64(at, raw, true) : v.setUint32(at, raw, true));
  const get = (v, at, cls) => (cls === 'i64' ? v.getBigInt64(at, true) : cls === 'f64' ? v.getFloat64(at, true) : v.getUint32(at, true));
  const bad = (what, ty, value) => new AvisoqError(`${what}: expected ${ty} but got ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`, { kind: 'argument' });

  // A JavaScript value as the raw value WebAssembly expects for this type.
  function toRaw(value, ty, what) {
    if (ty === 'Int') {
      let n;
      try { n = typeof value === 'bigint' ? value : typeof value === 'number' && Number.isInteger(value) ? BigInt(value) : typeof value === 'string' && /^-?\d+$/.test(value) ? BigInt(value) : null; } catch { n = null; }
      if (n === null || n < I64_MIN || n > I64_MAX) throw bad(what, 'an Int (a whole number that fits in 64 bits)', value);
      return n;
    }
    if (ty === 'Float') { if (typeof value !== 'number') throw bad(what, 'a Float', value); return value; }
    if (ty === 'Bool') { if (typeof value !== 'boolean') throw bad(what, 'a Bool', value); return value ? 1 : 0; }
    if (ty === 'Str') {
      if (typeof value !== 'string') throw bad(what, 'a Str', value);
      const bytes = enc.encode(value);
      const ptr = ex.__alloc(4 + bytes.length);
      view().setUint32(ptr, bytes.length, true);
      new Uint8Array(ex.memory.buffer).set(bytes, ptr + 4);
      return ptr;
    }
    if (isArr(ty)) {
      if (!Array.isArray(value)) throw bad(what, `an array (${ty})`, value);
      const et = elemOf(ty), size = elemSize(et);
      const raws = value.map((x, i) => toRaw(x, et, `${what}[${i}]`));
      const ptr = ex.__alloc(8 + raws.length * size);
      const v = view();
      v.setUint32(ptr, raws.length, true);
      v.setUint32(ptr + 4, raws.length, true);
      raws.forEach((r, i) => (size === 1 ? v.setUint8(ptr + 8 + i, r) : put(v, ptr + 8 + i * size, slot(et), r)));
      return ptr;
    }
    const st = structs[ty];
    if (st) {
      const tuple = /^Tuple[2-4]$/.test(typeHead(ty));
      if (tuple ? !Array.isArray(value) || value.length !== st.length : value === null || typeof value !== 'object') throw bad(what, tuple ? `a tuple of ${st.length}` : `an object (${ty})`, value);
      const raws = st.map((f, i) => toRaw(tuple ? value[i] : value[f.name], f.ty, `${what}.${f.name}`));
      const ptr = ex.__alloc(8 * st.length);
      const v = view();
      raws.forEach((r, i) => put(v, ptr + 8 * i, slot(st[i].ty), r));
      return ptr;
    }
    const en = enums[ty];
    if (en) {
      const index = value && typeof value === 'object' ? en.findIndex((x) => x.name === value.variant) : -1;
      if (index < 0) throw bad(what, `{ variant: ${en.map((x) => `"${x.name}"`).join(' | ')}, ... } (${ty})`, value);
      const fields = en[index].fields;
      const raws = fields.map((f) => toRaw(value[f.name], f.ty, `${what}.${f.name}`));
      const ptr = ex.__alloc(8 * (fields.length + 1));
      const v = view();
      v.setBigInt64(ptr, BigInt(index), true);
      raws.forEach((r, i) => put(v, ptr + 8 * (i + 1), slot(fields[i].ty), r));
      return ptr;
    }
    throw new AvisoqError(`${what}: values of type ${ty} cannot be passed in`, { kind: 'argument' });
  }

  function fromRaw(raw, ty) {
    if (ty === 'Int') return raw >= BigInt(Number.MIN_SAFE_INTEGER) && raw <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(raw) : raw;
    if (ty === 'Float') return raw;
    if (ty === 'Bool') return raw !== 0;
    const v = view();
    if (ty === 'Str') return dec.decode(new Uint8Array(ex.memory.buffer, raw + 4, v.getUint32(raw, true)));
    if (isArr(ty)) {
      const et = elemOf(ty), size = elemSize(et), n = v.getUint32(raw, true), out = [];
      for (let i = 0; i < n; i++) out.push(fromRaw(size === 1 ? v.getUint8(raw + 8 + i) : get(v, raw + 8 + i * size, slot(et)), et));
      return out;
    }
    const st = structs[ty];
    if (st) {
      const parts = st.map((f, i) => fromRaw(get(v, raw + 8 * i, slot(f.ty)), f.ty));
      return /^Tuple[2-4]$/.test(typeHead(ty)) ? parts : Object.fromEntries(st.map((f, i) => [f.name, parts[i]]));
    }
    const en = enums[ty];
    if (en) {
      const variant = en[Number(v.getBigInt64(raw, true))];
      return { variant: variant.name, ...Object.fromEntries(variant.fields.map((f, i) => [f.name, fromRaw(get(v, raw + 8 * (i + 1), slot(f.ty)), f.ty)])) };
    }
    return undefined;
  }

  const module = { $functions: compiled.meta.exports, $types: compiled.meta.types, $plan: compiled.meta.plan, $hash: compiled.meta.hash, $output: () => { const s = printed; printed = ''; return s; } };
  for (const f of compiled.meta.exports) {
    const problem = (e) => {
      if (e instanceof AvisoqError) return e;
      if (e && e.info) {
        const info = { ...e.info };
        if (info.kind === 'time_limit') info.message = `the call ran longer than its time limit of ${timeLimitMs} ms`;
        if (info.kind === 'out_of_memory' && memoryLimitMb) info.message = `the call used more memory than its limit of ${memoryLimitMb} MB`;
        return new AvisoqError(`${f.name}: ${info.message}`, info);
      }
      return new AvisoqError(`${f.name}: ${e instanceof RangeError ? 'the call ran out of stack (recursion too deep)' : e.message}`, { kind: e instanceof RangeError ? 'stack_overflow' : 'trap' });
    };
    if (waits) {
      const entry = WebAssembly.promising(ex[`fn_${f.name}`]);
      let busy = false;
      module[f.name] = async (...args) => {
        if (args.length !== f.params.length) throw new AvisoqError(`${f.name} takes ${f.params.length} argument${f.params.length === 1 ? '' : 's'} (${f.params.map((p) => `${p.name}: ${p.ty}`).join(', ')}) but got ${args.length}`, { kind: 'argument' });
        if (busy) throw new AvisoqError(`${f.name}: this module is in the middle of another call`, { kind: 'busy' });
        busy = true;
        const mark = ex.__heap.value;
        if (timeLimitMs > 0) { limits.deadline = performance.now() + timeLimitMs; ex.__fuel.value = 50000; }
        try {
          const raws = args.map((a, i) => toRaw(a, f.params[i].ty, `${f.name}: argument '${f.params[i].name}'`));
          const result = await entry(...raws);
          return f.ret === 'Unit' ? undefined : fromRaw(result, f.ret);
        } catch (e) {
          throw problem(e);
        } finally {
          ex.__heap.value = mark;
          busy = false;
        }
      };
      continue;
    }
    module[f.name] = (...args) => {
      if (args.length !== f.params.length) throw new AvisoqError(`${f.name} takes ${f.params.length} argument${f.params.length === 1 ? '' : 's'} (${f.params.map((p) => `${p.name}: ${p.ty}`).join(', ')}) but got ${args.length}`, { kind: 'argument' });
      const mark = ex.__heap.value;
      if (timeLimitMs > 0) { limits.deadline = performance.now() + timeLimitMs; ex.__fuel.value = 50000; }
      try {
        const raws = args.map((a, i) => toRaw(a, f.params[i].ty, `${f.name}: argument '${f.params[i].name}'`));
        const result = ex[`fn_${f.name}`](...raws);
        return f.ret === 'Unit' ? undefined : fromRaw(result, f.ret);
      } catch (e) {
        if (e instanceof AvisoqError) throw e;
        if (e && e.info) {
          const info = { ...e.info };
          if (info.kind === 'time_limit') info.message = `the call ran longer than its time limit of ${timeLimitMs} ms`;
          if (info.kind === 'out_of_memory' && memoryLimitMb) info.message = `the call used more memory than its limit of ${memoryLimitMb} MB`;
          throw new AvisoqError(`${f.name}: ${info.message}`, info);
        }
        throw new AvisoqError(`${f.name}: ${e instanceof RangeError ? 'the call ran out of stack (recursion too deep)' : e.message}`, { kind: e instanceof RangeError ? 'stack_overflow' : 'trap' });
      } finally {
        ex.__heap.value = mark; // everything the call allocated is handed back
      }
    };
  }
  return module;
}

// JSON cannot hold a bigint: Ints outside the exact range of a JSON number go out as strings.
const jsonSafe = (v) => (typeof v === 'bigint' ? v.toString() : Array.isArray(v) ? v.map(jsonSafe) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, jsonSafe(x)])) : v);

// One request per line on stdin:   {"id": 1, "fn": "score", "args": [[3, 5, 8], "strict"]}
// One answer per line on stdout:   {"id": 1, "ok": true, "result": 16, "output": ""}
//                             or   {"id": 1, "ok": false, "error": {"kind": "bounds", "message": "..."}}
// {"fn": "$functions"} lists what can be called. The first line written is {"ready": true, ...}.
export async function serve(path, opts = {}) {
  const say = (o) => process.stdout.write(`${JSON.stringify(o)}\n`);
  let module;
  try {
    module = await load(path, opts);
  } catch (e) {
    say({ ready: false, error: { kind: e.kind ?? 'error', message: e.message, diagnostics: e.diagnostics } });
    return 1;
  }
  say({ ready: true, functions: module.$functions });
  for await (const line of createInterface({ input: process.stdin })) {
    if (!line.trim()) continue;
    let req = {};
    try {
      req = JSON.parse(line);
      if (req.fn === '$functions') { say({ id: req.id, ok: true, result: module.$functions }); continue; }
      if (typeof module[req.fn] !== 'function' || req.fn.startsWith('$')) throw new AvisoqError(`there is no function '${req.fn}' to call`, { kind: 'argument' });
      const result = module[req.fn](...(req.args ?? []));
      say({ id: req.id, ok: true, result: jsonSafe(result) ?? null, output: module.$output() });
    } catch (e) {
      say({ id: req.id, ok: false, error: { kind: e.kind ?? 'error', message: e.message, ...(e.line ? { line: e.line, fn: e.fn } : {}) }, output: module ? module.$output() : '' });
    }
  }
  return 0;
}

// Loads a shared library built earlier with `avisoq build file.avq --shared`.
// A time limit needs a library built with --budget.
export async function open(libraryPath, { timeLimitMs = 0, memoryLimitMb = 0 } = {}) {
  return (await import('./embed-native.mjs')).open(libraryPath, { AvisoqError, timeLimitMs, memoryLimitMb });
}

export { jsonSafe };
