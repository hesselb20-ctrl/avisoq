pub fn checked_poly(coeffs: &[i64], x: i64) -> String {
    let mut acc: i64 = 0;
    for &c in coeffs.iter().rev() {
        acc = match acc.checked_mul(x).and_then(|v| v.checked_add(c)) {
            Some(v) => v,
            None => return "overflow".to_string(),
        };
    }
    acc.to_string()
}
