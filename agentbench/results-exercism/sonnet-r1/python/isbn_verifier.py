def isbn_verifier(isbn: str) -> bool:
    s = isbn.replace("-", "")
    if len(s) != 10:
        return False
    total = 0
    for i, c in enumerate(s):
        if c in "0123456789":
            v = int(c)
        elif c == "X" and i == 9:
            v = 10
        else:
            return False
        total += v * (10 - i)
    return total % 11 == 0
