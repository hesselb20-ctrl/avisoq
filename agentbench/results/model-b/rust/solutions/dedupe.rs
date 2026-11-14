use std::collections::HashSet;

pub fn dedupe(xs: &[i64]) -> Vec<i64> {
    let mut seen: HashSet<i64> = HashSet::new();
    let mut out: Vec<i64> = Vec::new();
    for &x in xs {
        if seen.insert(x) {
            out.push(x);
        }
    }
    out
}
