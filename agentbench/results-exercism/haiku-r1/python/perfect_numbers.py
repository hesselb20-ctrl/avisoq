def perfect_numbers(number: int) -> str:
    if number <= 0:
        raise ValueError("Classification is only possible for positive integers.")
    divisor_sum = 0
    d = 1
    while d * d <= number:
        if number % d == 0:
            divisor_sum += d
            other = number // d
            if other != d:
                divisor_sum += other
        d += 1
    aliquot = divisor_sum - number
    if aliquot == number:
        return "perfect"
    if aliquot > number:
        return "abundant"
    return "deficient"
