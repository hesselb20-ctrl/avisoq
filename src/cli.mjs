#!/usr/bin/env node
// Avisoq command line: check | run | test | build | fmt | lsp | init | add | install
import { readFileSync, writeFileSync } from 'node:fs';
import { buildNative, compile, LIB_EXT, run, runTests } from './compiler.mjs';

const USAGE = `Avisoq - a fast, safe language built for AI agents

usage: avisoq <command> <file.avq> [options]

commands:
  check   type-check, effect-check and contract-check without running
  run     compile and run fn main()
  test    compile and run every test block
  build   compile to a .wasm file, an executable with --native, or a library that other
          languages load with --shared (-o path)
  fmt     rewrite the file in the canonical layout (--check only reports)
  lsp     start the language server on stdin/stdout (no file argument)
  guide   print the language guide written for AI agents (no file argument)
  call    call one function and print its result as JSON:  avisoq call file.avq name '[args]'
          (--native runs it as machine code)
  serve   answer function calls as JSON lines on stdin/stdout, for other languages
  mcp     serve every function of the file as a tool for AI agents (Model Context Protocol)

scripts that act through tools:
  plan <script>               what the script can do: which tools, how often, under which rules
  approve <script>            agree to exactly that; any change to the script needs a new approval
  act <script> '[args]'       run an approved script; every tool call is logged
  replay <script>             rerun the last logged run against its log, calling nothing
  tools                       print the declarations of the tools in --tools, ready to paste
  gateway                     let an AI agent submit scripts: an MCP server that checks, asks and runs
  keygen [name]               make a signing key; from then on only signed approvals count here

packages (run in the project folder):
  init [name]                  create avisoq.json
  add <name> <path|git url>    add a dependency (--rev <tag or commit> for git)
  install                      fetch git dependencies into avisoq_modules

options:
  --allow io,time,fs:<folder>,net:<host>,run:<program>,ffi
                    grant capabilities to the program (default: none)
  --native          compile to machine code through GCC instead of WebAssembly
  --json            machine-readable output on stdout
  --unchecked       disable integer overflow checks (bounds checks stay on)
  --no-simd         native only: do not evaluate pure loops 8 values at a time
  --shared          build only: a shared library (.dll, .so, .dylib) instead of a program
  --budget          with --shared: count steps, so callers can set a time limit per call
  --time-limit <ms> call, serve, mcp: stop any call that runs longer than this
  --host <file.mjs> mcp: a JavaScript module whose exports the code may call (extern "host")
  --tools <file>    the MCP servers the tools come from: { "servers": { "name": { "command", "args" } } }
  --policy <file>   what may run without asking a person: { "tools": { "name": { "max": 1 } } }
  --log <file>      where act writes its log (default: <script>.runs.jsonl)
  --fn <name>       which function of the script to start, when it has more than one
  --approvers <file> accept only approvals signed by the people in this file (default: avisoq.approvers.json if present)
  --portable        native only: build for any recent 64-bit x86 CPU, not just this one
  --no-sandbox      native only: run without the reduced-rights launcher (Windows)
  --memory <MB>     stop the program, or a call, if it uses more memory than this (run: native only)
  -o <path>         output path for build
`;

