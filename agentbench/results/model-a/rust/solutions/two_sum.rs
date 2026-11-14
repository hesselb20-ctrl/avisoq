use std::collections::HashMap;

pub fn two_sum(xs: &[i64], target: i64) -> Vec<i64> {
    let mut idx: HashMap<i64, Vec<usize>> = HashMap::new();
    for (i, &x) in xs.iter().enumerate() {
        idx.entry(x).or_insert_with(Vec::new).push(i);
    }
    for i in 0..xs.len() {
        let need = match target.checked_sub(xs[i]) {
            Some(v) => v,
            None => continue,
        };
        if let Some(list) = idx.get(&need) {
            // list is sorted ascending; find first index > i
            let pos = list.partition_point(|&j| j <= i);
            if pos < list.len() {
                return vec![i as i64, list[pos] as i64];
            }
        }
    }
    Vec::new()
}
