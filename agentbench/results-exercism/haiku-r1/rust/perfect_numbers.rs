pub fn perfect_numbers(number: i64) -> String {
    if number <= 0 {
        panic!("classification is only possible for positive integers");
    }
    // sum of all divisors, then remove the number itself to get the aliquot sum
    let mut sum: i64 = 0;
    let mut i: i64 = 1;
    while i * i <= number {
        if number % i == 0 {
            sum += i;
            let j = number / i;
            if j != i {
                sum += j;
            }
        }
        i += 1;
    }
    let aliquot = sum - number;
    if aliquot == number {
        "perfect".to_string()
    } else if aliquot > number {
        "abundant".to_string()
    } else {
        "deficient".to_string()
    }
}
