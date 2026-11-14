pub fn two_sum(xs: &[i64], target: i64) -> Vec<i64> {
    let t = target as i128;
    let n = xs.len();
    for i in 0..n {
        for j in (i + 1)..n {
            if xs[i] as i128 + xs[j] as i128 == t {
                return vec![i as i64, j as i64];
            }
        }
    }
    Vec::new()
}
