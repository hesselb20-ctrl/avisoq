def pow_mod(base: int, exp: int, m: int) -> int:
    result = 1 % m
    b = base % m
    while exp > 0:
        if exp & 1:
            result = result * b % m
        b = b * b % m
        exp >>= 1
    return result
