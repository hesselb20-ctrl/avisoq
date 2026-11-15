pub fn anagram(subject: &str, candidates: &[&str]) -> Vec<String> {
    let subj_lower = subject.to_lowercase();
    let subj_key = sorted_chars(&subj_lower);

    candidates
        .iter()
        .filter(|cand| {
            let lower = cand.to_lowercase();
            lower != subj_lower && sorted_chars(&lower) == subj_key
        })
        .map(|cand| cand.to_string())
        .collect()
}

fn sorted_chars(s: &str) -> Vec<char> {
    let mut v: Vec<char> = s.chars().collect();
    v.sort();
    v
}
