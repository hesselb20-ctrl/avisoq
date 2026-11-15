fn pig_word(w: &str) -> String {
    let c: Vec<char> = w.chars().collect();
    let is_v = |ch: char| matches!(ch, 'a' | 'e' | 'i' | 'o' | 'u');
    if c.is_empty() {
        return String::new();
    }
    if is_v(c[0]) || w.starts_with("xr") || w.starts_with("yt") {
        return format!("{}ay", w);
    }
    let mut i = 0;
    while i < c.len() {
        if c[i] == 'q' && i + 1 < c.len() && c[i + 1] == 'u' {
            i += 2;
            break;
        }
        if is_v(c[i]) || (c[i] == 'y' && i > 0) {
            break;
        }
        i += 1;
    }
    let head: String = c[i..].iter().collect();
    let tail: String = c[..i].iter().collect();
    format!("{}{}ay", head, tail)
}

pub fn pig_latin(phrase: &str) -> String {
    phrase.split_whitespace().map(pig_word).collect::<Vec<_>>().join(" ")
}
