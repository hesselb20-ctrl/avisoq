use std::collections::BTreeMap;

pub fn ledger(ops: &str) -> String {
    let mut accounts: BTreeMap<String, i64> = BTreeMap::new();
    let mut rejected: i64 = 0;
    if !ops.is_empty() {
        for op in ops.split(';') {
            let w: Vec<&str> = op.split_whitespace().collect();
            let ok = apply(&mut accounts, &w);
            if !ok {
                rejected += 1;
            }
        }
    }
    let items: Vec<String> = accounts
        .iter()
        .map(|(k, v)| format!("{}={}", k, v))
        .collect();
    format!("{};rejected={}", items.join(","), rejected)
}

fn apply(acc: &mut BTreeMap<String, i64>, w: &[&str]) -> bool {
    match w {
        ["open", name] => {
            if acc.contains_key(*name) {
                return false;
            }
            acc.insert(name.to_string(), 0);
            true
        }
        ["deposit", name, amt] => {
            let a = match amt.parse::<i64>() {
                Ok(a) if a > 0 => a,
                _ => return false,
            };
            match acc.get_mut(*name) {
                Some(b) => {
                    *b += a;
                    true
                }
                None => false,
            }
        }
        ["withdraw", name, amt] => {
            let a = match amt.parse::<i64>() {
                Ok(a) if a > 0 => a,
                _ => return false,
            };
            match acc.get_mut(*name) {
                Some(b) if *b >= a => {
                    *b -= a;
                    true
                }
                _ => false,
            }
        }
        ["transfer", from, to, amt] => {
            let a = match amt.parse::<i64>() {
                Ok(a) if a > 0 => a,
                _ => return false,
            };
            if from == to {
                return false;
            }
            let fb = match acc.get(*from) {
                Some(b) => *b,
                None => return false,
            };
            if !acc.contains_key(*to) || fb < a {
                return false;
            }
            *acc.get_mut(*from).unwrap() -= a;
            *acc.get_mut(*to).unwrap() += a;
            true
        }
        ["close", name] => match acc.get(*name) {
            Some(0) => {
                acc.remove(*name);
                true
            }
            _ => false,
        },
        _ => false,
    }
}
