from fractions import Fraction


def det(xs: list[int], n: int) -> int:
    m = [[Fraction(xs[i * n + j]) for j in range(n)] for i in range(n)]
    d = Fraction(1)
    for c in range(n):
        p = None
        for r in range(c, n):
            if m[r][c] != 0:
                p = r
                break
        if p is None:
            return 0
        if p != c:
            m[p], m[c] = m[c], m[p]
            d = -d
        d *= m[c][c]
        for r in range(c + 1, n):
            f = m[r][c] / m[c][c]
            if f:
                for k in range(c, n):
                    m[r][k] -= f * m[c][k]
    return int(d)
