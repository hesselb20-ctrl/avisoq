# Vow

A small, fast, safe programming language designed to be written and verified by AI agents.
Version 0.4: one front end, two backends (native machine code through GCC, and sandboxed
WebAssembly), a standard library written in Vow, a formatter, a compile-time contract prover,
and a 255-case test suite that passes on both backends.

```
import "std/core"
import "std/strings"

struct Entry { name: Str, score: Int }

enum Line { Parsed(entry: Entry), Blank, Bad(reason: Str) }

fn parse_line(text: Str) -> Line {
  let clean = trim(text)
  if len(clean) == 0 { return Blank }
  let parts = split(clean, ",")
  if len(parts) != 2 { return Bad(reason: "expected name,score but got: " + clean) }
  match parse_int(trim(parts[1])) {
    Some(value) => { return Parsed(entry: Entry(name: trim(parts[0]), score: value)) }
    None => { return Bad(reason: "score is not a number: " + clean) }
  }
}

fn main() uses io, fs {
  let rows = lines(read_file("examples/scores.txt"))
  let parsed = [i in 0..len(rows): parse_line(rows[i])]
  for i in 0..len(parsed) {
    match parsed[i] {
      Parsed(entry) => { print(entry.name, "scored", entry.score) }
      Bad(reason) => { print("skipped:", reason) }
      Blank => { }
    }
  }
}
```

## Use

Requires Node 22 or newer. The native backend also needs GCC (found on PATH, through
`VOW_CC`, or in the WinGet WinLibs install).

```
node src/cli.mjs check examples/report.vow                             # types, effects, contracts
node src/cli.mjs run   examples/report.vow --allow io,fs:examples      # WebAssembly sandbox
node src/cli.mjs run   examples/report.vow --allow io,fs:examples --native
node src/cli.mjs test  examples/report.vow
node src/cli.mjs fmt   examples/report.vow                             # canonical layout
node src/cli.mjs build examples/report.vow --native --allow io,fs:examples -o report.exe
node tests/run.mjs wasm
node tests/run.mjs native
```

Add `--json` to any command for machine-readable output.

## What makes it agent-oriented

- **Contracts in the signature.** `requires` and `ensures` state what a function expects and
  guarantees. The compiler proves the ones it can, rejects calls that can never satisfy them,
  and checks the rest while running; a violation names the clause and its location.
- **Declared effects and scoped capabilities.** A function that prints, reads the clock,
  touches files or uses the network says so (`uses io, time, fs, net`), and so does every
  caller. The host grants them with `--allow io,fs:./data,net:example.com`: file access only
  inside the named folder, network access only to the named host.
- **No sharing, no surprises.** Arrays and maps are never shared between bindings. Storing one
  somewhere new needs a fresh value or an explicit `copy(...)`, so a `let` can never change
  under you and a function can never alter data it was not given as `mut`.
- **Errors as values.** Enums with `match` (which must cover every variant) and the standard
  `Option[T]` and `Result[T, E]` types replace null and exceptions.
- **Structured diagnostics.** Every error has a stable code, file, position and usually a hint
  with the concrete fix. All type errors are reported in one pass.
- **One way to write things.** No implicit conversions, no shadowing, no semicolons, no operator
  overloading. `vow fmt` gives every file the same layout, and verifies that the formatted
  text is the same program before it writes anything.
- **Tests in the language.** `test "name" { ... }` blocks are pure and each runs in isolation.

## What the compiler does with purity

1. **Threads.** `sum(i in a..b: expr)` and `[i in a..b: expr]` run on every core. A data race
   cannot be written, and integer totals are identical for every thread schedule.
2. **Lanes.** Plain numeric `sum` bodies are evaluated 8 iterations per instruction on the
   native backend, with every check gated per lane.
3. **Memory reclamation with no collector.** Where a function or loop body stores no
   pointer-carrying value and yields plain data, everything it allocated is provably dead when
   it finishes and the allocator is rewound, at no run-time cost.

## Contracts proven at compile time

The compiler tracks the range each `Int` and each array length can have, through `let`,
branches, loops, `assert` and the `ensures` clauses of called functions.

