// Builds every benchmark binary into bench/out: node bench/build.mjs
// Needs g++ (found the same way the Avisoq native backend finds gcc) and rustc with the GNU toolchain.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildNative, compile, findGcc } from '../src/compiler.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'out');
mkdirSync(out, { recursive: true });

const gcc = findGcc();
if (!gcc) throw new Error('GCC not found');
const gxx = gcc === 'gcc' ? 'g++' : join(dirname(gcc), 'g++.exe');
const env = { ...process.env, PATH: [gcc === 'gcc' ? '' : dirname(gcc), join(homedir(), '.cargo', 'bin'), process.env.PATH].join(delimiter) };
const sh = (bin, args) => { console.log(`${bin} ${args.join(' ')}`); execFileSync(bin, args, { stdio: 'inherit', env }); };

// -ffp-contract=off on every native build: fused multiply-add changes floating-point
// results, and all languages must compute the same answer.
const CXX = ['-O3', '-march=native', '-ffp-contract=off', '-std=c++17', '-static'];
sh(gxx, [...CXX, '-o', join(out, 'bench_cpp.exe'), join(here, 'bench.cpp')]);
sh(gxx, [...CXX, '-fopenmp', '-o', join(out, 'bench_omp.exe'), join(here, 'bench_omp.cpp')]);

const RUST = ['+stable-x86_64-pc-windows-gnu', '-C', 'opt-level=3', '-C', 'target-cpu=native'];
sh('rustc', [...RUST, '-o', join(out, 'bench_rs.exe'), join(here, 'bench.rs')]);
sh('rustc', [...RUST, '-C', 'overflow-checks=on', '-o', join(out, 'bench_rs_checked.exe'), join(here, 'bench.rs')]);

for (const b of ['fib', 'sieve', 'mandel', 'collatz', 'mandel_sum', 'collatz_sum', 'mandel_lanes']) {
  const src = readFileSync(join(here, `${b}.avq`), 'utf8');
  for (const checked of [true, false]) {
    if (!checked && (b.endsWith('_sum') || b.endsWith('_lanes'))) continue;
    const c = compile(src, { backend: 'native', checked });
    if (!c.ok) throw new Error(`${b}: ${JSON.stringify(c.diagnostics)}`);
    const name = `avisoq_${b}${checked ? '' : '_unchecked'}.exe`;
    buildNative(c, join(out, name));
    console.log(`avisoq build ${name}`);
  }
}
