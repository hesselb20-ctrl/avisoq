def transpose(lines: list[str]) -> list[str]:
    if not lines:
        return []
    width = max(len(line) for line in lines)
    result = []
    for col in range(width):
        # last row that actually has a character in this column
        last = max(i for i, line in enumerate(lines) if col < len(line))
        chars = []
        for i in range(last + 1):
            line = lines[i]
            chars.append(line[col] if col < len(line) else " ")
        result.append("".join(chars))
    return result
