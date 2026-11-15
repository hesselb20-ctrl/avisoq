pub fn largest_series_product(digits: &str, span: i64) -> i64 {
    if span < 0 {
        panic!("span must not be negative");
    }
    let values: Vec<i64> = digits
        .chars()
        .map(|c| match c.to_digit(10) {
            Some(d) => d as i64,
            None => panic!("input must contain only digits"),
        })
        .collect();
    let s = span as usize;
    if s > values.len() {
        panic!("span must not exceed the length of the input");
    }
    if s == 0 {
        return 1;
    }
    values
        .windows(s)
        .map(|w| w.iter().product::<i64>())
        .max()
        .unwrap()
}
