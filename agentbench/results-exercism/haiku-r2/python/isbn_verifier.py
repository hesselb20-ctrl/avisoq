def isbn_verifier(isbn: str) -> bool:
    digits = isbn.replace("-", "")
    if len(digits) != 10:
        return False
    total = 0
    for index, ch in enumerate(digits):
        if ch in "0123456789":
            value = int(ch)
        elif ch == "X" and index == 9:
            value = 10
        else:
            return False
        total += value * (10 - index)
    return total % 11 == 0
