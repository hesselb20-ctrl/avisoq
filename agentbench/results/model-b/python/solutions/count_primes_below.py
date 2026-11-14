def count_primes_below(n: int) -> int:
    if n <= 2:
        return 0
    sieve = bytearray([1]) * n
    sieve[0] = 0
    sieve[1] = 0
    i = 2
    while i * i < n:
        if sieve[i]:
            sieve[i * i::i] = bytearray(len(range(i * i, n, i)))
        i += 1
    return sum(sieve)
