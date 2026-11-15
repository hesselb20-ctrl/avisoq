pub fn largest_series_product(digits: &str, span: i64) -> i64 {
    if span < 0 { return -1; }
    let span = span as usize;
    let mut d = Vec::new();
    for c in digits.chars() {
        if c.is_ascii_digit() { d.push(c as i64 - '0' as i64); } else { return -1; }
    }
    if span > d.len() { return -1; }
    if span == 0 { return 1; }
    let mut best = 0;
    for w in d.windows(span) {
        let p: i64 = w.iter().product();
        if p > best { best = p; }
    }
    best
}
