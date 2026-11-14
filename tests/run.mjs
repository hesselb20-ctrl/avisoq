// Vow compiler test suite: node tests/run.mjs
import { compile, run, runTests } from '../src/compiler.mjs';

const BACKEND = process.argv[2] ?? 'wasm';
let passed = 0, failed = 0;
const report = (name, ok, detail) => {
  if (ok) passed++;
  else { failed++; console.log(`FAIL  ${name}\n      ${detail}`); }
};

async function exec(src, opts = {}) {
  const c = compile(src, { backend: BACKEND, allow: opts.allow ?? ['io', 'time'], ...opts });
  if (!c.ok) return { compile: c };
  let stdout = '';
  const r = await run(c, { allow: opts.allow ?? ['io', 'time'], write: (s) => { stdout += s; } });
  return { compile: c, run: r, stdout };
}

// Program prints exactly `expected`.
async function prints(name, src, expected) {
  const r = await exec(src);
  if (!r.compile.ok) return report(name, false, `compile error: ${JSON.stringify(r.compile.diagnostics)}`);
  if (!r.run.ok) return report(name, false, `runtime error: ${JSON.stringify(r.run.error)}`);
  report(name, r.stdout === expected, `expected ${JSON.stringify(expected)} got ${JSON.stringify(r.stdout)}`);
}

// As prints, but with explicit capability grants.
async function prints2(name, src, expected, opts) {
  const r = await exec(src, opts);
  if (!r.compile.ok) return report(name, false, `compile error: ${JSON.stringify(r.compile.diagnostics)}`);
  if (!r.run.ok) return report(name, false, `runtime error: ${JSON.stringify(r.run.error)}`);
  report(name, r.stdout === expected, `expected ${JSON.stringify(expected)} got ${JSON.stringify(r.stdout)}`);
}

// Program is rejected by the compiler with this diagnostic code.
function rejects(name, src, code) {
  const c = compile(src, { backend: BACKEND });
  const codes = c.diagnostics.map((d) => d.code);
  report(name, !c.ok && codes.includes(code), `expected ${code}, got ${c.ok ? 'successful compile' : codes.join(',')}`);
}

// Program compiles but fails at run time with this kind.
async function traps(name, src, kind, opts) {
  const r = await exec(src, opts);
  if (!r.compile.ok) return report(name, false, `compile error: ${JSON.stringify(r.compile.diagnostics)}`);
  report(name, !r.run.ok && r.run.error.kind === kind, `expected ${kind}, got ${JSON.stringify(r.run)}`);
}

const main = (body) => `fn main() uses io {\n${body}\n}`;

// ---- values and arithmetic ----
await prints('int arithmetic', main('print(1 + 2 * 3 - 4 / 2, 17 % 5, -7 / 2, -7 % 2)'), '5 2 -3 -1\n');
await prints('float arithmetic', main('print(1.5 + 2.0 * 2.0, 1.0 / 4.0, -2.5, 3.0)'), '5.5 0.25 -2.5 3.0\n');
await prints('precedence and parens', main('print((1 + 2) * 3, 2 * 3 + 4 * 5, 10 - 2 - 3)'), '9 26 5\n');
await prints('comparisons', main('print(1 < 2, 2 <= 2, 3 > 4, 1 == 1, 1 != 1, 1.5 < 2.5)'), 'true true false true false true\n');
await prints('boolean logic', main('print(true and false, true or false, not true, not 1 > 2 and true)'), 'false true false true\n');
await prints('short circuit', `
fn boom() -> Bool { assert false
 return true }
${main('print(false and boom(), true or boom())')}`, 'false true\n');
await prints('i64 range', main('print(9223372036854775807, 4611686018427387904 + 4611686018427387903)'), '9223372036854775807 9223372036854775807\n');
await prints('big multiply ok', main('print(3037000499 * 3037000499, -3037000499 * 3037000499, 4294967296 * 2147483647)'),
  '9223372030926249001 -9223372030926249001 9223372032559808512\n');
await prints('conversions', main('print(float(3), int(3.99), int(-3.99), sqrt(16.0))'), '3.0 3 -3 4.0\n');
await prints('strings', main('print("hello", "a\\tb", "q\\"q")\nprint()'), 'hello a\tb q"q\n\n');
await prints('underscore literals', main('print(1_000_000, 1.0e3)'), '1000000 1000.0\n');

// ---- control flow ----
await prints('if else chain', `
fn sign(n: Int) -> Int { if n < 0 { return -1 } else if n == 0 { return 0 } else { return 1 } }
${main('print(sign(-5), sign(0), sign(9))')}`, '-1 0 1\n');
await prints('while loop', main('var i = 0\nvar s = 0\nwhile i < 5 { s = s + i\n i = i + 1 }\nprint(s)'), '10\n');
await prints('for loop', main('var s = 0\nfor i in 1..11 { s = s + i }\nprint(s)'), '55\n');
await prints('empty and reversed range', main('var n = 0\nfor i in 5..5 { n = n + 1 }\nfor j in 9..2 { n = n + 1 }\nprint(n)'), '0\n');
await prints('nested loops with early return', `
fn find(limit: Int) -> Int {
  for a in 1..limit { for b in a..limit { if a * a + b * b == 25 { return a * 10 + b } } }
  return -1
}
${main('print(find(10))')}`, '34\n');
await prints('recursion', `
fn fact(n: Int) -> Int requires n >= 0 { if n == 0 { return 1 }
 return n * fact(n - 1) }
${main('print(fact(20))')}`, '2432902008176640000\n');
await prints('mutual recursion', `
fn even(n: Int) -> Bool { if n == 0 { return true }
 return odd(n - 1) }
fn odd(n: Int) -> Bool { if n == 0 { return false }
 return even(n - 1) }
${main('print(even(10), odd(7), even(3))')}`, 'true true false\n');
await prints('sibling scopes reuse names', main('for i in 0..2 { let x = i\n print(x) }\nfor i in 5..6 { let x = i\n print(x) }'), '0\n1\n5\n');

// ---- arrays ----
await prints('array literal and len', main('let a = [10, 20, 30]\nprint(len(a), a[0], a[2])'), '3 10 30\n');
await prints('array fill and write', main('var a = array(4, 7)\na[1] = 9\nprint(a[0], a[1], a[3])'), '7 9 7\n');
await prints('float and bool arrays', main('var f = array(2, 0.5)\nf[1] = 2.5\nvar b = [true, false]\nb[1] = true\nprint(f[0] + f[1], b[0] and b[1])'), '3.0 true\n');
await prints('nested arrays', main('var g = [[1, 2], [3, 4]]\ng[1][0] = 30\nprint(g[0][1] + g[1][0], len(g), len(g[0]))'), '32 2 2\n');
await prints('mut parameter', `
fn bump(xs: mut [Int]) { for i in 0..len(xs) { xs[i] = xs[i] + 1 } }
${main('var a = [1, 2, 3]\nbump(a)\nprint(a[0], a[1], a[2])')}`, '2 3 4\n');
await prints('array literal with nested index temps', main('let a = [1, 2, 3]\nlet b = [a[2], a[1] + a[0], [a[0]][0]]\nprint(b[0], b[1], b[2])'), '3 3 1\n');
await prints('zero length array', main('let a = array(0, 0)\nprint(len(a))'), '0\n');
await prints('large array grows memory', main('var a = array(3000000, 1)\nvar s = 0\nfor i in 0..len(a) { s = s + a[i] }\nprint(s)'), '3000000\n');
await prints('sieve', `
fn count_primes(n: Int) -> Int requires n >= 2 {
  var composite = array(n + 1, false)
  var count = 0
  for i in 2..n + 1 {
    if not composite[i] {
      count = count + 1
      var j = i * i
      while j <= n { composite[j] = true
        j = j + i }
    }
  }
  return count
}
${main('print(count_primes(100), count_primes(100000))')}`, '25 9592\n');

