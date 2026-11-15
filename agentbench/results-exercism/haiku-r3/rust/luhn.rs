pub fn luhn(value: &str) -> bool {
    let digits: Vec<u32> = {
        let mut v = Vec::new();
        for c in value.chars() {
            if c == ' ' {
                continue;
            }
            match c.to_digit(10) {
                Some(d) => v.push(d),
                None => return false,
            }
        }
        v
    };
    if digits.len() <= 1 {
        return false;
    }
    let sum: u32 = digits
        .iter()
        .rev()
        .enumerate()
        .map(|(i, &d)| {
            if i % 2 == 1 {
                let doubled = d * 2;
                if doubled > 9 { doubled - 9 } else { doubled }
            } else {
                d
            }
        })
        .sum();
    sum % 10 == 0
}
