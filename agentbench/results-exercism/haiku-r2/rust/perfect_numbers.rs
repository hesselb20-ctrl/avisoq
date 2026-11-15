pub fn perfect_numbers(number: i64) -> String {
    if number <= 0 {
        panic!("Classification is only possible for positive integers.");
    }

    // aliquot sum: sum of proper divisors (excluding the number itself)
    let mut aliquot: i64 = 0;
    let mut i: i64 = 1;
    while i * i <= number {
        if number % i == 0 {
            let j = number / i;
            if i < number {
                aliquot += i;
            }
            if j != i && j < number {
                aliquot += j;
            }
        }
        i += 1;
    }

    if aliquot == number {
        "perfect".to_string()
    } else if aliquot > number {
        "abundant".to_string()
    } else {
        "deficient".to_string()
    }
}
