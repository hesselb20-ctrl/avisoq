Best of 12 runs, 8 logical cores. Ratios are relative to C++ (lower is faster).

| Language | fib | sieve | mandel | collatz |
|---|---:|---:|---:|---:|
| C++ (g++ -O3 -march=native) | 36 ms (1.00x) | 30 ms (1.00x) | 110 ms (1.00x) | 138 ms (1.00x) |
| Rust (-O3, target-cpu=native) | 69 ms (1.94x) | 34 ms (1.13x) | 110 ms (1.00x) | 86 ms (0.62x) |
| Rust (same, overflow checks on) | 123 ms (3.45x) | 30 ms (1.00x) | 111 ms (1.01x) | 137 ms (1.00x) |
| Vow native (all checks on) | 1.5 ms (0.04x) | 30 ms (1.01x) | 113 ms (1.02x) | 117 ms (0.85x) |
| Vow native (--unchecked) | 34 ms (0.96x) | 30 ms (1.00x) | 110 ms (1.00x) | 103 ms (0.75x) |
| Vow native, written with sum (all checks on) |  |  | 4.7 ms (0.04x) | 14 ms (0.10x) |
| Vow native, per-pixel sum: threads + 8 lanes (all checks on) |  |  | 4.9 ms (0.04x) |  |
| C++ hand-parallelised with OpenMP |  |  | 15 ms (0.13x) | 13 ms (0.09x) |
| Vow WebAssembly (all checks on) | 225 ms (6.31x) | 57 ms (1.87x) | 107 ms (0.97x) | 232 ms (1.68x) |
| JavaScript (Node, V8) | 289 ms (8.10x) | 56 ms (1.83x) | 112 ms (1.02x) | 1466 ms (10.65x) |
| Python | 2738 ms (76.78x) | 1174 ms (38.78x) | 4485 ms (40.76x) | 5830 ms (42.36x) |
