pub fn prime_factors(value: i64) -> Vec<i64> {
    let mut factors = Vec::new();
    let mut n = value;

    if n <= 1 {
        return factors;
    }

    while n % 2 == 0 {
        factors.push(2);
        n /= 2;
    }

    let mut divisor = 3;
    while divisor <= n / divisor {
        while n % divisor == 0 {
            factors.push(divisor);
            n /= divisor;
        }
        divisor += 2;
    }

    if n > 1 {
        factors.push(n);
    }

    factors
}
