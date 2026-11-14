def nth_prime(k: int) -> int:
    limit = 20000
    sieve = bytearray([1]) * (limit + 1)
    sieve[0] = 0
    sieve[1] = 0
    i = 2
    while i * i <= limit:
        if sieve[i]:
            sieve[i * i::i] = bytearray(len(range(i * i, limit + 1, i)))
        i += 1
    count = 0
    for p in range(limit + 1):
        if sieve[p]:
            count += 1
            if count == k:
                return p
    return -1
