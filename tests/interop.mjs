// Tests for using what already exists from Avisoq: other programs (run_command) and C code (extern).
//   node tests/interop.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { compile, run, findGcc } from '../src/compiler.mjs';

let passed = 0, failed = 0;
const report = (name, ok, detail = '') => { if (ok) passed++; else { failed++; console.log(`FAIL  ${name}\n      ${detail}`); } };
const path = (p) => fileURLToPath(new URL(`../examples/interop/${p}`, import.meta.url));
const hasGcc = !!findGcc();
const backends = hasGcc ? ['wasm', 'native'] : ['wasm'];
if (!hasGcc) console.log('(GCC not found: native interop tests skipped)');

async function exec(src, backend, allow, file) {
  const c = compile(src, { backend, allow, path: file });
  if (!c.ok) return { compile: c };
  let stdout = '';
  const r = await run(c, { allow, write: (s) => { stdout += s; } });
  return { compile: c, run: r, stdout };
}

// ---- run_command ----
const tools = readFileSync(path('tools.avq'), 'utf8');
const expected = 'arithmetic ok: 42\ninput ok: HELLO FROM AVISOQ\narguments ok: a b|say "hi"|c:\\dir\\|\nexit code failed: exit 3: it broke\nmissing failed: not found\n';
for (const b of backends) {
  const r = await exec(tools, b, ['io', 'run'], path('tools.avq'));
  report(`[${b}] run_command: output, input, awkward arguments, exit code, missing program`, r.run?.ok && r.stdout === expected, JSON.stringify(r.run?.ok ? r.stdout : r.run ?? r.compile.diagnostics));
  const named = await exec(tools, b, ['io', 'run:node', 'run:no-such-program-here'], path('tools.avq'));
  report(`[${b}] run_command: programs can be granted by name`, named.run?.ok && named.stdout === expected, JSON.stringify(named.run));
  const other = await exec(tools, b, ['io', 'run:python'], path('tools.avq'));
  report(`[${b}] run_command: a program that was not granted is refused`, other.run && !other.run.ok && other.run.error.kind === 'capability_denied' && other.stdout === '', JSON.stringify(other.run));
  const none = await exec(tools, b, ['io'], path('tools.avq'));
  report(`[${b}] run_command: needs the run capability at all`, none.run && !none.run.ok && none.run.error.kind === 'capability_denied', JSON.stringify(none.run));
}
{
  const c = compile('fn f() -> Result[Str, Str] {\n  return run_command("node", [], "")\n}\nfn main() { }');
  report('run_command is an effect that must be declared', !c.ok && c.diagnostics.some((d) => d.code === 'E0301'), JSON.stringify(c.diagnostics));
  const t = compile('fn main() uses run {\n  let r = run_command("node", "x", "")\n}');
  report('run_command takes its arguments as an array', !t.ok && t.diagnostics.some((d) => d.code === 'E0201'), JSON.stringify(t.diagnostics));
}

// ---- extern C functions ----
const native = readFileSync(path('native.avq'), 'utf8');
{
  const w = await exec(native, 'wasm', ['io', 'ffi'], path('native.avq'));
  report('[wasm] an extern function explains that it needs the native backend', w.run && !w.run.ok && w.run.error.kind === 'unsupported' && w.run.error.message.includes('--native'), JSON.stringify(w.run ?? w.compile.diagnostics));
  const bad = compile('extern "shim.c" fn bad(xs: [Int]) -> Int\nfn main() { }');
  report('an extern function takes only plain values', !bad.ok && bad.diagnostics.some((d) => d.code === 'E0802'), JSON.stringify(bad.diagnostics));
  const pure = compile('extern "c" fn labs(x: Int) -> Int\nfn f(x: Int) -> Int {\n  return labs(x)\n}\nfn main() { }');
  report('calling C is an effect that must be declared', !pure.ok && pure.diagnostics.some((d) => d.code === 'E0301'), JSON.stringify(pure.diagnostics));
}
if (hasGcc) {
  const n = await exec(native, 'native', ['io', 'ffi'], path('native.avq'));
  report('[native] extern: every plain type, both directions, a C file and the C library', n.run?.ok && n.stdout === '25 2.5 true false\nitem:42:0.50:on 15 42 0 1.0 12 17\n', JSON.stringify(n.run?.ok ? n.stdout : n.run ?? n.compile.diagnostics));
  const denied = await exec(native, 'native', ['io'], path('native.avq'));
  report('[native] extern: needs the ffi capability', denied.run && !denied.run.ok && denied.run.error.kind === 'capability_denied', JSON.stringify(denied.run));
  let message = '';
  try { await exec('extern "no_such_file.c" fn f() -> Int\nfn main() uses io, ffi {\n  print(f())\n}', 'native', ['io', 'ffi'], path('native.avq')); } catch (e) { message = e.message; }
  report('[native] extern: a missing C file is reported plainly', message.includes('extern C file not found'), message);
}

