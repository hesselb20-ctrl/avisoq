pub fn gcd(a: i64, b: i64) -> i64 {
    let mut x: u64 = a.unsigned_abs();
    let mut y: u64 = b.unsigned_abs();
    while y != 0 {
        let t = x % y;
        x = y;
        y = t;
    }
    x as i64
}