// ---- contracts ----
await prints('contracts hold', `
fn clamp(x: Int, lo: Int, hi: Int) -> Int requires lo <= hi ensures result >= lo and result <= hi {
  if x < lo { return lo }
  if x > hi { return hi }
  return x
}
${main('print(clamp(5, 0, 3), clamp(-5, 0, 3), clamp(2, 0, 3))')}`, '3 0 2\n');
await traps('requires violated', `fn half(n: Int) -> Int requires n % 2 == 0 { return n / 2 }\n${main('print(half(3))')}`, 'precondition');
await traps('ensures violated', `fn bad(n: Int) -> Int ensures result > n { return n }\n${main('print(bad(3))')}`, 'postcondition');
await traps('ensures checked on early return', `fn bad(n: Int) -> Int ensures result != 0 { if n < 5 { return n }\n return 1 }\n${main('print(bad(0))')}`, 'postcondition');
await traps('assert fails', main('assert 1 + 1 == 3'), 'assert');

// ---- runtime safety ----
await traps('index too large', main('let a = [1, 2]\nprint(a[2])'), 'bounds');
await traps('negative index', main('let a = [1, 2]\nlet i = -1\nprint(a[i])'), 'bounds');
await traps('write out of bounds', main('var a = array(3, 0)\na[3] = 1'), 'bounds');
await traps('add overflow', main('let x = 9223372036854775807\nprint(x + 1)'), 'overflow');
await traps('sub overflow', main('let x = -9223372036854775807\nprint(x - 2)'), 'overflow');
await traps('mul overflow', main('let x = 3037000500\nprint(x * x)'), 'overflow');
await traps('mul overflow negative', main('let x = 4611686018427387904\nprint(x * -3)'), 'overflow');
await traps('negate min overflow', main('let x = -9223372036854775807 - 1\nprint(-x)'), 'overflow');
await traps('division by zero', main('let z = 0\nprint(1 / z)'), 'division_by_zero');
await traps('remainder by zero', main('let z = 0\nprint(1 % z)'), 'division_by_zero');
await traps('negative array length', main('let n = -1\nlet a = array(n, 0)\nprint(len(a))'), 'array_size');
await traps('huge array length', main('let a = array(1000000000000, 0)\nprint(len(a))'), 'array_size');
await traps('infinite recursion is contained', `fn f(n: Int) -> Int { return f(n + 1) + 1 }\n${main('print(f(0))')}`, 'stack_overflow');
await traps('float to int out of range', main('print(int(1.0e300))'), 'trap');

// ---- structs ----
const POINT = 'struct Point { x: Float, y: Float }\n';
await prints('struct build and field access', `${POINT}${main('let p = Point(x: 1.5, y: 2.0)\nprint(p.x, p.y, p.x + p.y)')}`, '1.5 2.0 3.5\n');
await prints('struct through functions', `${POINT}
fn add(a: Point, b: Point) -> Point { return Point(x: a.x + b.x, y: a.y + b.y) }
fn norm2(p: Point) -> Float { return p.x * p.x + p.y * p.y }
${main('let p = add(Point(x: 1.0, y: 2.0), Point(x: 2.0, y: 2.0))\nprint(norm2(p))')}`, '25.0\n');
await prints('struct reassignment', `${POINT}${main('var p = Point(x: 1.0, y: 1.0)\nfor i in 0..3 { p = Point(x: p.x * 2.0, y: p.y + 1.0) }\nprint(p.x, p.y)')}`, '8.0 4.0\n');
await prints('nested structs and mixed fields', `${POINT}
struct Body { name: Str, pos: Point, mass: Int, alive: Bool, tags: [Int] }
${main('let b = Body(name: "moon", pos: Point(x: 3.0, y: 4.0), mass: 7, alive: true, tags: [1, 2])\nprint(b.name, b.pos.y, b.mass, b.alive, b.tags[1], len(b.tags))')}`, 'moon 4.0 7 true 2 2\n');
await prints('array of structs', `${POINT}${main('var ps = array(3, Point(x: 0.0, y: 0.0))\nps[1] = Point(x: 5.0, y: 6.0)\nlet lit = [Point(x: 1.0, y: 1.0), ps[1]]\nprint(ps[0].x, ps[1].y, lit[1].x, len(ps))')}`, '0.0 6.0 5.0 3\n');
await prints('struct fields evaluated in order', `${POINT}
fn noisy(v: Float) -> Float uses io { print(v)
 return v }
${main('let p = Point(x: noisy(1.0), y: noisy(2.0))\nprint(p.x + p.y)')}`, '1.0\n2.0\n3.0\n');
await prints('arguments evaluated in order', `
fn noisy(v: Int) -> Int uses io { print(v)
 return v }
fn three(a: Int, b: Int, c: Int) -> Int { return a * 100 + b * 10 + c }
${main('print(three(noisy(1), noisy(2), noisy(3)), noisy(4) - noisy(5))')}`, '1\n2\n3\n4\n5\n123 -1\n');
rejects('field assignment', `${POINT}${main('var p = Point(x: 1.0, y: 1.0)\np.x = 2.0')}`, 'E0204');
rejects('unknown field', `${POINT}${main('let p = Point(x: 1.0, y: 1.0)\nprint(p.z)')}`, 'E0208');
rejects('missing field', `${POINT}${main('let p = Point(x: 1.0)')}`, 'E0209');
rejects('fields out of order', `${POINT}${main('let p = Point(y: 1.0, x: 1.0)')}`, 'E0209');
rejects('wrong field type', `${POINT}${main('let p = Point(x: 1, y: 1.0)')}`, 'E0201');
rejects('struct without names', `${POINT}${main('let p = Point(1.0, 2.0)')}`, 'E0203');
rejects('recursive struct', 'struct Node { value: Int, next: Node }\nfn main() { }', 'E0105');
rejects('duplicate struct', `${POINT}${POINT}fn main() { }`, 'E0102');
rejects('struct equality', `${POINT}${main('let p = Point(x: 1.0, y: 1.0)\nprint(p == p)')}`, 'E0201');
await prints('recursive struct through array', `struct Tree { value: Int, kids: [Tree] }
fn size(t: Tree) -> Int { var n = 1
 for i in 0..len(t.kids) { n = n + size(t.kids[i]) }
 return n }
${main('let leaf = Tree(value: 1, kids: [])\nlet mid = Tree(value: 2, kids: [copy(leaf), copy(leaf)])\nlet root = Tree(value: 3, kids: [copy(mid), copy(leaf)])\nprint(size(root), len(leaf.kids))')}`, '5 0\n');
await prints('typed empty array', main('let xs: [Int] = []\nlet fs: [Float] = []\nprint(len(xs), len(fs))'), '0 0\n');
rejects('empty array without type', main('let a = []'), 'E0207');

