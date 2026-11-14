def big_divmod(a: str, b: str) -> str:
    x, y = int(a), int(b)
    q = abs(x) // abs(y)
    if (x < 0) != (y < 0):
        q = -q
    r = x - q * y
    return "%d %d" % (q, r)
