def sum_of_multiples(factors: list[int], limit: int) -> int:
    multiples = set()
    for factor in factors:
        if factor <= 0:
            continue
        for m in range(factor, limit, factor):
            multiples.add(m)
    return sum(multiples)
