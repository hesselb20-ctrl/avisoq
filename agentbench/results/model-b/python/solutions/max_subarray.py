def max_subarray(xs: list[int]) -> int:
    if not xs:
        return 0
    current = xs[0]
    best = xs[0]
    for x in xs[1:]:
        current = max(x, current + x)
        if current > best:
            best = current
    return best
