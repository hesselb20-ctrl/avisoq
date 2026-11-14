<p align="center"><img src=".github/assets/logo.svg" width="88" alt="Avisoq logo"></p>

# Avisoq

A small, fast, safe programming language designed to be written and verified by AI agents.

<img src=".github/assets/figure/scene.webp" width="100%" alt="Three beats: a mandelbrot benchmark computed on one thread with every check on in 112 ms against 108 ms for C++; the same loop written as a sum, spread over 8 threads and 8 lanes; and the result, 4.6 ms against 15 ms for C++ parallelised by hand with OpenMP.">

Version 0.10. One front end, two backends (native machine code through GCC, and sandboxed
WebAssembly), a standard library written in Avisoq, a formatter, a compile-time contract prover,
a language server, a package manager and a differential fuzzer. The test suites pass on both
backends: 370 compiler cases each, plus 26 editor, 17 package and 10 sandbox tests.

```
import "std/strings"
import "std/arrays"

struct Count { word: Str, times: Int }

fn tally(ws: [Str]) -> [Count] {
  var seen: Map[Str, Int] = {}
  for i in 0..len(ws) {
    put(seen, ws[i], get_or(seen, ws[i], 0) + 1)
  }
  return map(keys(seen), fn(w) => Count(word: w, times: get(seen, w)))
}

fn main() uses io, fs {
  match read_file("examples/sample.txt") {
    Err(error) => { print("could not read the file:", error) }
    Ok(text) => {
      var counts = tally(split(text, " "))
      sort_by(counts, fn(c) => 0 - c.times)
      each(filter(counts, fn(c) => c.times > 1), fn(c) => print(c.word, c.times))
    }
  }
}
```

## Install and use

Requires Node 22 or newer.

```
npm install -g avisoq
```

Or run it from a clone of this repository with `node src/cli.mjs` in place of `avisoq`.
The native backend also needs GCC (found on PATH, through `AVISOQ_CC`, or in the WinGet
WinLibs install); without it, programs run on the WebAssembly backend.

```
avisoq check program.avq                         # types, effects, contracts
avisoq run   program.avq --allow io              # WebAssembly sandbox
avisoq run   program.avq --allow io --native     # machine code
avisoq test  program.avq
avisoq fmt   program.avq                         # canonical layout
avisoq build program.avq --native --portable -o program.exe
avisoq guide                                     # the language guide written for AI agents
avisoq lsp                                       # language server
avisoq init | add <name> <path or git url> | install     # packages
```

Add `--json` to any command for machine-readable output.

From a clone, the tests are `npm test` (WebAssembly backend, editor, packages),
`npm run test:native` and `npm run fuzz`.

### For AI agents

`docs/AGENT_GUIDE.md` (also printed by `avisoq guide`) is a one-page description of the whole
language, written to be given to a model. Point your agent at it, and have it check its work
with `avisoq check file.avq --json`, whose errors carry the exact fix in a `hint` field.

## Status: experimental preview

Avisoq is a few days old and was written with an AI coding agent. It has a thorough test
suite and has been used for one program of real size (`examples/loganalyzer.avq`, 260 lines),
but not yet by anyone other than its author. It is developed and tested on Windows only.
Expect rough edges, and please report them.

## How it works

One front end parses and checks a program: types, declared effects, contracts, and the rule
that arrays and maps are never shared. The checked program then goes to one of two backends.
The native backend writes C and hands it to GCC; the WebAssembly backend writes the binary
module itself and runs it in a sandbox. Both keep every run-time check.

### What the compiler does with purity

1. **Threads.** `sum(i in a..b: expr)`, `[i in a..b: expr]` and library functions built on them,
   such as `map`, run on every core. A data race cannot be written.
2. **Lanes.** Plain numeric `sum` and comprehension bodies are evaluated 8 values per
   instruction on the native backend, with every check gated per lane.
3. **Memory reclamation with no collector.** Where a function or loop body stores no
   pointer-carrying value and yields plain data, everything it allocated is provably dead when
   it finishes and the allocator is rewound, at no run-time cost.

### How it is tested

- **Both backends, same suite.** Every language test runs on native and on WebAssembly and
  must give identical output.