// ---- strings ----
await prints('string concat and length', main('let s = "ab" + "cd" + ""\nprint(s, len(s), len(""))'), 'abcd 4 0\n');
await prints('string equality', main('let a = "x" + "y"\nprint(a == "xy", a != "xy", a == "xyz", "" == "")'), 'true false false true\n');
await prints('str conversions', main('print(str(42) + "|" + str(-7) + "|" + str(true) + "|" + str(1.5) + "|" + str(3.0))'), '42|-7|true|1.5|3.0\n');
await prints('float formatting', main('print(0.1 + 0.2, 1.0 / 3.0, 1.0e21, 1.5e-7, 0.00001, 123456.789, -0.5, 2.0e20)'),
  '0.30000000000000004 0.3333333333333333 1e+21 1.5e-7 0.00001 123456.789 -0.5 200000000000000000000.0\n');
await prints('substr and byte_at', main('let s = "hello world"\nprint(substr(s, 6, 11), substr(s, 0, 0) == "", byte_at(s, 0), byte_at(s, 10))'), 'world true 104 100\n');
await prints('utf8 strings', main('let s = "hé"\nprint(s, len(s))'), 'hé 3\n');
await prints('string building in a loop', `
fn repeat(s: Str, n: Int) -> Str requires n >= 0 { var r = ""
 for i in 0..n { r = r + s }
 return r }
${main('print(repeat("ab", 3), len(repeat("x", 1000)))')}`, 'ababab 1000\n');
await prints('strings in arrays and functions', `
fn join(parts: [Str], sep: Str) -> Str { var r = ""
 for i in 0..len(parts) { if i > 0 { r = r + sep }
  r = r + parts[i] }
 return r }
${main('print(join(["a", "b", "c"], ", "))')}`, 'a, b, c\n');
await traps('substr out of range', main('print(substr("abc", 1, 9))'), 'bounds');
await traps('substr reversed', main('print(substr("abc", 2, 1))'), 'bounds');
await traps('byte_at out of range', main('print(byte_at("abc", 3))'), 'bounds');
rejects('string plus int', main('print("a" + 1)'), 'E0201');
rejects('string ordering', main('print("a" < "b")'), 'E0201');
rejects('index into string', main('let s = "abc"\nprint(s[0])'), 'E0201');

// ---- sum ----
await prints('sum of a range', main('print(sum(i in 0..101: i), sum(i in 5..5: i), sum(i in 9..2: i))'), '5050 0 0\n');
await prints('sum with a function body', `
fn steps(n: Int) -> Int requires n >= 1 { var x = n
 var c = 0
 while x != 1 { if x % 2 == 0 { x = x / 2 } else { x = 3 * x + 1 }
  c = c + 1 }
 return c }
${main('print(sum(n in 1..10000: steps(n)))')}`, '849637\n');
await prints('sum over an array and captured values', main('let a = [3, 4, 5]\nlet k = 10\nprint(sum(i in 0..len(a): a[i] * k))'), '120\n');
await prints('float sum', main('print(sum(i in 0..4: float(i) * 0.5))'), '3.0\n');
await prints('nested sum', main('print(sum(i in 0..100: sum(j in 0..100: i * j)))'), '24502500\n');
await prints('large parallel sum', main('print(sum(i in 0..3000000: i % 7))'), '8999994\n');
await prints('sum total may pass through large intermediates', main('let big = 9223372036854775807\nprint(sum(i in 0..4: (1 - 2 * (i % 2)) * big))'), '0\n');
await traps('sum overflow', main('let big = 9223372036854775807\nprint(sum(i in 0..2: big))'), 'overflow');
await traps('failure inside sum is reported', main('let a = [1, 2]\nprint(sum(i in 0..5000: a[i]))'), 'bounds');
rejects('effect inside sum', `fn noisy(i: Int) -> Int uses io { print(i)\n return i }\n${main('print(sum(i in 0..3: noisy(i)))')}`, 'E0305');
rejects('mutation inside sum', `fn bump(a: mut [Int]) -> Int { a[0] = a[0] + 1\n return a[0] }\n${main('var a = [0]\nprint(sum(i in 0..3: bump(a)))')}`, 'E0305');
rejects('sum of bools', main('print(sum(i in 0..3: true))'), 'E0201');
rejects('function named sum', 'fn sum(a: Int) -> Int { return a }\nfn main() { }', 'E0102');

// ---- comprehensions ----
await prints('comprehension basics', main('let a = [i in 0..5: i * i]\nprint(len(a), a[0], a[4], len([i in 3..3: i]), len([i in 9..2: i]))'), '5 0 16 0 0\n');
await prints('comprehension with offset range', main('let a = [i in 10..13: i - 10]\nprint(a[0], a[1], a[2])'), '0 1 2\n');
await prints('comprehension of strings', main('let a = [i in 0..4: "n" + str(i)]\nprint(a[0] + a[1] + a[2] + a[3])'), 'n0n1n2n3\n');
await prints('nested comprehension', main('let g = [i in 0..4: [j in 0..i: j * 10]]\nprint(len(g[0]), len(g[3]), g[3][2], sum(i in 0..4: len(g[i])))'), '0 3 20 6\n');
await prints('comprehension of structs and floats', `${POINT}${main('let ps = [i in 0..3: Point(x: float(i), y: float(i) * 2.0)]\nlet fs = [i in 0..3: ps[i].x + ps[i].y]\nprint(fs[0], fs[2], ps[1].y)')}`, '0.0 6.0 2.0\n');
await prints('large parallel comprehension', `
fn work(n: Int) -> Int { var x = n
 for i in 0..50 { x = (x * 31 + 7) % 1000003 }
 return x }
${main('let a = [i in 0..200000: work(i)]\nprint(len(a), a[0], a[199999], sum(i in 0..len(a): a[i]) % 1000)')}`, '200000 157176 850830 600\n');
await prints('comprehension captures outer values', main('let base = [5, 6, 7]\nlet k = 3\nlet a = [i in 0..len(base): base[i] * k]\nprint(a[0], a[1], a[2])'), '15 18 21\n');
await traps('comprehension too large', main('let a = [i in 0..1000000000000: i]\nprint(len(a))'), 'array_size');
await traps('failure inside comprehension', main('let b = [1, 2]\nlet a = [i in 0..5000: b[i]]\nprint(len(a))'), 'bounds');
rejects('effect inside comprehension', `fn noisy(i: Int) -> Int uses io { print(i)\n return i }\n${main('let a = [i in 0..3: noisy(i)]')}`, 'E0305');
rejects('comprehension variable is scoped', main('let a = [i in 0..3: i]\nprint(i)'), 'E0101');

