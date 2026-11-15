def _aliquot_sum(n: int) -> int:
    total = 0
    i = 1
    while i * i <= n:
        if n % i == 0:
            if i != n:
                total += i
            j = n // i
            if j != i and j != n:
                total += j
        i += 1
    return total


def perfect_numbers(number: int) -> str:
    if number <= 0:
        raise ValueError("Classification is only possible for positive integers.")
    aliquot = _aliquot_sum(number)
    if aliquot == number:
        return "perfect"
    if aliquot > number:
        return "abundant"
    return "deficient"
