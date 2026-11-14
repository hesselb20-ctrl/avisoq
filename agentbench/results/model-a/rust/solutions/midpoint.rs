pub fn midpoint(a: i64, b: i64) -> i64 {
    let s = a as i128 + b as i128;
    s.div_euclid(2) as i64
}