// ---- maps ----
await prints('map put get has len', main('var m: Map[Str, Int] = {}\nput(m, "a", 1)\nput(m, "b", 2)\nput(m, "a", 10)\nprint(get(m, "a"), get(m, "b"), has(m, "a"), has(m, "z"), len(m), get_or(m, "z", -1), get_or(m, "b", -1))'), '10 2 true false 2 -1 2\n');
await prints('map keys keep insertion order', main('var m: Map[Str, Int] = {}\nput(m, "pear", 1)\nput(m, "apple", 2)\nput(m, "fig", 3)\nput(m, "pear", 9)\nlet ks = keys(m)\nprint(len(ks), ks[0], ks[1], ks[2])'), '3 pear apple fig\n');
await prints('map with int keys', main('var m: Map[Int, Float] = {}\nput(m, -5, 1.5)\nput(m, 0, 2.5)\nput(m, 9223372036854775807, 3.5)\nlet ks = keys(m)\nprint(get(m, -5) + get(m, 0) + get(m, 9223372036854775807), ks[0], ks[2], len(m))'), '7.5 -5 9223372036854775807 3\n');
await prints('map values of every kind', `${POINT}${main('var a: Map[Int, Bool] = {}\nput(a, 1, true)\nvar b: Map[Int, Str] = {}\nput(b, 1, "one")\nvar c: Map[Str, Point] = {}\nput(c, "p", Point(x: 1.5, y: 2.5))\nvar d: Map[Int, [Int]] = {}\nput(d, 7, [4, 5, 6])\nprint(get(a, 1), get(b, 1), get(c, "p").y, get(d, 7)[2], get_or(b, 2, "none"))')}`, 'true one 2.5 6 none\n');
await prints('map grows', main('var m: Map[Int, Int] = {}\nfor i in 0..100000 { put(m, i * 7, i) }\nprint(len(m), get(m, 699993), has(m, 5), sum(i in 0..100000: get(m, i * 7)) % 1000)'), '100000 99999 false 0\n');
await prints('map through mut parameter', `
fn count(words: [Str], seen: mut Map[Str, Int]) { for i in 0..len(words) { put(seen, words[i], get_or(seen, words[i], 0) + 1) } }
${main('var seen: Map[Str, Int] = {}\ncount(["a", "b", "a", "c", "a", "b"], seen)\nlet ks = keys(seen)\nfor i in 0..len(ks) { print(ks[i], get(seen, ks[i])) }')}`, 'a 3\nb 2\nc 1\n');
await prints('map keys compare by content', main('var m: Map[Str, Int] = {}\nfor i in 0..50 { put(m, "k" + str(i % 5), i) }\nprint(len(m), get(m, "k" + str(3)), get(m, "k0"))'), '5 48 45\n');
await prints('map arguments evaluated before the map changes', `
fn bump(m: mut Map[Int, Int]) -> Int { put(m, 100, 1)\n return len(m) }
${main('var m: Map[Int, Int] = {}\nput(m, 1, bump(m))\nprint(len(m), get(m, 1), get(m, 100))')}`, '2 1 1\n');
await traps('missing key', main('var m: Map[Str, Int] = {}\nput(m, "a", 1)\nprint(get(m, "b"))'), 'missing_key');
rejects('put into immutable map', main('let m: Map[Str, Int] = {}\nput(m, "a", 1)'), 'E0204');
rejects('put through non-mut parameter', 'fn f(m: Map[Str, Int]) { put(m, "a", 1) }\nfn main() { }', 'E0204');
rejects('untyped empty map', main('let m = {}'), 'E0207');
rejects('bad map key type', 'fn f(m: Map[Float, Int]) { }\nfn main() { }', 'E0107');
rejects('wrong map key', main('var m: Map[Str, Int] = {}\nput(m, 1, 1)'), 'E0201');
rejects('wrong map value', main('var m: Map[Str, Int] = {}\nput(m, "a", "b")'), 'E0201');
rejects('put inside sum', `fn bump(m: mut Map[Int, Int]) -> Int { put(m, 1, 1)\n return 1 }\n${main('var m: Map[Int, Int] = {}\nprint(sum(i in 0..3: bump(m)))')}`, 'E0305');

// ---- memory reclamation ----
// These allocate far more than the address space allows unless memory is handed back.
await prints('loop memory is reclaimed', main('var t = 0\nfor i in 0..400000 { let a = array(1000, i)\n t = t + a[i % 1000] }\nprint(t)'), '79999800000\n');
await prints('large blocks are reclaimed', main('var t = 0\nfor i in 0..1500 { let a = array(1000000, 1)\n t = t + a[i] }\nprint(t)'), '1500\n');
await prints('function memory is reclaimed', `fn pick(i: Int) -> Int { let a = array(1000, i)\n return a[7] }\n${main('var t = 0\nfor i in 0..400000 { t = t + pick(i) }\nprint(t, sum(i in 0..400000: pick(i)))')}`, '79999800000 79999800000\n');
await prints('per-iteration strings are reclaimed', main('var t = 0\nfor i in 0..300000 { var cur = ""\n for j in 0..8 { cur = cur + str(j) }\n t = t + len(cur) }\nprint(t)'), '2400000\n');
await prints('maps created per iteration are reclaimed', main('var t = 0\nfor i in 0..20000 { var m: Map[Int, Int] = {}\n for j in 0..50 { put(m, j, i + j) }\n t = t + get(m, 49) - i }\nprint(t)'), '980000\n');
// These must NOT be reclaimed: the value is still reachable afterwards.
const JUNK = 'let junk = [i in 0..50000: str(i)]\n';
await prints('strings built in a loop survive', main(`var s = ""\nfor i in 0..3000 { s = s + str(i % 10) }\n${JUNK}print(len(s), substr(s, 2990, 3000), len(junk))`), '3000 0123456789 50000\n');
await prints('strings stored through a mut parameter survive', `fn fill(a: mut [Str]) -> Int { for i in 0..len(a) { a[i] = "n" + str(i) }\n return len(a) }\n${main(`var a = array(2000, "")\nlet n = fill(a)\n${JUNK}print(n, a[0], a[1999], junk[49999])`)}`, '2000 n0 n1999 49999\n');
await prints('map keys stored in a loop survive', main(`var m: Map[Str, Int] = {}\nfor i in 0..2000 { put(m, "key" + str(i), i) }\n${JUNK}let ks = keys(m)\nprint(len(m), ks[0], ks[1999], get(m, "key1500"), len(junk))`), '2000 key0 key1999 1500 50000\n');
await prints('structs holding strings stored in a loop survive', `struct Rec { name: Str, n: Int }\n${main(`var rs = array(1000, Rec(name: "", n: 0))\nfor i in 0..1000 { rs[i] = Rec(name: "r" + str(i), n: i) }\n${JUNK}print(rs[0].name, rs[999].name, rs[500].n, len(junk))`)}`, 'r0 r999 500 50000\n');
await prints('value assigned to an outer variable survives', main(`var best = ""\nfor i in 0..200 { var cur = ""\n for j in 0..20 { cur = cur + str((i + j) % 10) }\n if i == 137 { best = cur } }\n${JUNK}print(best, len(junk))`), '78901234567890123456 50000\n');
await prints('value returned from inside a reclaiming loop survives', `fn find(n: Int) -> Str { for i in 0..n { let s = "item" + str(i)\n if i == 77 { return s } }\n return "none" }\n${main(`let r = find(1000)\n${JUNK}print(r, len(junk))`)}`, 'item77 50000\n');
await prints('plain struct returned from an allocating function', `${POINT}fn centre(n: Int) -> Point { let xs = [i in 0..n: float(i)]\n return Point(x: xs[n - 1], y: float(len(xs))) }\n${main('var t = 0.0\nfor i in 1..20000 { let p = centre(i % 50 + 1)\n t = t + p.y - p.x }\nprint(t)')}`, '19999.0\n');

