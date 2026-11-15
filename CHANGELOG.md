# Changelog

Avisoq is an experimental preview. Until 1.0, any release may change the language. Every
release below passed the full test suite on both backends on Windows; no other platform has
been tested.

## 0.16 (15 November 2026)

Avisoq is now aimed at one job: scripts that AI agents write to act through tools.

- `tool name(args) -> T` declares a tool the script may call, with `at most N`,
  `total <param> at most N` and `requires` clauses. New effect `tools`.
- `avisoq plan` prints what a script can do before it runs: the tools it can reach, how often
  (a proof when the code cannot do more, otherwise a cap), and the rules on their arguments.
- `avisoq approve` ties a person's agreement to the compiled script and its limits;
  `--policy file.json` lets scripts inside set bounds run without asking.
- `avisoq act` runs an approved script against MCP servers named in `--tools`, enforces the
  caps before each call leaves, and logs every call. `avisoq replay` reruns the last run
  against its log.
- `avisoq gateway` is an MCP server for the agent itself: it lists the tools as declarations,
  checks scripts, runs the ones the policy covers and asks for approval of the rest.
- `avisoq tools` prints the declarations for the tools of any MCP server.
- Tool calls may take time: scripts are suspended while a tool answers, and the waiting does
  not count against the time limit.

## 0.15 (15 November 2026)

- Limits per call when embedding: `timeLimitMs` and `memoryLimitMb` in JavaScript,
  `time_limit_ms` and `memory_limit_mb` in Python, `--time-limit` and `--memory` for
  `avisoq call` and `serve`. Both routes. A call that goes over stops with `time_limit` or
  `out_of_memory`, and the module keeps working. `avisoq build --shared --budget` builds a
  library whose callers can set a time limit.
- `extern "host" fn name(...)`: a function the embedding program provides, with the new effect
  `host`. `load(file, { host: { name: fn } })`. WebAssembly route, JavaScript.
- `avisoq mcp file.avq`: every function of a file as a tool for AI agents over the Model
  Context Protocol. Schemas come from the types, descriptions from the comments, and each
  description states the capabilities the function uses. `--host file.mjs` supplies host
  functions; calls are limited to 5 seconds and 256 MB unless told otherwise.
- The README now leads with what Avisoq is for: running code nobody has reviewed.

## 0.14 (15 November 2026)

- Embedding at native speed: `load(file, { native: true })` in JavaScript and
  `avisoq.load(file, native=True)` in Python compile the file to a shared library and call it
  in the same process. `avisoq build file.avq --shared` writes the library, `open()` /
  `open_library()` load one built earlier, and `avisoq call --native` uses it from the shell.
  1.7 to 23 times faster than the WebAssembly route on calls that do real work.
- A failure inside a native library is reported to the caller; it never ends the process.
- `match` as an expression: `let area = match s { Circle(r) => 3 * r * r, Empty => 0 }`.
- Loops with a step: `for i in 10..0 step -1`, `for i in 0..n step 2`.
- A `let` can name a function: `let sq = square`, `let add = fn(x: Int) => x + offset`. It
  can be called and passed on. (Functions still cannot be stored in arrays or returned.)
- `Grid(cells: cells, rows: len(cells))` compiles: a later field may read the length of a
  value an earlier field took over.
- `let g = f` for a function parameter `f` is now allowed; it used to be an error.
- `agentbench`: a task set imported mechanically from Exercism (tasks and tests the author did
  not write), three runs per model and language, and a harness for local models.
- Documentation: a tutorial, a language reference and this changelog; every example in them
  is run by the tests.

## 0.13.1 (15 November 2026)

- `link` in an `extern` declaration can name a library file next to the source
  (`link "libsqlite3-0.dll"`), not only a library on the linker's search path.
- A working SQLite binding as an example (`examples/interop/sqlite`), with tests that create,
  query, close and reopen a real database.

## 0.13 (14 November 2026)

- `run_command(program, arguments, input)` starts an installed program without a shell and
  returns its output or the reason it failed. New effect `run`, granted per program:
  `--allow run:python`.
- `extern "file.c" fn name(...)` declares a function written in C (native backend only). New
  effect `ffi`. Only `Int`, `Float`, `Bool` and `Str` cross the boundary.
- A program granted `run` or `ffi` runs without the reduced-rights launcher.

## 0.12 (14 November 2026)

- Avisoq functions can be called from JavaScript (`import { load } from 'avisoq'`), from Python
  (`bindings/python/avisoq.py`) and from anything else (`avisoq call`, `avisoq serve`).
- `std/json`: parse, inspect and write JSON.
- `std/bigint` rewritten: proper long division, `big_divmod`, far fewer copies.
- A value now moves, without `copy`, when it is handed on and its variable is reassigned
  (`a = b` then `b = c`), and when it is given away inside a `return`.

## 0.11 (14 November 2026)

- A variable may have the same name as a function (`let lines = ...`, `var sum = 0`).
- `==` and `!=` work on arrays of `Int`, `Float`, `Bool` and `Str`; `xs == []` tests for empty.
- `(a, b) = pair` assigns to existing variables.
- `agentbench/bugs.mjs`: the same twelve mistakes in Avisoq, Rust and Python.

## 0.10 (14 November 2026)

- Poison test builds (`npm run test:memory`): reclaimed memory is overwritten, so a value
  handed back while still in use fails instead of passing by luck.
- The fuzzer now generates structs, `mut` parameters, `for x in items`, tuples, `?`, string
  appends and bit operations.
- `std/bigint`, and more helpers in `std/strings` and `std/arrays`.

## 0.9 (14 November 2026)

- Memory is reclaimed whenever nothing that existed before can point at what a function or a
  loop iteration allocated, not only when that code stores nothing at all.
- The main thread's allocator is a plain global with an inlined fast path.
- Appending to a `var` string grows it in place, on both backends.
- `bit_and`, `bit_or`, `bit_xor`, `shift_left`, `shift_right`.
- Together these took agent-written programs from 14 to 45 percent slower than the same
  agents' Rust programs to level or faster.

## 0.8 (14 November 2026)

- Character literals (`'a'` is the Int 97), `for x in items` and `for i, x in items`,
  `+= -= *= /= %=`, `s[i]` and `s[a..b]` on strings, and `if c then a else b`.
- A program's own function wins over a standard library function of the same name, so new
  library functions no longer break existing programs.
- `agentbench/speed.mjs`: how fast agent-written solutions run in each language.

## 0.7 (14 November 2026)

- Constants (a top-level `let`), tuples, the `?` operator, assignment to fields of a `var`
  struct, and structs as `mut` parameters.
- Strings on the WebAssembly backend: reading a byte no longer copies the string, and `repeat`
  and `join` are no longer quadratic.

## 0.6.1 (14 November 2026)

- Fixed: on the WebAssembly backend, an array lost elements when a call that grew it was
  nested inside the arguments of another call taking the same array.
- Fixed: on the native backend, `xs[i] = f(xs)` could store into the array's old memory when
  `f` grew it.
- An unknown standard library function now names the module to import.

## 0.6 (14 November 2026)

- `break` and `continue`.
- `checked_add`, `checked_sub`, `checked_mul`; the literal `-9223372036854775808`.
- `parse_int` covers the whole `Int` range.

## 0.5 (14 November 2026)

First public release, renamed from Vow (a name that turned out to be taken).

- Closures passed to functions, growable arrays, moves on last use, a compile-time contract
  prover, a language server, a package manager, a sandbox launcher for native programs.

## 0.4 and earlier (14 November 2026, unpublished)

- The compiler, both backends, the standard library and the formatter, under the name Vow.
