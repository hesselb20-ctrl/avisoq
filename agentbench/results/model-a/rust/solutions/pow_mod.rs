pub fn pow_mod(base: i64, exp: i64, m: i64) -> i64 {
    let md = m as u128;
    let mut b: u128 = (base as u128) % md;
    let mut e: u64 = exp as u64;
    let mut r: u128 = 1 % md;
    while e > 0 {
        if e & 1 == 1 {
            r = r * b % md;
        }
        b = b * b % md;
        e >>= 1;
    }
    r as i64
}
