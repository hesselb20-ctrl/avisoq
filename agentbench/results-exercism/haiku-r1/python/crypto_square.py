import math


def crypto_square(plaintext: str) -> str:
    text = "".join(ch for ch in plaintext.lower() if ch.isascii() and ch.isalnum())
    n = len(text)
    if n == 0:
        return ""
    cols = math.isqrt(n)
    if cols * cols < n:
        cols += 1
    rows_count = -(-n // cols)
    rows = [text[i:i + cols].ljust(cols) for i in range(0, n, cols)]
    assert len(rows) == rows_count
    chunks = ["".join(row[j] for row in rows) for j in range(cols)]
    return " ".join(chunks)
