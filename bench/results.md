Best of 7 runs, 8 logical cores. Ratios are relative to C++ (lower is faster).

| Language | fib | sieve | mandel | collatz |
|---|---:|---:|---:|---:|
| C++ (g++ -O3 -march=native) | 39 ms (1.00x) | 33 ms (1.00x) | 110 ms (1.00x) | 141 ms (1.00x) |
| Rust (-O3, target-cpu=native) | 70 ms (1.79x) | 38 ms (1.15x) | 111 ms (1.00x) | 88 ms (0.62x) |
| Rust (same, overflow checks on) | 122 ms (3.16x) | 34 ms (1.02x) | 110 ms (0.99x) | 142 ms (1.01x) |
| Avisoq native (all checks on) | 1.5 ms (0.04x) | 34 ms (1.02x) | 113 ms (1.03x) | 125 ms (0.89x) |
| Avisoq native (--unchecked) | 37 ms (0.96x) | 31 ms (0.93x) | 106 ms (0.96x) | 105 ms (0.75x) |
| Avisoq native, written with sum (all checks on) |  |  | 4.8 ms (0.04x) | 14 ms (0.10x) |
| Avisoq native, per-pixel sum: threads + 8 lanes (all checks on) |  |  | 5.0 ms (0.04x) |  |
| C++ hand-parallelised with OpenMP |  |  | 15 ms (0.14x) | 13 ms (0.09x) |
| Avisoq WebAssembly (all checks on) | 235 ms (6.07x) | 62 ms (1.89x) | 108 ms (0.98x) | 239 ms (1.69x) |
| JavaScript (Node, V8) | 295 ms (7.60x) | 59 ms (1.81x) | 115 ms (1.04x) | 1551 ms (10.99x) |
| Python | 2875 ms (74.10x) | 1216 ms (36.96x) | 4945 ms (44.80x) | 6015 ms (42.60x) |