```
fn half(n: Int) -> Int requires n > 0 { return n / 2 }

fn ok(b: Int) -> Int {
  if b <= 0 { return 0 }
  return half(b)        // proven: b is at least 1 here
}

fn bad() -> Int {
  return half(0)        // error[E0501]: this call always breaks the contract of 'half'
}
```

`vow check` reports how many checks were proven. This is interval reasoning, not a full
theorem prover: it handles bounds and lengths, not arbitrary arithmetic facts. Run-time checks
are never removed, so a gap in the prover costs a missed proof, never safety.

## Safety

| Hazard | Behaviour |
|---|---|
| Integer overflow, division by zero | Trap with source location |
| Index out of bounds, missing map key | Trap with source location |
| Contract that can never hold at a call or return | Compile error |
| Null, uninitialised variables, unhandled enum variant | Cannot be expressed |
| Mutation of a `let`, a struct field or a non-`mut` parameter | Compile error |
| Two bindings sharing one array or map | Compile error (use `copy`) |
| Undeclared side effect, or any effect inside a `sum` or comprehension | Compile error |
| File outside a granted folder, host that was not granted | Refused at run time |
| Data race, use after free | Cannot happen by construction |
| Runaway recursion | Contained: reported as `stack_overflow` |

## Language reference

- **Types:** `Int`, `Float`, `Bool`, `Str`, arrays `[T]`, maps `Map[K, V]` (`Int` or `Str`
  keys), structs and enums. Structs, enums and functions can take type parameters:
  `struct Pair[A, B]`, `enum Option[T]`, `fn max[T](a: T, b: T) -> T`. Type arguments are worked
  out from the arguments or from the expected type.
- **Structs:** `struct Point { x: Float, y: Float }`, built with `Point(x: 1.0, y: 2.0)`, read
  with `p.x`, immutable.
- **Enums:** `enum Shape { Circle(r: Float), Rect(w: Float, h: Float), Empty }`, built with
  `Circle(r: 2.0)` or a bare `Empty`, read with `match`.
- **Match:** `match value { Circle(r) => { ... } Rect(w, h) => { ... } else => { ... } }`. Every
  variant must be covered, or an `else` arm given. Field names can be left out to ignore them.
- **Bindings:** `let` (immutable), `var` (mutable). Empty `[]` and `{}` take their type from
  the context.
- **Functions:** `fn name(a: T, b: mut [T]) -> T uses io requires ... ensures ... { ... }`.
- **Statements:** `if / else if / else`, `while`, `for i in start..end`, `match`, `return`, `assert`.
- **Expressions:** `+ - * / %`, comparisons, `and or not`, `sum(i in a..b: expr)`,
  `[i in a..b: expr]`.
- **Modules:** `import "std/strings"` or `import "other_file"` (relative to the importing file).
  All names live in one namespace and must be unique.
- **Built-ins:** `print`, `len`, `array(n, init)`, `copy`, `float`, `int`, `sqrt`, `str`,
  `substr`, `byte_at`, `now_ms`; maps: `put`, `get`, `get_or`, `has`, `remove`, `keys`;
  files: `read_file`, `write_file`, `file_exists`; network: `http_get`.

### Standard library

| Module | Contents |
|---|---|
| `std/core` | `Option[T]`, `Result[T, E]`, `is_some`, `unwrap_or`, `is_ok`, `value_or` |
| `std/strings` | `split`, `join`, `lines`, `trim`, `replace`, `repeat`, `contains`, `index_of`, `starts_with`, `ends_with`, `parse_int` |
| `std/arrays` | `sort`, `sorted`, `reverse`, `concat`, `append`, `index_in`, `max_of`, `min_of` |
| `std/math` | `min`, `max`, `clamp`, `abs`, `abs_float`, `pow` |

## Editor support

`editor/vscode` is a VS Code extension: syntax highlighting, compiler errors with hints on
open and save, and Format Document. To install it, copy that folder to
`%USERPROFILE%\.vscode\extensions\vow-language` and restart VS Code. It runs the compiler from
the open workspace, so open the folder that contains `src/cli.mjs`.

