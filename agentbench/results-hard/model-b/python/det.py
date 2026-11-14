def det(xs: list[int], n: int) -> int:
    # Fraction-free Gaussian elimination (Bareiss algorithm), exact integers.
    m = [list(xs[i * n:(i + 1) * n]) for i in range(n)]
    sign = 1
    prev = 1
    for k in range(n - 1):
        if m[k][k] == 0:
            pivot = None
            for i in range(k + 1, n):
                if m[i][k] != 0:
                    pivot = i
                    break
            if pivot is None:
                return 0
            m[k], m[pivot] = m[pivot], m[k]
            sign = -sign
        for i in range(k + 1, n):
            for j in range(k + 1, n):
                m[i][j] = (m[i][j] * m[k][k] - m[i][k] * m[k][j]) // prev
        prev = m[k][k]
    return sign * m[n - 1][n - 1]
