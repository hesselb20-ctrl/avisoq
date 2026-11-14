Best of 12 runs, 8 logical cores. Ratios are relative to C++ (lower is faster).

| Language | fib | sieve | mandel | collatz |
|---|---:|---:|---:|---:|
| C++ (g++ -O3 -march=native) | 38 ms (1.00x) | 30 ms (1.00x) | 108 ms (1.00x) | 137 ms (1.00x) |
| Rust (-O3, target-cpu=native) | 70 ms (1.87x) | 34 ms (1.13x) | 109 ms (1.01x) | 88 ms (0.65x) |
| Rust (same, overflow checks on) | 124 ms (3.29x) | 29 ms (0.97x) | 111 ms (1.02x) | 136 ms (0.99x) |
| Avisoq native (all checks on) | 1.5 ms (0.04x) | 31 ms (1.01x) | 112 ms (1.03x) | 119 ms (0.87x) |
| Avisoq native (--unchecked) | 35 ms (0.92x) | 30 ms (0.99x) | 107 ms (0.99x) | 100 ms (0.73x) |
| Avisoq native, written with sum (all checks on) |  |  | 4.6 ms (0.04x) | 14 ms (0.10x) |
| Avisoq native, per-pixel sum: threads + 8 lanes (all checks on) |  |  | 5.0 ms (0.05x) |  |
| C++ hand-parallelised with OpenMP |  |  | 15 ms (0.13x) | 13 ms (0.09x) |
| Avisoq WebAssembly (all checks on) | 213 ms (5.64x) | 56 ms (1.84x) | 105 ms (0.97x) | 231 ms (1.69x) |
| JavaScript (Node, V8) | 290 ms (7.67x) | 56 ms (1.86x) | 110 ms (1.02x) | 1475 ms (10.78x) |
| Python | 2762 ms (73.18x) | 1174 ms (38.81x) | 4485 ms (41.34x) | 5745 ms (41.98x) |
