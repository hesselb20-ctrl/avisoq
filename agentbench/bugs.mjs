// What happens when a program has a bug? The same mistake, written in Avisoq, Rust and Python,
// and what each toolchain does with it:
//
//   rejected   the compiler refuses the program
//   stopped    the program stops with an error when the bug is reached
//   SILENT     the program finishes normally with a wrong result (or does what it should not)
//   correct    the language's own rules make this not a bug (for example, Python integers
//              do not overflow)
//
//   node agentbench/bugs.mjs
//
// These cases were chosen by the author of Avisoq to show where the languages differ. They are a
// list of checkable behaviours, each one run for real, not a sample of real-world bugs.
// Avisoq: native backend, all checks on. Rust: `rustc -O` (how programs are shipped) and a
// debug build. Python: CPython.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findGcc } from '../src/compiler.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const cli = join(here, '..', 'src', 'cli.mjs');
const gcc = findGcc();
const env = { ...process.env, PATH: [gcc && gcc !== 'gcc' ? dirname(gcc) : '', join(homedir(), '.cargo', 'bin'), process.env.PATH].join(delimiter) };
const tmp = join(tmpdir(), `agentbugs-${process.pid}`);
mkdirSync(tmp, { recursive: true });
const run = (bin, args) => spawnSync(bin, args, { encoding: 'utf8', timeout: 120000, env, cwd: tmp });

