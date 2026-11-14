pub fn csv_sum(s: &str) -> i64 {
    let mut total: i64 = 0;
    for field in s.split(',') {
        let f = field.trim();
        if f.is_empty() {
            continue;
        }
        let v: i64 = f.parse().unwrap_or(0);
        total = total.wrapping_add(v);
    }
    total
}
