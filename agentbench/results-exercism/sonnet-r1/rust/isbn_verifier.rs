pub fn isbn_verifier(isbn: &str) -> bool {
    let chars: Vec<char> = isbn.chars().filter(|&c| c != '-').collect();
    if chars.len() != 10 {
        return false;
    }
    let mut sum = 0u32;
    for (i, &c) in chars.iter().enumerate() {
        let v = if c.is_ascii_digit() {
            c as u32 - '0' as u32
        } else if c == 'X' && i == 9 {
            10
        } else {
            return false;
        };
        sum += v * (10 - i as u32);
    }
    sum % 11 == 0
}