// ---- lanes: pure numeric code evaluated 8 values at a time on the native backend ----
// The WebAssembly backend runs the same programs one value at a time; both must agree.
const PIXEL = `fn pixel(px: Int, py: Int) -> Int {
  let cx = float(px) / 20.0 * 3.0 - 2.0
  let cy = float(py) / 20.0 * 2.0 - 1.0
  var x = 0.0
  var y = 0.0
  var i = 0
  while i < 50 and x * x + y * y <= 4.0 {
    let t = x * x - y * y + cx
    y = 2.0 * x * y + cy
    x = t
    i = i + 1
  }
  return i
}
`;
await prints('lanes agree with a plain loop', `${PIXEL}${main('let a = sum(py in 0..20: sum(px in 0..20: pixel(px, py)))\nvar b = 0\nfor py in 0..20 { for px in 0..20 { b = b + pixel(px, py) } }\nprint(a == b, a)')}`, 'true 6950\n');
await prints('lanes with if and else and a partial last group', `fn f(i: Int) -> Int { let x = float(i) * 0.5\n var r = 0\n if x > 3.0 { r = int(x * 2.0) } else { r = i - 1 }\n return r }\n${main('print(sum(i in 0..37: f(i)))')}`, '659\n');
await prints('lanes with a for loop of varying length', `fn g(i: Int) -> Int { var acc = 0.0\n for k in 0..i { acc = acc + float(k) * 0.25 }\n return int(acc) }\n${main('print(sum(i in 0..30: g(i)))')}`, '1004\n');
const GATED = (limit) => `fn h(i: Int) -> Int { let x = float(i) * 1.0\n var r = 0\n if i < ${limit} { r = i + 9223372036854775800 }\n return int(x) - r + r }\n`;
await prints('a lane that is not running cannot trap', `${GATED(5)}${main('print(sum(i in 0..16: h(i)))')}`, '120\n');
await traps('a lane that is running does trap', `${GATED(12)}${main('print(sum(i in 0..16: h(i)))')}`, 'overflow');
await traps('contract checked inside lanes', `fn sq(x: Float) -> Float requires x >= 0.0 { return x * x }\n${main('print(sum(i in 0..10: int(sq(float(i) - 3.0))))')}`, 'precondition');
const SHORT = `fn safe(i: Int) -> Int { let x = float(i) * 1.0\n var r = 0\n if i < 3 or int(x * 1.0e300 * float(i - 2)) > 0 { r = 1 }\n return r }\n`;
await prints('or skips its right side per lane', `${SHORT}${main('print(sum(i in 0..3: safe(i)))')}`, '3\n');
await traps('or evaluates its right side where needed', `${SHORT}${main('print(sum(i in 0..8: safe(i)))')}`, 'trap');

// ---- enums and match ----
const SHAPE = `enum Shape { Circle(r: Float), Rect(w: Float, h: Float), Empty }
fn area(s: Shape) -> Float {
  match s {
    Circle(r) => { return 3.0 * r * r }
    Rect(w, h) => { return w * h }
    Empty => { return 0.0 }
  }
}
`;
await prints('enum construction and match', `${SHAPE}${main('print(area(Circle(r: 2.0)), area(Rect(w: 2.0, h: 3.5)), area(Empty))')}`, '12.0 7.0 0.0\n');
await prints('match with else and no fields named', `${SHAPE}${main('var n = 0\nlet shapes = [Circle(r: 1.0), Empty, Rect(w: 1.0, h: 1.0), Empty]\nfor i in 0..len(shapes) { match shapes[i] { Empty => { n = n + 1 } else => { n = n + 10 } } }\nprint(n)')}`, '22\n');
await prints('enum in a struct field', `${SHAPE}struct Tile { id: Int, shape: Shape }\n${main('let t = Tile(id: 7, shape: Rect(w: 3.0, h: 2.0))\nprint(t.id, area(t.shape))')}`, '7 6.0\n');
await prints('recursive enum through arrays', `enum Expr { Num(v: Int), Add(args: [Expr]), Neg(inner: [Expr]) }
fn eval(e: Expr) -> Int {
  match e {
    Num(v) => { return v }
    Add(args) => { return sum(i in 0..len(args): eval(args[i])) }
    Neg(inner) => { return 0 - eval(inner[0]) }
  }
}
${main('print(eval(Add(args: [Num(v: 2), Neg(inner: [Num(v: 5)]), Add(args: [Num(v: 10), Num(v: 1)])])))')}`, '8\n');
await prints('match arms may fall through without returning', `${SHAPE}fn label(s: Shape) -> Str { var out = "other"\n match s { Circle => { out = "round" } Empty => { out = "nothing" } else => { } }\n return out }\n${main('print(label(Circle(r: 1.0)), label(Empty), label(Rect(w: 1.0, h: 1.0)))')}`, 'round nothing other\n');
rejects('match must cover every variant', `${SHAPE}fn f(s: Shape) -> Int { match s { Circle(r) => { return 1 } Empty => { return 2 } } }\nfn main() { }`, 'E0219');
rejects('unknown variant in match', `${SHAPE}fn f(s: Shape) -> Int { match s { Square => { return 1 } else => { return 2 } } }\nfn main() { }`, 'E0216');
rejects('wrong number of names in a pattern', `${SHAPE}fn f(s: Shape) -> Int { match s { Rect(w) => { return 1 } else => { return 2 } } }\nfn main() { }`, 'E0218');
rejects('match on a non-enum', main('match 5 { else => { } }'), 'E0215');
rejects('variant matched twice', `${SHAPE}fn f(s: Shape) -> Int { match s { Empty => { return 1 } Empty => { return 2 } else => { return 3 } } }\nfn main() { }`, 'E0217');
rejects('enum equality', `${SHAPE}${main('print(Empty == Empty)')}`, 'E0201');
rejects('field access on an enum', `${SHAPE}${main('let s = Circle(r: 1.0)\nprint(s.r)')}`, 'E0208');
rejects('duplicate variant name', 'enum A { X, Y }\nenum B { Y, Z }\nfn main() { }', 'E0102');
rejects('enum containing itself by value', 'enum L { Nil, Cons(head: Int, tail: L) }\nfn main() { }', 'E0105');
rejects('variant built with wrong fields', `${SHAPE}${main('let s = Rect(w: 1.0)')}`, 'E0209');
rejects('match binding is immutable', `${SHAPE}fn f(s: Shape) { match s { Circle(r) => { r = 2.0 } else => { } } }\nfn main() { }`, 'E0204');

