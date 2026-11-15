pub fn largest_series_product(digits: &str, span: i64) -> i64 {
    if span < 0 {
        panic!("span must not be negative");
    }
    let ds: Vec<i64> = digits
        .chars()
        .map(|c| match c.to_digit(10) {
            Some(d) => d as i64,
            None => panic!("input must contain only digits"),
        })
        .collect();
    let span = span as usize;
    if span > ds.len() {
        panic!("span must not exceed the length of the input");
    }
    if span == 0 {
        return 1;
    }
    let mut best = i64::MIN;
    for w in ds.windows(span) {
        let p: i64 = w.iter().product();
        if p > best {
            best = p;
        }
    }
    best
}
