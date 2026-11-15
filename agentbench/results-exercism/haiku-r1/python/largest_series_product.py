_DIGITS = "0123456789"


def largest_series_product(digits: str, span: int) -> int:
    if span < 0:
        raise ValueError("span must not be negative")
    if span > len(digits):
        raise ValueError("span must be smaller than string length")
    if any(ch not in _DIGITS for ch in digits):
        raise ValueError("digits input must only contain digits")
    values = [int(ch) for ch in digits]
    best = None
    for start in range(len(values) - span + 1):
        product = 1
        for value in values[start:start + span]:
            product *= value
        if best is None or product > best:
            best = product
    return best
