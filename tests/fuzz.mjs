// Differential fuzzer: generates random valid Avisoq programs and checks that the native and
// WebAssembly backends agree on everything observable (output, and the kind of any failure).
//
//   node tests/fuzz.mjs [count] [firstSeed]
//
// A disagreement is a compiler bug in at least one backend. Programs the checker or the
// contract prover rejects are skipped; too many of those means the generator needs fixing.
import { writeFileSync } from 'node:fs';
import { compile, run } from '../src/compiler.mjs';

const count = Number(process.argv[2] ?? 100);
const firstSeed = Number(process.argv[3] ?? 1);

function generate(seed) {
  let state = seed >>> 0;
  const rnd = () => { // mulberry32
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (n) => Math.floor(rnd() * n);
  const pick = (xs) => xs[int(xs.length)];
  const chance = (p) => rnd() < p;
  let nameCount = 0;
  const fresh = (p) => `${p}${nameCount++}`;

  // scope: [{ name, ty, mutable }]
  const ofType = (scope, ty, mutableOnly = false) => scope.filter((v) => v.ty === ty && (!mutableOnly || v.mutable));
  const fns = []; // { name, params: [ty], ret }

  function intLit() {
    const r = rnd();
    if (r < 0.75) return String(int(21) - 5);
    if (r < 0.9) return String(int(2000) - 500);
    return pick(['9223372036854775807', '4611686018427387904', '3037000499', '2147483648', '1000000007']);
  }
  const floatLit = () => pick(['0.0', '0.5', '1.0', '1.5', '2.25', '3.0', '10.0', '0.1', '100.5', '1.0e10', '2.5e-3', '0.001', '7.75']);

  function expr(ty, scope, d) {
    const vars = ofType(scope, ty);
    const leaf = d <= 0 || chance(0.25);
    switch (ty) {
      case 'Int': {
        if (leaf) return vars.length && chance(0.6) ? pick(vars).name : intLit();
        const arrs = ofType(scope, '[Int]');
        const strs = ofType(scope, 'Str');
        const callable = fns.filter((f) => f.ret === 'Int');
        const r = int(13);
        const a = () => expr('Int', scope, d - 1);
        if (r === 0) return `(${a()} + ${a()})`;
        if (r === 1) return `(${a()} - ${a()})`;
        if (r === 2) return `(${a()} * ${a()})`;
        if (r === 3) return `(${a()} / ${chance(0.7) ? pick(['2', '3', '7', '10']) : a()})`;
        if (r === 4) return `(${a()} % ${chance(0.7) ? pick(['2', '3', '5', '100']) : a()})`;
        if (r === 5) return `-${a()}`;
        if (r === 6 && arrs.length) return `len(${pick(arrs).name})`;
        if (r === 7 && arrs.length) { const v = pick(arrs).name; return chance(0.8) ? `${v}[${a()} % (len(${v}) + 1)]` : `${v}[${a()}]`; }
        if (r === 8) return `int(${expr('Float', scope, d - 1)})`;
        if (r === 9 && callable.length) { const f = pick(callable); return `${f.name}(${f.params.map((p) => expr(p, scope, d - 1)).join(', ')})`; }
        if (r === 10) { const i = fresh('i'); return `sum(${i} in 0..${int(12)}: ${expr('Int', [...scope, { name: i, ty: 'Int' }], d - 1)})`; }
        if (r === 11) { const i = fresh('i'); return `sum(${i} in ${int(4)}..${int(40)}: int(float(${i}) * ${floatLit()} + ${expr('Float', [...scope, { name: i, ty: 'Int' }], Math.min(d - 1, 1))}))`; }
        if (r === 12 && strs.length) return `len(${pick(strs).name})`;
        return `(${a()} + ${a()})`;
      }
      case 'Float': {
        if (leaf) return vars.length && chance(0.6) ? pick(vars).name : floatLit();
        const a = () => expr('Float', scope, d - 1);
        const r = int(8);
        if (r === 0) return `(${a()} + ${a()})`;
        if (r === 1) return `(${a()} - ${a()})`;
        if (r === 2) return `(${a()} * ${a()})`;
        if (r === 3) return `(${a()} / ${a()})`;
        if (r === 4) return `float(${expr('Int', scope, d - 1)})`;
        if (r === 5) return `sqrt(${a()})`;
        if (r === 6) return `-${a()}`;
        { const i = fresh('i'); return `sum(${i} in 0..${int(9)}: float(${i}) * ${floatLit()})`; }
      }
      case 'Bool': {
        if (leaf) return vars.length && chance(0.5) ? pick(vars).name : pick(['true', 'false']);
        const r = int(7);
        const cmp = pick(['<', '<=', '>', '>=', '==', '!=']);
        if (r === 0) return `(${expr('Int', scope, d - 1)} ${cmp} ${expr('Int', scope, d - 1)})`;
        if (r === 1) return `(${expr('Float', scope, d - 1)} ${pick(['<', '<=', '>', '>='])} ${expr('Float', scope, d - 1)})`;
        if (r === 2) return `(${expr('Bool', scope, d - 1)} and ${expr('Bool', scope, d - 1)})`;
        if (r === 3) return `(${expr('Bool', scope, d - 1)} or ${expr('Bool', scope, d - 1)})`;
        if (r === 4) return `not ${expr('Bool', scope, d - 1)}`;
        if (r === 5) return `(${expr('Str', scope, d - 1)} ${cmp} ${expr('Str', scope, d - 1)})`;
        return `(${expr('Bool', scope, d - 1)} == ${expr('Bool', scope, d - 1)})`;
      }
      case 'Str': {
        if (leaf) return vars.length && chance(0.6) ? pick(vars).name : pick(['""', '"a"', '"ab"', '"hello"', '"x y"', '"Zed"', '"hé"']);
        const r = int(6);
        const a = () => expr('Str', scope, d - 1);
        if (r === 0) return `(${a()} + ${a()})`;
        if (r === 1) return `str(${expr('Int', scope, d - 1)})`;
        if (r === 2) return `str(${expr('Float', scope, d - 1)})`;
        if (r === 3) return `str(${expr('Bool', scope, d - 1)})`;
        if (r === 4 && vars.length) { const v = pick(vars).name; return `substr(${v}, 0, len(${v}) / 2)`; }
        return `(${a()} + ${a()})`;
      }
      case '[Int]': {
        const r = int(3);
        if (r === 0) return `[${Array.from({ length: 1 + int(4) }, () => expr('Int', scope, d - 1)).join(', ')}]`;
        if (r === 1) { const i = fresh('i'); return `[${i} in 0..${int(7)}: ${expr('Int', [...scope, { name: i, ty: 'Int' }], d - 1)}]`; }
        return `array(${chance(0.9) ? int(6) : expr('Int', scope, d - 1)}, ${expr('Int', scope, d - 1)})`;
      }
      default: throw new Error(ty);
    }
  }

  const SCALARS = ['Int', 'Int', 'Float', 'Bool', 'Str'];
  const printable = (scope) => scope.filter((v) => v.ty !== '[Int]');

  function block(scope, d, pad, out, inFn) {
    const local = [...scope];
    const n = 2 + int(4);
    for (let k = 0; k < n; k++) {
      const r = int(12);
      if (r <= 2) {
        const ty = chance(0.2) ? '[Int]' : pick(SCALARS);
        const mutable = chance(0.5);
        const name = fresh('v');
        out.push(`${pad}${mutable ? 'var' : 'let'} ${name} = ${expr(ty, local, 2)}`);
        local.push({ name, ty, mutable });
      } else if (r === 3) {
        const targets = local.filter((v) => v.mutable && v.ty !== '[Int]');
        if (targets.length) { const v = pick(targets); out.push(`${pad}${v.name} = ${expr(v.ty, local, 2)}`); }
      } else if (r === 4 && d > 0) {
        out.push(`${pad}if ${expr('Bool', local, 2)} {`);
        block(local, d - 1, `${pad}  `, out, inFn);
        if (chance(0.5)) { out.push(`${pad}} else {`); block(local, d - 1, `${pad}  `, out, inFn); }
        out.push(`${pad}}`);
      } else if (r === 5 && d > 0) {
        const i = fresh('i');
        out.push(`${pad}for ${i} in ${int(3)}..${int(7)} {`);
        block([...local, { name: i, ty: 'Int' }], d - 1, `${pad}  `, out, inFn);
        out.push(`${pad}}`);
      } else if (r === 6 && d > 0) {
        const c = fresh('c');
        out.push(`${pad}var ${c} = 0`, `${pad}while ${c} < ${1 + int(5)} {`);
        block([...local, { name: c, ty: 'Int' }], d - 1, `${pad}  `, out, inFn);
        out.push(`${pad}  ${c} = ${c} + 1`, `${pad}}`);
      } else if (r === 7) {
        const arrs = ofType(local, '[Int]', true);
        if (arrs.length) {
          const v = pick(arrs).name;
          out.push(chance(0.7) ? `${pad}push(${v}, ${expr('Int', local, 1)})` : `${pad}${v}[${expr('Int', local, 1)} % (len(${v}) + 1)] = ${expr('Int', local, 1)}`);
        }
      } else if (r === 8 && !inFn) {
        out.push(`${pad}assert ${expr('Bool', local, 1)}`);
      } else if (!inFn) {
        const vs = printable(local);
        const args = Array.from({ length: 1 + int(3) }, () => (vs.length && chance(0.6) ? pick(vs).name : expr(pick(SCALARS), local, 2)));
        out.push(`${pad}print(${args.join(', ')})`);
      }
    }
    return local;
  }

  const out = [];
  for (let k = 0; k < 1 + int(3); k++) {
    const name = fresh('f');
    const params = Array.from({ length: 1 + int(2) }, () => pick(['Int', 'Int', 'Float', 'Bool']));
    const ret = pick(['Int', 'Int', 'Float', 'Bool', 'Str']);
    const scope = params.map((ty) => ({ name: fresh('p'), ty }));
    const req = chance(0.4) && params[0] === 'Int' ? `\n  requires ${scope[0].name} ${pick(['>=', '<', '!='])} ${int(10) - 3}` : '';
    out.push(`fn ${name}(${scope.map((v) => `${v.name}: ${v.ty}`).join(', ')}) -> ${ret}${req}${req ? '\n{' : ' {'}`);
    const local = block(scope, 1, '  ', out, true);
    out.push(`  return ${expr(ret, local, 2)}`, '}', '');
    fns.push({ name, params, ret });
  }
  out.push('fn main() uses io {');
  block([], 2, '  ', out, false);
  out.push('  print("end")', '}');
  return `${out.join('\n')}\n`;
}

async function outcome(src, backend) {
  const c = compile(src, { backend, allow: ['io'] });
  if (!c.ok) {
    // FUZZ_SHOW=E0001 prints the programs rejected with that code, to tell generator gaps from compiler bugs
    const d = c.diagnostics[0];
    if (process.env.FUZZ_SHOW && c.diagnostics.some((x) => x.code === process.env.FUZZ_SHOW)) console.log(JSON.stringify(d), src.split(/\n/).slice(Math.max(0, d.line - 2), d.line + 1));
    return { compiled: false, codes: c.diagnostics.map((x) => x.code) };
  }
  let stdout = '';
  const r = await run(c, { allow: ['io'], write: (s) => { stdout += s; } });
  return { compiled: true, ok: r.ok, kind: r.ok ? null : r.error.kind, stdout };
}

let agree = 0, rejected = 0, failedRuns = 0;
const rejections = new Map();
const disagreements = [];
for (let seed = firstSeed; seed < firstSeed + count; seed++) {
  const src = generate(seed);
  const w = await outcome(src, 'wasm');
  if (!w.compiled) {
    rejected++;
    for (const c of w.codes) rejections.set(c, (rejections.get(c) ?? 0) + 1);
    continue;
  }
  const n = await outcome(src, 'native');
  // A deep recursion limit and the exact trap wording may differ; the kind may not.
  const same = n.compiled && w.ok === n.ok && w.kind === n.kind && w.stdout === n.stdout;
  if (same) { agree++; if (!w.ok) failedRuns++; } else disagreements.push({ seed, wasm: w, native: n, src });
  if ((seed - firstSeed + 1) % 25 === 0) process.stderr.write(`  ${seed - firstSeed + 1}/${count}\n`);
}
console.log(`${agree} programs agree (${failedRuns} of them end in the same run-time failure), ${rejected} rejected by the compiler, ${disagreements.length} disagreements`);
if (rejections.size) console.log(`rejections by code: ${[...rejections].map(([c, k]) => `${c} x${k}`).join(', ')}`);
for (const d of disagreements.slice(0, 5)) {
  const file = `fuzz-disagreement-${d.seed}.avq`;
  writeFileSync(file, d.src);
  console.log(`\nseed ${d.seed} written to ${file}`);
  console.log(`  wasm:   ${JSON.stringify({ ok: d.wasm.ok, kind: d.wasm.kind, stdout: d.wasm.stdout?.slice(-200) })}`);
  console.log(`  native: ${JSON.stringify({ ok: d.native.ok, kind: d.native.kind, stdout: d.native.stdout?.slice(-200), codes: d.native.codes })}`);
}
process.exit(disagreements.length ? 1 : 0);
