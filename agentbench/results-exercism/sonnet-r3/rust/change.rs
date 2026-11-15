pub fn change(coins: &[i64], target: i64) -> Vec<i64> {
    if target <= 0 { return Vec::new(); }
    let t = target as usize;
    let mut best: Vec<i64> = vec![i64::MAX; t + 1];
    let mut from: Vec<i64> = vec![0; t + 1];
    best[0] = 0;
    for a in 1..=t {
        for &c in coins {
            if c > 0 && (c as usize) <= a && best[a - c as usize] != i64::MAX {
                let v = best[a - c as usize] + 1;
                if v < best[a] { best[a] = v; from[a] = c; }
            }
        }
    }
    if best[t] == i64::MAX { return Vec::new(); }
    let mut res = Vec::new();
    let mut a = t;
    while a > 0 { res.push(from[a]); a -= from[a] as usize; }
    res.sort();
    res
}
