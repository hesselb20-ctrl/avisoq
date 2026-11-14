// How fast does agent-written code run? Times the solutions an agent wrote for one task set,
// in each language, on the same inputs: every hidden test input, repeated.
//
//   node agentbench/speed.mjs <results folder> [--set expert] [--reps 20] [--avisoq <other results folder>]
//
// e.g. node agentbench/speed.mjs results-expert/model-a --avisoq results-expert/model-a-v08
//
// Each program calls the solution on all test inputs `reps` times inside one process and reports
// the time spent in that loop, so start-up and compile time are not counted. Avisoq is built
// with the native backend with every check on; Rust with `rustc -O`; Python is CPython.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findGcc } from '../src/compiler.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const flag = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const folder = process.argv[2];
const set = flag('set', 'expert');
const reps = Number(flag('reps', '20'));
const avisoqFolder = flag('avisoq', folder);
const { TASKS } = await import(`./tasks-${set}.mjs`);
const cli = join(here, '..', 'src', 'cli.mjs');
const gcc = findGcc();
const env = { ...process.env, PATH: [gcc && gcc !== 'gcc' ? dirname(gcc) : '', join(homedir(), '.cargo', 'bin'), process.env.PATH].join(delimiter) };
const tmp = join(tmpdir(), `agentspeed-${process.pid}`);
mkdirSync(tmp, { recursive: true });
const run = (bin, args, timeout = 300000) => spawnSync(bin, args, { encoding: 'utf8', timeout, env });

function literal(lang, v) {
  if (Array.isArray(v)) {
    if (lang === 'rust') return v.length ? `&vec![${v.map((x) => `${x}i64`).join(', ')}]` : '&Vec::<i64>::new()';
    return `[${v.join(', ')}]`;
  }
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'boolean') return lang === 'python' ? (v ? 'True' : 'False') : String(v);
  if (String(v) === '-9223372036854775808') return lang === 'python' ? String(v) : lang === 'rust' ? 'i64::MIN' : '(-9223372036854775807 - 1)';
  return String(v);
}
const call = (lang, t, args) => `${t.id}(${args.map((a) => literal(lang, a)).join(', ')})`;
// A number derived from each result, so the work cannot be optimised away and the languages can be compared.
const check = { Int: (c) => `(${c}) % 1000`, Bool: (c) => c, Str: (c) => c, '[Int]': (c) => c };

function avisoq(t) {
  const file = join(here, avisoqFolder, 'avisoq', `${t.id}.avq`);
  if (!existsSync(file)) return null;
  const sum = { Int: (c) => `acc += (${c}) % 1000`, Bool: (c) => `if ${c} { acc += 1 }`, Str: (c) => `acc += len(${c})`, '[Int]': (c) => `acc += len(${c})` }[t.ret];
  const lines = t.tests.map((a) => `    ${sum(call('avisoq', t, a))}`).join('\n');
  const src = `${readFileSync(file, 'utf8')}\nfn main() uses io, time {\n  let bench_t0 = now_ms()\n  var acc = 0\n  for bench_rep in 0..${reps} {\n${lines}\n  }\n  print(acc, now_ms() - bench_t0)\n}\n`;
  const probe = join(tmp, `${t.id}.avq`);
  writeFileSync(probe, src);
  const r = run(process.execPath, [cli, 'run', probe, '--allow', 'io,time', '--native']);
  return r.status === 0 ? r.stdout.trim().split(/\s+/).map(Number) : { error: (r.stdout + r.stderr).trim().split('\n')[0].slice(0, 160) };
}

