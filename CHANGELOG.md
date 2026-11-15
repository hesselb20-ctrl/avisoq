# Changelog

Avisoq is an experimental preview. Until 1.0, any release may change the language. Every
release below passed the full test suite on both backends on Windows; no other platform has
been tested.

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
