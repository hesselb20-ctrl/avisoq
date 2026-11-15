# Agent benchmark

Can a model write correct Avisoq, a language it has never seen, as reliably as it writes
Python and Rust?

## Method

- **24 tasks** (`tasks.mjs`): small functions over integers, strings and arrays, each with a
  plain-language statement, an exact signature and 5 to 10 hidden test inputs chosen to hit
  edge cases (empty input, negative numbers, values near the 64-bit limit).
- **Three languages**, graded the same way by `run.mjs`.
- **One attempt per task.** The model writes each solution without running, compiling or
  checking anything, and without seeing the tests.
- **What the model is given:** the task sheet. For Avisoq it also gets `docs/AGENT_GUIDE.md`,
  a one-page description of the language, which is all it knows about Avisoq. For Python and
  Rust it relies on what it already knows.
- **Outcomes:** correct; rejected before running (compiler or syntax error); stopped with an
  error; or silently wrong (ran to completion and printed a wrong answer).

## Results (14 November 2026)

Two Claude models, run as sub-agents of a Claude Code session: Sonnet (run A) and Haiku
(run B). Each run used a fresh agent per language.

| Run | Language | Correct | Rejected before running | Stopped with an error | Silently wrong |
|---|---|---:|---:|---:|---:|
| A | Avisoq | 24 | 0 | 0 | 0 |
| A | Python | 24 | 0 | 0 | 0 |
| A | Rust | 24 | 0 | 0 | 0 |
| B | Avisoq | 24 | 0 | 0 | 0 |
| B | Python | 24 | 0 | 0 | 0 |
| B | Rust | 24 | 0 | 0 | 0 |

The solutions are in `results/`. Of the 24 Avisoq solutions, 23 differ between the two runs.

| | Avisoq | Python | Rust |
|---|---:|---:|---:|
| Lines of code for all 24 solutions (run A) | about 380 | 200 | 330 |
| Time the agent took, run A / run B | 62 s / 98 s | 35 s / 49 s | 47 s / 47 s |

## What this does and does not show

- **It shows** that a model can learn Avisoq from one page and write it correctly on the first
  attempt, at the same rate as two languages it has seen millions of examples of.
- **It does not show** that Avisoq is better for agents than Python or Rust. Every language
  scored 24 of 24, so these tasks are too easy to separate them. No language produced a
  silently wrong answer, so the benchmark says nothing yet about whether Avisoq's checks catch
  bugs the others let through.
- **Costs measured:** Avisoq solutions were about twice as long as Python's and slightly longer
  than Rust's, and the agent took longer, since it had to read the guide first.
- **Limits:** one attempt per task, two models from one vendor, small tasks, and task
  statements written by the same author as the language. The agents were instructed not to
  run code or read other files; that was not technically enforced.

## Harder benchmark, with the compiler in the loop (14 November 2026)

The first benchmark was too easy to separate the languages, so this one raises the bar.

- **13 tasks** (`tasks-hard.mjs`), each a small program, not a one-liner: an expression
  evaluator, a stack-machine interpreter, a bank ledger, a determinant, Game of Life, shortest
  path, overflow-checked polynomial evaluation, date arithmetic, a CSV grouper, big-number
  addition, an LRU cache, word wrap and longest valid bracket run. 9 to 15 hidden tests each.
- **Tools allowed.** Each agent could compile, run and test its own work as often as it liked
  before handing in. It still never saw the hidden tests. Solutions were graded once.
- Same two models, a fresh agent per language, same grader.

| Run | Language | Correct | Rejected before running | Stopped with an error | Silently wrong |
|---|---|---:|---:|---:|---:|
| A | Avisoq | 13 | 0 | 0 | 0 |
| A | Python | 13 | 0 | 0 | 0 |
| A | Rust | 13 | 0 | 0 | 0 |
| B | Avisoq | 13 | 0 | 0 | 0 |
| B | Python | 13 | 0 | 0 | 0 |
| B | Rust | 13 | 0 | 0 | 0 |

