pub fn anagram(subject: &str, candidates: &[&str]) -> Vec<String> {
    let lower = subject.to_lowercase();
    let mut key: Vec<char> = lower.chars().collect();
    key.sort();
    candidates
        .iter()
        .filter(|c| {
            let l = c.to_lowercase();
            if l == lower {
                return false;
            }
            let mut k: Vec<char> = l.chars().collect();
            k.sort();
            k == key
        })
        .map(|c| c.to_string())
        .collect()
}
