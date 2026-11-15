fn is_v(c: u8) -> bool { matches!(c, b'a' | b'e' | b'i' | b'o' | b'u') }

fn pig_word(w: &str) -> String {
    let b = w.as_bytes();
    if b.is_empty() { return String::new(); }
    if is_v(b[0]) || w.starts_with("xr") || w.starts_with("yt") {
        return format!("{}ay", w);
    }
    let mut i = 0;
    while i < b.len() {
        if is_v(b[i]) { break; }
        if b[i] == b'q' && i + 1 < b.len() && b[i + 1] == b'u' { i += 2; break; }
        if b[i] == b'y' && i > 0 { break; }
        i += 1;
    }
    format!("{}{}ay", &w[i..], &w[..i])
}

pub fn pig_latin(phrase: &str) -> String {
    phrase.split_whitespace().map(pig_word).collect::<Vec<_>>().join(" ")
}
