import math


def crypto_square(plaintext: str) -> str:
    normalized = "".join(ch for ch in plaintext.lower() if ch.isalnum())
    n = len(normalized)
    if n == 0:
        return ""
    cols = math.ceil(math.sqrt(n))
    rows = math.ceil(n / cols)
    chunks = []
    for j in range(cols):
        chunk = "".join(
            normalized[i * cols + j] if i * cols + j < n else " " for i in range(rows)
        )
        chunks.append(chunk)
    return " ".join(chunks)