// `right` is what a correct program would print; null means there is no right answer and the
// only acceptable outcomes are a refusal or an error.
const CASES = [
  {
    id: 'overflow', what: 'A product grows past 64 bits (25 factorial)', right: '15511210043330985984000000',
    avisoq: 'fn fact(n: Int) -> Int {\n  var f = 1\n  for i in 1..n + 1 { f = f * i }\n  return f\n}\nfn main() uses io {\n  print(fact(len("abcdefghijklmnopqrstuvwxy")))\n}\n',
    rust: 'fn fact(n: i64) -> i64 { let mut f = 1; for i in 1..=n { f = f * i; } f }\nfn main() { println!("{}", fact("abcdefghijklmnopqrstuvwxy".len() as i64)); }\n',
    python: 'def fact(n):\n    f = 1\n    for i in range(1, n + 1):\n        f = f * i\n    return f\nprint(fact(len("abcdefghijklmnopqrstuvwxy")))\n',
  },
  {
    id: 'negate_smallest', what: 'The absolute value of the smallest 64-bit integer', right: '9223372036854775808',
    avisoq: 'import "std/math"\nfn main() uses io {\n  let smallest = -9223372036854775807 - len("x")\n  print(abs(smallest))\n}\n',
    rust: 'fn main() { let smallest = -9223372036854775807i64 - ("x".len() as i64); println!("{}", smallest.abs()); }\n',
    python: 'smallest = -9223372036854775807 - len("x")\nprint(abs(smallest))\n',
  },
  {
    id: 'shift_too_far', what: 'A shift by 64 places', right: '18446744073709551616',
    avisoq: 'fn main() uses io {\n  let places = len("abcdefgh") * 8\n  print(shift_left(1, places))\n}\n',
    rust: 'fn main() { let places = ("abcdefgh".len() * 8) as u32; println!("{}", 1u64 << places); }\n',
    python: 'places = len("abcdefgh") * 8\nprint(1 << places)\n',
  },
  {
    id: 'float_to_int', what: 'A float too large for an integer is converted to one', right: '100000000000000000000',
    avisoq: 'fn main() uses io {\n  let big = 1.0e19 * float(len("0123456789"))\n  print(int(big))\n}\n',
    rust: 'fn main() { let big = 1.0e19 * ("0123456789".len() as f64); println!("{}", big as i64); }\n',
    python: 'big = 1.0e19 * float(len("0123456789"))\nprint(int(big))\n',
  },
  {
    id: 'index_past_end', what: 'Reading one element past the end of an array', right: null,
    avisoq: 'fn main() uses io {\n  let xs = [10, 20, 30]\n  print(xs[len(xs)])\n}\n',
    rust: 'fn main() { let xs = vec![10, 20, 30]; let i = xs.len(); println!("{}", xs[i]); }\n',
    python: 'xs = [10, 20, 30]\nprint(xs[len(xs)])\n',
  },
  {
    id: 'index_before_start', what: 'An off-by-one that reads the element before the first', right: null,
    avisoq: 'fn main() uses io {\n  let xs = [10, 20, 30]\n  let first = len(xs) - 3\n  print(xs[first - 1])\n}\n',
    rust: 'fn main() { let xs = vec![10, 20, 30]; let first = xs.len() - 3; println!("{}", xs[first - 1]); }\n',
    python: 'xs = [10, 20, 30]\nfirst = len(xs) - 3\nprint(xs[first - 1])\n',
  },
  {
    id: 'slice_past_end', what: 'Taking 10 characters from a 5-character string', right: null,
    avisoq: 'fn main() uses io {\n  let s = "hello"\n  print(substr(s, 0, len(s) + 5))\n}\n',
    rust: 'fn main() { let s = String::from("hello"); let n = s.len() + 5; println!("{}", &s[0..n]); }\n',
    python: 's = "hello"\nprint(s[0:len(s) + 5])\n',
  },
  {
    id: 'divide_by_zero', what: 'An integer average of an empty list', right: null,
    avisoq: 'fn main() uses io {\n  let xs: [Int] = []\n  var total = 0\n  for x in xs { total += x }\n  print(total / len(xs))\n}\n',
    rust: 'fn main() { let xs: Vec<i64> = Vec::new(); let total: i64 = xs.iter().sum(); println!("{}", total / (xs.len() as i64)); }\n',
    python: 'xs = []\ntotal = sum(xs)\nprint(total // len(xs))\n',
  },
  {
    id: 'float_average_of_nothing', what: 'A float average of an empty list, where the function says it needs a non-empty one', right: null,
    note: 'Avisoq states the requirement as a contract; in Rust and Python it is a comment.',
    avisoq: 'fn average(xs: [Float]) -> Float\n  requires len(xs) > 0\n{\n  var total = 0.0\n  for x in xs { total = total + x }\n  return total / float(len(xs))\n}\nfn main() uses io {\n  let xs: [Float] = []\n  print(average(xs))\n}\n',
    rust: '// xs must not be empty\nfn average(xs: &[f64]) -> f64 { let total: f64 = xs.iter().sum(); total / (xs.len() as f64) }\nfn main() { let xs: Vec<f64> = Vec::new(); println!("{}", average(&xs)); }\n',
    python: '# xs must not be empty\ndef average(xs):\n    total = 0.0\n    for x in xs:\n        total = total + x\n    return total / float(len(xs))\nprint(average([]))\n',
  },
  {
    id: 'missing_case', what: 'A new kind of value is added and one place that handles kinds is not updated', right: null,
    avisoq: 'enum Shape { Circle(r: Int), Square(side: Int), Triangle(base: Int, height: Int) }\nfn area(s: Shape) -> Int {\n  match s {\n    Circle(r) => { return 3 * r * r }\n    Square(side) => { return side * side }\n  }\n}\nfn main() uses io {\n  print(area(Triangle(base: 4, height: 3)))\n}\n',
    rust: 'enum Shape { Circle(i64), Square(i64), Triangle(i64, i64) }\nfn area(s: &Shape) -> i64 { match s { Shape::Circle(r) => 3 * r * r, Shape::Square(side) => side * side } }\nfn main() { println!("{}", area(&Shape::Triangle(4, 3))); }\n',
    python: 'def area(shape):\n    kind = shape[0]\n    if kind == "circle":\n        return 3 * shape[1] * shape[1]\n    elif kind == "square":\n        return shape[1] * shape[1]\nprint(area(("triangle", 4, 3)))\n',
  },
  {
    id: 'shared_list', what: 'A list is given a second name and changed through it; the original should stay 1,2,3', right: '3',
    avisoq: 'fn main() uses io {\n  var original = [1, 2, 3]\n  var working = original\n  push(working, 4)\n  print(len(original))\n}\n',
    rust: 'fn main() { let original = vec![1, 2, 3]; let mut working = original; working.push(4); println!("{}", original.len()); }\n',
    python: 'original = [1, 2, 3]\nworking = original\nworking.append(4)\nprint(len(original))\n',
  },
  {
    id: 'unexpected_file_write', what: 'Code that was only asked to compute a number also writes a file', right: null, writes: 'written_by_bug.txt',
    note: 'Avisoq is run the way untrusted code is run: with only the io capability granted.',
    avisoq: 'fn main() uses io, fs {\n  match write_file("written_by_bug.txt", "data") {\n    Ok => { print(42) }\n    Err(error) => { print(42) }\n  }\n}\n',
    rust: 'fn main() { let _ = std::fs::write("written_by_bug.txt", "data"); println!("42"); }\n',
    python: 'open("written_by_bug.txt", "w").write("data")\nprint(42)\n',
  },
];

