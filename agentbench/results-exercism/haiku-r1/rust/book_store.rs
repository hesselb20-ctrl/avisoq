use std::collections::HashMap;

// Price in cents of a group of k different books: k * 800 * (100 - discount) / 100.
fn group_price(k: usize) -> i64 {
    let discount: i64 = match k {
        1 => 0,
        2 => 5,
        3 => 10,
        4 => 20,
        _ => 25,
    };
    8 * (k as i64) * (100 - discount)
}

pub fn book_store(basket: &[i64]) -> i64 {
    let mut counts: HashMap<i64, i64> = HashMap::new();
    for &b in basket {
        *counts.entry(b).or_insert(0) += 1;
    }
    let mut v: Vec<i64> = counts.values().copied().collect();
    v.sort_unstable();
    let mut memo: HashMap<Vec<i64>, i64> = HashMap::new();
    best_price(v, &mut memo)
}

// counts: how many copies of each distinct title remain.
fn best_price(mut counts: Vec<i64>, memo: &mut HashMap<Vec<i64>, i64>) -> i64 {
    counts.retain(|&c| c > 0);
    counts.sort_unstable();
    if counts.is_empty() {
        return 0;
    }
    if let Some(&p) = memo.get(&counts) {
        return p;
    }
    let m = counts.len();
    let mut best = i64::MAX;
    for mask in 1u32..(1u32 << m) {
        let k = mask.count_ones() as usize;
        let mut next = counts.clone();
        for i in 0..m {
            if mask & (1u32 << i) != 0 {
                next[i] -= 1;
            }
        }
        let cost = group_price(k) + best_price(next, memo);
        if cost < best {
            best = cost;
        }
    }
    memo.insert(counts, best);
    best
}
