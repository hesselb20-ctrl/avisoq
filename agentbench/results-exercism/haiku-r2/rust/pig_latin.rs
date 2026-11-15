pub fn pig_latin(phrase: &str) -> String {
    phrase
        .split(' ')
        .map(translate_word)
        .collect::<Vec<String>>()
        .join(" ")
}

fn is_vowel(c: char) -> bool {
    matches!(c, 'a' | 'e' | 'i' | 'o' | 'u')
}

fn translate_word(word: &str) -> String {
    if word.is_empty() {
        return String::new();
    }
    let lower: Vec<char> = word.chars().map(|c| c.to_ascii_lowercase()).collect();
    let chars: Vec<char> = word.chars().collect();
    let lower_str: String = lower.iter().collect();

    // Index where the moved head ends (the head is chars[..split]).
    let split = if lower_str.starts_with("xr") || lower_str.starts_with("yt") {
        0
    } else {
        // first vowel; 'y' counts as a vowel only when it is not the first letter
        let mut found = lower.len();
        for (i, &c) in lower.iter().enumerate() {
            if is_vowel(c) || (c == 'y' && i > 0) {
                found = i;
                break;
            }
        }
        // "qu": the u belongs to the head as well
        if found > 0 && found < lower.len() && lower[found] == 'u' && lower[found - 1] == 'q' {
            found + 1
        } else {
            found
        }
    };

    let mut out: String = chars[split..].iter().collect();
    out.extend(chars[..split].iter());
    out.push_str("ay");
    out
}
