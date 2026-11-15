pub fn prime_factors(value: i64) -> Vec<i64> {
    let mut out: Vec<i64> = Vec::new();
    let mut n = value;
    let mut d: i64 = 2;
    while n > 1 && d * d <= n {
        while n % d == 0 {
            out.push(d);
            n /= d;
        }
        d += 1;
    }
    if n > 1 {
        out.push(n);
    }
    out
}