- **Differential fuzzing.** `tests/fuzz.mjs` generates random valid programs and checks that the
  two backends agree on all output and on the kind of any failure. It found two real bugs
  (the sign of negative zero, and partial output from a failing `print`), both fixed.
- **Adversarial memory tests.** Programs that would exhaust memory without reclamation, and
  programs that check live data survives it.
- **Poison builds.** `npm run test:memory` reruns the suite and the fuzzer with every piece of
  reclaimed memory overwritten first, so a value handed back while still in use fails loudly
  instead of passing by luck.

<img src=".github/assets/how/scene.webp" width="100%" alt="370 test programs go through one front end, are compiled by both the native and the WebAssembly backend, and all 370 print the same on both. The fuzzer found two mismatches, both fixed.">

## Capabilities

- **Contracts in the signature.** `requires`, `ensures` and loop `invariant` clauses state
  what code expects and guarantees. The compiler proves the ones it can, rejects code that can
  never satisfy them, and checks the rest while running.
- **Declared effects and scoped capabilities.** A function that prints, reads the clock,
  touches files or uses the network says so (`uses io, time, fs, net`), and so does every
  caller. The host grants them with `--allow io,fs:./data,net:example.com`.
- **Errors as values.** File and network calls return `Result`; `match` must cover every
  variant. There is no null and there are no exceptions.
- **No sharing, no surprises.** Arrays and maps are never shared between bindings. A value
  moves when it is used for the last time; otherwise storing it elsewhere needs `copy(...)`.
- **Structured diagnostics.** Every error has a stable code, file, position and usually a hint
  with the concrete fix.
- **One way to write things.** No implicit conversions, no shadowing, no semicolons, no operator
  overloading. `avisoq fmt` gives every file the same layout.
- **Tests in the language.** `test "name" { ... }` blocks are pure and each runs in isolation.

### Can a model actually write it?

Measured, with the method and all solutions in [`agentbench/`](agentbench/README.md): given
only the one-page guide, two Claude models each wrote 24 of 24 small tasks correctly in
Avisoq on the first attempt, with no chance to compile or test. They scored the same 24 of 24
in Python and Rust. So a model can learn the language from one page, but this benchmark is too
easy to show an advantage over existing languages, and Avisoq's solutions were about twice
as long as Python's.

A harder round followed: 13 small programs (an expression evaluator, a stack-machine
interpreter, shortest path and others), with each agent free to compile and test before
handing in. Both models again scored 13 of 13 in all three languages. Avisoq cost more: the
runs took two to seven times as long as Python's or Rust's (measured on version 0.5). So the honest claim today is that
agents can write Avisoq reliably, not that they write it better than other languages. The
friction the agents reported (no `break`, no checked arithmetic, and more) is listed in
[`agentbench/README.md`](agentbench/README.md) and was fixed in version 0.6. Rerun on 0.6, the
Avisoq agents again scored 13 of 13 and took about as long as the Python and Rust agents
(109 s and 219 s, against 92 to 174 s). That is one run per model, so treat it as a direction,
not a proof; the solutions are still about twice as long as Python's.

A third, expert round (10 larger programs, 373 hidden tests) produced the first failure, and
it was Avisoq's: 19 of 20 correct against 20 of 20 for Python and for Rust. The failure was a
loud overflow stop, not a wrong answer. That round also exposed two compiler bugs, both fixed
in 0.6.1. Version 0.7 added mutable struct state, tuples, constants and the `?` operator;
rerun on it, both Avisoq agents scored 10 of 10, level with Python and Rust. Version 0.8 added
shorthand (character literals, `for x in items`, `+=`, string indexing); the agents still take
1.4 to 2.4 times as long with Avisoq as with Python.

What the agents' Avisoq programs do better is run. On the same inputs, with every safety
check on, they were 8 to 14 times faster in total than the Python programs the same agents
wrote. Against the agents' Rust programs (`rustc -O`) they were 1.4 times faster in one run
and level in the other, as of version 0.9; before its allocator and string work they were 14%
to 45% slower. Solutions written fresh on 0.10, with the bigger library, ran about twice as
fast as the Rust ones in both runs, though one task dominates that total. So today the measured case for Avisoq is: as correct as Python and Rust on
these tasks, about as fast to run as Rust, much faster than Python, and slower for the agent
to write than either. Ten tasks and two runs is a small sample; see the table and its caveats
in [`agentbench/README.md`](agentbench/README.md).

