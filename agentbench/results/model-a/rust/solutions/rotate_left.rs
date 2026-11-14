pub fn rotate_left(xs: &[i64], k: i64) -> Vec<i64> {
    let n = xs.len();
    if n == 0 {
        return Vec::new();
    }
    let r = (k.rem_euclid(n as i64)) as usize;
    let mut out: Vec<i64> = Vec::with_capacity(n);
    out.extend_from_slice(&xs[r..]);
    out.extend_from_slice(&xs[..r]);
    out
}
