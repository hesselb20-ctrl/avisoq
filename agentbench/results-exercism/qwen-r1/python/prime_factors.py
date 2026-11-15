def prime_factors(value: int) -> list[int]:
    factors: list[int] = []
    n = value

    if n < 2:
        return factors

    while n % 2 == 0:
        factors.append(2)
        n //= 2

    divisor = 3
    while divisor * divisor <= n:
        while n % divisor == 0:
            factors.append(divisor)
            n //= divisor
        divisor += 2

    if n > 1:
        factors.append(n)

    return factors
