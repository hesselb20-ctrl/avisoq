pub fn sum_digits(n: i64) -> i64 {
    let mut m: u64 = n.unsigned_abs();
    let mut s: i64 = 0;
    while m > 0 {
        s += (m % 10) as i64;
        m /= 10;
    }
    s
}
