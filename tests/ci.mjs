// Runs one test file for the workflow and, when it fails, repeats the failing lines as an error
// annotation, so the reason shows on the run's summary page.   node tests/ci.mjs tests/act.mjs [args]
import { spawnSync } from 'node:child_process';

const [file, ...args] = process.argv.slice(2);
const r = spawnSync(process.execPath, [file, ...args], { encoding: 'utf8', maxBuffer: 1 << 28 });
const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
process.stdout.write(out);
if (r.status !== 0) {
  const lines = out.split('\n').filter((l) => l.trim() && !/ExperimentalWarning|trace-warnings/.test(l));
  const at = lines.findIndex((l) => /^(FAIL|NOT STOPPED)|Error|error\[/.test(l));
  const shown = (at >= 0 ? lines.slice(at, at + 12) : lines.slice(-12)).join(' | ').replace(/%/g, '%25').replace(/\r/g, '').slice(0, 3500);
  console.log(`::error title=${file} on ${process.platform}::${shown}`);
}
process.exit(r.status ?? 1);
