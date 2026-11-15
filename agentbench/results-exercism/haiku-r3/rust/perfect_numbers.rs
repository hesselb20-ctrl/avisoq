pub fn perfect_numbers(number: i64) -> String {
    if number <= 0 {
        panic!("only positive integers can be classified");
    }
    // Aliquot sum: sum of proper divisors (excluding the number itself).
    let mut sum: i64 = 0;
    let mut d: i64 = 1;
    while d * d <= number {
        if number % d == 0 {
            let e = number / d;
            if d != number {
                sum += d;
            }
            if e != d && e != number {
                sum += e;
            }
        }
        d += 1;
    }

    if sum == number {
        "perfect".to_string()
    } else if sum > number {
        "abundant".to_string()
    } else {
        "deficient".to_string()
    }
}
