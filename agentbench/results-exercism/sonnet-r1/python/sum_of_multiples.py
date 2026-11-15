def sum_of_multiples(factors: list[int], limit: int) -> int:
    found = set()
    for f in factors:
        if f <= 0:
            continue
        found.update(range(f, limit, f))
    return sum(found)
