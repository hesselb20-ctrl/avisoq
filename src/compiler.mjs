// Avisoq compiler driver and host runtime for both backends.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import v8 from 'node:v8';
import { parse } from './parser.mjs';
import { check } from './checker.mjs';
import { desugar } from './desugar.mjs';
import { planRegions } from './regions.mjs';
import { resolvePackageImport } from './pkg.mjs';
import { prove } from './prove.mjs';
import { codegen } from './codegen.mjs';
import { cgen } from './cgen.mjs';
import { FAIL, failInfo } from './fail.mjs';
import { AvisoqError } from './lexer.mjs';

// V8 cannot swap a running WebAssembly loop to optimised code, so a hot loop in a
// function that is called once would stay in the baseline tier. Compile optimised up front.
// (Inlining driven by baseline-tier feedback has to be off for that to be valid.)
v8.setFlagsFromString('--no-liftoff');
v8.setFlagsFromString('--no-wasm-inlining');

const STD_DIR = fileURLToPath(new URL('../std/', import.meta.url));

// Records which file every node came from, for diagnostics.
function stamp(n, file) {
  if (Array.isArray(n)) { for (const x of n) stamp(x, file); return; }
  if (!n || typeof n !== 'object') return;
  if (typeof n.line === 'number') n.file = file;
  for (const k in n) if (n[k] && typeof n[k] === 'object') stamp(n[k], file);
}

// --allow io,fs:./data,net:example.com  ->  effect names plus the scopes of fs and net
export function parseGrants(allow = []) {
  const g = { names: new Set(), fs: { any: false, roots: [] }, net: { any: false, hosts: [] } };
  for (const item of allow) {
    const i = item.indexOf(':');
    const name = i < 0 ? item : item.slice(0, i), scope = i < 0 ? null : item.slice(i + 1);
    g.names.add(name);
    if (name === 'fs') { if (scope) g.fs.roots.push(resolve(scope)); else g.fs.any = true; }
    if (name === 'net') { if (scope) g.net.hosts.push(scope.toLowerCase()); else g.net.any = true; }
  }
  return g;
}

// Parses the entry source and everything it imports into one program.
function loadProgram(src, entryPath, diagnostics, lenient = false) {
  const fail = (e, file) => {
    if (!(e instanceof AvisoqError)) throw e;
    diagnostics.push({ code: e.code, severity: 'error', message: e.message, ...(file ? { file } : {}), line: e.line, col: e.col, ...(e.hint ? { hint: e.hint } : {}) });
  };
  let program;
  try { program = parse(src); } catch (e) { fail(e, entryPath); return null; }
  stamp(program, entryPath);
  program.allDecls = [...program.decls];
  const seen = new Set(entryPath ? [resolve(entryPath)] : []);
  const queue = program.imports.map((imp) => ({ imp, from: entryPath }));
  // The core types (Option, Result) are always available.
  if (!entryPath || resolve(entryPath) !== join(STD_DIR, 'core.avq')) queue.unshift({ imp: { path: 'std/core', line: 1, col: 1 }, from: entryPath });
  while (queue.length) {
    const { imp, from } = queue.shift();
    const base = from ? dirname(resolve(from)) : process.cwd();
    let target;
    if (imp.path.startsWith('pkg:')) {
      const r = resolvePackageImport(imp.path, base);
      if (r.error) {
        diagnostics.push({ code: 'E0703', severity: 'error', message: r.error, ...(from ? { file: from } : {}), line: imp.line, col: imp.col, ...(r.hint ? { hint: r.hint } : {}) });
        continue;
      }
      target = r.path;
    } else {
      target = imp.path.startsWith('std/') ? join(STD_DIR, imp.path.slice(4)) : resolve(base, imp.path);
    }
    if (!target.endsWith('.avq')) target += '.avq';
    if (seen.has(target)) continue;
    seen.add(target);
    if (!existsSync(target)) {
      diagnostics.push({ code: 'E0701', severity: 'error', message: `cannot find module '${imp.path}'`, ...(from ? { file: from } : {}), line: imp.line, col: imp.col,
        hint: 'standard modules are imported as "std/name", packages as "pkg:name/module"; other paths are relative to the importing file' });
      continue;
    }
    let mod;
    try { mod = parse(readFileSync(target, 'utf8')); } catch (e) { fail(e, target); continue; }
    stamp(mod, target);
    program.fns.push(...mod.fns);
    program.structs.push(...mod.structs);
    program.enums.push(...mod.enums);
    program.consts.push(...mod.consts);
    program.allDecls.push(...mod.decls.filter((d) => d.kind !== 'Import' && d.kind !== 'Test'));
    queue.push(...mod.imports.map((x) => ({ imp: x, from: target })));
  }
  shadowStd(program);
  return diagnostics.length && !lenient ? null : program;
}