<img src=".github/assets/agents/scene.webp" width="100%" alt="Two models each solved 24 of 24 tasks on the first attempt in Avisoq, Python and Rust. The Avisoq solutions were the longest: about 380 lines against 200 for Python and 330 for Rust.">

## Contracts proven at compile time

The prover combines the range each `Int` and array length can have with linear relations
between values (gathered from conditions, loop bounds, asserts, assignments and contracts), and
decides each contract by checking whether its negation contradicts what is known.

```
fn at(xs: [Int], i: Int) -> Int requires i >= 0 and i < len(xs) { return xs[i] }

fn total(xs: [Int]) -> Int {
  var t = 0
  for i in 0..len(xs) { t = t + at(xs, i) }   // proven: 0 <= i < len(xs)
  return t
}

fn count_up(n: Int) -> Int
  requires n >= 0
  ensures result == n                          // proven from the invariant
{
  var i = 0
  while i < n
    invariant i <= n
  {
    i = i + 1
  }
  return i
}
```

A call or return that can never satisfy its contract is a compile error. Run-time checks are
never removed, so a gap in the prover costs a missed proof, never safety. It reasons about
linear integer arithmetic only: not multiplication of two variables, floats, strings or map
contents.

## Safety

| Hazard | Behaviour |
|---|---|
| Integer overflow, division by zero | Trap with source location |
| Index out of bounds, missing map key, empty `pop` | Trap with source location |
| Contract or invariant that can never hold | Compile error |
| Null, uninitialised variables, unhandled enum variant | Cannot be expressed |
| Mutation of a `let`, a struct field or a non-`mut` parameter | Compile error |
| Two bindings sharing one array or map | Compile error (the value moves, or use `copy`) |
| Undeclared side effect; any effect or mutation in parallel code or a lambda | Compile error |
| File outside a granted folder, host that was not granted | Refused at run time |
| File or network failure | A `Result` value the program must handle |
| Data race, use after free | Cannot happen by construction |
| Runaway recursion | Contained: reported as `stack_overflow` |

Native programs also run inside a reduced-rights launcher on Windows: no child processes, no
privileges, no access to the desktop or clipboard, an optional memory limit (`--memory`), and,
when the program was granted neither files nor network, no right to write any file at all.

## Language reference

- **Types:** `Int`, `Float`, `Bool`, `Str`, arrays `[T]`, maps `Map[K, V]` (`Int` or `Str`
  keys), structs, enums, and function types `fn(A, B) -> R` for parameters.
- **Generics:** `struct Pair[A, B]`, `enum Option[T]`, `fn max[T: Ord](a: T, b: T) -> T`.
  Constraints: `Ord` (Int, Float, Str), `Eq` (Int, Float, Bool, Str), `Num` (Int, Float).
  Type arguments are worked out from the arguments or the expected type.
- **Structs:** `struct Point { x: Float, y: Float }`, `Point(x: 1.0, y: 2.0)`, `p.x`. A struct is
  a value. A field of a `var` struct can be assigned (`p.x = 2.0`), and a function can take a
  struct as a `mut` parameter and change the caller's variable.
- **Tuples:** `(a, b)` with type `(A, B)`, 2 to 4 parts, taken apart with `let (x, y) = pair`.
- **Constants:** a top-level `let LIMIT = 5000`, built from literals, operators and other constants.
- **Passing errors up:** `let x = f()?` returns the `Err` (or `None`) from the enclosing function
  and otherwise gives the value. Only at the end of a `let`, an assignment or a call statement.
- **Enums and match:** `enum Shape { Circle(r: Float), Empty }`, built with `Circle(r: 2.0)` or
  a bare `Empty`. `match value { Circle(r) => { ... } else => { ... } }` must cover every variant.
- **Functions as arguments:** a parameter of type `fn(T) -> U` accepts a function name or a
  lambda, `fn(x) => x * 2`. Lambdas capture the variables they read. Functions cannot be stored
  in variables or fields, or returned.
