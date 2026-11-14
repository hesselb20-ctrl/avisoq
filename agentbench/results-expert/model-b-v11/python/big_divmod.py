def big_divmod(a: str, b: str) -> str:
    x = int(a)
    y = int(b)
    q = abs(x) // abs(y)
    if (x < 0) != (y < 0):
        q = -q
    r = x - y * q
    return '%d %d' % (q, r)
