pub fn luhn(value: &str) -> bool {
    let mut digits: Vec<u32> = Vec::new();
    for c in value.chars() {
        if c == ' ' {
            continue;
        }
        if !c.is_ascii_digit() {
            return false;
        }
        digits.push(c.to_digit(10).unwrap());
    }
    if digits.len() <= 1 {
        return false;
    }

    let mut sum: u32 = 0;
    for (i, &d) in digits.iter().rev().enumerate() {
        let mut v = if i % 2 == 1 { d * 2 } else { d };
        if v > 9 {
            v -= 9;
        }
        sum += v;
    }
    sum % 10 == 0
}
