pub fn isbn_verifier(isbn: &str) -> bool {
    let chars: Vec<char> = isbn.chars().filter(|&c| c != '-').collect();
    if chars.len() != 10 {
        return false;
    }

    let mut sum: u32 = 0;
    for (i, &c) in chars.iter().enumerate() {
        let value = if i == 9 && c == 'X' {
            10
        } else {
            match c.to_digit(10) {
                Some(d) => d,
                None => return false,
            }
        };
        sum += value * (10 - i as u32);
    }
    sum % 11 == 0
}
