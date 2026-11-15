pub fn anagram(subject: &str, candidates: &[&str]) -> Vec<String> {
    let lo = subject.to_lowercase();
    let mut key: Vec<char> = lo.chars().collect();
    key.sort();
    let mut out = Vec::new();
    for c in candidates {
        let cl = c.to_lowercase();
        if cl == lo { continue; }
        let mut k: Vec<char> = cl.chars().collect();
        k.sort();
        if k == key { out.push(c.to_string()); }
    }
    out
}
