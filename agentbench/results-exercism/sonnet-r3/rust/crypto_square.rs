pub fn crypto_square(plaintext: &str) -> String {
    let s: Vec<char> = plaintext.chars().filter(|c| c.is_ascii_alphanumeric()).map(|c| c.to_ascii_lowercase()).collect();
    let n = s.len();
    if n == 0 { return String::new(); }
    let mut c = 1usize;
    while c * c < n { c += 1; }
    let r = (n + c - 1) / c;
    let mut chunks = Vec::new();
    for j in 0..c {
        let mut t = String::new();
        for i in 0..r {
            let idx = i * c + j;
            t.push(if idx < n { s[idx] } else { ' ' });
        }
        chunks.push(t);
    }
    chunks.join(" ")
}
