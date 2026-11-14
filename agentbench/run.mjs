// Agent benchmark: how well does a model write Avisoq, compared with Python and Rust?
//
//   node agentbench/run.mjs prepare         write the task sheets a model works from
//   node agentbench/run.mjs grade <round>   grade the solutions, write feedback for the next round
//   node agentbench/run.mjs report          the summary table
//
// A model gets the task sheet for one language and writes one file per task into
// agentbench/work/<language>/solutions/. It never sees the tests. After grading, it gets the
// feedback file (what a compiler and a failing test would show) and may fix its solutions.
//
// Each solution ends up in one of four states:
//   pass     every hidden test gives the expected result
//   compile  rejected before running (compiler or syntax error)
//   loud     at least one test stops with an error, and none silently gives a wrong result
//   silent   at least one test runs to completion and prints a wrong result
// "silent" is the dangerous one: the program looks like it works.
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findGcc } from '../src/compiler.mjs';
import { TASKS } from './tasks.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const work = join(here, 'work');
const cli = join(here, '..', 'src', 'cli.mjs');
const LANGS = {
  avisoq: { ext: 'avq', name: 'Avisoq', types: { Int: 'Int', Bool: 'Bool', Str: 'Str', '[Int]': '[Int]' } },
  python: { ext: 'py', name: 'Python', types: { Int: 'int', Bool: 'bool', Str: 'str', '[Int]': 'list[int]' } },
  rust: { ext: 'rs', name: 'Rust', types: { Int: 'i64', Bool: 'bool', Str: '&str', '[Int]': '&[i64]' }, rets: { Int: 'i64', Bool: 'bool', Str: 'String', '[Int]': 'Vec<i64>' } },
};
const gcc = findGcc();
const env = { ...process.env, PATH: [gcc && gcc !== 'gcc' ? dirname(gcc) : '', join(homedir(), '.cargo', 'bin'), process.env.PATH].join(delimiter) };

const signature = (lang, t) => {
  const L = LANGS[lang], ps = t.params.map(([n, ty]) => `${n}: ${L.types[ty]}`).join(', ');
  if (lang === 'avisoq') return `fn ${t.id}(${ps}) -> ${L.types[t.ret]}`;
  if (lang === 'python') return `def ${t.id}(${ps}) -> ${L.types[t.ret]}:`;
  return `pub fn ${t.id}(${ps}) -> ${L.rets[t.ret]}`;
};

function literal(lang, v) {
  if (Array.isArray(v)) {
    if (lang === 'rust') return v.length ? `&vec![${v.map((x) => `${x}i64`).join(', ')}]` : '&Vec::<i64>::new()';
    return `[${v.join(', ')}]`;
  }
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'boolean') return lang === 'python' ? (v ? 'True' : 'False') : String(v);
  // i64::MIN has no literal of its own in Avisoq or Rust
  if (String(v) === '-9223372036854775808') return lang === 'python' ? String(v) : lang === 'rust' ? 'i64::MIN' : '(-9223372036854775807 - 1)';
  return String(v);
}
const render = (v) => (Array.isArray(v) ? v.join(',') : String(v));
const call = (lang, t, args) => `${t.id}(${args.map((a) => literal(lang, a)).join(', ')})`;

function prepare() {
  for (const [lang, L] of Object.entries(LANGS)) {
    mkdirSync(join(work, lang, 'solutions'), { recursive: true });
    let md = `# Tasks: ${L.name}\n\nWrite one file per task in \`agentbench/work/${lang}/solutions/\`, named \`<task id>.${L.ext}\`.\n`
      + 'Each file must define the function with exactly the signature shown. It may define helper functions and import from the standard library. '
      + `${lang === 'avisoq' ? 'It must not define `main`. ' : lang === 'rust' ? 'It must not define `main` and must use only the standard library (no crates). ' : 'It must not print anything or run code at import time. '}`
      + 'The function is tested against hidden inputs, including edge cases, so follow the statement exactly.\n\n';
    for (const t of TASKS) md += `## ${t.id}\n\n${t.desc}\n\n\`\`\`\n${signature(lang, t)}\n\`\`\`\n\n`;
    writeFileSync(join(work, lang, 'TASKS.md'), md);
  }
  console.log(`wrote task sheets for ${TASKS.length} tasks in ${work}`);
}

