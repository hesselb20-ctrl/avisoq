#include <chrono>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <vector>

static int64_t fib(int64_t n) {
    if (n < 2) return n;
    return fib(n - 1) + fib(n - 2);
}

static int64_t count_primes(int64_t n) {
    std::vector<uint8_t> composite(n + 1, 0);
    int64_t count = 0;
    for (int64_t i = 2; i <= n; i++) {
        if (!composite[i]) {
            count++;
            for (int64_t j = i * i; j <= n; j += i) composite[j] = 1;
        }
    }
    return count;
}

static int64_t mandel(int64_t size, int64_t max_iter) {
    int64_t total = 0;
    for (int64_t py = 0; py < size; py++) {
        for (int64_t px = 0; px < size; px++) {
            double cx = (double)px / (double)size * 3.0 - 2.0;
            double cy = (double)py / (double)size * 2.0 - 1.0;
            double x = 0.0, y = 0.0;
            int64_t i = 0;
            while (i < max_iter && x * x + y * y <= 4.0) {
                double t = x * x - y * y + cx;
                y = 2.0 * x * y + cy;
                x = t;
                i++;
            }
            total += i;
        }
    }
    return total;
}

static int64_t collatz(int64_t limit) {
    int64_t total = 0;
    for (int64_t n = 1; n < limit; n++) {
        int64_t x = n;
        while (x != 1) {
            if (x % 2 == 0) x /= 2; else x = 3 * x + 1;
            total++;
        }
    }
    return total;
}

int main(int argc, char** argv) {
    if (argc < 3) return 1;
    const char* name = argv[1];
    // Inputs come from the command line so the optimiser cannot fold them away.
    int64_t a = std::atoll(argv[2]);
    int64_t b = argc > 3 ? std::atoll(argv[3]) : 0;
    auto t0 = std::chrono::steady_clock::now();
    int64_t r = 0;
    if (!std::strcmp(name, "fib")) r = fib(a);
    else if (!std::strcmp(name, "sieve")) r = count_primes(a);
    else if (!std::strcmp(name, "mandel")) r = mandel(a, b);
    else if (!std::strcmp(name, "collatz")) r = collatz(a);
    double ms = std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - t0).count();
    std::printf("%s %lld %f\n", name, (long long)r, ms);
    return 0;
}
