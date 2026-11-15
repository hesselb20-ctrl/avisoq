def transpose(lines: list[str]) -> list[str]:
    if not lines:
        return []
    n = len(lines)
    widths = [0] * n
    m = 0
    for i in range(n - 1, -1, -1):
        m = max(m, len(lines[i]))
        widths[i] = m
    padded = [lines[i].ljust(widths[i]) for i in range(n)]
    return ["".join(p[j] for p in padded if j < len(p)) for j in range(m)]
