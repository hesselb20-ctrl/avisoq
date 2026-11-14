pub fn max_subarray(xs: &[i64]) -> i64 {
    if xs.is_empty() {
        return 0;
    }
    let mut best = xs[0];
    let mut cur = xs[0];
    for &x in &xs[1..] {
        cur = if cur > 0 { cur.wrapping_add(x) } else { x };
        if cur > best {
            best = cur;
        }
    }
    best
}
