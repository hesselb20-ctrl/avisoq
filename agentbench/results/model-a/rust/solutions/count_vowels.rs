pub fn count_vowels(s: &str) -> i64 {
    s.chars()
        .filter(|c| matches!(c, 'a' | 'e' | 'i' | 'o' | 'u' | 'A' | 'E' | 'I' | 'O' | 'U'))
        .count() as i64
}
