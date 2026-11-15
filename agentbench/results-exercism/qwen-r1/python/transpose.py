def transpose(lines: list[str]) -> list[str]:
    if not lines:
        return []

    max_len = max(len(line) for line in lines)
    transposed = []

    for col in range(max_len):
        row_chars = []
        for line in lines:
            if col < len(line):
                row_chars.append(line[col])
            else:
                row_chars.append(" ")

        row = "".join(row_chars).rstrip(" ")
        transposed.append(row)

    return transposed
