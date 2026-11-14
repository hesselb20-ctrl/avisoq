pub fn reverse_words(s: &str) -> String {
    if s.is_empty() {
        return String::new();
    }
    let words: Vec<&str> = s.split(' ').collect();
    let reversed: Vec<&str> = words.into_iter().rev().collect();
    reversed.join(" ")
}
