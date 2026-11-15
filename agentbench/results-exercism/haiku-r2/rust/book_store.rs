use std::collections::HashMap;

// Prices are in cents. One book costs 800 cents.
// A group of k different books costs k * 800 * (100 - discount) / 100 cents,
// which is always an integer as 8 * k * (100 - discount).
pub fn book_store(basket: &[i64]) -> i64 {
    let mut counts = [0i64; 5];
    for &book in basket {
        if !(1..=5).contains(&book) {
            panic!("book id must be between 1 and 5");
        }
        counts[(book - 1) as usize] += 1;
    }
    let mut memo: HashMap<[i64; 5], i64> = HashMap::new();
    best_price(counts, &mut memo)
}

fn discount_percent(group_size: usize) -> i64 {
    match group_size {
        0 | 1 => 0,
        2 => 5,
        3 => 10,
        4 => 20,
        _ => 25,
    }
}

fn best_price(counts: [i64; 5], memo: &mut HashMap<[i64; 5], i64>) -> i64 {
    if counts.iter().all(|&c| c == 0) {
        return 0;
    }
    if let Some(&cached) = memo.get(&counts) {
        return cached;
    }

    let mut best = i64::MAX;
    // Every non-empty subset of titles that still has copies forms one group.
    for mask in 1u32..32 {
        let mut next = counts;
        let mut size = 0usize;
        let mut possible = true;
        for i in 0..5 {
            if mask & (1 << i) != 0 {
                if next[i] == 0 {
                    possible = false;
                    break;
                }
                next[i] -= 1;
                size += 1;
            }
        }
        if !possible {
            continue;
        }
        let group_cost = 8 * size as i64 * (100 - discount_percent(size));
        let cost = group_cost + best_price(next, memo);
        if cost < best {
            best = cost;
        }
    }

    memo.insert(counts, best);
    best
}
