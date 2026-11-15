pub fn largest_series_product(digits: &str, span: i64) -> i64 {
    if span < 0 {
        return -1;
    }
    let mut d: Vec<i128> = Vec::new();
    for c in digits.chars() {
        if c.is_ascii_digit() {
            d.push((c as u8 - b'0') as i128);
        } else {
            return -1;
        }
    }
    let s = span as usize;
    if s > d.len() {
        return -1;
    }
    let mut best: i128 = 0;
    for i in 0..=(d.len() - s) {
        let p: i128 = d[i..i + s].iter().product();
        if p > best {
            best = p;
        }
    }
    best as i64
}
