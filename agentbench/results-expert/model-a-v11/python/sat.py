def sat(n: int, clauses: list[int]) -> list[int]:
    cl = []
    cur = []
    for x in clauses:
        if x == 0:
            cl.append(cur)
            cur = []
        else:
            cur.append(x)
    for mask in range(1 << n):
        # variable 1 is the most significant bit
        ok = True
        for c in cl:
            for x in c:
                val = (mask >> (n - abs(x))) & 1
                if (x > 0) == bool(val):
                    break
            else:
                ok = False
                break
        if ok:
            return [(mask >> (n - v)) & 1 for v in range(1, n + 1)]
    return [-1]
