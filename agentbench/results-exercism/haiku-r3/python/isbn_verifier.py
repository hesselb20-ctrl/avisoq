def isbn_verifier(isbn: str) -> bool:
    chars = isbn.replace("-", "")
    if len(chars) != 10:
        return False
    total = 0
    for position, ch in enumerate(chars):
        if position < 9:
            if not ("0" <= ch <= "9"):
                return False
            value = int(ch)
        else:
            if ch == "X":
                value = 10
            elif "0" <= ch <= "9":
                value = int(ch)
            else:
                return False
        total += value * (10 - position)
    return total % 11 == 0
