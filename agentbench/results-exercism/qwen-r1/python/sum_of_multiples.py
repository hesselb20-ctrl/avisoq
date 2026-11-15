def sum_of_multiples(factors: list[int], limit: int) -> int:
    """Return the sum of unique positive multiples of factors below limit."""
    if limit <= 0:
        return 0

    unique_factors = {factor for factor in factors if factor > 0}
    if not unique_factors:
        return 0

    # For small limits, direct collection is simple and fast.
    if limit <= 100_000:
        multiples = set()
        for factor in unique_factors:
            multiples.update(range(factor, limit, factor))
        return sum(multiples)

    # For larger limits with few factors, use inclusion-exclusion.
    if len(unique_factors) <= 20:
        factors_list = list(unique_factors)
        total = 0

        for mask in range(1, 1 << len(factors_list)):
            lcm = 1
            valid = True
            bits = 0

            for i, factor in enumerate(factors_list):
                if mask & (1 << i):
                    bits += 1
                    g = math.gcd(lcm, factor)
                    lcm = lcm // g * factor
                    if lcm >= limit:
                        valid = False
                        break

            if valid:
                count = (limit - 1) // lcm
                term = lcm * count * (count + 1) // 2
                if bits % 2 == 1:
                    total += term
                else:
                    total -= term

        return total

    # Fallback for many factors: collect multiples directly.
    multiples = set()
    for factor in unique_factors:
        multiples.update(range(factor, limit, factor))
    return sum(multiples)
