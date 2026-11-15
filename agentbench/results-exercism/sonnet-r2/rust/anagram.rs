fn anagram_key(s: &str) -> Vec<char> {
    let mut v: Vec<char> = s.chars().flat_map(|c| c.to_lowercase()).collect();
    v.sort();
    v
}

pub fn anagram(subject: &str, candidates: &[&str]) -> Vec<String> {
    let lower: String = subject.chars().flat_map(|c| c.to_lowercase()).collect();
    let k = anagram_key(subject);
    candidates
        .iter()
        .filter(|c| {
            let cl: String = c.chars().flat_map(|x| x.to_lowercase()).collect();
            cl != lower && anagram_key(c) == k
        })
        .map(|c| c.to_string())
        .collect()
}
