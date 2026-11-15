import math


def crypto_square(plaintext: str) -> str:
    s = "".join(ch.lower() for ch in plaintext if ch.isalnum())
    n = len(s)
    if n == 0:
        return ""
    c = math.isqrt(n)
    if c * c < n:
        c += 1
    r = -(-n // c)
    padded = s.ljust(r * c)
    return " ".join(padded[i::c] for i in range(c))