// ---- generics ----
const PICK = 'fn pick[T](a: T, b: T, first: Bool) -> T { if first { return copy(a) }\n return copy(b) }\n';
await prints('generic function at several types', `${PICK}${main('print(pick(1, 2, true), pick("x", "y", false), pick(1.5, 2.5, false), pick([1, 2], [3], false)[0])')}`, '1 y 2.5 3\n');
const PAIR = 'struct Pair[A, B] { first: A, second: B }\nfn swap[A, B](p: Pair[A, B]) -> Pair[B, A] { return Pair(first: p.second, second: p.first) }\n';
await prints('generic struct', `${PAIR}${main('let p = Pair(first: 1, second: "one")\nlet q = swap(p)\nlet typed: Pair[Float, Bool] = Pair(first: 2.5, second: true)\nprint(q.first, q.second, typed.first, typed.second)')}`, 'one 1 2.5 true\n');
const OPT = 'enum Maybe[T] { Just(value: T), Nothing }\nfn or_else[T](m: Maybe[T], d: T) -> T { match m { Just(value) => { return copy(value) } Nothing => { return copy(d) } } }\n';
await prints('generic enum with inference from context', `${OPT}fn find(xs: [Int], x: Int) -> Maybe[Int] { for i in 0..len(xs) { if xs[i] == x { return Just(value: i) } }\n return Nothing }\n${main('let none: Maybe[Str] = Nothing\nlet all = [Just(value: 1), Nothing, Just(value: 5)]\nprint(or_else(find([4, 5, 6], 6), -1), or_else(find([4, 5, 6], 9), -1), or_else(none, "empty"), or_else(all[1], 0) + or_else(all[2], 0))')}`, '2 -1 empty 5\n');
await prints('generic function calling itself', `fn depth[T](x: T, n: Int) -> Int { if n == 0 { return 0 }\n return 1 + depth(x, n - 1) }\n${main('print(depth("a", 5), depth(1.5, 3))')}`, '5 3\n');
await prints('type parameter worked out from the expected type', `fn none_of[T]() -> [T] { return [] }\n${main('let xs: [Int] = none_of()\nlet ys: [Str] = none_of()\nprint(len(xs), len(ys))')}`, '0 0\n');
rejects('generic arguments disagree', `${PICK}${main('print(pick(1, "a", true))')}`, 'E0201');
rejects('type parameter cannot be worked out', `fn none_of[T]() -> [T] { return [] }\n${main('let xs = none_of()')}`, 'E0213');
rejects('bare generic variant without context', `${OPT}${main('let m = Nothing')}`, 'E0213');
rejects('wrong number of type arguments', `${PAIR}fn f(p: Pair[Int]) { }\nfn main() { }`, 'E0214');
rejects('generic body invalid for this type', `fn smaller[T](a: T, b: T) -> Bool { return a < b }\n${main('print(smaller("a", "b"))')}`, 'E0201');

// ---- arrays and maps are never shared ----
rejects('var from an existing array', main('let a = [1, 2]\nvar b = a\nb[0] = 9'), 'E0210');
rejects('let viewing a mutable array', main('var a = [1, 2]\nlet b = a\na[0] = 9\nprint(b[0])'), 'E0210');
rejects('returning the caller\'s array', 'fn same(a: [Int]) -> [Int] { return a }\nfn main() { }', 'E0210');
rejects('returning a view of a parameter', 'fn row(g: [[Int]]) -> [Int] { let r = g[0]\n return r }\nfn main() { }', 'E0210');
rejects('array filled with one shared element', main('var g = array(3, [0, 0])'), 'E0210');
rejects('storing an existing array', main('let row = [1, 2]\nvar g = [[0], [0]]\ng[0] = row'), 'E0210');
rejects('putting an existing array into a map', main('let row = [1, 2]\nvar m: Map[Int, [Int]] = {}\nput(m, 1, row)'), 'E0210');
rejects('same array as mutable and other argument', 'fn mix(a: mut [Int], b: [Int]) { a[0] = b[0] }\nfn main() { var x = [1, 2]\n mix(x, x) }', 'E0211');
rejects('writing through get on an immutable map', main('let m: Map[Int, [Int]] = {}\nget(m, 1)[0] = 5'), 'E0204');
await prints('copy makes an independent array', main('let a = [1, 2, 3]\nvar b = copy(a)\nb[0] = 99\nvar g = [[1], [2]]\nvar h = copy(g)\nh[0][0] = 7\nprint(a[0], b[0], g[0][0], h[0][0])'), '1 99 1 7\n');
await prints('copy of maps and structs', `struct Bag { items: [Int], name: Str }\n${main('var m: Map[Str, Int] = {}\nput(m, "a", 1)\nvar n = copy(m)\nput(n, "a", 5)\nput(n, "b", 2)\nlet x = Bag(items: [1, 2], name: "x")\nvar y = copy(x)\ny.items[0] = 5\nprint(get(m, "a"), len(m), get(n, "a"), len(n), x.items[0], y.items[0], y.name)')}`, '1 1 5 2 1 5 x\n');
await prints('read-only views and fresh results are allowed', `fn build(n: Int) -> [Int] { var out = array(n, 0)\n for i in 0..n { out[i] = i * 2 }\n return out }\n${main('let grid = [[1, 2], [3, 4]]\nlet row = grid[1]\nvar mine = build(3)\nmine[0] = 100\nvar rows = [i in 0..2: build(i + 1)]\nrows[1][0] = 50\nprint(row[0], mine[0], mine[2], rows[1][0], rows[1][1])')}`, '3 100 4 50 2\n');
await prints('map remove keeps order', main('var m: Map[Str, Int] = {}\nput(m, "a", 1)\nput(m, "b", 2)\nput(m, "c", 3)\nlet r1 = remove(m, "b")\nlet r2 = remove(m, "zz")\nput(m, "b", 9)\nlet ks = keys(m)\nprint(r1, r2, len(m), ks[0], ks[1], ks[2], get(m, "b"), has(m, "a"))'), 'true false 3 a c b 9 true\n');
await prints('map remove with int keys under growth', main('var m: Map[Int, Int] = {}\nfor i in 0..1000 { put(m, i, i * 2) }\nvar gone = 0\nfor i in 0..1000 { if i % 3 == 0 { if remove(m, i) { gone = gone + 1 } } }\nprint(len(m), gone, has(m, 3), get(m, 4), keys(m)[0])'), '666 334 false 8 1\n');

