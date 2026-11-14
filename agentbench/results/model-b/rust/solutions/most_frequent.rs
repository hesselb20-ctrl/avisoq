use std::collections::BTreeMap;

pub fn most_frequent(xs: &[i64]) -> i64 {
    let mut counts: BTreeMap<i64, usize> = BTreeMap::new();
    for &x in xs {
        *counts.entry(x).or_insert(0) += 1;
    }
    // BTreeMap iterates in ascending key order, so a strictly greater count
    // is needed to replace the current best; ties keep the smaller value.
    let mut best_value: i64 = 0;
    let mut best_count: usize = 0;
    for (&value, &count) in counts.iter() {
        if count > best_count {
            best_count = count;
            best_value = value;
        }
    }
    best_value
}
