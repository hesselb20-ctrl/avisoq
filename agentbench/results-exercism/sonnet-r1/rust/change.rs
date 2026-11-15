pub fn change(coins: &[i64], target: i64) -> Vec<i64> {
    if target <= 0 {
        return Vec::new();
    }
    let t = target as usize;
    let inf = usize::MAX;
    let mut best = vec![inf; t + 1];
    let mut from = vec![0i64; t + 1];
    best[0] = 0;
    for a in 1..=t {
        for &c in coins {
            if c <= 0 || (c as usize) > a {
                continue;
            }
            let p = a - c as usize;
            if best[p] != inf && best[p] + 1 < best[a] {
                best[a] = best[p] + 1;
                from[a] = c;
            }
        }
    }
    if best[t] == inf {
        return Vec::new();
    }
    let mut res = Vec::new();
    let mut a = t;
    while a > 0 {
        res.push(from[a]);
        a -= from[a] as usize;
    }
    res.sort();
    res
}
