pub fn prime_factors(value: i64) -> Vec<i64> {
    let mut n = value;
    let mut out = Vec::new();
    if n < 2 { return out; }
    let mut d: i64 = 2;
    while d * d <= n {
        while n % d == 0 { out.push(d); n /= d; }
        d += if d == 2 { 1 } else { 2 };
    }
    if n > 1 { out.push(n); }
    out
}
