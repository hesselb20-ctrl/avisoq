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
        const recs = ofType(scope, 'Rec');
        const q = int(9);
        if (q === 0) return `${pick(['bit_and', 'bit_or', 'bit_xor'])}(${a()}, ${a()})`;
        if (q === 1) return `${pick(['shift_left', 'shift_right'])}(${a()}, ${chance(0.9) ? int(64) : a()})`;
        if (q === 2) return `(if ${expr('Bool', scope, d - 1)} then ${a()} else ${a()})`;
        if (q === 3 && recs.length) return pick([`${pick(recs).name}.n`, `len(${pick(recs).name}.xs)`, `len(${pick(recs).name}.tag)`, `total(${pick(recs).name}.xs)`]);
        if (q === 4 && arrs.length) return `total(${pick(arrs).name})`;
        if (q === 5) return `len(build(${a()} % 40))`;
        if (q === 6 && strs.length) { const v = pick(strs).name; return `(if len(${v}) > 0 then ${v}[0] else -1)`; }
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
  const printable = (scope) => scope.filter((v) => v.ty !== '[Int]' && v.ty !== 'Rec');

  function block(scope, d, pad, out, inFn) {
    const local = [...scope];
    const n = 2 + int(4);
    for (let k = 0; k < n; k++) {
      const r = int(12);
      const recs = ofType(local, 'Rec', true);
      const extra = chance(0.3) ? int(8) : -1; // the newer features: structs with arrays, mut parameters, for-in, tuples, ?
      if (extra === 0) {
        const name = fresh('r');
        out.push(`${pad}var ${name} = Rec(n: ${expr('Int', local, 1)}, tag: ${expr('Str', local, 1)}, xs: ${expr('[Int]', local, 1)})`);
        local.push({ name, ty: 'Rec', mutable: true });
      } else if (extra === 1 && recs.length) {
        const v = pick(recs).name;
        out.push(pick([`${pad}bump(${v}, ${expr('Int', local, 1)})`, `${pad}${v}.n = ${expr('Int', local, 1)}`, `${pad}push(${v}.xs, ${expr('Int', local, 1)})`,
          `${pad}${v}.tag = ${v}.tag + ${expr('Str', local, 1)}`, `${pad}${v}.n += len(${v}.tag)`]));
      } else if (extra === 2) {
        const strs = ofType(local, 'Str', true);
        if (strs.length) { const v = pick(strs).name; out.push(chance(0.5) ? `${pad}${v} += ${expr('Str', local, 1)}` : `${pad}${v} = ${v} + chr(97 + ${int(26)}) + str(len(${v}))`); }
      } else if (extra === 3 && d > 0) {
        const arrs = ofType(local, '[Int]');
        if (arrs.length) {
          const x = fresh('x');
          out.push(`${pad}for ${x} in ${pick(arrs).name} {`);
          block([...local.filter((v) => v.ty !== '[Int]' || !v.mutable), { name: x, ty: 'Int' }], d - 1, `${pad}  `, out, inFn);
          out.push(`${pad}}`);
        }
      } else if (extra === 4) {
        const a = fresh('t'), b = fresh('t');
        out.push(`${pad}let (${a}, ${b}) = pair(${expr('Int', local, 1)})`);
        local.push({ name: a, ty: 'Int' }, { name: b, ty: 'Str' });
      } else if (extra === 5 && !inFn) {
        out.push(`${pad}print(show(chain(${expr('Int', local, 1)}, ${expr('Int', local, 1)}, ${expr('Int', local, 1)})))`);
      } else if (extra === 6 && recs.length && !inFn) {
        const v = pick(recs).name;
        out.push(`${pad}print(${v}.n, ${v}.tag, len(${v}.xs), total(${v}.xs))`);
      } else if (extra === 7 && recs.length) {
        const v = pick(recs).name, w = fresh('r');
        out.push(`${pad}var ${w} = copy(${v})`, `${pad}bump(${w}, ${int(9)})`);
        local.push({ name: w, ty: 'Rec', mutable: true });
      } else if (r <= 2) {
        const ty = chance(0.2) ? '[Int]' : pick(SCALARS);
        const mutable = chance(0.5);
        const name = fresh('v');
        out.push(`${pad}${mutable ? 'var' : 'let'} ${name} = ${expr(ty, local, 2)}`);
        local.push({ name, ty, mutable });
      } else if (r === 3) {
        const targets = local.filter((v) => v.mutable && v.ty !== '[Int]' && v.ty !== 'Rec');
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

  const out = [
    'struct Rec { n: Int, tag: Str, xs: [Int] }', '',
    'fn bump(r: mut Rec, k: Int) {', '  r.n += k % 1000', '  push(r.xs, k)', '  r.tag += str(k % 7)', '}', '',
    'fn build(n: Int) -> Str {', '  var s = ""', "  for i in 0..n { s += chr('a' + i % 26) }", '  return s', '}', '',
    'fn total(xs: [Int]) -> Int {', '  var t = 0', '  for x in xs { t = t + x % 1000 }', '  return t', '}', '',
    'fn pair(a: Int) -> (Int, Str) {', '  return (a % 100, build(a % 5))', '}', '',
    'fn safe_div(a: Int, b: Int) -> Result[Int, Str] {', '  if b == 0 { return Err(error: "zero after " + str(a % 10)) }', '  return Ok(value: a / b)', '}', '',
    'fn chain(a: Int, b: Int, c: Int) -> Result[Int, Str] {', '  let x = safe_div(a, b)?', '  var y = safe_div(x, c)?', '  y += 1', '  return Ok(value: x % 1000 + y % 1000)', '}', '',
    'fn show(r: Result[Int, Str]) -> Str {', '  match r {', '    Ok(value) => { return "ok " + str(value) }', '    Err(error) => { return "err " + error }', '  }', '}', '',
  ];
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
