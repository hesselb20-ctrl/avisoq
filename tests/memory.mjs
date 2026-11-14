// Runs the compiler tests and the fuzzer in poison builds: every piece of memory the program
// hands back is overwritten first, so a value that was reclaimed while still in use produces a
// wrong result or a failure instead of passing by luck.
//
//   node tests/memory.mjs [fuzz count]
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const env = { ...process.env, AVISOQ_POISON: '1' };
let failed = false;
for (const args of [['run.mjs', 'wasm'], ['run.mjs', 'native'], ['fuzz.mjs', process.argv[2] ?? '100']]) {
  const r = spawnSync(process.execPath, [here + args[0], ...args.slice(1)], { env, encoding: 'utf8' });
  const last = r.stdout.trim().split('\n').filter((l) => !/^\s+\d+\/\d+$/.test(l)).slice(args[0] === 'fuzz.mjs' ? -2 : -1).join(' | ');
  console.log(`[poison] ${args.join(' ')}: ${last}`);
  if (r.status !== 0) { failed = true; console.log(r.stdout.split('\n').filter((l) => l.startsWith('FAIL') || l.startsWith('      ')).slice(0, 12).join('\n')); }
}
process.exit(failed ? 1 : 0);
