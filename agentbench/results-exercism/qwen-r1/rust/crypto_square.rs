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

    let mut r = 1;
    while (r as u64) * (r as u64) < n as u64 {
        r += 1;
    }

    let c = (n + r - 1) / r;

    let mut chunks = Vec::with_capacity(c);
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
