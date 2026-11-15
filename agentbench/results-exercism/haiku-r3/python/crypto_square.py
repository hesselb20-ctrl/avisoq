import math


def crypto_square(plaintext: str) -> str:
    text = "".join(ch for ch in plaintext.lower() if ch.isalnum())
    n = len(text)
    if n == 0:
        return ""
    c = math.ceil(math.sqrt(n))
    r = math.ceil(n / c)
    padded = text.ljust(r * c)
    columns = [padded[j::c] for j in range(c)]
    return " ".join(columns)
