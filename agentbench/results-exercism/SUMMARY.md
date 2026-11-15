### haiku (3 runs per language)

| Language | Correct per run | Total | Rejected before running | Stopped with an error | Silently wrong | Time per run | Mean time | Mean tokens |
|---|---|---:|---:|---:|---:|---|---:|---:|
| Avisoq | 20, 20, 19 | 59 of 60 | 0 | 0 | 1 | 400 s, 279 s, 318 s | 332 s | 186k |
| Python | 19, 20, 20 | 59 of 60 | 0 | 0 | 1 | 221 s, 216 s, 192 s | 210 s | 154k |
| Rust | 20, 19, 19 | 58 of 60 | 0 | 0 | 2 | 266 s, 227 s, 257 s | 250 s | 165k |

Failures: Avisoq run 3: pig_latin (wrong); Python run 1: food_chain (wrong); Rust run 2: food_chain (wrong); Rust run 3: food_chain (wrong).

### qwen (1 run per language)

| Language | Correct per run | Total | Rejected before running | Stopped with an error | Silently wrong | Time per run | Mean time | Mean tokens |
|---|---|---:|---:|---:|---:|---|---:|---:|
| Avisoq | 11 | 11 of 20 | 0 | 0 | 9 | 1899 s | 1899 s | 41k |
| Python | 14 | 14 of 20 | 1 | 1 | 4 | 1695 s | 1695 s | 27k |
| Rust | 13 | 13 of 20 | 0 | 1 | 6 | 1699 s | 1699 s | 30k |

Failures: Avisoq run 1: crypto_square (wrong); Avisoq run 1: largest_series_product (wrong); Avisoq run 1: luhn (wrong); Avisoq run 1: book_store (wrong); Avisoq run 1: transpose (wrong); Avisoq run 1: meetup (wrong); Avisoq run 1: isbn_verifier (wrong); Avisoq run 1: connect (wrong); Avisoq run 1: perfect_numbers (wrong); Python run 1: change (stopped); Python run 1: book_store (wrong); Python run 1: transpose (wrong); Python run 1: pig_latin (wrong); Python run 1: isbn_verifier (rejected); Python run 1: connect (wrong); Rust run 1: crypto_square (wrong); Rust run 1: change (wrong); Rust run 1: book_store (wrong); Rust run 1: transpose (wrong); Rust run 1: pig_latin (wrong); Rust run 1: connect (wrong); Rust run 1: state_of_tic_tac_toe (stopped).

### sonnet (3 runs per language)

| Language | Correct per run | Total | Rejected before running | Stopped with an error | Silently wrong | Time per run | Mean time | Mean tokens |
|---|---|---:|---:|---:|---:|---|---:|---:|
| Avisoq | 20, 20, 20 | 60 of 60 | 0 | 0 | 0 | 149 s, 172 s, 169 s | 163 s | 143k |
| Python | 20, 20, 20 | 60 of 60 | 0 | 0 | 0 | 129 s, 110 s, 117 s | 119 s | 127k |
| Rust | 20, 20, 20 | 60 of 60 | 0 | 0 | 0 | 149 s, 161 s, 116 s | 142 s | 131k |

No failures.

