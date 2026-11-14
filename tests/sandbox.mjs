// Tests for the reduced-rights launcher used by the native backend on Windows.   node tests/sandbox.mjs
import { spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compile, run, sandboxLauncher } from '../src/compiler.mjs';

let passed = 0, failed = 0;
const report = (name, ok, detail) => { if (ok) passed++; else { failed++; console.log(`FAIL  ${name}\n      ${detail}`); } };

if (process.platform !== 'win32') {
  console.log('[sandbox] skipped: the launcher is Windows-only');
  process.exit(0);
}
const box = sandboxLauncher();
report('the launcher builds', !!box, 'GCC is needed to build it');
if (box) {
  const node = process.execPath;
  const probe = join(tmpdir(), `avisoq_sandbox_probe_${process.pid}.txt`);
  const writer = 'try { require("fs").writeFileSync(process.argv[1], "x"); console.log("wrote"); } catch (e) { console.log("blocked"); }';
  rmSync(probe, { force: true });
  let r = spawnSync(box, ['low', '0', node, '-e', writer, probe], { encoding: 'utf8' });
  report('low mode cannot write a file', r.stdout.trim() === 'blocked' && !existsSync(probe), r.stdout + r.stderr);
  rmSync(probe, { force: true });
  r = spawnSync(box, ['std', '0', node, '-e', writer, probe], { encoding: 'utf8' });
  report('standard mode can write a file', r.stdout.trim() === 'wrote' && existsSync(probe), r.stdout + r.stderr);
  rmSync(probe, { force: true });
  const child = 'try { require("child_process").execFileSync("whoami"); console.log("spawned"); } catch (e) { console.log("blocked"); }';
  for (const mode of ['low', 'std']) {
    r = spawnSync(box, [mode, '0', node, '-e', child], { encoding: 'utf8' });
    report(`${mode} mode cannot start another process`, r.stdout.trim() === 'blocked', r.stdout + r.stderr);
  }
  r = spawnSync(box, ['low', '0', node, '-e', 'console.log("a b", process.argv[1]); process.exit(7)', 'x "quoted" \\ y'], { encoding: 'utf8' });
  report('arguments, output and exit code pass through', r.stdout.trim() === 'a b x "quoted" \\ y' && r.status === 7, JSON.stringify(r.stdout) + r.status);
  r = spawnSync(box, ['low', '64', node, '-e', 'const a = []; for (;;) a.push(new Array(1e6).fill(1));'], { encoding: 'utf8' });
  report('the memory limit stops a runaway program', r.status !== 0, String(r.status));

  // Through the compiler: an ordinary program still runs, and failures are still reported.
  const ok = compile('fn main() uses io { print(sum(i in 0..1000: i)) }', { backend: 'native', allow: ['io'] });
  let out = '';
  const a = await run(ok, { allow: ['io'], write: (s) => { out += s; } });
  report('a program runs normally inside the sandbox', a.ok && out === '499500\n', JSON.stringify(a) + out);
  const bad = compile('fn main() uses io { let xs = [1]\n let i = 4\n print(xs[i]) }', { backend: 'native', allow: ['io'] });
  const b = await run(bad, { allow: ['io'], write: () => {} });
  report('a failure inside the sandbox is reported with its location', !b.ok && b.error.kind === 'bounds' && b.error.line === 3, JSON.stringify(b));
  const c = await run(ok, { allow: ['io'], sandbox: false, write: () => {} });
  report('the sandbox can be turned off', c.ok, JSON.stringify(c));
}
console.log(`[sandbox] ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
