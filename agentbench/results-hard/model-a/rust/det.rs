fn dt(m: &Vec<Vec<i64>>) -> i64 {
    let n = m.len();
    if n == 1 { return m[0][0]; }
    let mut r = 0;
    for c in 0..n {
        if m[0][c] == 0 { continue; }
        let sub: Vec<Vec<i64>> = m[1..].iter().map(|row| row.iter().enumerate().filter(|(j, _)| *j != c).map(|(_, v)| *v).collect()).collect();
        let t = m[0][c] * dt(&sub);
        if c % 2 == 0 { r += t } else { r -= t }
    }
    r
}
pub fn det(xs: &[i64], n: i64) -> i64 {
    let n = n as usize;
    let m: Vec<Vec<i64>> = (0..n).map(|i| xs[i * n..(i + 1) * n].to_vec()).collect();
    dt(&m)
}
