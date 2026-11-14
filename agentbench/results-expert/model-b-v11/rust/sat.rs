// Variable v (1-based) is bit (n - v) of an assignment integer x, so that
// increasing x is the lexicographic order with 0 before 1 read from variable 1.

pub fn sat(n: i64, clauses: &[i64]) -> Vec<i64> {
    let n = if n < 0 { 0 } else { n as usize };
    // (positive-literal mask, negative-literal mask) per clause.
    let mut masks: Vec<(u32, u32)> = Vec::new();
    let mut unsat = false;
    let mut pos: u32 = 0;
    let mut neg: u32 = 0;
    let mut count = 0usize;
    for &v in clauses {
        if v == 0 {
            if count == 0 {
                unsat = true;
            }
            masks.push((pos, neg));
            pos = 0;
            neg = 0;
            count = 0;
        } else {
            let var = v.unsigned_abs() as usize;
            if var >= 1 && var <= n {
                let bit = 1u32 << (n - var);
                if v > 0 {
                    pos |= bit;
                } else {
                    neg |= bit;
                }
            }
            count += 1;
        }
    }
    if unsat {
        return vec![-1];
    }
    let total: u64 = 1u64 << n;
    for x in 0..total {
        let x = x as u32;
        let mut ok = true;
        for &(p, q) in &masks {
            if (x & p) == 0 && ((!x) & q) == 0 {
                ok = false;
                break;
            }
        }
        if ok {
            let mut res = Vec::with_capacity(n);
            for var in 1..=n {
                res.push(((x >> (n - var)) & 1) as i64);
            }
            return res;
        }
    }
    vec![-1]
}