| Cost, run A / run B | Avisoq | Python | Rust |
|---|---:|---:|---:|
| Non-blank lines for all 13 solutions | 851 / 688 | 315 / 379 | 373 / 698 |
| Time the agent took | 694 s / 356 s | 92 s / 174 s | 116 s / 150 s |
| Tokens the agent used (thousands) | 120 / 177 | 108 / 132 | 112 / 123 |

The solutions are in `results-hard/`.

**Result: parity again, at a higher cost.** Both models solved everything in every language,
so this benchmark still does not show that agents are better at Avisoq than at Python or Rust.
It does show the costs: the Avisoq runs took two to seven times as long and, in run A, more
than twice the code.

One grading note: the first grading pass failed two `checked_poly` solutions (Avisoq and
Rust, run B) because two test inputs near the 64-bit limit were written as JavaScript numbers
and lost precision. The test data was corrected and both passed; no solution was changed.

### What the agents said was hard in Avisoq

These come from the agents' own reports and are the most useful output of the run:

- No `break` or `continue`, so loops need flag variables.
- No checked or wrapping arithmetic. Because overflow traps, detecting it needs
  division-based checks before every multiply and add.
- The smallest `Int` has no literal; it must be written `-9223372036854775807 - 1`. The error
  for an oversized `Int` literal suggests a `Float`, which is misleading.
- `parse_int` gives `None` beyond 18 digits, so both agents wrote their own parser.
- A local variable may not share a name with any standard library function (`lines`).
- Arrays cannot be compared with `==`.
- The two agents reported opposite things about whether a bare `pop(xs)` is accepted as a
  statement. That has not been checked yet.

Version 0.6 answers these: `break` and `continue`, `checked_add` / `checked_sub` /
`checked_mul` in `std/math`, a literal for the smallest `Int`, `parse_int` over the whole range,
`equal` for arrays, and a name-clash error that names the module. A bare `pop(xs)` was checked
and is accepted.

### Rerun on version 0.6

The two Avisoq agents were run again on 0.6, with the same instructions and fresh agents.
Both again scored 13 of 13. Solutions are in `results-hard/model-a-v06` and `model-b-v06`.

| Avisoq, run A / run B | Version 0.5 | Version 0.6 | Python (for scale) | Rust (for scale) |
|---|---:|---:|---:|---:|
| Time the agent took | 694 s / 356 s | 109 s / 219 s | 92 s / 174 s | 116 s / 150 s |
| Tokens used (thousands) | 120 / 177 | 118 / 148 | 108 / 132 | 112 / 123 |
| Non-blank lines | 851 / 688 | 809 / 660 | 315 / 379 | 373 / 698 |

The Avisoq runs now take about as long as the Python and Rust runs, where before they took
two to seven times as long. How much of that is due to the fixes is not established:

- It is one run per model per version, and agent run times vary a lot between runs.
- Both agents used `checked_mul` and `checked_add` for the overflow task, and neither
  reported a language problem this time. But neither used `break` or `continue` in any
  solution, so that fix did not contribute.
- Code length barely changed. Avisoq solutions are still about twice as long as Python's.

### Limits

Same as above: two models from one vendor, tasks and tests written by the language's author,
rules against reading other files not technically enforced. Thirteen tasks that every agent
solves cannot rank languages. A benchmark that could would need tasks hard enough that some
runs fail: programs of several hundred lines, changes to existing code, or weaker models.

## Expert benchmark (14 November 2026, Avisoq 0.6)

The harder round still ended 13 of 13 everywhere, so this one was built to be hard enough
that some runs fail.

- **10 tasks** (`tasks-expert.mjs`): an interpreter for a small language, a strict JSON-like
  parser with canonical output, a regular-expression matcher with a time limit, a spreadsheet
  with cycle detection, a topological sort, exact fraction arithmetic, long division on
  50-digit numbers, a time-range merger, a SAT solver, and postfix to infix with minimal
  parentheses.
- **373 hidden tests**, part hand-written and part generated from the reference
  implementation with a fixed seed.
- Same protocol as the harder round: compiler available, hidden tests never shown, graded once.

