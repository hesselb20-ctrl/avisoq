// Vow compiler driver and host runtime for both backends.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import v8 from 'node:v8';
import { parse } from './parser.mjs';
import { check } from './checker.mjs';
import { planRegions } from './regions.mjs';
import { prove } from './prove.mjs';
import { codegen } from './codegen.mjs';
import { cgen } from './cgen.mjs';
import { FAIL, failInfo } from './fail.mjs';
import { VowError } from './lexer.mjs';

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
function loadProgram(src, entryPath, diagnostics) {
  const fail = (e, file) => {
    if (!(e instanceof VowError)) throw e;
    diagnostics.push({ code: e.code, severity: 'error', message: e.message, ...(file ? { file } : {}), line: e.line, col: e.col, ...(e.hint ? { hint: e.hint } : {}) });
  };
  let program;
  try { program = parse(src); } catch (e) { fail(e, entryPath); return null; }
  stamp(program, entryPath);
  const seen = new Set(entryPath ? [resolve(entryPath)] : []);
  const queue = program.imports.map((imp) => ({ imp, from: entryPath }));
  while (queue.length) {
    const { imp, from } = queue.shift();
    let target = imp.path.startsWith('std/') ? join(STD_DIR, imp.path.slice(4)) : resolve(from ? dirname(from) : process.cwd(), imp.path);
    if (!target.endsWith('.vow')) target += '.vow';
    if (seen.has(target)) continue;
    seen.add(target);
    if (!existsSync(target)) {
      diagnostics.push({ code: 'E0701', severity: 'error', message: `cannot find module '${imp.path}'`, ...(from ? { file: from } : {}), line: imp.line, col: imp.col,
        hint: 'standard modules are imported as "std/name"; other paths are relative to the importing file' });
      continue;
    }
    let mod;
    try { mod = parse(readFileSync(target, 'utf8')); } catch (e) { fail(e, target); continue; }
    stamp(mod, target);
    program.fns.push(...mod.fns);
    program.structs.push(...mod.structs);
    program.enums.push(...mod.enums);
    queue.push(...mod.imports.map((x) => ({ imp: x, from: target })));
  }
  return diagnostics.length ? null : program;
}

