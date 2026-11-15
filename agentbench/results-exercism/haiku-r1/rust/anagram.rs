pub fn anagram(subject: &str, candidates: &[&str]) -> Vec<String> {
    let subj = subject.to_lowercase();
    let mut key: Vec<char> = subj.chars().collect();
    key.sort_unstable();

    candidates
        .iter()
        .filter(|cand| {
            let lc = cand.to_lowercase();
            if lc == subj {
                return false;
            }
            let mut k: Vec<char> = lc.chars().collect();
            k.sort_unstable();
            k == key
        })
        .map(|s| s.to_string())
        .collect()
}
