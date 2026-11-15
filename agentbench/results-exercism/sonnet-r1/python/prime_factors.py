def prime_factors(value: int) -> list[int]:
    out = []
    d = 2
    while d * d <= value:
        while value % d == 0:
            out.append(d)
            value //= d
        d += 1 if d == 2 else 2
    if value > 1:
        out.append(value)
    return out
