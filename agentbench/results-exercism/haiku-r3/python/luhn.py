def luhn(value: str) -> bool:
    digits = value.replace(" ", "")
    if len(digits) <= 1:
        return False
    if any(not ("0" <= ch <= "9") for ch in digits):
        return False
    total = 0
    for index, ch in enumerate(reversed(digits)):
        d = int(ch)
        if index % 2 == 1:
            d *= 2
            if d > 9:
                d -= 9
        total += d
    return total % 10 == 0
