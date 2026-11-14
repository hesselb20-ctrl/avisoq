pub fn reverse_words(s: &str) -> String {
    if s.is_empty() {
        return String::new();
    }
    let mut parts: Vec<&str> = s.split(' ').collect();
    parts.reverse();
    parts.join(" ")
}