// ---- modules and the standard library ----
await prints('std strings', `import "std/strings"\n${main('print(join(split("a,b,,c", ","), "|"), index_of("hello", "ll"), contains("hello", "xyz"), starts_with("hello", "he"), ends_with("hello", "lo"), trim("  hi \\n"), replace("a-b-c", "-", "+"), repeat("ab", 3), len(lines("x\\ny\\nz")))')}`, 'a|b||c 2 false true true hi a+b+c ababab 3\n');
await prints('std parse_int returns an Option', `import "std/strings"\nimport "std/core"\n${main('print(unwrap_or(parse_int("42"), -1), unwrap_or(parse_int("-7"), -1), unwrap_or(parse_int("4x"), -1), unwrap_or(parse_int(""), -1), is_some(parse_int("0")))')}`, '42 -7 -1 -1 true\n');
await prints('std arrays', `import "std/arrays"\n${main('var xs = [5, 3, 9, 1, 4, 9, -2]\nsort(xs)\nlet fs = sorted([2.5, -1.0, 0.5])\nlet r = reverse(xs)\nlet c = append(concat([1, 2], [3]), 4)\nprint(xs[0], xs[1], xs[5], xs[6], fs[0], fs[2], r[0], index_in(xs, 4), index_in(xs, 77), max_of(xs), min_of(fs), len(c), c[3])')}`, '-2 1 9 9 -1.0 2.5 9 3 -1 9 -1.0 4 4\n');
await prints('std sort on a larger array', `import "std/arrays"\n${main('var xs = [i in 0..5000: (i * 7919) % 5003]\nsort(xs)\nvar ok = true\nfor i in 1..len(xs) { if xs[i - 1] > xs[i] { ok = false } }\nprint(ok, xs[0], xs[4999])')}`, 'true 0 5002\n');
await prints('std math', `import "std/math"\n${main('print(min(3, 8), max(2.5, 1.5), clamp(15, 0, 10), abs(-4), abs_float(-2.5), pow(2, 10))')}`, '3 2.5 10 4 2.5 1024\n');
await prints('std result type', `import "std/core"\nfn safe_div(a: Int, b: Int) -> Result[Int, Str] { if b == 0 { return Err(error: "division by zero") }\n return Ok(value: a / b) }\n${main('print(value_or(safe_div(10, 2), -1), value_or(safe_div(1, 0), -1), is_ok(safe_div(1, 0)))\nmatch safe_div(1, 0) { Err(error) => { print(error) } Ok => { } }')}`, '5 -1 false\ndivision by zero\n');
rejects('missing module', 'import "std/nothing_here"\nfn main() { }', 'E0701');
{
  const c = compile('import "std/math"\nfn main() uses io { let v = [1, 5, 2]\n print(clamp(v[0], v[1], v[2])) }', { backend: BACKEND, allow: ['io'] });
  const r = await run(c, { allow: ['io'] });
  report('failure inside a module names its file', !r.ok && r.error.kind === 'precondition' && /math\.vow$/.test(r.error.file ?? ''), JSON.stringify(r));
}

// ---- file and network capabilities ----
{
  const { mkdtempSync, rmSync, writeFileSync: wf } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join: pj } = await import('node:path');
  const dir = mkdtempSync(pj(tmpdir(), 'vow-fs-'));
  const other = mkdtempSync(pj(tmpdir(), 'vow-other-'));
  wf(pj(other, 'secret.txt'), 'secret');
  const P = (d, n) => pj(d, n).replace(/\\/g, '/');
  const prog = (body) => `fn main() uses io, fs {\n${body}\n}`;
  const granted = { allow: ['io', `fs:${dir}`] };
  await prints2('write then read a file', prog(`write_file("${P(dir, 'a.txt')}", "hello\\nworld")\nprint(file_exists("${P(dir, 'a.txt')}"), read_file("${P(dir, 'a.txt')}"), file_exists("${P(dir, 'nope.txt')}"))`), 'true hello\nworld false\n', granted);
  await traps('reading outside the granted folder is refused', prog(`print(read_file("${P(other, 'secret.txt')}"))`), 'capability_denied', granted);
  await traps('writing outside the granted folder is refused', prog(`write_file("${P(other, 'x.txt')}", "x")`), 'capability_denied', granted);
  await traps('escaping with .. is refused', prog(`print(read_file("${P(dir, '../' + other.split(/[\\/]/).pop() + '/secret.txt')}"))`), 'capability_denied', granted);
  await traps('missing file is an io error', prog(`print(read_file("${P(dir, 'missing.txt')}"))`), 'io_error', granted);
  await traps('fs needs a grant', prog(`print(file_exists("${P(dir, 'a.txt')}"))`), 'capability_denied', { allow: ['io'] });
  rejects('fs effect must be declared', main('print(read_file("a.txt"))'), 'E0301');
  if (BACKEND === 'wasm') {
    await traps('http_get to a host that was not granted is refused', 'fn main() uses io, net { print(http_get("https://example.org/")) }', 'capability_denied', { allow: ['io', 'net:example.com'] });
  } else {
    rejects('http_get is not on the native backend yet', 'fn main() uses io, net { print(http_get("https://example.com/")) }', 'E0601');
  }
  rmSync(dir, { recursive: true, force: true });
  rmSync(other, { recursive: true, force: true });
}

// ---- contracts proven or refuted at compile time ----
const HALF = 'fn half(n: Int) -> Int requires n > 0 ensures result >= 0 { return n / 2 }\n';
rejects('call that always breaks a requires clause', `${HALF}${main('print(half(0))')}`, 'E0501');
rejects('contract on an array length refuted', `fn first(xs: [Int]) -> Int requires len(xs) > 0 { return xs[0] }\n${main('let e: [Int] = []\nprint(first(e))')}`, 'E0501');
rejects('return that always breaks an ensures clause', 'fn f(n: Int) -> Int ensures result != 0 { if n == 0 { return 0 }\n return 1 }\nfn main() { }', 'E0502');
rejects('violation found through a constant variable', `${HALF}${main('let k = 3\nlet j = k - 5\nprint(half(j))')}`, 'E0501');
await prints('code that cannot run is not reported', `${HALF}${main('let n = 0\nfor i in 0..n { print(half(i - 5)) }\nif n > 0 { print(half(n - 1)) }\nprint("ok")')}`, 'ok\n');
{
  const proofOf = (src) => compile(src, { backend: BACKEND }).proof;
  const a = proofOf(`${HALF}fn main() uses io { for i in 1..10 { print(half(i)) }\n print(half(7)) }`);
  report('calls with known ranges are proven', a.proven === 3 && a.runtime === 0, JSON.stringify(a));
  const b = proofOf(`${HALF}fn g(b: Int) -> Int { if b <= 0 { return 0 }\n return half(b) }\nfn main() { }`);
  report('a guard before the call proves it', b.proven === 2 && b.runtime === 0, JSON.stringify(b));
  const c = proofOf(`${HALF}fn h(a: Int) -> Int { return half(a) }\nfn main() { }`);
  report('an unknown argument stays a run-time check', c.proven === 1 && c.runtime === 1, JSON.stringify(c));
  const d = proofOf('fn mean(xs: [Float]) -> Float requires len(xs) > 0 { return xs[0] }\nfn main() uses io { print(mean([1.0, 2.0]))\n let ys = array(3, 0.5)\n print(mean(ys))\n let zs = [i in 0..4: 1.0]\n print(mean(zs)) }');
  report('array lengths are tracked', d.proven === 3 && d.runtime === 0, JSON.stringify(d));
  const e = proofOf(`${HALF}fn main() uses io { var x = 5\n for i in 0..3 { x = x - i }\n print(half(x))\n assert x > 0\n print(half(x)) }`);
  report('a variable changed in a loop is unknown until asserted', e.proven === 2 && e.runtime === 1, JSON.stringify(e));
  const w = proofOf(`${HALF}fn main() uses io { var x = 1\n while x < 100 { x = x * 2 }\n print(half(x)) }`);
  report('the exit condition of a loop is used', w.proven === 2 && w.runtime === 0, JSON.stringify(w));
}

