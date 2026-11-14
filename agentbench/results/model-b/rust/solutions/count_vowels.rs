pub fn count_vowels(s: &str) -> i64 {
    s.chars()
        .filter(|c| matches!(c.to_ascii_lowercase(), 'a' | 'e' | 'i' | 'o' | 'u'))
        .count() as i64
}
