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

A harder benchmark (longer programs, multi-step agent loops with the compiler in the loop,
other vendors' models) is the obvious next step.

## Running it yourself

```
node agentbench/run.mjs prepare      # writes agentbench/work/<language>/TASKS.md
# have a model write agentbench/work/<language>/solutions/<task id>.<ext>
node agentbench/run.mjs grade 1      # grades, and writes feedback for a repair round
node agentbench/run.mjs report
```

Rust is compiled with `rustc -O`, an ordinary optimised build.
