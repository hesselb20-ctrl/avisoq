def perfect_numbers(number: int) -> str:
    if number < 1:
        raise ValueError("Classification is only possible for positive integers.")
    total = 0
    i = 1
    while i * i <= number:
        if number % i == 0:
            total += i
            j = number // i
            if j != i:
                total += j
        i += 1
    total -= number
    if total == number:
        return "perfect"
    return "abundant" if total > number else "deficient"
