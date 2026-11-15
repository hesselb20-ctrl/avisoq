pub fn prime_factors(value: i64) -> Vec<i64> {
    let mut n = value;
    let mut factors = Vec::new();
    if n < 2 {
        return factors;
    }
    let mut d: i64 = 2;
    while d * d <= n {
        while n % d == 0 {
            factors.push(d);
            n /= d;
        }
        d += 1;
    }
    if n > 1 {
        factors.push(n);
    }
    factors
}
