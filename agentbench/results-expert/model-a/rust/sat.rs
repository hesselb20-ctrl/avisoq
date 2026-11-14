pub fn sat(n: i64, clauses: &[i64]) -> Vec<i64> {
    let mut cl: Vec<Vec<i64>> = Vec::new();
    let mut cur: Vec<i64> = Vec::new();
    for &x in clauses {
        if x == 0 {
            cl.push(std::mem::take(&mut cur));
        } else {
            cur.push(x);
        }
    }
    let n = n.max(0) as usize;
    for mask in 0u64..(1u64 << n) {
        let val = |v: i64| -> bool { (mask >> (n as i64 - v)) & 1 == 1 };
        let ok = cl.iter().all(|c| {
            c.iter().any(|&l| {
                let v = l.abs();
                if v < 1 || v as usize > n {
                    return false;
                }
                if l > 0 {
                    val(v)
                } else {
                    !val(v)
                }
            })
        });
        if ok {
            return (1..=n as i64).map(|v| val(v) as i64).collect();
        }
    }
    vec![-1]
}