// ---- formatter ----
{
  const { format, shape } = await import('../src/format.mjs');
  const messy = '// header\n\n\nimport   "std/math"\nstruct  P {x:Int,y:Int}\nfn  f( a:Int,b : mut [Int] )->Int   uses io\n requires a>0   // why\n{\n      let v=( a+1 )*2 // trailing\n\n\n  if a>1 {return v}\n  b[ 0 ]=v\n  // own line\n  return -( a - 1 )\n}\n';
  const tidy = '// header\n\nimport "std/math"\n\nstruct P { x: Int, y: Int }\n\nfn f(a: Int, b: mut [Int]) -> Int uses io\n  requires a > 0  // why\n{\n  let v = (a + 1) * 2  // trailing\n\n  if a > 1 { return v }\n  b[0] = v\n  // own line\n  return -(a - 1)\n}\n';
  report('formatter produces the canonical layout', format(messy) === tidy, JSON.stringify(format(messy)));
  report('formatting is stable', format(tidy) === tidy, JSON.stringify(format(tidy)));
  report('formatting keeps the meaning', shape(messy) === shape(format(messy)), '');
  const long = 'fn main() uses io {\n  let o = Order(id: 1, customer: "a long customer name here", items: [Item(name: "cable", cents: 799, qty: 2), Item(name: "hub", cents: 2450, qty: 1)])\n}\n';
  const f2 = format(long);
  report('long constructors are broken across lines', f2.split('\n').every((l) => l.length <= 100) && shape(f2) === shape(long) && format(f2) === f2, JSON.stringify(f2));
  const m = 'enum E { A(x: Int), B }\n\nfn g(e: E) -> Int {\n  match e {\n    A(x) => { return x }\n    B => {\n      // nothing here\n      return 0\n    }\n  }\n}\n';
  report('match and comments inside arms survive', format(m) === m, JSON.stringify(format(m)));
}

// ---- capabilities ----
await traps('io denied without grant', main('print(1)'), 'capability_denied', { allow: [] });
await traps('time denied without grant', 'fn main() uses io, time { print(now_ms() >= 0.0) }', 'capability_denied', { allow: ['io'] });
await prints('time granted', 'fn main() uses io, time { print(now_ms() >= 0.0) }', 'true\n');

// ---- compile-time rejections ----
rejects('undeclared effect', 'fn helper() { print(1) }\nfn main() uses io { helper() }', 'E0301');
rejects('effect through call chain', 'fn a() uses io { print(1) }\nfn b() { a() }\nfn main() uses io { b() }', 'E0301');
rejects('unknown effect', 'fn main() uses network { }', 'E0304');
rejects('impure contract', 'fn noisy() -> Bool uses io { print(1)\n return true }\nfn f() requires noisy() { }\nfn main() { }', 'E0302');
rejects('test must be pure', 'fn main() { }\ntest "t" { print(1) }', 'E0301');
rejects('int plus float', main('print(1 + 2.0)'), 'E0201');
rejects('non-bool condition', main('if 1 { }'), 'E0201');
rejects('wrong argument type', `fn f(x: Int) -> Int { return x }\n${main('print(f(true))')}`, 'E0201');
rejects('wrong argument count', `fn f(x: Int) -> Int { return x }\n${main('print(f(1, 2))')}`, 'E0202');
rejects('wrong return type', 'fn f() -> Int { return 1.5 }\nfn main() { }', 'E0201');
rejects('missing return', 'fn f(x: Int) -> Int { if x > 0 { return 1 } }\nfn main() { }', 'E0205');
rejects('assign to let', main('let x = 1\nx = 2'), 'E0204');
rejects('assign to parameter', 'fn f(x: Int) { x = 2 }\nfn main() { }', 'E0204');
rejects('assign to loop variable', main('for i in 0..3 { i = 5 }'), 'E0204');
rejects('write to immutable array', main('let a = [1]\na[0] = 2'), 'E0204');
rejects('write to non-mut parameter', 'fn f(a: [Int]) { a[0] = 1 }\nfn main() { }', 'E0204');
rejects('let array passed as mut', 'fn f(a: mut [Int]) { a[0] = 1 }\nfn main() { let a = [1]\n f(a) }', 'E0303');
rejects('unknown name', main('print(y)'), 'E0101');
rejects('unknown function', main('nope(1)'), 'E0203');
rejects('shadowing', main('let x = 1\nif true { let x = 2 }'), 'E0103');
rejects('duplicate function', 'fn f() { }\nfn f() { }\nfn main() { }', 'E0102');
rejects('redefine builtin', 'fn len() { }\nfn main() { }', 'E0102');
rejects('unused value', main('1 + 2'), 'E0206');
rejects('empty array literal', main('let a = []'), 'E0207');
rejects('bad main signature', 'fn main(x: Int) { }', 'E0401');
rejects('result outside ensures', 'fn f() -> Int requires result > 0 { return 1 }\nfn main() { }', 'E0101');
rejects('mixed array literal', main('let a = [1, 2.0]'), 'E0201');
rejects('array equality', main('print([1] == [1])'), 'E0201');
rejects('semicolon', main('let x = 1;'), 'E0001');
rejects('chained comparison', main('print(1 < 2 < 3)'), 'E0001');
rejects('missing brace', 'fn main() {', 'E0001');
rejects('unknown type', 'fn f(x: Number) { }\nfn main() { }', 'E0005');
rejects('unterminated string', main('print("abc)'), 'E0003');
rejects('literal too large', main('print(9223372036854775808)'), 'E0002');

// Multiple errors are all reported in one pass.
{
  const c = compile(main('let a = 1 + 2.0\nprint(zz)\nlet b: Int = true'));
  report('reports several errors at once', !c.ok && c.diagnostics.length === 3, JSON.stringify(c.diagnostics));
  report('diagnostics carry positions and hints', c.diagnostics.every((d) => d.line > 0 && d.col > 0) && !!c.diagnostics[0].hint, JSON.stringify(c.diagnostics));
}

// ---- unchecked mode ----
{
  const r = await exec(main('let x = 9223372036854775807\nprint(x + 1)'), { checked: false });
  report('unchecked mode wraps on overflow', r.run?.ok && r.stdout === '-9223372036854775808\n', JSON.stringify(r.run));
  const b = await exec(main('let a = [1]\nprint(a[5])'), { checked: false });
  report('unchecked mode keeps bounds checks', b.run && !b.run.ok && b.run.error.kind === 'bounds', JSON.stringify(b.run));
}

// ---- test blocks ----
{
  const c = compile('fn sq(x: Int) -> Int { return x * x }\nfn main() { }\ntest "ok" { assert sq(3) == 9 }\ntest "bad" { assert sq(3) == 10 }', { backend: BACKEND });
  const results = await runTests(c);
  report('test blocks pass and fail independently', results[0].ok && !results[1].ok && results[1].error.kind === 'assert', JSON.stringify(results));
  report('failure reports source location', results[1].error.line === 4 && results[1].error.message.includes('sq(3) == 10'), JSON.stringify(results[1]));
}

console.log(`[${BACKEND}] ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