| Run | Language | Correct | Rejected before running | Stopped with an error | Silently wrong |
|---|---|---:|---:|---:|---:|
| A | Avisoq | 9 | 0 | 1 | 0 |
| A | Python | 10 | 0 | 0 | 0 |
| A | Rust | 10 | 0 | 0 | 0 |
| B | Avisoq | 10 | 0 | 0 | 0 |
| B | Python | 10 | 0 | 0 | 0 |
| B | Rust | 10 | 0 | 0 | 0 |

| Cost, run A / run B | Avisoq | Python | Rust |
|---|---:|---:|---:|
| Time the agent took | 220 s / 584 s | 117 s / 165 s | 116 s / 212 s |
| Tokens used (thousands) | 135 / 226 | 112 / 135 | 111 / 143 |
| Non-blank lines for all 10 solutions | 1154 / 1040 | 562 / 669 | 1015 / 1186 |

The solutions are in `results-expert/`.

**Result: the only failure was in Avisoq.** In run A the interpreter task read number
literals with `v * 10 + digit_byte - 48`. For the literal 9223372036854775807 the sum
overflows before the `- 48` brings it back, and Avisoq stops the program. The same expression
cannot overflow in Python and wraps around to the right answer in an optimised Rust build.
The failure was loud, not a wrong answer, and no language produced a silently wrong result.
Still, on this benchmark Avisoq scored 19 of 20 against 20 of 20 for Python and for Rust,
and its runs took longer.

**The benchmark found two compiler bugs.** The run B agent reported that a growable array
lost elements when a call that grew it was nested inside the arguments of another call taking
the same array. It was real: the WebAssembly backend read the array's address before
evaluating the other arguments, and gave a different answer from the native backend with no
error. Checking the neighbouring cases turned up the same mistake in the native backend for
`xs[i] = f(xs)`. Both are fixed, with regression tests on both backends, and the agent's
repro is kept as `results-expert/compiler-bug-repro.avq`. The agent had worked around the bug,
so its score did not depend on it; all Avisoq solutions were regraded after the fix with the
same result.

**What the agents asked for this time:** an "unknown function" error that names the module to
import (done), and a warning in the guide about overflow in the middle of an expression
(done). Not done: mutable state other than `mut` parameters, constants, tuples or multiple
return values, and a way to propagate errors without checking a flag at every level. Those
explain most of the extra code and time, and they are design work, not fixes.

### Rerun on version 0.7

Version 0.7 added what the agents had asked for: constants (a top-level `let`), tuples with
`let (a, b) = ...`, the `?` operator for passing an `Err` or `None` up, assignment to the
fields of a `var` struct, and structs as `mut` parameters. The two Avisoq agents were run again
with fresh agents and the same instructions. Solutions are in `results-expert/model-a-v07` and
`model-b-v07`.

| Avisoq, run A / run B | Version 0.6 | Version 0.7 | Python (for scale) | Rust (for scale) |
|---|---:|---:|---:|---:|
| Correct out of 10 | 9 / 10 | 10 / 10 | 10 / 10 | 10 / 10 |
| Time the agent took | 220 s / 584 s | 213 s / 391 s | 117 s / 165 s | 116 s / 212 s |
| Tokens used (thousands) | 135 / 226 | 137 / 183 | 112 / 135 | 111 / 143 |
| Non-blank lines | 1154 / 1040 | 1194 / 1040 | 562 / 669 | 1015 / 1186 |

- **Correctness is level now:** 20 of 20, the same as Python and Rust. One run per model, so
  this does not show the earlier failure could not happen again.
- **The agents used the new state features and not the rest.** Both used `mut` struct
  parameters in 5 of 10 solutions, and both named them as the most useful addition. One used
  a tuple once. Neither used `?` or constants.
- **The code did not get shorter**, and Avisoq is still the slowest of the three for an agent:
  about 1.8 times Python's time in run A and 2.4 times in run B.
- Neither agent reported a compiler bug. Remaining friction they named: the no-shadowing rule
  across sibling branches, no bit operations, no `for` loop that counts down, no conditional
  expression.

### Rerun on version 0.8, and how fast the agent-written code runs

