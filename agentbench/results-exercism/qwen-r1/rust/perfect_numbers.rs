pub fn perfect_numbers(number: i64) -> String {
    if number <= 0 {
        return "deficient".to_string();
    }

    let n = number as i128;
    let mut sum: i128 = if n > 1 { 1 } else { 0 };

    let mut d: i128 = 2;
    while d * d <= n {
        if n % d == 0 {
            sum += d;
            let other = n / d;
            if other != d {
                sum += other;
            }
        }
        d += 1;
    }

    if sum == n {
        "perfect".to_string()
    } else if sum > n {
        "abundant".to_string()
    } else {
        "deficient".to_string()
    }
}