function classify(c, compiled, r) {
  if (!compiled) return 'rejected';
  const wrote = c.writes && existsSync(join(tmp, c.writes));
  if (c.writes) { rmSync(join(tmp, c.writes), { force: true }); return wrote ? 'SILENT' : 'stopped'; }
  if (r.status !== 0) return 'stopped';
  const out = r.stdout.replace(/\r/g, '').trim();
  if (c.right !== null && out === c.right) return 'correct';
  return 'SILENT';
}

function avisoq(c) {
  const f = join(tmp, `${c.id}.avq`);
  writeFileSync(f, c.avisoq);
  const check = run(process.execPath, [cli, 'check', f]);
  if (check.status !== 0) return { outcome: 'rejected', detail: check.stdout.split('\n')[0] };
  const r = run(process.execPath, [cli, 'run', f, '--allow', 'io', '--native']);
  return { outcome: classify(c, true, r), detail: (r.stderr || r.stdout).trim().split('\n')[0] };
}
function rust(c, debug) {
  const f = join(tmp, `${c.id}.rs`), exe = join(tmp, `${c.id}${debug ? '_d' : ''}.exe`);
  writeFileSync(f, c.rust);
  const b = run('rustc', ['+stable-x86_64-pc-windows-gnu', ...(debug ? [] : ['-O']), '-A', 'warnings', '-o', exe, f]);
  if (b.status !== 0) return { outcome: 'rejected', detail: b.stderr.trim().split('\n')[0] };
  const r = run(exe, []);
  return { outcome: classify(c, true, r), detail: (r.stderr || r.stdout).trim().split('\n')[0] };
}
function python(c) {
  const f = join(tmp, `${c.id}.py`);
  writeFileSync(f, c.python);
  const r = run('python', [f]);
  return { outcome: classify(c, true, r), detail: (r.stderr.trim().split('\n').pop() || r.stdout.trim()) };
}

const verbose = process.argv.includes('--detail');
const langs = [['Avisoq', avisoq], ['Rust -O', (c) => rust(c, false)], ['Rust debug', (c) => rust(c, true)], ['Python', python]];
const tally = Object.fromEntries(langs.map(([n]) => [n, { rejected: 0, stopped: 0, SILENT: 0, correct: 0 }]));
console.log(`| Bug | ${langs.map(([n]) => n).join(' | ')} |`);
console.log(`|---|${langs.map(() => '---').join('|')}|`);
for (const c of CASES) {
  const row = langs.map(([name, f]) => { const r = f(c); tally[name][r.outcome]++; return verbose ? `${r.outcome} (${r.detail.slice(0, 60)})` : r.outcome; });
  console.log(`| ${c.what} | ${row.join(' | ')} |`);
}
console.log(`| **silent, out of ${CASES.length}** | ${langs.map(([n]) => `**${tally[n].SILENT}**`).join(' | ')} |`);
rmSync(tmp, { recursive: true, force: true });