Version 0.8 added shorthand aimed at the bulk in the earlier solutions: character literals
(`'a'` is the Int 97), `for x in items`, `+=`, `s[i]` and `s[a..b]` on strings, a conditional
expression, and byte-class helpers in `std/strings`. A program's own function now also wins over
a standard library function of the same name. Solutions are in `results-expert/model-a-v08`
and `model-b-v08`.

| Avisoq, run A / run B | 0.6 | 0.7 | 0.8 | Python | Rust |
|---|---:|---:|---:|---:|---:|
| Correct out of 10 | 9 / 10 | 10 / 10 | 10 / 10 | 10 / 10 | 10 / 10 |
| Time the agent took | 220 s / 584 s | 213 s / 391 s | 164 s / 398 s | 117 s / 165 s | 116 s / 212 s |
| Non-blank lines | 1154 / 1040 | 1194 / 1040 | 1024 / 1199 | 562 / 669 | 1015 / 1186 |

Both agents used character literals, `+=` and string indexing in most solutions; run A used
`for x in items` in 6 of 10, run B in none. Run A got shorter and faster; run B did not. An
agent still takes about 1.4 times (run A) to 2.4 times (run B) as long with Avisoq as with
Python. Writing speed is not where Avisoq wins.

**Where it does win over Python: how fast the result runs.** `speed.mjs` runs each agent's
solutions on every hidden test input, 20 times over, inside one process (start-up and compile
time are not counted). Avisoq is the native backend with every check on; Rust is `rustc -O`.
Total for all 10 tasks, best of three:

| | Avisoq 0.8 | Python | Rust | Python / Avisoq | Rust / Avisoq |
|---|---:|---:|---:|---:|---:|
| Run A (Sonnet) | 29 ms | 240 ms | 25 ms | 8.3x | 0.86x |
| Run B (Haiku) | 47 ms | 223 ms | 26 ms | 4.8x | 0.55x |

- **Against Python:** the Avisoq programs ran 5 to 8 times faster in total, and faster on 8 or 9
  of the 10 tasks. The exception is `big_divmod`, where Python uses its built-in big integers
  and Avisoq does long division on digit arrays (10 to 30 times slower).
- **Against Rust:** slower in total, by 14% in run A and 45% in run B. Avisoq was ahead on 6
  tasks in run A and on 2 in run B.
- The agents chose their own algorithms per language, so a single task can swing either way for
  reasons that have nothing to do with the language. The totals are the fairer number, and
  each is dominated by one or two tasks.

```
node agentbench/speed.mjs results-expert/model-a --avisoq results-expert/model-a-v08
```

### Version 0.9: closing the run-time gap to Rust

The 0.8 timings had the agents' Avisoq programs 14% to 45% slower than their Rust programs.
Three causes were found and fixed in the compiler and runtime; the solutions were not changed.

- **Memory was rarely handed back.** A function or loop was only reclaimed if it stored nothing
  at all, so any code that built a local array or string kept its memory until the program
  ended. The analysis now tracks what is stored through, and reclaims whenever nothing that
  existed before can point at the new memory.
- **Every allocation paid for an emulated thread-local lookup.** With this toolchain
  thread-local storage is a function call. The main thread now uses a plain global arena, and
  the common allocation is an inlined pointer bump.
- **Appending to a string copied the whole string.** A `var` string now grows in place, on
  both backends, while every other holder of an earlier value still sees that earlier value.

Bit operations (`bit_and`, `bit_or`, `bit_xor`, `shift_left`, `shift_right`) were added too, but
the solutions timed here were written before that and do not use them.

Same solutions as above (Avisoq 0.8 runs, Python and Rust from the first expert round), same
inputs, total for all 10 tasks, best of three:

| | Avisoq 0.8 | Avisoq 0.9 | Python | Rust | Python / Avisoq 0.9 | Rust / Avisoq 0.9 |
|---|---:|---:|---:|---:|---:|---:|
| Run A (Sonnet) | 29 ms | 17 ms | 239 ms | 24 ms | 14.3x | 1.43x |
| Run B (Haiku) | 47 ms | 27 ms | 229 ms | 27 ms | 8.5x | 0.99x |

