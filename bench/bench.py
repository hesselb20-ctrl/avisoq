import sys, time

def fib(n):
    if n < 2:
        return n
    return fib(n - 1) + fib(n - 2)

def count_primes(n):
    composite = [False] * (n + 1)
    count = 0
    for i in range(2, n + 1):
        if not composite[i]:
            count += 1
            j = i * i
            while j <= n:
                composite[j] = True
                j += i
    return count

def mandel(size, max_iter):
    total = 0
    for py in range(size):
        for px in range(size):
            cx = px / size * 3.0 - 2.0
            cy = py / size * 2.0 - 1.0
            x = 0.0
            y = 0.0
            i = 0
            while i < max_iter and x * x + y * y <= 4.0:
                t = x * x - y * y + cx
                y = 2.0 * x * y + cy
                x = t
                i += 1
            total += i
    return total

def collatz(limit):
    total = 0
    for n in range(1, limit):
        x = n
        while x != 1:
            if x % 2 == 0:
                x = x // 2
            else:
                x = 3 * x + 1
            total += 1
    return total

BENCH = {
    "fib": lambda: fib(38),
    "sieve": lambda: count_primes(20000000),
    "mandel": lambda: mandel(800, 300),
    "collatz": lambda: collatz(1000000),
}
name = sys.argv[1]
t0 = time.perf_counter()
r = BENCH[name]()
print(name, r, (time.perf_counter() - t0) * 1000)
