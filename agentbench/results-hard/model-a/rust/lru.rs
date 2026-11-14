use std::collections::{HashMap, BTreeMap};
pub fn lru(capacity: i64, ops: &[i64]) -> Vec<i64> {
    let mut map: HashMap<i64, (i64, u64)> = HashMap::new();
    let mut order: BTreeMap<u64, i64> = BTreeMap::new();
    let mut t = 0u64;
    let mut res = vec![];
    let mut i = 0;
    while i < ops.len() {
        if ops[i] == 0 {
            let k = ops[i + 1]; i += 2;
            t += 1;
            if let Some(e) = map.get_mut(&k) {
                res.push(e.0);
                order.remove(&e.1); e.1 = t; order.insert(t, k);
            } else { res.push(-1); }
        } else {
            let (k, v) = (ops[i + 1], ops[i + 2]); i += 3;
            t += 1;
            if let Some(e) = map.get_mut(&k) {
                order.remove(&e.1); *e = (v, t); order.insert(t, k);
            } else {
                map.insert(k, (v, t)); order.insert(t, k);
                if map.len() as i64 > capacity {
                    let (&ot, &ok) = order.iter().next().unwrap();
                    order.remove(&ot); map.remove(&ok);
                }
            }
        }
    }
    res
}
