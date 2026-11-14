pub fn max_subarray(xs: &[i64]) -> i64 {
    if xs.is_empty() {
        return 0;
    }
    let mut best: i64 = xs[0];
    let mut current: i64 = xs[0];
    for &x in &xs[1..] {
        current = if current > 0 { current + x } else { x };
        if current > best {
            best = current;
        }
    }
    best
}
