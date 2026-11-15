use std::collections::HashMap;

fn book_solve(counts: Vec<i64>, memo: &mut HashMap<Vec<i64>, i64>) -> i64 {
    let mut c: Vec<i64> = counts.into_iter().filter(|&x| x > 0).collect();
    c.sort_by(|a, b| b.cmp(a));
    if c.is_empty() {
        return 0;
    }
    if let Some(&v) = memo.get(&c) {
        return v;
    }
    let price = [0i64, 800, 1520, 2160, 2560, 3000];
    let mut best = i64::MAX;
    for k in 1..=c.len().min(5) {
        let mut next = c.clone();
        for i in 0..k {
            next[i] -= 1;
        }
        let v = price[k] + book_solve(next, memo);
        if v < best {
            best = v;
        }
    }
    memo.insert(c, best);
    best
}

pub fn book_store(basket: &[i64]) -> i64 {
    let mut m: HashMap<i64, i64> = HashMap::new();
    for &b in basket {
        *m.entry(b).or_insert(0) += 1;
    }
    let counts: Vec<i64> = m.values().cloned().collect();
    let mut memo = HashMap::new();
    book_solve(counts, &mut memo)
}
