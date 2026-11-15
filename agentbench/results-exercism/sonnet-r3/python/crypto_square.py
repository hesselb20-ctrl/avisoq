import math


def crypto_square(plaintext: str) -> str:
    text = "".join(ch.lower() for ch in plaintext if ch.isascii() and ch.isalnum())
    n = len(text)
    if n == 0:
        return ""
    c = math.isqrt(n)
    if c * c < n:
        c += 1
    r = -(-n // c)
    padded = text.ljust(r * c)
    return " ".join("".join(padded[row * c + col] for row in range(r)) for col in range(c))
