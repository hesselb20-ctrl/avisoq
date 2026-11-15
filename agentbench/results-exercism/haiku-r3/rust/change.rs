pub fn change(coins: &[i64], target: i64) -> Vec<i64> {
    if target <= 0 {
        return Vec::new();
    }
    let t = target as usize;
    const INF: usize = usize::MAX;

    let mut cs: Vec<i64> = coins.iter().cloned().filter(|&c| c > 0).collect();
    cs.sort_unstable();
    cs.dedup();

    let mut best = vec![INF; t + 1];
    let mut last = vec![0i64; t + 1];
    best[0] = 0;
    for x in 1..=t {
        for &c in &cs {
            if c > x as i64 {
                break;
            }
            let prev = best[x - c as usize];
            if prev != INF && prev + 1 < best[x] {
                best[x] = prev + 1;
                last[x] = c;
            }
        }
    }

    if best[t] == INF {
        return Vec::new();
    }
    let mut result = Vec::with_capacity(best[t]);
    let mut x = t;
    while x > 0 {
        result.push(last[x]);
        x -= last[x] as usize;
    }
    result.sort_unstable();
    result
}
