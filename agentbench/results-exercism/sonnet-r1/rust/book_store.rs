pub fn book_store(basket: &[i64]) -> i64 {
    let mut counts: std::collections::HashMap<i64, i64> = std::collections::HashMap::new();
    for &b in basket {
        *counts.entry(b).or_insert(0) += 1;
    }
    let mut cs: Vec<i64> = counts.values().cloned().collect();
    // groups[k] = number of groups of size k
    let mut groups = [0i64; 6];
    loop {
        let size = cs.iter().filter(|&&c| c > 0).count();
        if size == 0 {
            break;
        }
        for c in cs.iter_mut() {
            if *c > 0 {
                *c -= 1;
            }
        }
        groups[size.min(5)] += 1;
    }
    let swap = groups[5].min(groups[3]);
    groups[5] -= swap;
    groups[3] -= swap;
    groups[4] += 2 * swap;
    let price = [0i64, 800, 1520, 2160, 2560, 3000];
    (1..=5).map(|k| groups[k] * price[k]).sum()
}
