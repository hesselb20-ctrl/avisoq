def largest_series_product(digits: str, span: int) -> int:
    if span < 0:
        raise ValueError("span must not be negative")
    if span > len(digits):
        raise ValueError("span must be smaller than string length")
    if not all(ch in "0123456789" for ch in digits):
        raise ValueError("digits input must only contain digits")
    best = 0
    for i in range(len(digits) - span + 1):
        p = 1
        for ch in digits[i:i + span]:
            p *= int(ch)
        best = max(best, p)
    return best
