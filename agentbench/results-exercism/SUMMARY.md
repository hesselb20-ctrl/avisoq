### haiku (3 runs per language)

| Language | Correct per run | Total | Rejected before running | Stopped with an error | Silently wrong | Time per run | Mean time | Mean tokens |
|---|---|---:|---:|---:|---:|---|---:|---:|
| Avisoq | 20, 20, 19 | 59 of 60 | 0 | 0 | 1 | 400 s, 279 s, 318 s | 332 s | 186k |
| Python | 19, 20, 20 | 59 of 60 | 0 | 0 | 1 | 221 s, 216 s, 192 s | 210 s | 154k |
| Rust | 20, 19, 19 | 58 of 60 | 0 | 0 | 2 | 266 s, 227 s, 257 s | 250 s | 165k |

Failures: Avisoq run 3: pig_latin (wrong); Python run 1: food_chain (wrong); Rust run 2: food_chain (wrong); Rust run 3: food_chain (wrong).

### sonnet (3 runs per language)

| Language | Correct per run | Total | Rejected before running | Stopped with an error | Silently wrong | Time per run | Mean time | Mean tokens |
|---|---|---:|---:|---:|---:|---|---:|---:|
| Avisoq | 20, 20, 20 | 60 of 60 | 0 | 0 | 0 | 149 s, 172 s, 169 s | 163 s | 143k |
| Python | 20, 20, 20 | 60 of 60 | 0 | 0 | 0 | 129 s, 110 s, 117 s | 119 s | 127k |
| Rust | 20, 20, 20 | 60 of 60 | 0 | 0 | 0 | 149 s, 161 s, 116 s | 142 s | 131k |

No failures.

