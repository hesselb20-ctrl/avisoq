def sum_of_multiples(factors: list[int], limit: int) -> int:
    found = set()
    for factor in factors:
        if factor <= 0:
            continue
        found.update(range(factor, limit, factor))
    return sum(found)