## Benchmarks

Same algorithm in every language, each program timing its own workload, runs interleaved,
best of 12 (Python best of 2), on an idle machine with 8 logical cores (Zen 4, AVX-512).
C++ and Rust use their strongest ordinary flags; inputs are hidden from every optimiser.
Ratios are relative to C++, lower is faster.

| Language | fib(38) | sieve 20M | mandelbrot 800x800 | collatz 1M |
|---|---:|---:|---:|---:|
| C++ (g++ 16.2, -O3 -march=native) | 36 ms (1.00x) | 30 ms (1.00x) | 110 ms (1.00x) | 138 ms (1.00x) |
| Rust 1.100 (-O3, target-cpu=native) | 69 ms (1.94x) | 34 ms (1.13x) | 110 ms (1.00x) | 86 ms (0.62x) |
| Rust (same, overflow checks on) | 123 ms (3.45x) | 30 ms (1.00x) | 111 ms (1.01x) | 137 ms (1.00x) |
| **Vow native (all checks on)** | 1.5 ms (0.04x) | 30 ms (1.01x) | 113 ms (1.02x) | 117 ms (0.85x) |
| Vow native (`--unchecked`) | 34 ms (0.96x) | 30 ms (1.00x) | 110 ms (1.00x) | 103 ms (0.75x) |
| **Vow native, written with `sum`** (all checks on) | | | 4.7 ms (0.04x) | 14 ms (0.10x) |
| C++ hand-parallelised with OpenMP | | | 15 ms (0.13x) | 13 ms (0.09x) |
| Vow WebAssembly (all checks on) | 225 ms (6.31x) | 57 ms (1.87x) | 107 ms (0.97x) | 232 ms (1.68x) |
| JavaScript (Node 26, V8) | 289 ms (8.10x) | 56 ms (1.83x) | 112 ms (1.02x) | 1466 ms (10.65x) |
| Python 3.15 | 2738 ms (77x) | 1174 ms (39x) | 4485 ms (41x) | 5830 ms (42x) |

- **Same code, one thread:** level with C++ and Rust on sieve and mandelbrot, ahead of C++ on
  collatz. Rust without overflow checks is still the fastest on collatz.
- **fib is an outlier, not a trend:** in the checked build GCC merges repeated recursive calls.
- **Against hand-parallelised C++:** about 3 times faster on mandelbrot (threads plus 8 lanes
  against threads only), level on collatz.
- A C++ programmer who writes AVX-512 intrinsics by hand would match the mandelbrot number.
  Four micro-benchmarks do not describe real programs.

Reproduce: `node bench/build.mjs` then `node bench/run.mjs`.

## Known limits

- **Prover:** interval reasoning over `Int` values and array lengths only. It does not reason
  about `Float`, strings, map contents or relations between two variables.
- **Network:** `http_get` works on the WebAssembly backend only. There is no POST, no headers
  and no streaming. File and network failures trap; they are not yet returned as `Result`.
- **Generics:** type parameters have no constraints, so a generic body is checked each time it
  is instantiated and an unsuitable type is reported inside the generic function. Unused
  generic functions are not checked at all.
- **No sharing costs copies:** storing an existing array into another structure needs `copy`.
  There is no move, so building nested data from named parts copies it.
- **Arrays have a fixed length.** `append` and `concat` build new arrays.
- **Modules** share one global namespace; there are no private names or packages.
- **No closures or first-class functions.**
- **Memory reclamation is conservative:** values rebuilt in an outer variable inside a long
  loop are kept until the enclosing function returns, and `main` never reclaims.
- **Lanes** cover `sum` only, and only `Int`, `Float` and `Bool` code without arrays.
- **The native backend is not sandboxed by the operating system.** Its file restrictions are
  enforced by the compiled program itself, with grants fixed at build time. The WebAssembly
  backend is sandboxed as well.
- **The VS Code extension has not been run inside VS Code yet.** Its files are validated and
  the commands it calls are tested, but the integration itself is untested.
- Native binaries are built with `-march=native` and may not run on other CPUs.
