"""Square code cipher implementation."""

import math


def crypto_square(plaintext: str) -> str:
    """Encode plaintext using the classic square code method."""
    normalized = "".join(ch.lower() for ch in plaintext if ch.isalnum())
    length = len(normalized)

    if length == 0:
        return ""

    r = math.isqrt(length)
    c = r
    if c * c < length:
        c += 1

    if r * c < length:
        r = c

    chunks = []
    for col in range(c):
        chunk = []
        for row in range(r):
            index = row * c + col
            if index < length:
                chunk.append(normalized[index])
            else:
                chunk.append(" ")
        chunks.append("".join(chunk))

    return " ".join(chunks)
