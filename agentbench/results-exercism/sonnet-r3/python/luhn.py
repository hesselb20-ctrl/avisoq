def luhn(value: str) -> bool:
    s = value.replace(" ", "")
    if len(s) <= 1 or not all(ch in "0123456789" for ch in s):
        return False
    total = 0
    for i, ch in enumerate(reversed(s)):
        d = int(ch)
        if i % 2 == 1:
            d *= 2
            if d > 9:
                d -= 9
        total += d
    return total % 10 == 0
