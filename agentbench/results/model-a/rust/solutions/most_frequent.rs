use std::collections::HashMap;

pub fn most_frequent(xs: &[i64]) -> i64 {
    let mut counts: HashMap<i64, usize> = HashMap::new();
    for &x in xs {
        *counts.entry(x).or_insert(0) += 1;
    }
    let mut best_v = xs[0];
    let mut best_c = 0usize;
    for (&v, &c) in counts.iter() {
        if c > best_c || (c == best_c && v < best_v) {
            best_c = c;
            best_v = v;
        }
    }
    best_v
}
