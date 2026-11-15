fn sorted_key(word: &str) -> Vec<u8> {
    let mut key: Vec<u8> = word.bytes().map(|b| b.to_ascii_lowercase()).collect();
    key.sort_unstable();
    key
}

pub fn anagram(subject: &str, candidates: &[&str]) -> Vec<String> {
    let subject_lower = subject.to_ascii_lowercase();
    let subject_key = sorted_key(&subject_lower);
    candidates
        .iter()
        .filter(|cand| {
            let lower = cand.to_ascii_lowercase();
            lower != subject_lower && sorted_key(&lower) == subject_key
        })
        .map(|cand| cand.to_string())
        .collect()
}
