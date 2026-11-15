// Calling Avisoq compiled to machine code, in the same process, with no WebAssembly in between.
//
//   import { load, open } from 'avisoq';
//   const scoring = await load('scoring.avq', { native: true });   // compiles with GCC, then loads
//   const same = await open('scoring.dll');                        // or load a library built earlier
//   scoring.score([3, 5, 8], 10)
//
// The library is built by `avisoq build file.avq --shared` and has three C functions:
// avisoq_describe, avisoq_call and avisoq_take (see the end of the generated C). Arguments and
// results cross as bytes in the layout described in src/runtime.c; this file is the JavaScript
// side of that layout, and bindings/python/avisoq.py is the Python side.
//
// What is different from the WebAssembly route: the code is not sandboxed by a virtual machine
// (it can still only use the capabilities it was built with), anything it prints goes straight
// to the process's standard output, parallel loops run on one thread, and recursion deep enough
// to overflow the stack ends the process instead of raising an error.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { elemOf, isArr, typeHead } from './types.mjs';

const I64_MIN = -(2n ** 63n), I64_MAX = 2n ** 63n - 1n;
const SAFE_MIN = BigInt(Number.MIN_SAFE_INTEGER), SAFE_MAX = BigInt(Number.MAX_SAFE_INTEGER);

let ffi;
async function ffiModule(AvisoqError) {
  if (ffi !== undefined) return ffi;
  try { ffi = (await import('node:ffi')).default; } catch { ffi = null; }
  if (!ffi) throw new AvisoqError('loading a native library needs node:ffi (Node 26 or newer); without it use load(path) and run in WebAssembly', { kind: 'setup' });
  return ffi;
}

