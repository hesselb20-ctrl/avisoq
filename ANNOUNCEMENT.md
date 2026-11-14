# Announcement draft

Not posted anywhere. Edit freely before using it.

## Title

Show: Avisoq, an experimental language built for code written by AI agents

## Post

I have been building Avisoq, a small programming language designed around one question: if
an AI agent writes the code, what should the language guarantee?

What it does differently:

- **Contracts in the signature.** `requires`, `ensures` and loop invariants. The compiler
  proves the ones it can, rejects calls that can never satisfy them, and checks the rest
  while running.
- **Capabilities.** A program can only print, read files or use the network if it declares
  it and the person running it grants it, per folder and per host:
  `avisoq run tool.avq --allow io,fs:./data`.
- **Purity is tracked,** so pure loops run on every core and, for numeric code, 8 values per
  instruction, with no annotations and no possible data race.
- **No garbage collector and no lifetime annotations.** Memory is handed back where the
  compiler can prove it is dead.
- **Two backends that must agree:** native code through GCC, and sandboxed WebAssembly. A
  fuzzer checks them against each other.
- **A one-page guide written for models** (`avisoq guide`), and compiler errors as JSON with
  the exact fix in a `hint` field.

What I measured:

- Given only that one-page guide, two Claude models each wrote 24 of 24 small tasks correctly
  in Avisoq on the first attempt, without compiling. They also scored 24 of 24 in Python and
  Rust, so this shows the language is learnable, not that it is better.
- On four micro-benchmarks, with every safety check on, single-thread speed is level with C++
  and Rust. A parallel mandelbrot is about 3 times faster than hand-parallelised C++ here,
  because the compiler also vectorises it; hand-written SIMD would match that.

What it is not:

- It is a few days old, written with an AI coding agent, tested on Windows only, and used for
  exactly one program of real size.
- Functions cannot be stored or returned, there is no `if` expression, and the contract prover
  handles linear integer facts only.
- There is an unrelated, older project called Vow with a similar goal and real static
  verification; if that is what you need, look there first.

It is MIT licensed. I would like to hear where it breaks.

    npm install -g avisoq

Repository: https://github.com/hesselb20-ctrl/avisoq
