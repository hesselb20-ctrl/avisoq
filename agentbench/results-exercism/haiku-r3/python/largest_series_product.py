def largest_series_product(digits: str, span: int) -> int:
    if any(not ("0" <= ch <= "9") for ch in digits):
        raise ValueError("digits input must only contain digits")
    if span < 0:
        raise ValueError("span must not be negative")
    if span > len(digits):
        raise ValueError("span must be smaller than string length")
    if span == 0:
        return 1
    values = [int(ch) for ch in digits]
    best = 0
    for start in range(len(values) - span + 1):
        product = 1
        for v in values[start:start + span]:
            product *= v
        if product > best:
            best = product
    return best
