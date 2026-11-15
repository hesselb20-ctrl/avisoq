pub fn largest_series_product(digits: &str, span: i64) -> i64 {
    if span < 0 {
        panic!("span must be non-negative");
    }

    let span = span as usize;
    let digits: Vec<u8> = digits
        .bytes()
        .map(|b| {
            if b.is_ascii_digit() {
                b - b'0'
            } else {
                panic!("digits must contain only digits");
            }
        })
        .collect();

    if span > digits.len() {
        panic!("span must not be greater than the number of digits");
    }

    if span == 0 {
        return 1;
    }

    let mut best = 0;

    for window in digits.windows(span) {
        let product = window.iter().fold(1, |acc, &digit| acc * digit as i64);
        if product > best {
            best = product;
        }
    }

    best
}