const run = (bin, args, opts = {}) => spawnSync(bin, args, { encoding: 'utf8', timeout: 20000, env, ...opts });
const clip = (s, n = 1200) => { const t = (s ?? '').trim(); return t.length > n ? `${t.slice(0, n)}\n... (cut)` : t; };

// Returns { state, detail } for one solution.
function gradeOne(lang, t, tmp) {
  const L = LANGS[lang];
  const file = join(work, lang, 'solutions', `${t.id}.${L.ext}`);
  if (!existsSync(file)) return { state: 'compile', detail: 'no solution file was written' };
  const src = readFileSync(file, 'utf8');
  const expected = t.tests.map((args) => render(t.ref(...args)));
  const outcomes = []; // per test: { ok, kind: 'pass' | 'wrong' | 'error', got, error }

  if (lang === 'avisoq') {
    const show = t.ret === '[Int]' ? '\nfn bench_show(xs: [Int]) -> Str {\n  var bench_out = ""\n  for bench_i in 0..len(xs) {\n    if bench_i > 0 { bench_out = bench_out + "," }\n    bench_out = bench_out + str(xs[bench_i])\n  }\n  return bench_out\n}\n' : '';
    const program = (args) => `${src}\n${show}\nfn main() uses io {\n  print(${t.ret === '[Int]' ? `bench_show(${call(lang, t, args)})` : call(lang, t, args)})\n}\n`;
    const probe = join(tmp, `${t.id}.avq`);
    writeFileSync(probe, program(t.tests[0]));
    const c = run(process.execPath, [cli, 'check', probe, '--json']);
    let diag;
    try { diag = JSON.parse(c.stdout); } catch { diag = { ok: false, diagnostics: [{ code: '?', message: clip(c.stdout + c.stderr), line: 0 }] }; }
    if (!diag.ok) {
      return { state: 'compile', detail: diag.diagnostics.slice(0, 4).map((d) => `error[${d.code}] line ${d.line}: ${d.message}${d.hint ? `\n  hint: ${d.hint}` : ''}`).join('\n') };
    }
    t.tests.forEach((args, i) => {
      writeFileSync(probe, program(args));
      const r = run(process.execPath, [cli, 'run', probe, '--allow', 'io', '--json']);
      let j = null;
      try { j = JSON.parse(r.stdout); } catch { /* crashed or timed out */ }
      if (!j) outcomes.push({ kind: 'error', error: r.error?.code === 'ETIMEDOUT' ? 'timed out' : clip(r.stderr || 'crashed') });
      else if (!j.ok) outcomes.push({ kind: 'error', error: j.error ? `${j.error.kind}: ${j.error.message}${j.error.line ? ` (line ${j.error.line})` : ''}` : clip(JSON.stringify(j.diagnostics)) });
      else outcomes.push({ kind: j.stdout === `${expected[i]}\n` ? 'pass' : 'wrong', got: j.stdout.replace(/\n$/, '') });
    });
  } else if (lang === 'python') {
    const fmt = t.ret === '[Int]' ? '",".join(str(x) for x in r)' : t.ret === 'Bool' ? '("true" if r else "false")' : 'str(r)';
    const driver = `${src}\n\nif __name__ == "__main__":\n    import sys\n    _tests = [${t.tests.map((a) => `lambda: ${call(lang, t, a)}`).join(', ')}]\n    r = _tests[int(sys.argv[1])]()\n    sys.stdout.write(${fmt} + "\\n")\n`;
    const probe = join(tmp, `${t.id}.py`);
    writeFileSync(probe, driver);
    const c = run('python', ['-m', 'py_compile', probe]);
    if (c.status !== 0) return { state: 'compile', detail: clip(c.stderr) };
    t.tests.forEach((_, i) => {
      const r = run('python', [probe, String(i)]);
      if (r.status !== 0) outcomes.push({ kind: 'error', error: r.error?.code === 'ETIMEDOUT' ? 'timed out' : clip(r.stderr.split('\n').slice(-4).join('\n')) });
      else outcomes.push({ kind: r.stdout.replace(/\r/g, '') === `${expected[i]}\n` ? 'pass' : 'wrong', got: r.stdout.trim() });
    });
  } else {
    const fmt = t.ret === '[Int]' ? 'r.iter().map(|x| x.to_string()).collect::<Vec<_>>().join(",")' : 'r.to_string()';
    const arms = t.tests.map((a, i) => `        ${i} => { let r = ${call(lang, t, a)}; ${fmt} }`).join('\n');
    const driver = `${src}\n\nfn main() {\n    let bench_t: usize = std::env::args().nth(1).unwrap().parse().unwrap();\n    let bench_out: String = match bench_t {\n${arms}\n        _ => unreachable!(),\n    };\n    println!("{}", bench_out);\n}\n`;
    const probe = join(tmp, `${t.id}.rs`), exe = join(tmp, `${t.id}.exe`);
    writeFileSync(probe, driver);
    // An ordinary optimised build: this is how Rust programs are normally shipped.
    const c = run('rustc', ['+stable-x86_64-pc-windows-gnu', '-O', '-A', 'warnings', '-o', exe, probe], { timeout: 120000 });
    if (c.status !== 0) return { state: 'compile', detail: clip(c.stderr) };
    t.tests.forEach((_, i) => {
      const r = run(exe, [String(i)]);
      if (r.status !== 0) outcomes.push({ kind: 'error', error: r.error?.code === 'ETIMEDOUT' ? 'timed out' : clip(r.stderr.split('\n').slice(0, 3).join('\n') || `crashed (exit ${r.status})`) });
      else outcomes.push({ kind: r.stdout.replace(/\r/g, '') === `${expected[i]}\n` ? 'pass' : 'wrong', got: r.stdout.trim() });
    });
  }

  const show = (i) => `${call(lang === 'rust' ? 'python' : lang, t, t.tests[i])}`;
  const wrong = outcomes.findIndex((o) => o.kind === 'wrong'), error = outcomes.findIndex((o) => o.kind === 'error');
  if (wrong >= 0) return { state: 'silent', detail: `wrong result for ${show(wrong)}\n  expected: ${expected[wrong]}\n  got:      ${outcomes[wrong].got}` };
  if (error >= 0) return { state: 'loud', detail: `${show(error)} stopped with an error (expected result: ${expected[error]})\n  ${outcomes[error].error}` };
  return { state: 'pass', detail: '' };
}

