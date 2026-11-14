pub fn checked_poly(coeffs: &[i64], x: i64) -> String {
    let mut acc: i64 = 0;
    for i in (0..coeffs.len()).rev() {
        acc = match acc.checked_mul(x) {
            Some(v) => v,
            None => return "overflow".to_string(),
        };
        acc = match acc.checked_add(coeffs[i]) {
            Some(v) => v,
            None => return "overflow".to_string(),
        };
    }
    acc.to_string()
}