Per task, run A / run B, as Rust time divided by Avisoq time (above 1 means Avisoq is faster):
interp 1.74 / 0.94, json_canon 4.15 / 1.97, regex_match 1.01 / 0.83, sheet 2.43 / 2.21,
toposort 3.57 / 4.32, frac_calc 1.85 / 1.66, big_divmod 0.24 / 1.49, schedule 1.07 / 0.32,
sat 0.37 / 0.28, to_infix 5.52 / 4.54.

- Avisoq is ahead of Rust on 8 of 10 tasks in run A and 6 of 10 in run B, and clearly behind on
  `sat` in both (the Rust solutions use bit shifts where the Avisoq ones allocate an array per
  candidate).
- All 20 Avisoq solutions were regraded on 0.9 and still pass every hidden test, on both
  backends for run A.
- The caveats above still hold: each agent chose its own algorithm per language, the totals are
  dominated by one or two tasks, and this is ten small programs. It supports "about as fast as
  Rust on this kind of code", not "faster than Rust".

### Rerun on version 0.10: does the bigger library help?

Version 0.10 added `std/bigint` and string and array helpers (0.9 had added bit operations).
The two Avisoq agents were run again, fresh, with the same instructions. Solutions are in
`results-expert/model-a-v10` and `model-b-v10`.

| Avisoq, run A / run B | 0.8 | 0.10 | Python | Rust |
|---|---:|---:|---:|---:|
| Correct out of 10 | 10 / 10 | 10 / 10 | 10 / 10 | 10 / 10 |
| Time the agent took | 164 s / 398 s | 162 s / 323 s | 117 s / 165 s | 116 s / 212 s |
| Non-blank lines | 1024 / 1199 | 935 / 1127 | 562 / 669 | 1015 / 1186 |
| Run time, all 10 tasks | 17 ms / 27 ms (on 0.9) | 12 ms / 15 ms | 238 ms / 229 ms | 25 ms / 27 ms |

- **Both agents used the library where it fit.** Each solved the big-number division with
  `std/bigint` (16 and 28 lines, against 121 before in run A), each used bit operations for the
  SAT task, and 4 to 5 of the 10 solutions use the other new helpers.
- **The code got about 7% shorter and the agents no slower**; run B was 19% faster. An agent
  still takes 1.4 times (run A) to 2 times (run B) as long with Avisoq as with Python, and the
  Avisoq solutions are still much longer than the Python ones.
- **The programs run faster than before**: in total about twice as fast as the same agents' Rust
  programs (2.0x and 1.9x) and 15 to 19 times as fast as their Python programs. Avisoq is ahead
  of Rust on 6 of 10 tasks in run A and 7 of 10 in run B. It is still behind on `sat` in both
  and on `big_divmod` against Python.
- The usual caveats apply, and one more: more than half of each total is the `interp` task, and
  the agents wrote different interpreters each time. A different draw could move the totals a
  lot. "About as fast as Rust, sometimes faster" is what this supports.

### Version 0.11, with a second Rust run

0.11 removed three things that had each cost agents a compile-and-fix round: a variable may now
share its name with a function (`lines`, `keys`, `sum`), `==` works on arrays of plain values,
and `(a, b) = pair` assigns to existing variables. The guide now says its library table is
complete and describes the test loop that needs no second file.

Because a single run per language says little about time, both models also did the Rust tasks
again, fresh. All four runs scored 10 of 10. Solutions are in `results-expert/model-a-v11`
and `model-b-v11`.

| Time the agent took | Run A (Sonnet) | Run B (Haiku) |
|---|---:|---:|
| Rust, first run / second run | 116 s / 219 s | 212 s / 243 s |
| Avisoq, 0.10 / 0.11 | 162 s / 188 s | 323 s / 296 s |
| Mean, Rust / Avisoq | 168 s / 175 s | 228 s / 310 s |
| Python, single run | 117 s | 165 s |

- **Agent time is noisy.** The same model on the same Rust tasks took 116 s once and 219 s the
  next time. Differences of tens of percent between single runs mean nothing.
- **Against Rust, on means:** level for run A (4% slower) and 36% slower for run B. In this
  round the run A agent was faster in Avisoq than in Rust (188 s against 219 s).
