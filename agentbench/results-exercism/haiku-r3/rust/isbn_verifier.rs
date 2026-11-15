pub fn isbn_verifier(isbn: &str) -> bool {
    let chars: Vec<char> = isbn.chars().filter(|&c| c != '-').collect();
    if chars.len() != 10 {
        return false;
    }
    let mut sum: i64 = 0;
    for (i, &c) in chars.iter().enumerate() {
        let value = match c {
            '0'..='9' => c as i64 - '0' as i64,
            'X' if i == 9 => 10,
            _ => return false,
        };
        sum += value * (10 - i as i64);
    }
    sum % 11 == 0
}
