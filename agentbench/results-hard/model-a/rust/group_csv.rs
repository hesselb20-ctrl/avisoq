use std::collections::BTreeMap;
pub fn group_csv(s: &str) -> String {
    let mut map: BTreeMap<String, i128> = BTreeMap::new();
    let mut bad = 0;
    for row in s.split('|') {
        if row.trim().is_empty() { continue; }
        let f: Vec<&str> = row.split(',').collect();
        if f.len() != 2 { bad += 1; continue; }
        let k = f[0].trim(); let a = f[1].trim();
        let digits = a.strip_prefix('-').unwrap_or(a);
        if k.is_empty() || !k.bytes().all(|c| c.is_ascii_alphabetic())
            || digits.is_empty() || !digits.bytes().all(|c| c.is_ascii_digit()) { bad += 1; continue; }
        *map.entry(k.to_string()).or_insert(0) += a.parse::<i128>().unwrap_or(0);
    }
    let parts: Vec<String> = map.iter().map(|(k, v)| format!("{}={}", k, v)).collect();
    format!("{};bad={}", parts.join(","), bad)
}
