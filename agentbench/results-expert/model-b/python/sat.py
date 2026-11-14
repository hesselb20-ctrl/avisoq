def sat(n: int, clauses: list[int]) -> list[int]:
    cls = []
    cur = []
    for x in clauses:
        if x == 0:
            cls.append(cur)
            cur = []
        else:
            cur.append(x)
    if cur:
        cls.append(cur)

    # Variable 1 is the most significant bit, so increasing integers
    # give assignments in lexicographic order with 0 before 1.
    for mask in range(1 << n):
        ok = True
        for c in cls:
            sat_c = False
            for lit in c:
                v = abs(lit)
                val = (mask >> (n - v)) & 1
                if (lit > 0 and val == 1) or (lit < 0 and val == 0):
                    sat_c = True
                    break
            if not sat_c:
                ok = False
                break
        if ok:
            return [(mask >> (n - v)) & 1 for v in range(1, n + 1)]
    return [-1]
