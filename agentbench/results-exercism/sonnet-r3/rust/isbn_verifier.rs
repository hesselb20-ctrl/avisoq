pub fn isbn_verifier(isbn: &str) -> bool {
    let mut vals: Vec<i64> = Vec::new();
    for c in isbn.chars() {
        if c == '-' { continue; }
        if c.is_ascii_digit() { vals.push(c as i64 - '0' as i64); }
        else if c == 'X' && vals.len() == 9 { vals.push(10); }
        else { return false; }
    }
    if vals.len() != 10 { return false; }
    let s: i64 = vals.iter().enumerate().map(|(i, v)| v * (10 - i as i64)).sum();
    s % 11 == 0
}
