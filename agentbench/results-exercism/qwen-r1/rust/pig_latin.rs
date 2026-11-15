pub fn pig_latin(phrase: &str) -> String {
    phrase
        .split_whitespace()
        .map(transform_word)
        .collect::<Vec<_>>()
        .join(" ")
}

fn is_vowel(c: char) -> bool {
    matches!(c, 'a' | 'e' | 'i' | 'o' | 'u')
}

fn transform_word(word: &str) -> String {
    let chars: Vec<char> = word.chars().collect();
    let len = chars.len();

    if len == 0 {
        return String::new();
    }

    if is_vowel(chars[0])
        || (len >= 2 && chars[0] == 'x' && chars[1] == 'r')
        || (len >= 2 && chars[0] == 'y' && chars[1] == 't')
    {
        return format!("{}ay", word);
    }

    let mut split = len;

    for i in 1..len {
        if is_vowel(chars[i]) {
            if chars[i] == 'q' && i + 1 < len && chars[i + 1] == 'u' {
                split = i + 2;
            } else {
                split = i;
            }
            break;
        }

        if chars[i] == 'y' {
            split = i;
            break;
        }
    }

    let front: String = chars[..split].iter().collect();
    let back: String = chars[split..].iter().collect();

    format!("{}{}ay", back, front)
}
