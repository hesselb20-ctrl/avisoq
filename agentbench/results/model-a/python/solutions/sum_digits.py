def sum_digits(n: int) -> int:
    n = abs(n)
    total = 0
    while n:
        n, d = divmod(n, 10)
        total += d
    return total