// A program's own function, struct, enum or constant wins over a standard library function of
// the same name. The library keeps using its own: its function is renamed out of the way, and
// so are the uses of it inside the library. New library functions therefore never break a
// program that already has one with that name.
function shadowStd(program) {
  const std = resolve(STD_DIR).toLowerCase();
  const inStd = (d) => !!d.file && resolve(d.file).toLowerCase().startsWith(std);
  const own = new Set([...program.fns, ...program.structs, ...program.enums, ...program.consts].filter((d) => !inStd(d)).map((d) => d.name));
  const renamed = new Map();
  for (const f of program.fns) if (inStd(f) && own.has(f.name)) { renamed.set(f.name, `std__${f.name}`); f.shadowed = f.name; f.name = `std__${f.name}`; }
  if (!renamed.size) return;
  const visit = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { for (const x of n) visit(x); return; }
    if ((n.kind === 'Call' || n.kind === 'Name') && renamed.has(n.name)) n.name = renamed.get(n.name);
    for (const k in n) if (k !== 'file' && n[k] && typeof n[k] === 'object') visit(n[k]);
  };
  for (const f of program.fns) if (inStd(f)) { visit(f.body); visit(f.requires); visit(f.ensures); }
}

// For editors: checks as much as it can and always reports what it found.
export function analyze(src, opts = {}) {
  const diagnostics = [];
  const program = loadProgram(src, opts.path, diagnostics, true);
  if (!program) return { program: null, diagnostics, decls: [] };
  const decls = program.allDecls;
  desugar(program);
  check(program, diagnostics);
  if (!diagnostics.length) prove(program, diagnostics);
  dedupe(diagnostics);
  diagnostics.sort((a, b) => (a.file ?? '').localeCompare(b.file ?? '') || a.line - b.line || a.col - b.col);
  return { program, diagnostics, decls };
}

// A generic function is checked once per instance, which can report the same problem several times.
function dedupe(diagnostics) {
  const seen = new Set();
  const unique = diagnostics.filter((d) => { const k = `${d.code}|${d.file ?? ''}|${d.line}|${d.col}|${d.message}`; if (seen.has(k)) return false; seen.add(k); return true; });
  diagnostics.length = 0;
  diagnostics.push(...unique);
}

// opts: { backend: 'wasm' | 'native', checked, simd, path, allow }
export function compile(src, opts = {}) {
  const backend = opts.backend ?? 'wasm';
  // AVISOQ_POISON=1 (or poison: true) builds test programs that overwrite reclaimed memory.
  if (opts.poison === undefined && process.env.AVISOQ_POISON === '1') opts = { ...opts, poison: true };
  const diagnostics = [];
  const program = loadProgram(src, opts.path, diagnostics);
  if (!program) return { ok: false, diagnostics };
  desugar(program);
  check(program, diagnostics);
  dedupe(diagnostics);
  if (diagnostics.length) {
    diagnostics.sort((a, b) => (a.file ?? '').localeCompare(b.file ?? '') || a.line - b.line || a.col - b.col);
    return { ok: false, diagnostics };
  }
  const grants = parseGrants(opts.allow);
  const proof = opts.prove === false ? null : prove(program, diagnostics);
  if (diagnostics.length) return { ok: false, diagnostics };
  planRegions(program, backend);
  if (backend === 'native') {
    const { c, meta } = cgen(program, { ...opts, grants });
    return { ok: true, diagnostics, backend, c, meta, proof };
  }
  const { wasm, meta } = codegen(program, opts);
  return { ok: true, diagnostics, backend, wasm, meta, proof };
}

