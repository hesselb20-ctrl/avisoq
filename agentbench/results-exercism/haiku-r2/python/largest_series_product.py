def largest_series_product(digits: str, span: int) -> int:
    if span < 0:
        raise ValueError("span must not be negative")
    if any(ch not in "0123456789" for ch in digits):
        raise ValueError("digits input must only contain digits")
    if span > len(digits):
        raise ValueError("span must be smaller than string length")
    best = 0
    for start in range(len(digits) - span + 1):
        product = 1
        for ch in digits[start:start + span]:
            product *= int(ch)
        best = max(best, product)
    return best
