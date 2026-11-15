_DIGITS = "0123456789"


def luhn(value: str) -> bool:
    stripped = value.replace(" ", "")
    if len(stripped) <= 1:
        return False
    if any(ch not in _DIGITS for ch in stripped):
        return False
    total = 0
    for index, ch in enumerate(reversed(stripped)):
        digit = int(ch)
        if index % 2 == 1:
            digit *= 2
            if digit > 9:
                digit -= 9
        total += digit
    return total % 10 == 0
