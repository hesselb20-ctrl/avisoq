def csv_sum(s: str) -> int:
    total = 0
    for field in s.split(","):
        t = field.strip()
        if t == "":
            continue
        total += int(t)
    return total
