pub fn caesar(s: &str, k: i64) -> String {
    let shift: i64 = k.rem_euclid(26);
    s.chars()
        .map(|c| {
            if c.is_ascii_lowercase() {
                let off = (c as i64 - 'a' as i64 + shift) % 26;
                char::from((b'a' as i64 + off) as u8)
            } else if c.is_ascii_uppercase() {
                let off = (c as i64 - 'A' as i64 + shift) % 26;
                char::from((b'A' as i64 + off) as u8)
            } else {
                c
            }
        })
        .collect()
}
