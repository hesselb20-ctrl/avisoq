import math


def crypto_square(plaintext: str) -> str:
    s = "".join(c.lower() for c in plaintext if c.isalnum())
    if not s:
        return ""
    c = math.ceil(math.sqrt(len(s)))
    r = c if (c - 1) * c < len(s) else c - 1
    padded = s.ljust(r * c)
    return " ".join(padded[i::c] for i in range(c))
