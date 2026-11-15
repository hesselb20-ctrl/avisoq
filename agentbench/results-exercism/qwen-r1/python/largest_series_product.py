def largest_series_product(digits: str, span: int) -> int:
    """Return the largest product of a series of adjacent digits.

    A series is a contiguous substring of ``digits`` whose length is ``span``.
    If ``span`` is zero, the product is defined as 1.
    """
    if not isinstance(digits, str):
        raise ValueError("digits must be a string")
    if not isinstance(span, int) or isinstance(span, bool):
        raise ValueError("span must be an integer")
    if span < 0:
        raise ValueError("span must be non-negative")
    if span > len(digits):
        raise ValueError("span is longer than the digit sequence")

    for ch in digits:
        if not ("0" <= ch <= "9"):
            raise ValueError("digits must contain only decimal digits")

    if span == 0:
        return 1

    zero_count = 0
    nonzero_product = 1
    best = 0

    for i, ch in enumerate(digits):
        digit = ord(ch) - 48

        if digit == 0:
            zero_count += 1
        else:
            nonzero_product *= digit

        if i >= span:
            old_digit = ord(digits[i - span]) - 48
            if old_digit == 0:
                zero_count -= 1
            else:
                nonzero_product //= old_digit

        if i >= span - 1:
            current = 0 if zero_count else nonzero_product
            if current > best:
                best = current

    return best
