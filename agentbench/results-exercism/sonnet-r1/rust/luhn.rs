pub fn luhn(value: &str) -> bool {
    let mut digits: Vec<u32> = Vec::new();
    for c in value.chars() {
        if c == ' ' {
            continue;
        }
        if c.is_ascii_digit() {
            digits.push(c as u32 - '0' as u32);
        } else {
            return false;
        }
    }
    if digits.len() <= 1 {
        return false;
    }
    let mut sum = 0;
    for (i, &d) in digits.iter().rev().enumerate() {
        if i % 2 == 1 {
            let x = d * 2;
            sum += if x > 9 { x - 9 } else { x };
        } else {
            sum += d;
        }
    }
    sum % 10 == 0
}
