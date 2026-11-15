pub fn line_up(name: &str, number: i64) -> String {
    let suffix = ordinal_suffix(number);
    format!(
        "{}, you are the {}{} customer we serve today. Thank you!",
        name, number, suffix
    )
}

fn ordinal_suffix(number: i64) -> &'static str {
    let last_two = number.rem_euclid(100);
    let last_one = number.rem_euclid(10);

    if (11..=13).contains(&last_two) {
        "th"
    } else {
        match last_one {
            1 => "st",
            2 => "nd",
            3 => "rd",
            _ => "th",
        }
    }
}
