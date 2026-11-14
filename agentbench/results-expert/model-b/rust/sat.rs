pub fn sat(n: i64, clauses: &[i64]) -> Vec<i64> {
    let n = if n < 0 { 0 } else { n as usize };
    let mut cls: Vec<Vec<i64>> = Vec::new();
    let mut cur: Vec<i64> = Vec::new();
    for &x in clauses.iter() {
        if x == 0 {
            cls.push(std::mem::take(&mut cur));
        } else {
            cur.push(x);
        }
    }
    if !cur.is_empty() {
        cls.push(cur);
    }
    for x in 0u64..(1u64 << n) {
        let bit_of = |k: usize| -> bool { ((x >> (n - k)) & 1) == 1 };
        let lit_true = |v: i64| -> bool {
            let k = v.unsigned_abs() as usize;
            if v > 0 {
                bit_of(k)
            } else {
                !bit_of(k)
            }
        };
        if cls.iter().all(|c| c.iter().any(|&v| lit_true(v))) {
            return (1..=n).map(|k| if bit_of(k) { 1 } else { 0 }).collect();
        }
    }
    vec![-1]
}
