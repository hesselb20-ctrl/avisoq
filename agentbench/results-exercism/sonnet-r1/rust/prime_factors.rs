pub fn prime_factors(value: i64) -> Vec<i64> {
    let mut n = value;
    let mut res = Vec::new();
    if n < 2 {
        return res;
    }
    let mut d = 2i64;
    while d * d <= n {
        while n % d == 0 {
            res.push(d);
            n /= d;
        }
        d += if d == 2 { 1 } else { 2 };
    }
    if n > 1 {
        res.push(n);
    }
    res
}
