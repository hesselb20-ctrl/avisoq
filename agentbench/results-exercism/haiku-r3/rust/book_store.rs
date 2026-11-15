use std::collections::HashMap;

// Cost in cents of a group of k different books: k * 800 * (100 - discount) / 100.
fn group_cost(k: i64) -> i64 {
    let discount = match k {
        1 => 0,
        2 => 5,
        3 => 10,
        4 => 20,
        _ => 25,
    };
    8 * k * (100 - discount)
}

// counts[i] = number of copies of book i+1 still to be placed.
fn best(counts: [i64; 5], memo: &mut HashMap<[i64; 5], i64>) -> i64 {
    let mut key = counts;
    key.sort_unstable_by(|a, b| b.cmp(a));
    if key[0] == 0 {
        return 0;
    }
    if let Some(&v) = memo.get(&key) {
        return v;
    }

    let mut result = i64::MAX;
    for mask in 1u32..32 {
        let mut next = key;
        let mut ok = true;
        for i in 0..5 {
            if mask & (1 << i) != 0 {
                if next[i] == 0 {
                    ok = false;
                    break;
                }
                next[i] -= 1;
            }
        }
        if !ok {
            continue;
        }
        let cost = group_cost(mask.count_ones() as i64) + best(next, memo);
        if cost < result {
            result = cost;
        }
    }

    memo.insert(key, result);
    result
}

pub fn book_store(basket: &[i64]) -> i64 {
    let mut counts = [0i64; 5];
    for &b in basket {
        if (1..=5).contains(&b) {
            counts[(b - 1) as usize] += 1;
        }
    }
    let mut memo = HashMap::new();
    best(counts, &mut memo)
}
