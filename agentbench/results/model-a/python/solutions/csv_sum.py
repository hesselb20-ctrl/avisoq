def csv_sum(s: str) -> int:
    total = 0
    for field in s.split(","):
        field = field.strip()
        if field:
            total += int(field)
    return total
