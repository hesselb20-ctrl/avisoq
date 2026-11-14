def common_prefix(a: str, b: str) -> str:
    i = 0
    limit = min(len(a), len(b))
    while i < limit and a[i] == b[i]:
        i += 1
    return a[:i]
