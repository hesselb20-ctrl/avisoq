use std::collections::BTreeMap;
pub fn ledger(ops: &str) -> String {
    let mut acc: BTreeMap<String, i128> = BTreeMap::new();
    let mut rej = 0;
    if !ops.is_empty() {
        for op in ops.split(';') {
            let w: Vec<&str> = op.split(' ').filter(|x| !x.is_empty()).collect();
            let amt = |i: usize| -> Option<i128> { w.get(i).and_then(|a| a.parse::<i128>().ok()) };
            let ok = match w.first().copied() {
                Some("open") if w.len() == 2 => {
                    if acc.contains_key(w[1]) { false } else { acc.insert(w[1].to_string(), 0); true }
                }
                Some("deposit") if w.len() == 3 => match amt(2) {
                    Some(a) if a > 0 && acc.contains_key(w[1]) => { *acc.get_mut(w[1]).unwrap() += a; true }
                    _ => false,
                },
                Some("withdraw") if w.len() == 3 => match amt(2) {
                    Some(a) if a > 0 && acc.get(w[1]).map_or(false, |&b| b >= a) => { *acc.get_mut(w[1]).unwrap() -= a; true }
                    _ => false,
                },
                Some("transfer") if w.len() == 4 => match amt(3) {
                    Some(a) if a > 0 && w[1] != w[2] && acc.contains_key(w[2]) && acc.get(w[1]).map_or(false, |&b| b >= a) => {
                        *acc.get_mut(w[1]).unwrap() -= a; *acc.get_mut(w[2]).unwrap() += a; true
                    }
                    _ => false,
                },
                Some("close") if w.len() == 2 => {
                    if acc.get(w[1]) == Some(&0) { acc.remove(w[1]); true } else { false }
                }
                _ => false,
            };
            if !ok { rej += 1; }
        }
    }
    let parts: Vec<String> = acc.iter().map(|(k, v)| format!("{}={}", k, v)).collect();
    format!("{};rejected={}", parts.join(","), rej)
}
