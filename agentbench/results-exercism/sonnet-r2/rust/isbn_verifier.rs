pub fn isbn_verifier(isbn: &str) -> bool {
    let c: Vec<char> = isbn.chars().filter(|&c| c != '-').collect();
    if c.len() != 10 {
        return false;
    }
    let mut sum = 0u32;
    for (i, &ch) in c.iter().enumerate() {
        let v = if ch.is_ascii_digit() {
            ch.to_digit(10).unwrap()
        } else if ch == 'X' && i == 9 {
            10
        } else {
            return false;
        };
        sum += v * (10 - i as u32);
    }
    sum % 11 == 0
}
