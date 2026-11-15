pub fn largest_series_product(digits: &str, span: i64) -> i64 {
    if span < 0 {
        return -1;
    }
    let span = span as usize;
    let mut ds: Vec<i64> = Vec::new();
    for c in digits.chars() {
        match c.to_digit(10) {
            Some(d) => ds.push(d as i64),
            None => return -1,
        }
    }
    if span > ds.len() {
        return -1;
    }
    if span == 0 {
        return 1;
    }
    let mut best = 0i64;
    for w in ds.windows(span) {
        let p: i64 = w.iter().product();
        if p > best {
            best = p;
        }
    }
    best
}
