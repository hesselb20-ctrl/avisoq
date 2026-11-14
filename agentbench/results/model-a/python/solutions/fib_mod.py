def fib_mod(n: int) -> int:
    mod = 1000000007
    a, b = 0, 1
    for _ in range(n):
        a, b = b, (a + b) % mod
    return a