function grade(round) {
  const tmp = join(tmpdir(), `agentbench-${process.pid}`);
  mkdirSync(tmp, { recursive: true });
  const results = {};
  for (const lang of Object.keys(LANGS)) {
    results[lang] = {};
    let feedback = `# Feedback for ${LANGS[lang].name}, after round ${round}\n\nFix the solutions listed here by rewriting their files. Solutions not listed passed every test.\n\n`;
    let failing = 0;
    for (const t of TASKS) {
      const r = gradeOne(lang, t, tmp);
      results[lang][t.id] = r.state;
      if (r.state !== 'pass') {
        failing++;
        const what = { compile: 'did not compile', loud: 'stopped with an error', silent: 'gave a wrong result' }[r.state];
        feedback += `## ${t.id}: ${what}\n\n\`\`\`\n${r.detail}\n\`\`\`\n\n`;
      }
      process.stderr.write(`${lang.padEnd(7)} ${t.id.padEnd(20)} ${r.state}\n`);
    }
    writeFileSync(join(work, lang, `feedback-round${round}.md`), failing ? feedback : `# Feedback for ${LANGS[lang].name}\n\nEvery solution passed.\n`);
    cpSync(join(work, lang, 'solutions'), join(work, lang, `round${round}`), { recursive: true });
  }
  writeFileSync(join(work, `results-round${round}.json`), `${JSON.stringify(results, null, 2)}\n`);
  rmSync(tmp, { recursive: true, force: true });
  summary(results, `Round ${round}`);
}

function summary(results, title) {
  const count = (lang, state) => Object.values(results[lang]).filter((s) => s === state).length;
  console.log(`\n${title} (${TASKS.length} tasks)\n`);
  console.log('| Language | Correct | Rejected before running | Stopped with an error | Silently wrong |');
  console.log('|---|---:|---:|---:|---:|');
  for (const lang of Object.keys(LANGS)) console.log(`| ${LANGS[lang].name} | ${count(lang, 'pass')} | ${count(lang, 'compile')} | ${count(lang, 'loud')} | ${count(lang, 'silent')} |`);
}

function report() {
  for (let r = 1; existsSync(join(work, `results-round${r}.json`)); r++) summary(JSON.parse(readFileSync(join(work, `results-round${r}.json`), 'utf8')), `Round ${r}`);
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === 'prepare') prepare();
else if (cmd === 'grade') grade(Number(arg ?? 1));
else if (cmd === 'report') report();
else console.log('usage: node agentbench/run.mjs prepare | grade <round> | report');
