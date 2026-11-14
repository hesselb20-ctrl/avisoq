MOD = 1000000007


def fib_mod(n: int) -> int:
    a, b = 0, 1
    for _ in range(n):
        a, b = b, (a + b) % MOD
    return a
