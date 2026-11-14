def checked_poly(coeffs: list[int], x: int) -> str:
    lo, hi = -(1 << 63), (1 << 63) - 1
    acc = 0
    for c in reversed(coeffs):
        acc *= x
        if not lo <= acc <= hi:
            return "overflow"
        acc += c
        if not lo <= acc <= hi:
            return "overflow"
    return str(acc)
