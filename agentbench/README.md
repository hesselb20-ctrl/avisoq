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

## Running it yourself

```
node agentbench/run.mjs prepare      # writes agentbench/work/<language>/TASKS.md
# have a model write agentbench/work/<language>/solutions/<task id>.<ext>
node agentbench/run.mjs grade 1      # grades, and writes feedback for a repair round
node agentbench/run.mjs report
```

Add `--set hard --work work-hard/<name>` to any of these for the harder task set, or `--set expert --work work-expert/<name>` for the expert set.

Rust is compiled with `rustc -O`, an ordinary optimised build.
