pub fn luhn(value: &str) -> bool {
    let mut digits = Vec::new();

    for ch in value.chars() {
        if ch == ' ' {
            continue;
        }

        match ch.to_digit(10) {
            Some(d) => digits.push(d),
            None => return false,
        }
    }

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
                if doubled > 9 {
                    doubled - 9
                } else {
                    doubled
                }
            } else {
                d
            }
        })
        .sum();

    sum % 10 == 0
}
