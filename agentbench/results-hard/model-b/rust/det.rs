fn det_rec(m: &[Vec<i128>]) -> i128 {
    let n = m.len();
    if n == 0 {
        return 1;
    }
    if n == 1 {
        return m[0][0];
    }
    let mut total: i128 = 0;
    for c in 0..n {
        if m[0][c] == 0 {
            continue;
        }
        let minor: Vec<Vec<i128>> = (1..n)
            .map(|r| (0..n).filter(|&k| k != c).map(|k| m[r][k]).collect())
            .collect();
        let sign: i128 = if c % 2 == 0 { 1 } else { -1 };
        total += sign * m[0][c] * det_rec(&minor);
    }
    total
}

pub fn det(xs: &[i64], n: i64) -> i64 {
    let n = n as usize;
    let m: Vec<Vec<i128>> = (0..n)
        .map(|r| (0..n).map(|c| xs[r * n + c] as i128).collect())
        .collect();
    det_rec(&m) as i64
}