function python(t) {
  const file = join(here, folder, 'python', `${t.id}.py`);
  if (!existsSync(file)) return null;
  const sum = { Int: (c) => `acc += abs(${c}) % 1000 * (1 if (${c}) >= 0 else -1)`, Bool: (c) => `acc += 1 if ${c} else 0`, Str: (c) => `acc += len(${c})`, '[Int]': (c) => `acc += len(${c})` }[t.ret];
  const lines = t.tests.map((a) => `        ${sum(call('python', t, a))}`).join('\n');
  const src = `${readFileSync(file, 'utf8')}\n\nif __name__ == "__main__":\n    import time\n    bench_t0 = time.perf_counter()\n    acc = 0\n    for bench_rep in range(${reps}):\n${lines}\n    print(acc, (time.perf_counter() - bench_t0) * 1000)\n`;
  const probe = join(tmp, `${t.id}.py`);
  writeFileSync(probe, src);
  const r = run('python', [probe]);
  return r.status === 0 ? r.stdout.trim().split(/\s+/).map(Number) : { error: r.stderr.trim().split('\n').pop().slice(0, 160) };
}

function rust(t) {
  const file = join(here, folder, 'rust', `${t.id}.rs`);
  if (!existsSync(file)) return null;
  const sum = { Int: (c) => `acc += (${c}) % 1000;`, Bool: (c) => `if ${c} { acc += 1; }`, Str: (c) => `acc += (${c}).len() as i64;`, '[Int]': (c) => `acc += (${c}).len() as i64;` }[t.ret];
  const lines = t.tests.map((a) => `        ${sum(call('rust', t, a))}`).join('\n');
  const src = `${readFileSync(file, 'utf8')}\n\nfn main() {\n    let bench_t0 = std::time::Instant::now();\n    let mut acc: i64 = 0;\n    for _bench_rep in 0..${reps} {\n${lines}\n    }\n    println!("{} {}", acc, bench_t0.elapsed().as_secs_f64() * 1000.0);\n}\n`;
  const probe = join(tmp, `${t.id}.rs`), exe = join(tmp, `${t.id}.exe`);
  writeFileSync(probe, src);
  const c = run('rustc', ['+stable-x86_64-pc-windows-gnu', '-O', '-A', 'warnings', '-o', exe, probe]);
  if (c.status !== 0) return { error: c.stderr.trim().split('\n')[0].slice(0, 160) };
  const r = run(exe, []);
  return r.status === 0 ? r.stdout.trim().split(/\s+/).map(Number) : { error: `exit ${r.status}` };
}

const ms = (r) => (r === null ? 'missing' : r.error ? `failed: ${r.error}` : r[1] < 10 ? r[1].toFixed(2) : r[1].toFixed(0));
const totals = { avisoq: 0, python: 0, rust: 0 };
let complete = true;
console.log(`Run time for all hidden test inputs, ${reps} times over, in milliseconds (lower is faster).\n`);
console.log('| Task | Avisoq (native, checks on) | Python | Rust (-O) | Python / Avisoq | Rust / Avisoq |');
console.log('|---|---:|---:|---:|---:|---:|');
for (const t of TASKS) {
  // best of three runs each
  const best = (f) => { let b = null; for (let k = 0; k < 3; k++) { const r = f(t); if (r === null || r.error) return r; if (!b || r[1] < b[1]) b = r; } return b; };
  const a = best(avisoq), p = best(python), r = best(rust);
  const ok = [a, p, r].every((x) => x && !x.error);
  const agree = ok && a[0] === p[0] && p[0] === r[0];
  if (ok) { totals.avisoq += a[1]; totals.python += p[1]; totals.rust += r[1]; } else complete = false;
  console.log(`| ${t.id}${ok && !agree ? ' (results differ!)' : ''} | ${ms(a)} | ${ms(p)} | ${ms(r)} | ${ok ? `${(p[1] / a[1]).toFixed(1)}x` : ''} | ${ok ? `${(r[1] / a[1]).toFixed(2)}x` : ''} |`);
}
console.log(`| **total${complete ? '' : ' (tasks that ran in all three)'}** | ${totals.avisoq.toFixed(0)} | ${totals.python.toFixed(0)} | ${totals.rust.toFixed(0)} | ${(totals.python / totals.avisoq).toFixed(1)}x | ${(totals.rust / totals.avisoq).toFixed(2)}x |`);
rmSync(tmp, { recursive: true, force: true });
