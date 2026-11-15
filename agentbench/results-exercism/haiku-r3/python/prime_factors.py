def prime_factors(value: int) -> list[int]:
    factors = []
    if value < 2:
        return factors
    divisor = 2
    while divisor * divisor <= value:
        while value % divisor == 0:
            factors.append(divisor)
            value //= divisor
        divisor += 1
    if value > 1:
        factors.append(value)
    return factors