export async function open(libraryPath, { AvisoqError, timeLimitMs = 0, memoryLimitMb = 0 }) {
  const f = await ffiModule(AvisoqError);
  let lib;
  try {
    lib = f.dlopen(resolve(libraryPath), {
      avisoq_describe: { arguments: ['buffer', 'int64'], return: 'int64' },
      avisoq_call: { arguments: ['int32', 'buffer', 'int64', 'buffer', 'int64'], return: 'int64' },
      avisoq_take: { arguments: ['buffer', 'int64'], return: 'int64' },
      avisoq_limits: { arguments: ['int64', 'int64'], return: 'void' },
    });
  } catch (e) {
    throw new AvisoqError(`${libraryPath}: cannot be loaded as an Avisoq library (${e.message})`, { kind: 'setup' });
  }
  const fn = lib.functions;
  let out = Buffer.alloc(4096);
  const fetch = (n) => { if (n > out.length) { out = Buffer.alloc(Math.max(n, out.length * 2)); fn.avisoq_take(out, out.length); } return n; };
  const about = JSON.parse(out.toString('utf8', 0, fetchDescribe()));
  function fetchDescribe() {
    const n = Number(fn.avisoq_describe(out, out.length));
    if (n > out.length) { out = Buffer.alloc(n); fn.avisoq_describe(out, n); }
    return n;
  }
  if (timeLimitMs > 0 && !about.budget) {
    lib.lib.close();
    throw new AvisoqError(`${libraryPath}: a time limit needs a library built with --budget (avisoq build file.avq --shared --budget)`, { kind: 'setup' });
  }
  fn.avisoq_limits(Math.ceil(timeLimitMs), Math.ceil(memoryLimitMb * 1048576));
  const { structs, enums } = about.types;
  const bad = (what, ty, value) => new AvisoqError(`${what}: expected ${ty} but got ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`, { kind: 'argument' });

  // ---- JavaScript value -> bytes ----
  let buf = Buffer.alloc(4096), at = 0;
  const room = (n) => { if (at + n > buf.length) { const b = Buffer.alloc(Math.max(buf.length * 2, at + n)); buf.copy(b, 0, 0, at); buf = b; } };
  const putInt = (n) => { room(8); buf.writeBigInt64LE(n, at); at += 8; };
  // A whole number that a JavaScript number holds exactly, written as two 32-bit halves
  // (much cheaper than going through a bigint).
  const putExact = (v) => { room(8); const hi = Math.floor(v / 4294967296); buf.writeUInt32LE(v - hi * 4294967296, at); buf.writeInt32LE(hi, at + 4); at += 8; };
  function put(value, ty, what) {
    if (ty === 'Int') {
      if (typeof value === 'number' && Number.isSafeInteger(value)) { putExact(value); return; }
      let n;
      try { n = typeof value === 'bigint' ? value : typeof value === 'number' && Number.isInteger(value) ? BigInt(value) : typeof value === 'string' && /^-?\d+$/.test(value) ? BigInt(value) : null; } catch { n = null; }
      if (n === null || n < I64_MIN || n > I64_MAX) throw bad(what, 'an Int (a whole number that fits in 64 bits)', value);
      putInt(n);
    } else if (ty === 'Float') {
      if (typeof value !== 'number') throw bad(what, 'a Float', value);
      room(8); buf.writeDoubleLE(value, at); at += 8;
    } else if (ty === 'Bool') {
      if (typeof value !== 'boolean') throw bad(what, 'a Bool', value);
      room(1); buf[at++] = value ? 1 : 0;
    } else if (ty === 'Str') {
      if (typeof value !== 'string') throw bad(what, 'a Str', value);
      const n = Buffer.byteLength(value, 'utf8');
      putExact(n);
      room(n); buf.write(value, at, 'utf8'); at += n;
    } else if (isArr(ty)) {
      if (!Array.isArray(value)) throw bad(what, `an array (${ty})`, value);
      const et = elemOf(ty);
      const n = value.length;
      putExact(n);
      if (et === 'Int') {
        // the common case, without a call per element
        room(8 * n);
        for (let i = 0; i < n; i++) {
          const v = value[i];
          if (typeof v === 'number' && Number.isSafeInteger(v)) { const hi = Math.floor(v / 4294967296); buf.writeUInt32LE(v - hi * 4294967296, at); buf.writeInt32LE(hi, at + 4); at += 8; } else put(v, et, `${what}[${i}]`);
        }
      } else if (et === 'Float') {
        room(8 * n);
        for (let i = 0; i < n; i++) { const v = value[i]; if (typeof v !== 'number') throw bad(`${what}[${i}]`, 'a Float', v); buf.writeDoubleLE(v, at); at += 8; }
      } else {
        for (let i = 0; i < n; i++) put(value[i], et, `${what}[${i}]`);
      }
    } else if (structs[ty]) {
      const st = structs[ty], tuple = /^Tuple[2-4]$/.test(typeHead(ty));
      if (tuple ? !Array.isArray(value) || value.length !== st.length : value === null || typeof value !== 'object') throw bad(what, tuple ? `a tuple of ${st.length}` : `an object (${ty})`, value);
      st.forEach((f, i) => put(tuple ? value[i] : value[f.name], f.ty, `${what}.${f.name}`));
    } else if (enums[ty]) {
      const en = enums[ty];
      const index = value && typeof value === 'object' ? en.findIndex((x) => x.name === value.variant) : -1;
      if (index < 0) throw bad(what, `{ variant: ${en.map((x) => `"${x.name}"`).join(' | ')}, ... } (${ty})`, value);
      putExact(index);
      for (const f of en[index].fields) put(value[f.name], f.ty, `${what}.${f.name}`);
    } else {
      throw new AvisoqError(`${what}: values of type ${ty} cannot be passed in`, { kind: 'argument' });
    }
  }

  // ---- bytes -> JavaScript value ----
  let pos = 0;
  // An Int comes back as a number when a number holds it exactly, and as a bigint otherwise.
  const getInt = () => {
    const hi = out.readInt32LE(pos + 4);
    pos += 8;
    if (hi >= -2097152 && hi < 2097152) return hi * 4294967296 + out.readUInt32LE(pos - 8);
    const n = out.readBigInt64LE(pos - 8);
    return n >= SAFE_MIN && n <= SAFE_MAX ? Number(n) : n;
  };
  const getCount = () => { const n = out.readUInt32LE(pos) + out.readInt32LE(pos + 4) * 4294967296; pos += 8; return n; };
  function get(ty) {
    if (ty === 'Int') return getInt();
    if (ty === 'Float') { const x = out.readDoubleLE(pos); pos += 8; return x; }
    if (ty === 'Bool') return out[pos++] !== 0;
    if (ty === 'Str') { const n = getCount(); pos += n; return out.toString('utf8', pos - n, pos); }
    if (isArr(ty)) {
      const et = elemOf(ty), n = getCount(), items = new Array(n);
      if (et === 'Int') for (let i = 0; i < n; i++) items[i] = getInt();
      else for (let i = 0; i < n; i++) items[i] = get(et);
      return items;
    }
    if (structs[ty]) {
      const st = structs[ty], parts = st.map((f) => get(f.ty));
      return /^Tuple[2-4]$/.test(typeHead(ty)) ? parts : Object.fromEntries(st.map((f, i) => [f.name, parts[i]]));
    }
    const variant = enums[ty][getCount()];
    const value = { variant: variant.name };
    for (const f of variant.fields) value[f.name] = get(f.ty);
    return value;
  }

  let closed = false;
  const module = {
    $functions: about.functions.map(({ denied, ...f }) => f),
    $types: about.types,
    $output: () => '',
    $native: true,
    $close: () => { if (!closed) { closed = true; lib.lib.close(); } },
  };
  about.functions.forEach((f, index) => {
    module[f.name] = (...args) => {
      if (closed) throw new AvisoqError(`${f.name}: this library was closed`, { kind: 'closed' });
      if (args.length !== f.params.length) throw new AvisoqError(`${f.name} takes ${f.params.length} argument${f.params.length === 1 ? '' : 's'} (${f.params.map((p) => `${p.name}: ${p.ty}`).join(', ')}) but got ${args.length}`, { kind: 'argument' });
      at = 0;
      for (let i = 0; i < args.length; i++) put(args[i], f.params[i].ty, `${f.name}: argument '${f.params[i].name}'`);
      const r = Number(fn.avisoq_call(index, buf, at, out, out.length));
      if (r < 0) {
        const info = JSON.parse(out.toString('utf8', 0, fetch(-1 - r)));
        if (info.kind === 'capability_denied') info.message = `capability '${f.denied.join("', '")}' was not granted`;
        if (info.kind === 'time_limit') info.message = `the call ran longer than its time limit of ${timeLimitMs} ms`;
        if (info.kind === 'out_of_memory' && memoryLimitMb) info.message = `the call used more memory than its limit of ${memoryLimitMb} MB`;
        throw new AvisoqError(`${f.name}: ${info.message}`, info);
      }
      fetch(r);
      if (f.ret === 'Unit') return undefined;
      pos = 0;
      return get(f.ret);
    };
  });
  return module;
}

// Compiles a file to a shared library (cached by content) and loads it.
export async function loadNative(path, { allow = [], source, portable = false, timeLimitMs = 0, memoryLimitMb = 0 } = {}, { AvisoqError }) {
  const { compile, buildNative } = await import('./compiler.mjs');
  await ffiModule(AvisoqError);
  const compiled = compile(source ?? readFileSync(path, 'utf8'), { backend: 'native', shared: true, budget: timeLimitMs > 0, path, allow });
  if (!compiled.ok) {
    const d = compiled.diagnostics[0];
    throw new AvisoqError(`${path}:${d.line}:${d.col}: error[${d.code}]: ${d.message}`, { kind: 'compile', diagnostics: compiled.diagnostics });
  }
  let library;
  try { library = buildNative(compiled, null, { portable }); } catch (e) { throw new AvisoqError(e.message, { kind: 'setup' }); }
  return open(library, { AvisoqError, timeLimitMs, memoryLimitMb });
}