// opts: { backend: 'wasm' | 'native', checked, simd, path, allow }
export function compile(src, opts = {}) {
  const backend = opts.backend ?? 'wasm';
  const diagnostics = [];
  const program = loadProgram(src, opts.path, diagnostics);
  if (!program) return { ok: false, diagnostics };
  check(program, diagnostics);
  if (!diagnostics.length && backend === 'native' && program.usedBuiltins.has('http_get')) {
    diagnostics.push({ code: 'E0601', severity: 'error', message: 'http_get is not available on the native backend yet', line: 1, col: 1,
      hint: 'run this program without --native' });
  }
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

class VowFailure extends Error {}

function describe(e) {
  if (e instanceof VowFailure) return e.info;
  if (e instanceof RangeError) return { kind: 'stack_overflow', message: 'stack overflow (recursion too deep)' };
  if (e instanceof WebAssembly.RuntimeError) {
    const msg = /divide|unrepresentable/.test(e.message) && !/float/.test(e.message) ? 'integer overflow' : e.message;
    return { kind: 'trap', message: msg };
  }
  throw e;
}

const fmtFloat = (x) => (Number.isInteger(x) && Math.abs(x) < 1e21 ? x.toFixed(1) : String(x));

// Instantiates a compiled module. Only capabilities listed in `allow` are wired in.
export async function instantiate(wasm, meta, { allow = [], write = (s) => process.stdout.write(s) } = {}) {
  const grants = parseGrants(allow);
  let memory, instance;
  let parts = [];
  const dec = new TextDecoder(), enc = new TextEncoder();
  const fail = (kind, siteId) => {
    const info = failInfo(kind, meta.sites[siteId]);
    const err = new VowFailure(info.message);
    err.info = info;
    throw err;
  };
  const deny = (message) => {
    const err = new VowFailure(message);
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
      read_file: (p, site) => { try { return newStr(readFileSync(fsPath(p))); } catch (e) { if (e instanceof VowFailure) throw e; fail(FAIL.IO, site); } },
      write_file: (p, c, site) => { try { writeFileSync(fsPath(p), strBytes(c)); } catch (e) { if (e instanceof VowFailure) throw e; fail(FAIL.IO, site); } },
      file_exists: (p) => (existsSync(fsPath(p)) ? 1 : 0),
    },
    net: {
      http_get: (u, site) => {
        let url;
        try { url = new URL(dec.decode(strBytes(u))); } catch { fail(FAIL.IO, site); }
        if (!['http:', 'https:'].includes(url.protocol)) fail(FAIL.IO, site);
        if (!grants.net.any && !grants.net.hosts.includes(url.hostname.toLowerCase())) deny(`host '${url.hostname}' was not granted; use --allow net:${url.hostname}`);
        // The host call must be synchronous, so the request runs in a short-lived child process.
        const script = 'fetch(process.argv[1]).then(async (r) => { if (!r.ok) process.exit(3); process.stdout.write(Buffer.from(await r.arrayBuffer())); }).catch(() => process.exit(4));';
        const r = spawnSync(process.execPath, ['-e', script, url.href], { maxBuffer: 1 << 26, timeout: 30000 });
        if (r.status !== 0) fail(FAIL.IO, site);
        return newStr(r.stdout);
      },
    },
  };
  const imports = {
    env: { fail },
    // Pure string helpers: no capability needed.
    rt: {
      str_concat: (a, b) => {
        const x = strBytes(a), y = strBytes(b);
        const out = new Uint8Array(x.length + y.length);
        out.set(x); out.set(y, x.length);
        return newStr(out);
      },
      str_eq: (a, b) => {
        const x = strBytes(a), y = strBytes(b);
        return x.length === y.length && x.every((v, i) => v === y[i]) ? 1 : 0;
      },
      str_from_i64: (v) => newStr(enc.encode(v.toString())),
      str_from_f64: (v) => newStr(enc.encode(fmtFloat(v))),
      str_from_bool: (v) => newStr(enc.encode(v ? 'true' : 'false')),
      substr: (s, start, end, site) => {
        const x = strBytes(s);
        if (start < 0n || end < start || end > BigInt(x.length)) fail(FAIL.BOUNDS, site);
        return newStr(x.subarray(Number(start), Number(end)));
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
  const rawKey = (ptr) => { let s = ''; for (const b of strBytes(ptr)) s += String.fromCharCode(b); return s; };
  const mkey = { i: (k) => k, s: rawKey };
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
      const err = new VowFailure(`capability '${c}' was not granted`);
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
  if (process.env.VOW_CC && existsSync(process.env.VOW_CC)) return (gccPath = process.env.VOW_CC);
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

// Compiles generated C to an executable. Results are cached by content.
export function buildNative(compiled, outPath) {
  const gcc = findGcc();
  if (!gcc) throw new Error('the native backend needs GCC; install it or set VOW_CC to its path');
  const cache = join(tmpdir(), 'vow-cache');
  mkdirSync(cache, { recursive: true });
  const hash = createHash('sha256').update(compiled.c).update(CFLAGS.join(' ')).digest('hex').slice(0, 24);
  const exe = join(cache, `${hash}${process.platform === 'win32' ? '.exe' : ''}`);
  if (!existsSync(exe)) {
    const cfile = join(cache, `${hash}.c`);
    writeFileSync(cfile, compiled.c);
    const env = { ...process.env };
    if (gcc !== 'gcc') env.PATH = dirname(gcc) + delimiter + (env.PATH ?? '');
    const r = spawnSync(gcc, [...CFLAGS, '-o', exe, cfile, '-lm'], { encoding: 'utf8', env });
    if (r.status !== 0) throw new Error(`internal error: generated C failed to compile (${cfile})\n${r.stderr}`);
  }
  if (outPath) copyFileSync(exe, outPath);
  return outPath ?? exe;
}

function execNative(exe, args, write) {
  const r = spawnSync(exe, args, { stdio: ['ignore', write ? 'pipe' : 'inherit', 'pipe'], maxBuffer: 1 << 30 });
  if (write && r.stdout?.length) write(r.stdout.toString('utf8'));
  const stderr = r.stderr?.toString('utf8') ?? '';
  const m = /\x01VOWFAIL (.*)/.exec(stderr);
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

export async function run(compiled, { allow = [], write } = {}) {
  const denied = capabilityError(compiled.meta, allow);
  if (denied) return { ok: false, error: denied };
  if (compiled.backend === 'native') return execNative(buildNative(compiled), [], write);
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
      r = execNative(exe, ['--test', String(i)], () => {});
    } else {
      const instance = await instantiate(compiled.wasm, meta, { allow: [] });
      try { instance.exports[`test_${i}`](); r = { ok: true }; } catch (e) { r = { ok: false, error: describe(e) }; }
    }
    results.push({ name: meta.tests[i].name, ...r });
  }
  return results;
}
