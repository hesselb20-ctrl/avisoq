pub fn crypto_square(plaintext: &str) -> String {
    let t: Vec<char> = plaintext
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .map(|c| c.to_ascii_lowercase())
        .collect();
    let n = t.len();
    if n == 0 {
        return String::new();
    }
    let mut c = 0usize;
    while c * c < n {
        c += 1;
    }
    let r = if c * (c - 1) >= n { c - 1 } else { c };
    let mut chunks: Vec<String> = Vec::new();
    for col in 0..c {
        let mut s = String::new();
        for row in 0..r {
            let idx = row * c + col;
            s.push(if idx < n { t[idx] } else { ' ' });
        }
        chunks.push(s);
    }
    chunks.join(" ")
}
