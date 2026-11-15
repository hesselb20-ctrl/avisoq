_DIGITS = "0123456789"


def isbn_verifier(isbn: str) -> bool:
    chars = isbn.replace("-", "")
    if len(chars) != 10:
        return False
    total = 0
    for index, ch in enumerate(chars):
        if ch in _DIGITS:
            value = int(ch)
        elif ch == "X" and index == 9:
            value = 10
        else:
            return False
        total += value * (10 - index)
    return total % 11 == 0
