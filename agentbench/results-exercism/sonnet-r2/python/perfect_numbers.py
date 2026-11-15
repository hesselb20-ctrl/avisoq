def perfect_numbers(number: int) -> str:
    if number < 1:
        raise ValueError("Classification is only possible for positive integers.")
    total = 0
    d = 1
    while d * d <= number:
        if number % d == 0:
            total += d
            o = number // d
            if o != d:
                total += o
        d += 1
    total -= number
    if total == number:
        return "perfect"
    return "abundant" if total > number else "deficient"
