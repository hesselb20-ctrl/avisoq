pub fn nth_prime(k: i64) -> i64 {
    let mut primes: Vec<i64> = Vec::new();
    let mut c: i64 = 2;
    while (primes.len() as i64) < k {
        let mut ok = true;
        for &p in primes.iter() {
            if p * p > c {
                break;
            }
            if c % p == 0 {
                ok = false;
                break;
            }
        }
        if ok {
            primes.push(c);
        }
        c += 1;
    }
    primes[(k - 1) as usize]
}
