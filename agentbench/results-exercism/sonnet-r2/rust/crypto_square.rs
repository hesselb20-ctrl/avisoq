pub fn crypto_square(plaintext: &str) -> String {
    let chars: Vec<char> = plaintext
        .chars()
        .filter(|c| c.is_alphanumeric())
        .flat_map(|c| c.to_lowercase())
        .collect();
    let n = chars.len();
    if n == 0 {
        return String::new();
    }
    let mut c = 1usize;
    while c * c < n {
        c += 1;
    }
    let r = (n + c - 1) / c;
    let mut chunks: Vec<String> = Vec::new();
    for i in 0..c {
        let mut s = String::new();
        for j in 0..r {
            let idx = j * c + i;
            s.push(if idx < n { chars[idx] } else { ' ' });
        }
        chunks.push(s);
    }
    chunks.join(" ")
}
