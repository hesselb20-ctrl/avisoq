pub fn crypto_square(plaintext: &str) -> String {
    let normalized: Vec<char> = plaintext
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .map(|c| c.to_ascii_lowercase())
        .collect();
    let n = normalized.len();
    if n == 0 {
        return String::new();
    }
    // smallest c with c * c >= n
    let mut c = 1usize;
    while c * c < n {
        c += 1;
    }
    // r = c - 1 when that still fits, otherwise r = c
    let r = if c * (c - 1) >= n { c - 1 } else { c };

    let mut chunks: Vec<String> = Vec::with_capacity(c);
    for col in 0..c {
        let mut chunk = String::with_capacity(r);
        for row in 0..r {
            let idx = row * c + col;
            if idx < n {
                chunk.push(normalized[idx]);
            } else {
                chunk.push(' ');
            }
        }
        chunks.push(chunk);
    }
    chunks.join(" ")
}
