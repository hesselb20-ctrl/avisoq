fn is_vowel(c: char) -> bool {
    matches!(c, 'a' | 'e' | 'i' | 'o' | 'u')
}

fn translate_word(word: &str) -> String {
    let chars: Vec<char> = word.chars().collect();
    let n = chars.len();
    if n == 0 {
        return String::new();
    }
    let lower: Vec<char> = chars.iter().map(|c| c.to_ascii_lowercase()).collect();
    let starts_with = |i: usize, pat: &str| -> bool {
        pat.chars()
            .enumerate()
            .all(|(k, p)| i + k < n && lower[i + k] == p)
    };

    let cut: usize = if is_vowel(lower[0]) || starts_with(0, "xr") || starts_with(0, "yt") {
        0
    } else {
        let mut i = 0;
        loop {
            if i >= n {
                break n;
            }
            if starts_with(i, "qu") {
                break i + 2;
            }
            if i > 0 && lower[i] == 'y' {
                break i;
            }
            if is_vowel(lower[i]) {
                break i;
            }
            i += 1;
        }
    };

    let mut out: String = chars[cut..].iter().collect();
    out.extend(chars[..cut].iter());
    out.push_str("ay");
    out
}

pub fn pig_latin(phrase: &str) -> String {
    phrase
        .split(' ')
        .map(translate_word)
        .collect::<Vec<String>>()
        .join(" ")
}
