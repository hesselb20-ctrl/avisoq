def transpose(lines: list[str]) -> list[str]:
    if not lines:
        return []
    width = max(len(line) for line in lines)
    result = []
    for col in range(width):
        # Only rows up to the last input line that still reaches this column are
        # emitted, so short trailing lines are not padded on the right.
        last_row = max(j for j, line in enumerate(lines) if len(line) > col)
        result.append(
            "".join(
                lines[j][col] if len(lines[j]) > col else " "
                for j in range(last_row + 1)
            )
        )
    return result
