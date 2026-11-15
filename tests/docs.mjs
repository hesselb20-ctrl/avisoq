// Runs every program in the documentation and compares what it prints with the output shown.
//   node tests/docs.mjs
// In docs/*.md, a fenced block marked `avisoq` that defines main, followed by a block marked
// `output`, is a tested example. Blocks marked `avisoq` without main only have to compile when
// wrapped with the declarations around them (see `fragment`).
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { compile, run, runTests } from '../src/compiler.mjs';

const dir = new URL('../docs/', import.meta.url);
let passed = 0, failed = 0;
const report = (name, ok, detail = '') => { if (ok) passed++; else { failed++; console.log(`FAIL  ${name}\n      ${detail}`); } };

for (const file of readdirSync(dir).filter((f) => f.endsWith('.md')).sort()) {
  const text = readFileSync(new URL(file, dir), 'utf8').replace(/\r/g, '');
  const blocks = [...text.matchAll(/```(\w+)\n([\s\S]*?)```/g)].map((m) => ({ kind: m[1], body: m[2], at: text.slice(0, m.index).split('\n').length }));
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.kind !== 'avisoq') continue;
    const name = `${file}:${b.at}`;
    const hasMain = /^fn main\(/m.test(b.body);
    const src = hasMain ? b.body : `${b.body}\nfn main() { }\n`;
    const c = compile(src, { backend: 'wasm', allow: ['io', 'time'], path: fileURLToPath(new URL(file, dir)) });
    if (!c.ok) { report(name, false, `does not compile: ${c.diagnostics.map((d) => `line ${d.line}: ${d.message}`).join('; ')}`); continue; }
    if (!hasMain) { report(name, true); continue; }
    const next = blocks[i + 1];
    let stdout = '';
    const r = await run(c, { allow: ['io', 'time'], write: (s) => { stdout += s; } });
    if (!r.ok) { report(name, false, `stops with ${JSON.stringify(r.error)}`); continue; }
    if (next && next.kind === 'output') report(name, stdout === next.body, `prints ${JSON.stringify(stdout)} but the page shows ${JSON.stringify(next.body)}`);
    else report(name, true);
    if (/^test "/m.test(b.body)) {
      const results = await runTests(c);
      report(`${name} (its tests)`, results.every((t) => t.ok), JSON.stringify(results.filter((t) => !t.ok)));
    }
  }
}
console.log(`[docs] ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
