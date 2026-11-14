pub fn pow_mod(base: i64, exp: i64, m: i64) -> i64 {
    let modulus: i128 = m as i128;
    let mut result: i128 = 1 % modulus;
    let mut b: i128 = (base as i128).rem_euclid(modulus);
    let mut e: i64 = exp;
    while e > 0 {
        if e & 1 == 1 {
            result = result * b % modulus;
        }
        b = b * b % modulus;
        e >>= 1;
    }
    result as i64
}
