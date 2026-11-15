fn is_vowel(c: u8) -> bool {
    matches!(c, b'a' | b'e' | b'i' | b'o' | b'u')
}

fn translate_word(word: &str) -> String {
    let lower = word.to_ascii_lowercase();
    let b = lower.as_bytes();
    let n = b.len();
    if n == 0 {
        return String::new();
    }
    // Rule 1: vowel start, or "xr" / "yt"
    if is_vowel(b[0]) || lower.starts_with("xr") || lower.starts_with("yt") {
        return format!("{}ay", word);
    }
    let first_vowel = b.iter().position(|&c| is_vowel(c)).unwrap_or(n);
    // Rule 3: consonants followed by "qu" (the u is the first vowel)
    let split = if first_vowel > 0
        && first_vowel < n
        && b[first_vowel - 1] == b'q'
        && b[first_vowel] == b'u'
    {
        first_vowel + 1
    } else if let Some(p) = b.iter().position(|&c| c == b'y') {
        // Rule 4: consonants followed by "y"
        if p > 0 && b[..p].iter().all(|&c| !is_vowel(c)) {
            p
        } else {
            // Rule 2: leading consonants
            first_vowel
        }
    } else {
        // Rule 2: leading consonants
        first_vowel
    };
    format!("{}{}ay", &word[split..], &word[..split])
}

pub fn pig_latin(phrase: &str) -> String {
    phrase
        .split_whitespace()
        .map(translate_word)
        .collect::<Vec<String>>()
        .join(" ")
}