function capabilityError(meta, allow) {
  if (!meta.hasMain) return { kind: 'no_main', message: "program has no 'fn main()'" };
  const names = parseGrants(allow).names;
  const missing = meta.effects.filter((e) => !names.has(e));
  if (!missing.length) return null;
  return {
    kind: 'capability_denied',
    message: `program needs capabilities that were not granted: ${missing.join(', ')}`,
    hint: `re-run with --allow ${meta.effects.join(',')}`,
  };
}

// ---------------------------------------------------------------------------
// WebAssembly backend host
// ---------------------------------------------------------------------------

class AvisoqFailure extends Error {}

function describe(e) {
  if (e instanceof AvisoqFailure) return e.info;
  if (e instanceof RangeError) return { kind: 'stack_overflow', message: 'stack overflow (recursion too deep)' };
  if (e instanceof WebAssembly.RuntimeError) {
    const msg = /divide|unrepresentable/.test(e.message) && !/float/.test(e.message) ? 'integer overflow' : e.message;
    return { kind: 'trap', message: msg };
  }
  throw e;
}

// Negative zero keeps its sign, as on the native backend (JavaScript would print it as 0).
const fmtFloat = (x) => (Object.is(x, -0) ? '-0.0' : Number.isInteger(x) && Math.abs(x) < 1e21 ? x.toFixed(1) : String(x));

