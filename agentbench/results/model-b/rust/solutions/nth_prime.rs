fn is_prime(n: i64) -> bool {
    if n < 2 {
        return false;
    }
    let mut d: i64 = 2;
    while d * d <= n {
        if n % d == 0 {
            return false;
        }
        d += 1;
    }
    true
}

pub fn nth_prime(k: i64) -> i64 {
    let mut count: i64 = 0;
    let mut n: i64 = 1;
    loop {
        n += 1;
        if is_prime(n) {
            count += 1;
            if count == k {
                return n;
            }
        }
    }
}
