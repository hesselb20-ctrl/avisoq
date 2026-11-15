def transpose(lines: list[str]) -> list[str]:
    out = []
    width = max((len(l) for l in lines), default=0)
    for j in range(width):
        last = max(i for i, l in enumerate(lines) if len(l) > j)
        out.append("".join(lines[i][j] if len(lines[i]) > j else " "
                           for i in range(last + 1)))
    return out
