use std::collections::{BTreeMap, HashMap};

pub fn lru(capacity: i64, ops: &[i64]) -> Vec<i64> {
    let cap = capacity.max(1) as usize;
    // key -> (value, stamp of last use)
    let mut map: HashMap<i64, (i64, u64)> = HashMap::new();
    // stamp -> key, ordered so the first entry is the least recently used
    let mut order: BTreeMap<u64, i64> = BTreeMap::new();
    let mut clock: u64 = 0;
    let mut out: Vec<i64> = Vec::new();
    let mut i = 0usize;
    while i < ops.len() {
        let kind = ops[i];
        if kind == 0 {
            let key = ops.get(i + 1).copied().unwrap_or(0);
            i += 2;
            match map.get(&key).copied() {
                Some((val, stamp)) => {
                    out.push(val);
                    clock += 1;
                    order.remove(&stamp);
                    order.insert(clock, key);
                    map.insert(key, (val, clock));
                }
                None => out.push(-1),
            }
        } else {
            let key = ops.get(i + 1).copied().unwrap_or(0);
            let val = ops.get(i + 2).copied().unwrap_or(0);
            i += 3;
            clock += 1;
            if let Some((_, stamp)) = map.get(&key).copied() {
                order.remove(&stamp);
            }
            order.insert(clock, key);
            map.insert(key, (val, clock));
            if map.len() > cap {
                let (&old_stamp, &old_key) = order.iter().next().unwrap();
                order.remove(&old_stamp);
                map.remove(&old_key);
            }
        }
    }
    out
}
