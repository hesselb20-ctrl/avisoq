pub fn perfect_numbers(number: i64) -> String {
    if number < 1 { return "invalid".to_string(); }
    let mut s: i64 = 0;
    let mut d: i64 = 1;
    while d * d <= number {
        if number % d == 0 {
            s += d;
            let o = number / d;
            if o != d { s += o; }
        }
        d += 1;
    }
    s -= number;
    if s == number { "perfect".to_string() } else if s > number { "abundant".to_string() } else { "deficient".to_string() }
}
