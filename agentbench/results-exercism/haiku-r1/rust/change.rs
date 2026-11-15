pub fn change(coins: &[i64], target: i64) -> Vec<i64> {
    if target <= 0 {
        return Vec::new();
    }
    let t = target as usize;
    const INF: usize = usize::MAX;
    let mut best = vec![INF; t + 1];
    let mut last = vec![0i64; t + 1];
    best[0] = 0;
    for v in 1..=t {
        for &coin in coins {
            if coin <= 0 || coin as usize > v {
                continue;
            }
            let prev = best[v - coin as usize];
            if prev != INF && prev + 1 < best[v] {
                best[v] = prev + 1;
                last[v] = coin;
            }
        }
    }
    if best[t] == INF {
        return Vec::new();
    }
    let mut result = Vec::with_capacity(best[t]);
    let mut v = t;
    while v > 0 {
        let coin = last[v];
        result.push(coin);
        v -= coin as usize;
    }
    result.sort();
    result
}
