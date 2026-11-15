// Times the functions of speed.avq called from JavaScript in two ways: in the WebAssembly
// sandbox, and as a native shared library.   node examples/embed/speed.mjs
import { fileURLToPath } from 'node:url';
import { load } from '../../src/index.mjs';

const file = fileURLToPath(new URL('./speed.avq', import.meta.url));
const wasm = await load(file);
const native = await load(file, { native: true });

let seed = 12345;
const random = () => (seed = (seed * 1103515245 + 12345) % 2147483648);
const numbers = Array.from({ length: 200000 }, () => random() % 50000);
const words = Array.from({ length: 150000 }, () => `w${random() % 3000}`).join(' ');
const jobs = [
  ['count_primes(5 000 000)', (m) => m.count_primes(5000000)],
  ['longest_collatz(300 000)', (m) => m.longest_collatz(300000)],
  ['top_word(a text of 150 000 words)', (m) => m.top_word(words)],
  ['sorted_unique(200 000 numbers)', (m) => m.sorted_unique(numbers).length],
  ['a call that does almost nothing, 100 000 times', (m) => { let t = 0; for (let i = 0; i < 100000; i++) t += m.longest_collatz(2); return t; }],
];
const time = (f) => {
  let best = Infinity, result;
  for (let k = 0; k < 5; k++) { const t = process.hrtime.bigint(); result = f(); best = Math.min(best, Number(process.hrtime.bigint() - t) / 1e6); }
  return [best, JSON.stringify(result)];
};
console.log('| Call | WebAssembly | Native library | Native is |');
console.log('|---|---:|---:|---:|');
for (const [name, job] of jobs) {
  const [a, ra] = time(() => job(wasm)), [b, rb] = time(() => job(native));
  if (ra !== rb) { console.log(`${name}: the two routes disagree (${ra.slice(0, 60)} and ${rb.slice(0, 60)})`); process.exitCode = 1; continue; }
  console.log(`| ${name} | ${a.toFixed(1)} ms | ${b.toFixed(1)} ms | ${a >= b ? `${(a / b).toFixed(1)}x faster` : `${(b / a).toFixed(1)}x slower`} |`);
}
