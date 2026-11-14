pub fn sat(n: i64, clauses: &[i64]) -> Vec<i64> {
    let n = n.max(0) as usize;
    let mut cl: Vec<Vec<i64>> = Vec::new();
    let mut cur: Vec<i64> = Vec::new();
    for &x in clauses {
        if x == 0 {
            cl.push(std::mem::take(&mut cur));
        } else {
            cur.push(x);
        }
    }
    if cl.iter().any(|c| c.is_empty()) {
        return vec![-1];
    }
    let total: u64 = 1u64 << n;
    for mask in 0..total {
        let val = |v: usize| -> bool { v >= 1 && v <= n && (mask >> (n - v)) & 1 == 1 };
        let ok = cl.iter().all(|c| {
            c.iter().any(|&l| {
                if l > 0 {
                    val(l as usize)
                } else {
                    let v = (-l) as usize;
                    v >= 1 && v <= n && !val(v)
                }
            })
        });
        if ok {
            return (1..=n).map(|v| if val(v) { 1 } else { 0 }).collect();
        }
    }
    vec![-1]
}
