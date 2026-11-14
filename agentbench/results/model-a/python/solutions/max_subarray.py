def max_subarray(xs: list[int]) -> int:
    if not xs:
        return 0
    best = cur = xs[0]
    for x in xs[1:]:
        cur = max(x, cur + x)
        if cur > best:
            best = cur
    return best