// ---- a real C library: SQLite ----
if (hasGcc) {
  const { copyFileSync, existsSync, mkdtempSync, rmSync } = await import('node:fs');
  const { dirname, join } = await import('node:path');
  const { tmpdir } = await import('node:os');
  const here = path('sqlite/libsqlite3-0.dll');
  const shipped = join(dirname(findGcc()), 'libsqlite3-0.dll');
  if (!existsSync(here) && existsSync(shipped)) copyFileSync(shipped, here);
  if (!existsSync(here)) {
    console.log('(libsqlite3-0.dll not found: the SQLite test was skipped; see examples/interop/sqlite/README.md)');
  } else {
    const notes = readFileSync(path('sqlite/notes.avq'), 'utf8');
    const want = [
      'SQLite loaded', 'notes: 6', "  4 4 Read the 'manual'", '  3 1 Buy milk', '  3 6 Buy stamps', "  2 3 It's a test; DROP TABLE notes; --", '  1 5 Zürich trip', '  0 2 Call Ada',
      'starting with Buy: 2 Buy milk Buy stamps', 'count, stars, longest title: 6 13 33 ok', 'no match: 0',
      'a bad query is an error value: no such table: missing_table', 'a broken rule is an error value: NOT NULL constraint failed: notes.stars', 'done: 6', '',
    ].join('\n');
    const r = await exec(notes, 'native', ['io', 'ffi'], path('sqlite/notes.avq'));
    report('[native] SQLite: create, insert with bound values, query, aggregate, errors as values', r.run?.ok && r.stdout === want, JSON.stringify(r.run?.ok ? r.stdout : r.run ?? r.compile.diagnostics));

    // a database file on disk: written by one connection, read back by another
    const dir = mkdtempSync(join(tmpdir(), 'avisoq-sqlite-'));
    const file = join(dir, 'kept.db').replace(/\\/g, '/');
    const decls = notes.slice(0, notes.indexOf('struct Note'));
    const program = `${decls}
fn main() uses io, ffi {
  let first = db_open("${file}")
  let made = db_exec(first, "CREATE TABLE kept (word TEXT, n INTEGER)")
  var last = 0
  for i in 0..500 { last = db_insert(first, "INSERT INTO kept (word, n) VALUES (?1, ?2)", "w" + str(i), i * i) }
  db_close(first)
  let second = db_open("${file}")
  let total = db_query(second, "SELECT COUNT(*), SUM(n), MAX(word) FROM kept WHERE word LIKE ?1", "w%")
  let one = db_query(second, "SELECT n FROM kept WHERE word = ?1", "w499")
  print(made, last, db_query_ok(), total, one)
  db_close(second)
}
`;
    const k = await exec(program, 'native', ['io', 'ffi'], path('sqlite/notes.avq'));
    report('[native] SQLite: a database file survives being closed and reopened', k.run?.ok && k.stdout === 'true 500 true 500\t41541750\tw99 249001\n' && existsSync(file), JSON.stringify(k.run?.ok ? k.stdout : k.run ?? k.compile.diagnostics));
    rmSync(dir, { recursive: true, force: true });
  }
}

console.log(`[interop] ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