- **Why it is not faster than Rust:** time follows the amount of text an agent produces. This
  round the agents wrote about as much in both languages (1171 lines against 1196 in run A,
  1424 against 1466 in run B, counting tests and scratch files), and the Avisoq agent also has
  to read the guide first. There is no large remaining difference for a language feature to
  remove; Python is quicker because its programs are half as long.
- In run A every Avisoq task compiled and passed the agent's own tests on the first attempt.

Run time of this round's solutions, all 10 tasks, same inputs (Python from the first round):

| | Avisoq 0.11 | Rust | Python | Rust / Avisoq | Python / Avisoq |
|---|---:|---:|---:|---:|---:|
| Run A (Sonnet) | 10 ms | 26 ms | 237 ms | 2.6x | 23x |
| Run B (Haiku) | 13 ms | 26 ms | 224 ms | 2.1x | 18x |

Avisoq is ahead of Rust on 9 of 10 tasks in both runs and behind on `sat` in both. More than
half of each total is still the `interp` task.

## Tasks the author did not write, three runs per cell (15 November 2026, Avisoq 0.13.1)

Everything above uses tasks and tests written by the author of the language, run once. This
section removes both objections as far as one person can.

**Where the tasks come from.** `exercism.mjs` imports them from the Exercism problem
specifications (https://github.com/exercism/problem-specifications, MIT licence, commit
`84a96854` of 11 November 2026), statement and test cases unchanged. Nobody picks tasks:

1. An exercise qualifies if all its cases call one function, every argument and result is a
   whole number, a boolean, a string, or an array of whole numbers or strings, and at least 8
   cases remain after dropping cases that expect an error, cases with characters outside
   ASCII, and cases Exercism itself has replaced. 44 exercises qualify.
2. They are ordered by the SHA-256 of their name and the first 20 are taken: line-up,
   scrabble-score, crypto-square, change, sum-of-multiples, largest-series-product, luhn,
   anagram, book-store, protein-translation, transpose, food-chain, wordy, pig-latin,
   prime-factors, meetup, isbn-verifier, connect, perfect-numbers, state-of-tic-tac-toe.
3. The first two cases of each are shown to the model as examples. The other 364 are hidden
   and used for grading.

**How a run goes.** One fresh agent per model, language and run gets the 20 statements and
signatures (and, for Avisoq, the one-page guide). It may compile and run its own tests as often
as it likes, never sees the hidden cases, and hands in once; there is no repair round. Three
runs per cell, 18 runs in all, 360 solutions per model.

### Claude Sonnet (3 runs per language)

| Language | Correct per run | Total | Rejected before running | Stopped with an error | Silently wrong | Time per run | Mean time | Mean tokens |
|---|---|---:|---:|---:|---:|---|---:|---:|
| Avisoq | 20, 20, 20 | 60 of 60 | 0 | 0 | 0 | 149 s, 172 s, 169 s | 163 s | 143k |
| Python | 20, 20, 20 | 60 of 60 | 0 | 0 | 0 | 129 s, 110 s, 117 s | 119 s | 127k |
| Rust | 20, 20, 20 | 60 of 60 | 0 | 0 | 0 | 149 s, 161 s, 116 s | 142 s | 131k |

### Claude Haiku (3 runs per language)

| Language | Correct per run | Total | Rejected before running | Stopped with an error | Silently wrong | Time per run | Mean time | Mean tokens |
|---|---|---:|---:|---:|---:|---|---:|---:|
| Avisoq | 20, 20, 19 | 59 of 60 | 0 | 0 | 1 | 400 s, 279 s, 318 s | 332 s | 186k |
| Python | 19, 20, 20 | 59 of 60 | 0 | 0 | 1 | 221 s, 216 s, 192 s | 210 s | 154k |
| Rust | 20, 19, 19 | 58 of 60 | 0 | 0 | 2 | 266 s, 227 s, 257 s | 250 s | 165k |

Failures: Avisoq run 3, pig-latin (a rule applied in the wrong order); Python run 1 and Rust
runs 2 and 3, food-chain (whether verses are separated by an empty line, which the statement
does not say).

### What this shows

