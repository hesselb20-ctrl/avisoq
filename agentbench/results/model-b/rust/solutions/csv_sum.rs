pub fn csv_sum(s: &str) -> i64 {
    if s.is_empty() {
        return 0;
    }
    let mut total: i64 = 0;
    for field in s.split(',') {
        let t = field.trim();
        if !t.is_empty() {
            total += t.parse::<i64>().unwrap_or(0);
        }
    }
    total
}