- **Bindings:** `let` (immutable), `var` (mutable). Empty `[]` and `{}` take their type from
  the context.
- **Arrays:** fixed layout, growable with `push(xs, v)` and `pop(xs)` on a `var` or `mut`
  parameter.
- **Statements:** `if / else if / else`, `while cond invariant e { }`, `for i in a..b`,
  `for x in items`, `for i, x in items`, `break`, `continue`, `x += 1` (and `-= *= /= %=`),
  `match`, `return`, `assert`.
- **Shorthand:** character literals (`'a'` is the Int 97), `s[i]` and `s[a..b]` on strings, and
  the conditional expression `if c then a else b`.
- **Expressions:** `+ - * / %`, comparisons (also on `Str`), `and or not`,
  `sum(i in a..b: expr)`, `[i in a..b: expr]`.
- **Modules:** `import "std/strings"`, `import "other_file"` (relative), `import "pkg:name/module"`.
  `private fn` / `private struct` / `private enum` are usable only in their own file.
- **Built-ins:** `print`, `len`, `array`, `copy`, `push`, `pop`, `float`, `int`, `sqrt`, `str`,
  `substr`, `byte_at`, `chr`, `now_ms`, `bit_and`, `bit_or`, `bit_xor`, `shift_left`, `shift_right`; maps: `put`, `get`, `get_or`, `has`, `remove`, `keys`;
  files: `read_file`, `write_file`, `file_exists`; network: `http_get`, `http_post`.

### Standard library

| Module | Contents |
|---|---|
| `std/core` (always available) | `Option[T]`, `Result[T, E]`, `is_some`, `unwrap_or`, `is_ok`, `value_or`, tuples, `equal` (`==` on arrays of plain values) |
| `std/strings` | `split`, `join`, `lines`, `trim`, `replace`, `repeat`, `contains`, `index_of`, `starts_with`, `ends_with`, `parse_int`, `to_upper`, `to_lower`, `count_of`, `last_index_of`, `reversed`, `matches_at`, `matches_glob`, `is_digit`, `is_letter`, `is_alnum`, `is_space`, `pad_left`, `pad_right` |
| `std/arrays` | `map`, `filter`, `fold`, `each`, `any`, `all`, `count_if`, `find_index`, `equal`, `sort`, `sort_by` (stable), `sorted`, `reverse`, `concat`, `append`, `index_in`, `max_of`, `min_of`, `sum_of`, `includes`, `last_of`, `slice`, `range`, `swap`, `unique` |
| `std/math` | `min`, `max`, `clamp`, `abs`, `abs_float`, `pow`, `checked_add`, `checked_sub`, `checked_mul`, `int_max`, `int_min` |
| `std/bigint` | `BigInt`: `big`, `big_parse`, `big_from_int`, `big_str`, `big_to_int`, `big_add`, `big_sub`, `big_mul`, `big_div`, `big_rem`, `big_pow`, `big_neg`, `big_abs`, `big_cmp`, `big_eq`, `big_is_zero` |

## Packages

A project lists its dependencies in `avisoq.json`:

```
avisoq init
avisoq add textkit ../textkit                          # a folder on disk
avisoq add geo https://example.com/geo.git --rev v1.2  # a git repository
avisoq install                                         # fetches git packages into avisoq_modules, writes avisoq.lock
```

and imports them as `import "pkg:textkit/shout"`. There is no central registry.

## Editor support

- **VS Code:** the extension in `editor/vscode` gives highlighting, errors while typing, hover,
  go to definition, completion, an outline and Format Document. Build and install it with
  `python editor/package.py` then `code --install-extension editor/avisoq-language-0.1.0.vsix`.
  Open the folder that contains `src/cli.mjs`.
- **Other editors:** `avisoq lsp` is a Language Server Protocol server over stdin/stdout with the
  same features.

## Benchmarks

See `bench/results.md` for the latest run. Same algorithm in every language, runs interleaved,
on an idle machine with 8 logical cores (Zen 4, AVX-512). Ratios are relative to C++.