- **Correctness: no difference.** 119 of 120 for Avisoq, 119 of 120 for Python, 118 of 120
  for Rust. With one or two failures per language, that is a tie, not a ranking.
- **A model learns Avisoq from one page well enough to match languages it has seen millions
  of lines of.** These are also problems whose Python and Rust solutions are all over the
  public internet, which favours those two.
- **Avisoq costs the agent more.** Sonnet took 15% longer than with Rust and 37% longer than
  with Python; Haiku 33% and 58% longer, and 10 to 20% more tokens. The claim "level with Rust
  on agent time" made further up, from single runs, does not survive three runs.
- **Avisoq's safety net was not exercised.** Its one failure was a silently wrong answer, the
  same kind as the others'. Tasks this small rarely overflow or index out of range.

### What it still does not show

- The selection rule and the harness are the author's, even though the tasks are not. The
  rule drops every case that expects an error, so how each language reports bad input is not
  tested.
- Both models are from one vendor. (A local open-weights model is reported below.)
- In round 1 the two example cases shown for `anagram` differed from rounds 2 and 3, because
  an import bug (cases that Exercism had replaced) was fixed in between. All rounds are graded
  on the same hidden cases.
- Times are wall-clock for one agent run and include its tool calls; they vary by up to 45%
  between runs of the same cell.
- Twenty textbook exercises are still small programs. Nothing here measures large codebases.

`node agentbench/results-exercism/summary.mjs` rebuilds these tables from the graded runs; the
solutions of every run are in `results-exercism/`.

## What each language does with a bug

`bugs.mjs` writes the same twelve mistakes in Avisoq, Rust and Python and runs them. Avisoq is
the native backend with all checks on, granted only what a program that prints needs. "Silent"
means the program finished normally with a wrong result, or did what it should not have.

| Bug | Avisoq | Rust `-O` | Rust debug | Python |
|---|---|---|---|---|
| A product grows past 64 bits (25 factorial) | stopped | **silent** | stopped | correct |
| The absolute value of the smallest 64-bit integer | stopped | **silent** | stopped | correct |
| A shift by 64 places | stopped | **silent** | stopped | correct |
| A float too large for an integer is converted to one | stopped | **silent** | **silent** | correct |
| Reading one element past the end of an array | stopped | stopped | stopped | stopped |
| An off-by-one that reads the element before the first | stopped | stopped | stopped | **silent** |
| Taking 10 characters from a 5-character string | stopped | stopped | stopped | **silent** |
| An integer average of an empty list | stopped | stopped | stopped | stopped |
| A float average of an empty list, in a function that needs a non-empty one | rejected | **silent** | **silent** | stopped |
| A new kind of value is added and one place that handles kinds is not updated | rejected | rejected | rejected | **silent** |
| A list is given a second name and changed through it | rejected | rejected | rejected | **silent** |
| Code that was only asked to compute a number also writes a file | stopped | **silent** | **silent** | **silent** |
| **Silent, out of 12** | **0** | **6** | **3** | **5** |

Read this for what it is:

- **The cases were chosen by the author of Avisoq** to show where the languages differ. It is a
  list of behaviours, each one reproduced by `node agentbench/bugs.mjs`, not a sample of real
  bugs, and "0 against 6" is not a measured defect rate.
- Two rows depend on something only Avisoq has. The empty-average row uses a `requires`
  contract, which a programmer has to write; in Rust and Python the same requirement is a
  comment. The file-write row is Avisoq's capability model; Rust and Python have none.
- Python is "correct" on the integer rows because its integers do not overflow.
- Rust has safety properties this table does not exercise at all, such as its ownership
  rules for memory shared between threads, and a far more mature compiler.

## Running it yourself

```
node agentbench/run.mjs prepare      # writes agentbench/work/<language>/TASKS.md
# have a model write agentbench/work/<language>/solutions/<task id>.<ext>
node agentbench/run.mjs grade 1      # grades, and writes feedback for a repair round
node agentbench/run.mjs report
```

Add `--set hard --work work-hard/<name>` to any of these for the harder task set, or `--set expert --work work-expert/<name>` for the expert set.

Rust is compiled with `rustc -O`, an ordinary optimised build.
