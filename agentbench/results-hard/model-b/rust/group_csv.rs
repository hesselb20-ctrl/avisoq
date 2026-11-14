use std::collections::BTreeMap;

fn parse_amount(s: &str) -> Option<i64> {
    let digits = s.strip_prefix('-').unwrap_or(s);
    if digits.is_empty() || !digits.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    s.parse::<i64>().ok()
}

pub fn group_csv(s: &str) -> String {
    let mut totals: BTreeMap<String, i64> = BTreeMap::new();
    let mut bad: i64 = 0;
    for row in s.split('|') {
        let row = row.trim_matches(' ');
        if row.is_empty() {
            continue;
        }
        let fields: Vec<&str> = row.split(',').collect();
        let mut good = false;
        if fields.len() == 2 {
            let key = fields[0].trim_matches(' ');
            let amt = fields[1].trim_matches(' ');
            if !key.is_empty() && key.bytes().all(|b| b.is_ascii_alphabetic()) {
                if let Some(v) = parse_amount(amt) {
                    *totals.entry(key.to_string()).or_insert(0) += v;
                    good = true;
                }
            }
        }
        if !good {
            bad += 1;
        }
    }
    let items: Vec<String> = totals.iter().map(|(k, v)| format!("{}={}", k, v)).collect();
    format!("{};bad={}", items.join(","), bad)
}
