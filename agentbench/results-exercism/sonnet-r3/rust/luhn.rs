pub fn luhn(value: &str) -> bool {
    let mut ds = Vec::new();
    for c in value.chars() {
        if c == ' ' { continue; }
        if c.is_ascii_digit() { ds.push(c as i64 - '0' as i64); } else { return false; }
    }
    if ds.len() <= 1 { return false; }
    let mut sum = 0;
    for (i, d) in ds.iter().rev().enumerate() {
        let mut v = *d;
        if i % 2 == 1 { v *= 2; if v > 9 { v -= 9; } }
        sum += v;
    }
    sum % 10 == 0
}
