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

### Limits

Same as above: two models from one vendor, tasks and tests written by the language's author,
rules against reading other files not technically enforced. Thirteen tasks that every agent
solves cannot rank languages. A benchmark that could would need tasks hard enough that some
runs fail: programs of several hundred lines, changes to existing code, or weaker models.

## Running it yourself

```
node agentbench/run.mjs prepare      # writes agentbench/work/<language>/TASKS.md
# have a model write agentbench/work/<language>/solutions/<task id>.<ext>
node agentbench/run.mjs grade 1      # grades, and writes feedback for a repair round
node agentbench/run.mjs report
```

Add `--set hard --work work-hard/<name>` to any of these for the harder task set.

Rust is compiled with `rustc -O`, an ordinary optimised build.