// Instantiates a compiled module. Only capabilities listed in `allow` are wired in.
export async function instantiate(wasm, meta, { allow = [], write = (s) => process.stdout.write(s) } = {}) {
  const grants = parseGrants(allow);
  let memory, instance;
  let parts = [];
  const dec = new TextDecoder(), enc = new TextEncoder();
  const fail = (kind, siteId) => {
    const info = failInfo(kind, meta.sites[siteId]);
    const err = new AvisoqFailure(info.message);
    err.info = info;
    throw err;
  };
  const deny = (message) => {
    const err = new AvisoqFailure(message);
    err.info = { kind: 'capability_denied', message };
    throw err;
  };
  // A path is usable only inside a folder granted with --allow fs:<folder>.
  const fold = (p) => (process.platform === 'win32' ? p.toLowerCase() : p);
  const fsPath = (ptr) => {
    const full = resolve(dec.decode(strBytes(ptr)));
    const ok = grants.fs.any || grants.fs.roots.some((r) => fold(full) === fold(r) || fold(full).startsWith(fold(r) + sep));
    if (!ok) deny('file path is outside the folders granted with --allow fs:<folder>');
    return full;
  };
  // Results of fallible host calls: the value or the reason, plus a flag read back by the program.
  let lastOk = 0;
  const ioReason = (e) => ({ ENOENT: 'not found', EACCES: 'permission denied', EPERM: 'permission denied', EISDIR: 'is a directory' }[e.code] ?? 'io error');
  const io = (f) => { try { const r = f(); lastOk = 1; return r; } catch (e) { if (e instanceof AvisoqFailure) throw e; lastOk = 0; return newStr(enc.encode(ioReason(e))); } };
  const http = (method, u, body, ctype) => {
    const bad = (why) => { lastOk = 0; return newStr(enc.encode(why)); };
    let url;
    try { url = new URL(dec.decode(strBytes(u))); } catch { return bad('bad url'); }
    if (!['http:', 'https:'].includes(url.protocol)) return bad('bad url');
    if (!grants.net.any && !grants.net.hosts.includes(url.hostname.toLowerCase())) deny('host was not granted; use --allow net:<host>');
    // The host call must be synchronous, so the request runs in a short-lived child process.
    const script = 'const a = JSON.parse(process.argv[1]); fetch(a.url, { method: a.method, body: a.body === null ? undefined : Buffer.from(a.body, "base64"), headers: a.ctype ? { "content-type": a.ctype } : {} })'
      + '.then(async (r) => { process.stdout.write(JSON.stringify({ status: r.status, body: Buffer.from(await r.arrayBuffer()).toString("base64") })); }).catch(() => process.exit(4));';
    const arg = JSON.stringify({ url: url.href, method, body: body === null ? null : Buffer.from(body).toString('base64'), ctype });
    const r = spawnSync(process.execPath, ['-e', script, arg], { maxBuffer: 1 << 28, timeout: 40000 });
    if (r.status !== 0) return bad('connection failed');
    const res = JSON.parse(r.stdout.toString('utf8'));
    if (res.status < 200 || res.status >= 300) return bad(`http status ${res.status}`);
    lastOk = 1;
    return newStr(Buffer.from(res.body, 'base64'));
  };
  // A view of a string's bytes, valid only until the next allocation (which may move the memory).
  const strView = (ptr) => new Uint8Array(memory.buffer, ptr + 4, new DataView(memory.buffer).getUint32(ptr, true));
  // A new string made of byte ranges [from, to) of memory, given as pairs.
  const strOfRanges = (ranges) => {
    let n = 0;
    for (const [a, b] of ranges) n += b - a;
    const ptr = instance.exports.__alloc(4 + n);
    const mem = new Uint8Array(memory.buffer);
    new DataView(memory.buffer).setUint32(ptr, n, true);
    let at = ptr + 4;
    for (const [a, b] of ranges) { mem.copyWithin(at, a, b); at += b - a; }
    return ptr;
  };
  const strLen = (ptr) => new DataView(memory.buffer).getUint32(ptr, true);
  const strBytes = (ptr) => {
    const len = new DataView(memory.buffer).getUint32(ptr, true);
    return new Uint8Array(memory.buffer, ptr + 4, len).slice();
  };
  const newStr = (bytes) => {
    const ptr = instance.exports.__alloc(4 + bytes.length);
    new DataView(memory.buffer).setUint32(ptr, bytes.length, true);
    new Uint8Array(memory.buffer).set(bytes, ptr + 4);
    return ptr;
  };
  const caps = {
    io: {
      print_i64: (v) => { parts.push(v.toString()); },
      print_f64: (v) => { parts.push(fmtFloat(v)); },
      print_bool: (v) => { parts.push(v ? 'true' : 'false'); },
      print_str: (ptr) => { parts.push(dec.decode(strBytes(ptr))); },
      print_end: () => { write(parts.join(' ') + '\n'); parts = []; },
    },
    time: { now_ms: () => performance.now() },
    fs: {
      read_file: (p) => io(() => newStr(readFileSync(fsPath(p)))),
      write_file: (p, c) => {
        const bytes = strBytes(c), full = fsPath(p);
        try { writeFileSync(full, bytes); lastOk = 1; return BigInt(bytes.length); } catch (e) { lastOk = 0; return BigInt(newStr(enc.encode(ioReason(e)))); }
      },
      file_exists: (p) => (existsSync(fsPath(p)) ? 1 : 0),
    },
    net: {
      http_get: (u) => http('GET', u, null, null),
      http_post: (u, b, c) => http('POST', u, strBytes(b), dec.decode(strBytes(c))),
    },
  };
  const imports = {
    env: { fail },
    // Pure string helpers: no capability needed.
    rt: {
      str_concat: (a, b) => strOfRanges([[a + 4, a + 4 + strLen(a)], [b + 4, b + 4 + strLen(b)]]),
      // x = x + b for a string that is being built. In place when x owns its buffer and there is
      // room; otherwise the string moves to a buffer twice the size. Returns [string, capacity].
      str_append: (a, b, cap, shared) => {
        const la = strLen(a), lb = strLen(b), n = la + lb;
        if (!shared && n <= cap) {
          new Uint8Array(memory.buffer).copyWithin(a + 4 + la, b + 4, b + 4 + lb);
          new DataView(memory.buffer).setUint32(a, n, true);
          return [a, cap];
        }
        const room = n < 24 ? 48 : n * 2;
        const ptr = instance.exports.__alloc(4 + room);
        const mem = new Uint8Array(memory.buffer);
        mem.copyWithin(ptr + 4, a + 4, a + 4 + la);
        mem.copyWithin(ptr + 4 + la, b + 4, b + 4 + lb);
        new DataView(memory.buffer).setUint32(ptr, n, true);
        return [ptr, room];
      },
      str_eq: (a, b) => {
        if (a === b) return 1;
        const x = strView(a), y = strView(b);
        if (x.length !== y.length) return 0;
        for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return 0;
        return 1;
      },
      str_cmp: (a, b) => {
        const x = strView(a), y = strView(b);
        for (let i = 0; i < Math.min(x.length, y.length); i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
        return Math.sign(x.length - y.length);
      },
      str_from_i64: (v) => newStr(enc.encode(v.toString())),
      str_from_f64: (v) => newStr(enc.encode(fmtFloat(v))),
      str_from_bool: (v) => newStr(enc.encode(v ? 'true' : 'false')),
      substr: (s, start, end, site) => {
        if (start < 0n || end < start || end > BigInt(strLen(s))) fail(FAIL.BOUNDS, site);
        return strOfRanges([[s + 4 + Number(start), s + 4 + Number(end)]]);
      },
      str_from_byte: (b, site) => {
        if (b < 0n || b > 255n) fail(FAIL.BOUNDS, site);
        return newStr(Uint8Array.of(Number(b)));
      },
      byte_at: (s, i, site) => {
        const x = strBytes(s);
        if (i < 0n || i >= BigInt(x.length)) fail(FAIL.BOUNDS, site);
        return BigInt(x[Number(i)]);
      },
    },
  };
  // Maps live in the host and are addressed by handle. Keys keep insertion order.
  const maps = [];
  const rawKey = (ptr) => Buffer.from(memory.buffer, ptr + 4, strLen(ptr)).latin1Slice();
  const mkey = { i: (k) => k, s: rawKey };
  imports.rt.last_ok = () => lastOk;
  imports.rt.map_new = () => maps.push(new Map()) - 1;
  imports.rt.map_len = (h) => BigInt(maps[h].size);
  imports.rt.map_copy = (h) => maps.push(new Map([...maps[h]].map(([k, e]) => [k, { ...e }]))) - 1;
  imports.rt.map_remove_i = (h, k) => (maps[h].delete(k) ? 1 : 0);
  imports.rt.map_remove_s = (h, k) => (maps[h].delete(rawKey(k)) ? 1 : 0);
  for (const kc of ['i', 's']) {
    imports.rt[`map_has_${kc}`] = (h, k) => (maps[h].has(mkey[kc](k)) ? 1 : 0);
    imports.rt[`map_keys_${kc}`] = (h) => {
      const ks = [...maps[h].values()].map((e) => e.k);
      const size = kc === 'i' ? 8 : 4;
      const ptr = instance.exports.__alloc(8 + ks.length * size);
      const dv = new DataView(memory.buffer);
      dv.setUint32(ptr, ks.length, true);
      dv.setUint32(ptr + 4, ks.length, true); // capacity
      ks.forEach((k, j) => (kc === 'i' ? dv.setBigInt64(ptr + 8 + 8 * j, k, true) : dv.setUint32(ptr + 8 + 4 * j, k, true)));
      return ptr;
    };
    for (const vc of ['i64', 'f64', 'i32']) {
      imports.rt[`map_put_${kc}_${vc}`] = (h, k, v) => {
        const key = mkey[kc](k), e = maps[h].get(key);
        if (e) e.v = v; else maps[h].set(key, { k, v });
      };
      imports.rt[`map_get_${kc}_${vc}`] = (h, k, site) => {
        const e = maps[h].get(mkey[kc](k));
        if (!e) fail(FAIL.KEY, site);
        return e.v;
      };
      imports.rt[`map_get_or_${kc}_${vc}`] = (h, k, d) => maps[h].get(mkey[kc](k))?.v ?? d;
    }
  }
  for (const c of Object.keys(caps)) {
    if (grants.names.has(c)) { imports[c] = caps[c]; continue; }
    // Not granted: the module links, but every entry point refuses to act.
    imports[c] = Object.fromEntries(Object.keys(caps[c]).map((k) => [k, () => {
      const err = new AvisoqFailure(`capability '${c}' was not granted`);
      err.info = { kind: 'capability_denied', message: err.message };
      throw err;
    }]));
  }
  ({ instance } = await WebAssembly.instantiate(wasm, imports));
  memory = instance.exports.memory;
  return instance;
}

// ---------------------------------------------------------------------------
// Native backend host
// ---------------------------------------------------------------------------

let gccPath;
export function findGcc() {
  if (gccPath !== undefined) return gccPath;
  gccPath = null;
  if (process.env.AVISOQ_CC && existsSync(process.env.AVISOQ_CC)) return (gccPath = process.env.AVISOQ_CC);
  const probe = spawnSync('gcc', ['--version'], { encoding: 'utf8' });
  if (probe.status === 0) return (gccPath = 'gcc');
  const pk = join(process.env.LOCALAPPDATA ?? '', 'Microsoft', 'WinGet', 'Packages');
  if (existsSync(pk)) {
    for (const d of readdirSync(pk)) {
      const cand = join(pk, d, 'mingw64', 'bin', 'gcc.exe');
      if (d.startsWith('BrechtSanders.WinLibs') && existsSync(cand)) return (gccPath = cand);
    }
  }
  return gccPath;
}

// -muse-unaligned-vector-move: GCC on Windows can emit aligned vector stores to thread stacks
// that are not aligned enough (GCC bug 54412); the assembler rewrites them as unaligned moves.
const CFLAGS = ['-std=gnu17', '-O3', '-march=native', '-ffp-contract=off', '-fopenmp', '-static', '-w',
  '-Wl,--stack,268435456', ...(process.platform === 'win32' ? ['-Wa,-muse-unaligned-vector-move'] : [])];

const gccEnv = (gcc) => {
  const env = { ...process.env };
  if (gcc !== 'gcc') env.PATH = dirname(gcc) + delimiter + (env.PATH ?? '');
  return env;
};

// The launcher that runs native programs with reduced rights (Windows). Built once, then cached.
let launcher;
export function sandboxLauncher() {
  if (launcher !== undefined) return launcher;
  launcher = null;
  const gcc = findGcc();
  if (process.platform !== 'win32' || !gcc) return launcher;
  const source = readFileSync(new URL('./sandbox_win.c', import.meta.url));
  const cache = join(tmpdir(), 'avisoq-cache');
  mkdirSync(cache, { recursive: true });
  const exe = join(cache, `sandbox-${createHash('sha256').update(source).digest('hex').slice(0, 16)}.exe`);
  if (!existsSync(exe)) {
    const r = spawnSync(gcc, ['-O2', '-municode', '-o', exe, fileURLToPath(new URL('./sandbox_win.c', import.meta.url))], { encoding: 'utf8', env: gccEnv(gcc) });
    if (r.status !== 0) return launcher;
  }
  return (launcher = exe);
}

// Compiles generated C to an executable. Results are cached by content.
// opts.portable: build for any 64-bit x86 CPU of the last decade instead of exactly this one.
export function buildNative(compiled, outPath, opts = {}) {
  const gcc = findGcc();
  if (!gcc) throw new Error('the native backend needs GCC; install it or set AVISOQ_CC to its path');
  const cache = join(tmpdir(), 'avisoq-cache');
  mkdirSync(cache, { recursive: true });
  const flags = opts.portable ? CFLAGS.map((f) => (f === '-march=native' ? '-march=x86-64-v2' : f)) : CFLAGS;
  const hash = createHash('sha256').update(compiled.c).update(flags.join(' ')).digest('hex').slice(0, 24);
  const exe = join(cache, `${hash}${process.platform === 'win32' ? '.exe' : ''}`);
  if (!existsSync(exe)) {
    const cfile = join(cache, `${hash}.c`);
    writeFileSync(cfile, compiled.c);
    const env = gccEnv(gcc);
    const r = spawnSync(gcc, [...flags, '-o', exe, cfile, '-lm', ...(process.platform === 'win32' ? ['-lwinhttp'] : [])], { encoding: 'utf8', env });
    if (r.status !== 0) throw new Error(`internal error: generated C failed to compile (${cfile})\n${r.stderr}`);
  }
  if (outPath) copyFileSync(exe, outPath);
  return outPath ?? exe;
}

// sandbox: null (run directly), 'low' or 'std' (see sandbox_win.c)
function execNative(exe, args, write, sandbox = null, memoryMb = 0) {
  const box = sandbox ? sandboxLauncher() : null;
  if (box) { args = [sandbox, String(memoryMb), exe, ...args]; exe = box; }
  const r = spawnSync(exe, args, { stdio: ['ignore', write ? 'pipe' : 'inherit', 'pipe'], maxBuffer: 1 << 30 });
  if (write && r.stdout?.length) write(r.stdout.toString('utf8'));
  const stderr = r.stderr?.toString('utf8') ?? '';
  const m = /\x01AVISOQFAIL (.*)/.exec(stderr);
  if (m) return { ok: false, error: JSON.parse(m[1]) };
  if (r.status === 0) return { ok: true };
  // 0xC00000FD: Windows stack overflow. SIGSEGV on other systems.
  if (r.status === 3221225725 || r.signal === 'SIGSEGV') {
    return { ok: false, error: { kind: 'stack_overflow', message: 'stack overflow (recursion too deep)' } };
  }
  return { ok: false, error: { kind: 'trap', message: `program crashed (exit ${r.status ?? r.signal})${stderr ? `: ${stderr.trim()}` : ''}` } };
}

// ---------------------------------------------------------------------------
// Running
// ---------------------------------------------------------------------------

export async function run(compiled, { allow = [], write, sandbox, portable, memoryMb } = {}) {
  const denied = capabilityError(compiled.meta, allow);
  if (denied) return { ok: false, error: denied };
  if (compiled.backend === 'native') {
    // A program that was granted neither files nor network also loses the right to write anywhere.
    const mode = sandbox === false ? null : compiled.meta.effects.some((e) => e === 'fs' || e === 'net') ? 'std' : 'low';
    return execNative(buildNative(compiled, undefined, { portable }), [], write, mode, memoryMb);
  }
  const instance = await instantiate(compiled.wasm, compiled.meta, { allow, write });
  try {
    instance.exports.main();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: describe(e) };
  }
}

export async function runTests(compiled) {
  const { meta } = compiled;
  const results = [];
  const exe = compiled.backend === 'native' && meta.tests.length ? buildNative(compiled) : null;
  for (let i = 0; i < meta.tests.length; i++) {
    // Fresh instance or process per test: tests cannot affect each other.
    let r;
    if (exe) {
      r = execNative(exe, ['--test', String(i)], () => {}, 'low');
    } else {
      const instance = await instantiate(compiled.wasm, meta, { allow: [] });
      try { instance.exports[`test_${i}`](); r = { ok: true }; } catch (e) { r = { ok: false, error: describe(e) }; }
    }
    results.push({ name: meta.tests[i].name, ...r });
  }
  return results;
}
