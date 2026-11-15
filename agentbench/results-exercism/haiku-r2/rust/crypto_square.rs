pub fn crypto_square(plaintext: &str) -> String {
    let norm: Vec<char> = plaintext
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .map(|c| c.to_ascii_lowercase())
        .collect();
    let n = norm.len();
    if n == 0 {
        return String::new();
    }

    // smallest c with c * c >= n (c = ceil(sqrt(n)))
    let mut c = (n as f64).sqrt().ceil() as usize;
    while c * c < n {
        c += 1;
    }
    while c > 1 && (c - 1) * (c - 1) >= n {
        c -= 1;
    }
    // r = ceil(n / c); this always satisfies c - r <= 1 and c >= r
    let r = (n + c - 1) / c;

    let mut chunks: Vec<String> = Vec::with_capacity(c);
    for j in 0..c {
        let mut s = String::with_capacity(r);
        for i in 0..r {
            let idx = i * c + j;
            s.push(if idx < n { norm[idx] } else { ' ' });
        }
        chunks.push(s);
    }
    chunks.join(" ")
}
