pub fn change(coins: &[i64], target: i64) -> Vec<i64> {
    if target <= 0 {
        return Vec::new();
    }
    let t = target as usize;
    let usable: Vec<i64> = coins.iter().cloned().filter(|&c| c > 0).collect();

    const UNREACHABLE: usize = usize::MAX;
    let mut best = vec![UNREACHABLE; t + 1];
    let mut last = vec![0i64; t + 1];
    best[0] = 0;

    for v in 1..=t {
        for &c in &usable {
            if c > v as i64 {
                continue;
            }
            let prev = best[v - c as usize];
            if prev != UNREACHABLE && prev + 1 < best[v] {
                best[v] = prev + 1;
                last[v] = c;
            }
        }
    }

    if best[t] == UNREACHABLE {
        return Vec::new();
    }

    let mut result = Vec::with_capacity(best[t]);
    let mut v = t;
    while v > 0 {
        let c = last[v];
        result.push(c);
        v -= c as usize;
    }
    result.sort();
    result
}