const args = process.argv.slice(2);
const flags = { allow: [], json: false, unchecked: false, native: false, simd: true, check: false, out: null, rev: null, sandbox: true, portable: false, memory: 0, shared: false, budget: false, timeLimit: 0 };
const pos = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--json') flags.json = true;
  else if (a === '--unchecked') flags.unchecked = true;
  else if (a === '--native') flags.native = true;
  else if (a === '--no-simd') flags.simd = false;
  else if (a === '--check') flags.check = true;
  else if (a === '--no-sandbox') flags.sandbox = false;
  else if (a === '--portable') flags.portable = true;
  else if (a === '--shared') { flags.shared = true; flags.native = true; }
  else if (a === '--budget') flags.budget = true;
  else if (a === '--host') flags.host = args[++i];
  else if (a === '--tools') flags.tools = args[++i];
  else if (a === '--policy') flags.policy = args[++i];
  else if (a === '--log') flags.log = args[++i];
  else if (a === '--fn') flags.fn = args[++i];
  else if (a === '--dir') flags.dir = args[++i];
  else if (a === '--approvers') flags.approvers = args[++i];
  else if (a === '--key') flags.key = args[++i];
  else if (a === '--time-limit') flags.timeLimit = Number(args[++i]) || 0;
  else if (a === '--memory') flags.memory = Number(args[++i]) || 0;
  else if (a === '--allow') flags.allow = (args[++i] ?? '').split(',').filter(Boolean);
  else if (a === '-o') flags.out = args[++i];
  else if (a === '--rev') flags.rev = args[++i];
  else pos.push(a);
}
const [cmd, file] = pos;
if (['init', 'add', 'install'].includes(cmd)) {
  const pkg = await import('./pkg.mjs');
  const { basename } = await import('node:path');
  const say = (m) => process.stdout.write(`${m}\n`);
  let r;
  if (cmd === 'init') r = pkg.init(process.cwd(), file ?? basename(process.cwd()).replace(/[^A-Za-z0-9_-]/g, '_'));
  else if (cmd === 'add') r = pos.length < 3 ? { ok: false, message: 'usage: avisoq add <name> <path or git url> [--rev <tag or commit>]' } : pkg.add(process.cwd(), pos[1], pos[2], flags.rev);
  else r = pkg.install(process.cwd(), flags.json ? () => {} : say);
  if (flags.json) process.stdout.write(`${JSON.stringify(r, null, 2)}\n`); else (r.ok ? say : (m) => process.stderr.write(`avisoq ${cmd}: ${m}\n`))(r.message);
  process.exit(r.ok ? 0 : 1);
}
if (cmd === 'guide') {
  process.stdout.write(readFileSync(new URL('../docs/AGENT_GUIDE.md', import.meta.url), 'utf8'));
  process.exit(0);
}
if (cmd === 'lsp') {
  const { startServer } = await import('./lsp.mjs');
  startServer();
  await new Promise(() => {}); // serve until the editor closes the connection
}
if (['plan', 'approve', 'act', 'replay', 'tools', 'gateway', 'keygen'].includes(cmd)) {
  const { runCommand } = await import('./act-cli.mjs');
  process.exit(await runCommand(cmd, pos.slice(1), flags));
}
if (cmd === 'mcp' && file) {
  const { mcp } = await import('./mcp.mjs');
  const { pathToFileURL } = await import('node:url');
  const { resolve } = await import('node:path');
  // --host tools.mjs: its exports are the functions the Avisoq code may call with extern "host"
  const host = flags.host ? { ...(await import(pathToFileURL(resolve(flags.host)).href)) } : undefined;
  process.exit(await mcp(file, { allow: flags.allow, native: flags.native, timeLimitMs: flags.timeLimit, memoryLimitMb: flags.memory, host }));
}
if ((cmd === 'call' || cmd === 'serve') && file) {
  const { load, serve, jsonSafe } = await import('./embed.mjs');
  if (cmd === 'serve') process.exit(await serve(file, { allow: flags.allow, timeLimitMs: flags.timeLimit, memoryLimitMb: flags.memory }));
  try {
    const module = await load(file, { allow: flags.allow, native: flags.native, portable: flags.portable, timeLimitMs: flags.timeLimit, memoryLimitMb: flags.memory });
    const name = pos[2];
    if (!name || typeof module[name] !== 'function' || name.startsWith('$')) {
      process.stderr.write(`avisoq call: ${name ? `there is no function '${name}' to call` : 'which function?'}\ncallable: ${module.$functions.map((f) => `${f.name}(${f.params.map((p) => `${p.name}: ${p.ty}`).join(', ')})${f.ret === 'Unit' ? '' : ` -> ${f.ret}`}`).join(', ')}\n`);
      process.exit(64);
    }
    const result = module[name](...JSON.parse(pos[3] ?? '[]'));
    process.stdout.write(module.$output());
    if (result !== undefined) process.stdout.write(`${JSON.stringify(jsonSafe(result))}\n`);
    process.exit(0);
  } catch (e) {
    process.stderr.write(`avisoq call: ${e.message}\n`);
    process.exit(e.kind === 'compile' ? 65 : 70);
  }
}
if (!cmd || !file || !['check', 'run', 'test', 'build', 'fmt'].includes(cmd)) {
  process.stdout.write(USAGE);
  process.exit(cmd ? 64 : 0);
}

let src;
try {
  src = readFileSync(file, 'utf8');
} catch {
  process.stderr.write(`avisoq: cannot read ${file}\n`);
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
      process.stderr.write(`avisoq fmt: ${e.message}\n`);
    }
    process.exit(1);
  }
  const changed = text !== src.replace(/\r\n/g, '\n');
  if (changed && !flags.check) writeFileSync(file, text);
  if (flags.json) out({ ok: !(flags.check && changed), changed });
  else process.stdout.write(`${file}: ${changed ? (flags.check ? 'needs formatting' : 'formatted') : 'already formatted'}\n`);
  process.exit(flags.check && changed ? 1 : 0);
}

const result = compile(src, { checked: !flags.unchecked, backend: flags.native ? 'native' : 'wasm', simd: flags.simd, path: file, allow: flags.allow, shared: flags.shared && cmd === 'build', budget: flags.budget });
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
  const path = flags.out ?? file.replace(/\.avq$/, '') + (flags.shared ? LIB_EXT : flags.native ? '.exe' : '.wasm');
  if (flags.native) buildNative(result, path, { portable: flags.portable });
  else writeFileSync(path, result.wasm);
  if (flags.json) out({ ok: true, output: path });
  else process.stdout.write(`wrote ${path}\n`);
} else if (cmd === 'run') {
  let captured = '';
  const r = await run(result, {
    allow: flags.allow,
    sandbox: flags.sandbox,
    portable: flags.portable,
    memoryMb: flags.memory,
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
