// Benchmark harness: node bench/run.mjs [runs]
// Each program times its own workload (process start-up excluded) and prints "name result ms".
// Reports the best of N runs. Build everything first with: node bench/build.mjs
import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const runs = Number(process.argv[2] ?? 7);
const cppArgs = { fib: ['38'], sieve: ['20000000'], mandel: ['800', '300'], collatz: ['1000000'] };
const cli = join(here, '..', 'src', 'cli.mjs');
const exe = (n) => join(here, 'out', n);
const BENCHES = ['fib', 'sieve', 'mandel', 'collatz'];
const PAR = ['mandel', 'collatz'];

// [label, bench -> [binary, args] | null, max runs]
const LANGS = [
  ['C++ (g++ -O3 -march=native)', (b) => [exe('bench_cpp.exe'), [b, ...cppArgs[b]]]],
  ['Rust (-O3, target-cpu=native)', (b) => [exe('bench_rs.exe'), [b]]],
  ['Rust (same, overflow checks on)', (b) => [exe('bench_rs_checked.exe'), [b]]],
  ['Avisoq native (all checks on)', (b) => [exe(`avisoq_${b}.exe`), []]],
  ['Avisoq native (--unchecked)', (b) => [exe(`avisoq_${b}_unchecked.exe`), []]],
  ['Avisoq native, written with sum (all checks on)', (b) => (PAR.includes(b) ? [exe(`avisoq_${b}_sum.exe`), []] : null)],
  ['Avisoq native, per-pixel sum: threads + 8 lanes (all checks on)', (b) => (b === 'mandel' ? [exe('avisoq_mandel_lanes.exe'), []] : null)],
  ['C++ hand-parallelised with OpenMP', (b) => (PAR.includes(b) ? [exe('bench_omp.exe'), [b, ...cppArgs[b]]] : null)],
  ['Avisoq WebAssembly (all checks on)', (b) => [process.execPath, [cli, 'run', join(here, `${b}.avq`), '--allow', 'io,time']]],
  ['JavaScript (Node, V8)', (b) => [process.execPath, [join(here, 'bench.js'), b]]],
  ['Python', (b) => ['python', [join(here, 'bench.py'), b]], 2],
];

// Runs are interleaved: every round runs each program once, so drift in machine load
// (thermal throttling, background work) affects all languages alike.
const table = {};
const answers = {};
const jobs = [];
for (const [lang, cmd, maxRuns] of LANGS) {
  table[lang] = {};
  for (const b of BENCHES) {
    const c = cmd(b);
    if (!c) continue;
    if (c[0].endsWith('.exe') && c[0] !== process.execPath && !existsSync(c[0])) { console.log(`skip ${lang} ${b}: not built`); continue; }
    table[lang][b] = Infinity;
    jobs.push({ lang, b, c, maxRuns: maxRuns ?? runs });
  }
}
for (let round = 0; round < runs; round++) {
  for (const j of jobs) {
    if (round >= j.maxRuns) continue;
    const out = execFileSync(j.c[0], j.c[1], { encoding: 'utf8' }).trim().split(/\s+/);
    table[j.lang][j.b] = Math.min(table[j.lang][j.b], Number(out[2]));
    answers[j.b] ??= out[1];
    if (answers[j.b] !== out[1]) throw new Error(`${j.lang} ${j.b}: result ${out[1]} differs from ${answers[j.b]}`);
  }
  process.stderr.write(`round ${round + 1}/${runs}
`);
}

const base = table[LANGS[0][0]];
const fmt = (ms) => (ms < 10 ? ms.toFixed(1) : ms.toFixed(0));
let md = `Best of ${runs} runs, ${cpus().length} logical cores. Ratios are relative to C++ (lower is faster).\n\n`;
md += `| Language | ${BENCHES.join(' | ')} |\n|---|${BENCHES.map(() => '---:').join('|')}|\n`;
for (const [lang, row] of Object.entries(table)) {
  md += `| ${lang} | ${BENCHES.map((b) => (row[b] === undefined ? '' : `${fmt(row[b])} ms (${(row[b] / base[b]).toFixed(2)}x)`)).join(' | ')} |\n`;
}
writeFileSync(join(here, 'results.md'), md);
console.log('\n' + md);
