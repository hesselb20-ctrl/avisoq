pub fn perfect_numbers(number: i64) -> String {
    if number < 1 {
        return "invalid".to_string();
    }
    let mut sum = 0i64;
    let mut d = 1i64;
    while d * d <= number {
        if number % d == 0 {
            sum += d;
            let o = number / d;
            if o != d {
                sum += o;
            }
        }
        d += 1;
    }
    sum -= number;
    let s = if sum == number {
        "perfect"
    } else if sum > number {
        "abundant"
    } else {
        "deficient"
    };
    s.to_string()
}
