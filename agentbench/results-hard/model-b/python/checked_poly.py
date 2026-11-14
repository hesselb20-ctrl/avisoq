_LO = -(1 << 63)
_HI = (1 << 63) - 1


def checked_poly(coeffs: list[int], x: int) -> str:
    acc = 0
    for i in range(len(coeffs) - 1, -1, -1):
        acc = acc * x
        if acc < _LO or acc > _HI:
            return "overflow"
        acc = acc + coeffs[i]
        if acc < _LO or acc > _HI:
            return "overflow"
    return str(acc)
