def transpose(lines: list[str]) -> list[str]:
    if not lines:
        return []
    width = max(len(line) for line in lines)
    result = []
    for j in range(width):
        # last input row that still has a character in column j
        last = max(i for i, line in enumerate(lines) if len(line) > j)
        row = "".join(
            lines[i][j] if j < len(lines[i]) else " " for i in range(last + 1)
        )
        result.append(row)
    return result
