// Builds a task set from tasks and tests that the author of Avisoq did not write: the Exercism
// problem specifications (https://github.com/exercism/problem-specifications, MIT licence).
//
//   node agentbench/exercism.mjs <path to a clone of problem-specifications> [count]
//
// writes agentbench/tasks-exercism.json. The selection is mechanical, so nobody picks tasks:
//   1. An exercise qualifies if all its test cases call one function, every argument and result
//      is a whole number, a boolean, a string, an array of whole numbers or an array of strings,
//      and at least 8 cases remain after dropping cases that expect an error and cases with
//      characters outside printable ASCII.
//   2. The qualifying exercises are ordered by the SHA-256 of their name and the first `count`
//      (default 20) are taken.
//      Cases that Exercism has replaced (another case `reimplements` them) are not used.
//   3. The statement is the exercise's own instructions. The first two cases are shown to the
//      model as examples; all the others are hidden and used for grading.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = process.argv[2];
const count = Number(process.argv[3] ?? 20);
if (!repo || !existsSync(join(repo, 'exercises'))) { console.log('usage: node agentbench/exercism.mjs <clone of problem-specifications> [count]'); process.exit(64); }

const RESERVED = new Set(['in', 'match', 'for', 'fn', 'let', 'var', 'if', 'else', 'while', 'return', 'assert', 'test', 'uses', 'true', 'false', 'and', 'or', 'not', 'mut', 'struct', 'enum', 'import', 'private', 'break', 'continue', 'then', 'extern',
  'str', 'type', 'mod', 'move', 'ref', 'self', 'use', 'as', 'loop', 'impl', 'trait', 'pub', 'len', 'print', 'int', 'float', 'list', 'input', 'range', 'sum', 'min', 'max', 'def', 'class', 'from', 'is', 'lambda', 'pass', 'with', 'yield', 'del', 'try', 'none', 'async', 'await', 'box', 'const', 'crate', 'dyn', 'static', 'super', 'where', 'unsafe', 'string', 'array', 'copy', 'push', 'pop', 'keys', 'has', 'get', 'put', 'remove', 'chr', 'sqrt', 'result']);
const snake = (s) => { const n = s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/[^A-Za-z0-9]+/g, '_').toLowerCase().replace(/^_+|_+$/g, ''); return RESERVED.has(n) || /^[0-9]/.test(n) || !n ? `${n || 'x'}_value` : n; };
const plainText = (s) => /^[\x20-\x7e]*$/.test(s);
const isInt = (v) => typeof v === 'number' && Number.isInteger(v) && Math.abs(v) <= Number.MAX_SAFE_INTEGER;
const typeOf = (v) => {
  if (typeof v === 'boolean') return 'Bool';
  if (isInt(v)) return 'Int';
  if (typeof v === 'string') return plainText(v) ? 'Str' : 'bad-text';
  if (Array.isArray(v)) {
    if (v.every(isInt)) return v.length ? '[Int]' : '[]';
    if (v.every((x) => typeof x === 'string')) return v.every(plainText) ? '[Str]' : 'bad-text';
  }
  return 'unsupported';
};
// an empty array takes the type the other cases give that position
const merge = (a, b) => (a === b ? a : a === '[]' && b.startsWith('[') ? b : b === '[]' && a.startsWith('[') ? a : null);

const flat = (cases, out = []) => { for (const c of cases) if (c.cases) flat(c.cases, out); else out.push(c); return out; };

const eligible = [];
const rejected = {};
for (const name of readdirSync(join(repo, 'exercises')).sort()) {
  const dir = join(repo, 'exercises', name);
  const why = (r) => { rejected[r] = (rejected[r] ?? 0) + 1; };
  // older exercises call their statement description.md
  const statement = ['instructions.md', 'description.md'].map((f) => join(dir, f)).find((f) => existsSync(f));
  if (!existsSync(join(dir, 'canonical-data.json')) || !statement) { why('no test data or statement'); continue; }
  if (existsSync(join(dir, '.deprecated'))) { why('deprecated'); continue; }
  // A case marked `reimplements` replaces an older, wrong case, which Exercism keeps in the file.
  const every = flat(JSON.parse(readFileSync(join(dir, 'canonical-data.json'), 'utf8')).cases);
  const replaced = new Set(every.map((c) => c.reimplements).filter(Boolean));
  const all = every.filter((c) => !replaced.has(c.uuid));
  const props = new Set(all.map((c) => c.property));
  if (props.size !== 1) { why('more than one function'); continue; }
  const names = Object.keys(all[0].input ?? {});
  if (!names.length || names.length > 4 || all.some((c) => JSON.stringify(Object.keys(c.input ?? {})) !== JSON.stringify(names))) { why('arguments differ between cases'); continue; }
  let unsupported = false;
  const cases = [];
  for (const c of all) {
    if (c.expected !== null && typeof c.expected === 'object' && !Array.isArray(c.expected)) { if (!('error' in c.expected)) unsupported = true; continue; }
    const types = [...names.map((n) => typeOf(c.input[n])), typeOf(c.expected)];
    if (types.includes('unsupported')) { unsupported = true; break; }
    if (types.includes('bad-text')) continue;
    cases.push({ args: names.map((n) => c.input[n]), expected: c.expected, types, description: c.description });
  }
  if (unsupported) { why('a value that is not a whole number, boolean, string or flat array'); continue; }
  let sig = cases[0]?.types ?? null;
  for (const c of cases) sig = sig && sig.map((t, i) => (t === null ? null : merge(t, c.types[i])));
  if (!sig || sig.includes(null) || sig.includes('[]')) { why('types differ between cases'); continue; }
  // the same input may appear twice with different descriptions; keep one of each
  const seen = new Set();
  const unique = cases.filter((c) => { const k = JSON.stringify(c.args); if (seen.has(k)) return false; seen.add(k); return true; });
  if (unique.length < 8) { why('fewer than 8 usable cases'); continue; }
  eligible.push({
    id: snake(name),
    exercise: name,
    params: names.map((n, i) => [snake(n), sig[i]]),
    ret: sig[sig.length - 1],
    desc: readFileSync(statement, 'utf8').replace(/\r/g, '').trim(),
    examples: unique.slice(0, 2).map((c) => ({ args: c.args, expected: c.expected })),
    tests: unique.slice(2).map((c) => ({ args: c.args, expected: c.expected })),
  });
}
const order = (t) => createHash('sha256').update(t.exercise).digest('hex');
eligible.sort((a, b) => order(a).localeCompare(order(b)));
const chosen = eligible.slice(0, count);
let commit = '';
try { commit = execFileSync('git', ['-C', repo, 'log', '-1', '--format=%H %cs'], { encoding: 'utf8' }).trim(); } catch { /* not a git clone */ }
const out = fileURLToPath(new URL('./tasks-exercism.json', import.meta.url));
writeFileSync(out, `${JSON.stringify({ source: 'https://github.com/exercism/problem-specifications', licence: 'MIT, copyright Exercism', commit, eligible: eligible.map((t) => t.exercise), tasks: chosen }, null, 1)}\n`);
console.log(`${eligible.length} exercises qualify; took ${chosen.length}: ${chosen.map((t) => t.exercise).join(', ')}`);
console.log(`hidden test cases: ${chosen.reduce((n, t) => n + t.tests.length, 0)}`);
console.log(`left out: ${Object.entries(rejected).map(([k, v]) => `${v} ${k}`).join('; ')}`);
