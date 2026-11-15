def transpose(lines: list[str]) -> list[str]:
    if not lines:
        return []
    rows = []
    width = 0
    for line in reversed(lines):
        width = max(width, len(line))
        rows.append(line.ljust(width))
    rows.reverse()
    return ["".join(r[i] for r in rows if i < len(r)) for i in range(width)]
