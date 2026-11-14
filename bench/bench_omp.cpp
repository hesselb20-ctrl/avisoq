// Hand-parallelised C++ (OpenMP) versions of the two benchmarks that can be parallelised.
// This is what a C++ programmer has to write to match Vow's sum(...).
#include <chrono>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>

static int64_t mandel(int64_t size, int64_t max_iter) {
    int64_t total = 0;
    #pragma omp parallel for reduction(+:total) schedule(dynamic)
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
    #pragma omp parallel for reduction(+:total) schedule(dynamic, 1024)
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
    int64_t a = std::atoll(argv[2]);
    int64_t b = argc > 3 ? std::atoll(argv[3]) : 0;
    auto t0 = std::chrono::steady_clock::now();
    int64_t r = 0;
    if (!std::strcmp(name, "mandel")) r = mandel(a, b);
    else if (!std::strcmp(name, "collatz")) r = collatz(a);
    else return 2;
    double ms = std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - t0).count();
    std::printf("%s %lld %f\n", name, (long long)r, ms);
    return 0;
}
