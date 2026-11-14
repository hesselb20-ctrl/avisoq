pub fn binary_search(xs: &[i64], target: i64) -> i64 {
    match xs.binary_search(&target) {
        Ok(i) => i as i64,
        Err(_) => -1,
    }
}
