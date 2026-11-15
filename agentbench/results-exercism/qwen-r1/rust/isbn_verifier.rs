pub fn isbn_verifier(isbn: &str) -> bool {
    let mut digits: Vec<u32> = Vec::with_capacity(10);

    for c in isbn.chars() {
        if c == '-' {
            continue;
        }

        let value = match c {
            '0'..='9' => c as u32 - '0' as u32,
            'X' => 10,
            _ => return false,
        };

        digits.push(value);
    }

    if digits.len() != 10 {
        return false;
    }

    if digits.iter().take(9).any(|&d| d == 10) {
        return false;
    }

    let sum: u32 = digits
        .iter()
        .enumerate()
        .map(|(i, &d)| d * (10 - i as u32))
        .sum();

    sum % 11 == 0
}
