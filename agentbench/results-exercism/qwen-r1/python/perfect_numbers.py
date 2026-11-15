import math


def perfect_numbers(number: int) -> str:
    """Classify a positive integer as perfect, abundant, or deficient."""
    if number <= 0:
        raise ValueError("Classification is defined only for positive integers.")

    if number == 1:
        return "deficient"

    aliquot_sum = 1
    limit = math.isqrt(number)

    for divisor in range(2, limit + 1):
        if number % divisor == 0:
            aliquot_sum += divisor
            complement = number // divisor
            if complement != divisor:
                aliquot_sum += complement

    if aliquot_sum == number:
        return "perfect"
    if aliquot_sum > number:
        return "abundant"
    return "deficient"