| Language | fib(38) | sieve 20M | mandelbrot 800x800 | collatz 1M |
|---|---:|---:|---:|---:|
| C++ (g++ 16.2, -O3 -march=native) | 38 ms (1.00x) | 30 ms (1.00x) | 108 ms (1.00x) | 137 ms (1.00x) |
| Rust 1.100 (-O3, target-cpu=native) | 70 ms (1.87x) | 34 ms (1.13x) | 109 ms (1.01x) | 88 ms (0.65x) |
| Rust (same, overflow checks on) | 124 ms (3.29x) | 29 ms (0.97x) | 111 ms (1.02x) | 136 ms (0.99x) |
| **Avisoq native (all checks on)** | 1.5 ms (0.04x) | 31 ms (1.01x) | 112 ms (1.03x) | 119 ms (0.87x) |
| Avisoq native (`--unchecked`) | 35 ms (0.92x) | 30 ms (0.99x) | 107 ms (0.99x) | 100 ms (0.73x) |
| **Avisoq native, written with `sum`** (all checks on) | | | 4.6 ms (0.04x) | 14 ms (0.10x) |
| C++ hand-parallelised with OpenMP | | | 15 ms (0.13x) | 13 ms (0.09x) |
| Avisoq WebAssembly (all checks on) | 213 ms (5.64x) | 56 ms (1.84x) | 105 ms (0.97x) | 231 ms (1.69x) |
| JavaScript (Node 26, V8) | 290 ms (7.67x) | 56 ms (1.86x) | 110 ms (1.02x) | 1475 ms (10.78x) |
| Python 3.15 | 2762 ms (73x) | 1174 ms (39x) | 4485 ms (41x) | 5745 ms (42x) |

- **Same code, one thread:** level with C++ and Rust on sieve and mandelbrot, ahead of C++ on
  collatz. Rust without overflow checks is still the fastest on collatz.
- **fib is an outlier, not a trend:** in the checked build GCC merges repeated recursive calls.
- **Against hand-parallelised C++:** about 3 times faster on mandelbrot (threads plus 8 lanes
  against threads only), level on collatz.
- A C++ programmer who writes AVX-512 intrinsics by hand would match the mandelbrot number.
  Four micro-benchmarks do not describe real programs.

## Known limits

- **Barely used.** One 260-line program and the examples; nobody but the author has written
  Avisoq yet. Expect gaps the moment someone writes something larger.
- **Windows only, in practice.** The code is written to be portable, but Linux and macOS have
  never been run. Native HTTP and the sandbox launcher are Windows-only; elsewhere native
  `http_get` returns an error value and programs run without the launcher.
- **Functions are not first-class.** They can be passed to functions, with captured values,
  but not stored or returned. Each lambda creates its own copy of the function it is passed to.
- **Prover:** linear integer reasoning only, and no SMT solver. Invariants it cannot prove are
  still checked while running.
- **Generic constraints** cover the three built-in ones; you cannot declare your own.
- **No sharing costs copies** when a value is stored while still in use; only whole local
  values move, not parts of them.
- **Memory reclamation is by region, not per value:** what a function or a loop iteration
  allocates is handed back when nothing that existed before can point at it. A value rebuilt in
  an outer variable inside a long loop keeps its old versions until the enclosing function
  returns, and `main` itself never reclaims.
- **Lanes** cover `sum` and numeric comprehensions over `Int`, `Float` and `Bool` code without
  array reads.
- **Network:** GET and POST only, no headers, timeouts fixed, no streaming.
- **Packages:** no central registry and no version solving; a dependency is a path or a git
  revision.
- **Native sandbox:** the launcher restricts the process but is not a full container. A
  program granted files or network can still write wherever your user account can; the
  per-folder and per-host limits are enforced by the compiled program itself.
- **Strings on the WebAssembly backend** still call into the host for concatenation, comparison
  and substrings, so string-heavy code is several times slower there than on the native backend.
- **Field assignment copies the struct.** `p.x = v` builds a new struct value, and
  `push(p.items, v)` takes the array out and puts it back. Fine for parser state; costly in a
  hot loop on the WebAssembly backend, where structs live on the heap.
- **The VS Code extension has not been exercised by hand inside VS Code.** The analysis and
  the language server are tested; the wiring into VS Code is not.
