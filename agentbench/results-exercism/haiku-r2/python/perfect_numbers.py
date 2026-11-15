def perfect_numbers(number: int) -> str:
    if number <= 0:
        raise ValueError("Classification is only possible for positive integers.")
    divisor_sum = 0
    i = 1
    while i * i <= number:
        if number % i == 0:
            divisor_sum += i
            partner = number // i
            if partner != i:
                divisor_sum += partner
        i += 1
    aliquot_sum = divisor_sum - number
    if aliquot_sum == number:
        return "perfect"
    if aliquot_sum > number:
        return "abundant"
    return "deficient"
