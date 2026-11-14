#!/usr/bin/env node
// Vow command line: check | run | test | build | fmt
import { readFileSync, writeFileSync } from 'node:fs';
import { buildNative, compile, run, runTests } from './compiler.mjs';

const USAGE = `Vow - a fast, safe language built for AI agents

usage: vow <command> <file.vow> [options]

commands:
  check   type-check, effect-check and contract-check without running
  run     compile and run fn main()
  test    compile and run every test block
  build   compile to a .wasm file, or an executable with --native (-o path)
  fmt     rewrite the file in the canonical layout (--check only reports)

options:
  --allow io,time,fs:<folder>,net:<host>
                    grant capabilities to the program (default: none)
  --native          compile to machine code through GCC instead of WebAssembly
  --json            machine-readable output on stdout
  --unchecked       disable integer overflow checks (bounds checks stay on)
  --no-simd         native only: do not evaluate pure loops 8 values at a time
  -o <path>         output path for build
`;

const args = process.argv.slice(2);
const flags = { allow: [], json: false, unchecked: false, native: false, simd: true, check: false, out: null };
const pos = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--json') flags.json = true;
  else if (a === '--unchecked') flags.unchecked = true;
  else if (a === '--native') flags.native = true;
  else if (a === '--no-simd') flags.simd = false;
  else if (a === '--check') flags.check = true;
  else if (a === '--allow') flags.allow = (args[++i] ?? '').split(',').filter(Boolean);
  else if (a === '-o') flags.out = args[++i];
  else pos.push(a);
}
const [cmd, file] = pos;
if (!cmd || !file || !['check', 'run', 'test', 'build', 'fmt'].includes(cmd)) {
  process.stdout.write(USAGE);
  process.exit(cmd ? 64 : 0);
}

let src;
try {
  src = readFileSync(file, 'utf8');
} catch {
  process.stderr.write(`vow: cannot read ${file}\n`);
  process.exit(66);
}

const out = (obj) => process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
const sources = new Map([[file, src]]);
const sourceOf = (f) => {
  if (!sources.has(f)) { try { sources.set(f, readFileSync(f, 'utf8')); } catch { sources.set(f, ''); } }
  return sources.get(f);
};
const showDiag = (d) => {
  const where = d.file ?? file;
  const lineText = sourceOf(where).split('\n')[d.line - 1] ?? '';
  let s = `${where}:${d.line}:${d.col}: error[${d.code}]: ${d.message}\n`;
  s += `  ${lineText.replace(/\t/g, ' ')}\n  ${' '.repeat(Math.max(0, d.col - 1))}^\n`;
  if (d.hint) s += `  hint: ${d.hint}\n`;
  return s;
};
const showRuntime = (e) => {
  let s = `runtime error[${e.kind}]: ${e.message}`;
  if (e.line) s += `\n  in ${e.fn} at ${e.file ?? file}:${e.line}:${e.col}`;
  if (e.hint) s += `\n  hint: ${e.hint}`;
  return s + '\n';
};

if (cmd === 'fmt') {
  const { format, shape } = await import('./format.mjs');
  let text;
  try {
    text = format(src);
    // Safety net: the formatted text must parse to exactly the same program.
    if (shape(text) !== shape(src)) throw new Error('internal error: formatting would change the program; the file was left untouched');
  } catch (e) {
    if (e.code && e.line) {
      const d = { code: e.code, message: e.message, line: e.line, col: e.col, hint: e.hint };
      if (flags.json) out({ ok: false, phase: 'parse', diagnostics: [d] }); else process.stderr.write(showDiag(d));
    } else {
      process.stderr.write(`vow fmt: ${e.message}\n`);
    }
    process.exit(1);
  }
  const changed = text !== src.replace(/\r\n/g, '\n');
  if (changed && !flags.check) writeFileSync(file, text);
  if (flags.json) out({ ok: !(flags.check && changed), changed });
  else process.stdout.write(`${file}: ${changed ? (flags.check ? 'needs formatting' : 'formatted') : 'already formatted'}\n`);
  process.exit(flags.check && changed ? 1 : 0);
}

const result = compile(src, { checked: !flags.unchecked, backend: flags.native ? 'native' : 'wasm', simd: flags.simd, path: file, allow: flags.allow });
if (!result.ok) {
  if (flags.json) out({ ok: false, phase: 'compile', diagnostics: result.diagnostics });
  else process.stderr.write(result.diagnostics.map(showDiag).join('\n'));
  process.exit(1);
}

if (cmd === 'check') {
  const pr = result.proof;
  if (flags.json) out({ ok: true, effects: result.meta.effects, tests: result.meta.tests.length, contracts: { proven: pr.proven, checkedAtRunTime: pr.runtime } });
  else {
    process.stdout.write(`ok: ${file} (main uses: ${result.meta.effects.join(', ') || 'nothing'}; ${result.meta.tests.length} tests)\n`);
    if (pr.proven + pr.runtime) process.stdout.write(`contracts: ${pr.proven} of ${pr.proven + pr.runtime} checks proven at compile time; the rest are checked while running\n`);
  }
} else if (cmd === 'build') {
  const path = flags.out ?? file.replace(/\.vow$/, '') + (flags.native ? '.exe' : '.wasm');
  if (flags.native) buildNative(result, path);
  else writeFileSync(path, result.wasm);
  if (flags.json) out({ ok: true, output: path });
  else process.stdout.write(`wrote ${path}\n`);
} else if (cmd === 'run') {
  let captured = '';
  const r = await run(result, {
    allow: flags.allow,
    write: flags.json ? (s) => { captured += s; } : undefined,
  });
  if (flags.json) out({ ok: r.ok, phase: 'run', stdout: captured, ...(r.error ? { error: r.error } : {}) });
  else if (!r.ok) process.stderr.write(showRuntime(r.error));
  if (!r.ok) process.exit(2);
} else if (cmd === 'test') {
  const results = await runTests(result);
  const failed = results.filter((t) => !t.ok).length;
  if (flags.json) {
    out({ ok: failed === 0, phase: 'test', passed: results.length - failed, failed, results });
  } else {
    for (const t of results) {
      process.stdout.write(`${t.ok ? 'pass' : 'FAIL'}  ${t.name}\n`);
      if (!t.ok) process.stdout.write('      ' + showRuntime(t.error).trim().replace(/\n/g, '\n      ') + '\n');
    }
    process.stdout.write(`${results.length - failed} passed, ${failed} failed\n`);
  }
  if (failed) process.exit(2);
}
