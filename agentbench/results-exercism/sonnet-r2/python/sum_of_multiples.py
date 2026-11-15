def sum_of_multiples(factors: list[int], limit: int) -> int:
    seen = set()
    for f in factors:
        if f > 0:
            seen.update(range(f, limit, f))
    return sum(seen)
