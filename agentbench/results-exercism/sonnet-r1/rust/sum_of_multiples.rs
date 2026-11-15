use std::collections::HashSet;
pub fn sum_of_multiples(factors: &[i64], limit: i64) -> i64 {
    let mut set: HashSet<i64> = HashSet::new();
    for &f in factors {
        if f <= 0 {
            continue;
        }
        let mut m = f;
        while m < limit {
            set.insert(m);
            m += f;
        }
    }
    set.iter().sum()
}
